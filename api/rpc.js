import {rpc,changesOf,ApiError} from '../lib/supabase.js';
import {authAction,limit} from '../lib/auth.js';
import {authenticate} from '../lib/session.js';
import {createEngine} from '../lib/engine.js';
import {uploadImage} from '../lib/media.js';
import {noStore,errorResponse,validatePost} from '../lib/http.js';
const AUTH=new Set(['challenge','register','login','logout','me','updateProfile','changePassword']);
const BUSINESS=new Set(['orders','createOrder','confirmPayment','requestRevision','completeOrder','adminData','uploadMedia','saveProduct','saveCategory','deleteProduct','updateCategory','deleteCategory','savePreview','deletePreview','reorderPreviews','updateOrder','saveSettings']);
export default async function handler(req,res){
 noStore(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Gunakan POST.'});}
 try{
  const p=validatePost(req);
  if(AUTH.has(p.action))return res.status(200).json({ok:true,data:await authAction(req,res,p)});
  if(!BUSINESS.has(p.action))throw new ApiError('Aksi tidak dikenal.');
  const auth=await authenticate(req,res);
  if(p.action==='createOrder')await limit(req,'orders',auth.user.id,12,3600);
  if(p.action==='uploadMedia')await limit(req,'uploads',auth.user.id,100,3600);
  let uploaded=null;
  for(let attempt=0;attempt<4;attempt++){
   const snapshot=await rpc('jh_snapshot',{p_user_id:auth.user.id,p_admin:auth.user.role==='admin'});
   const engine=createEngine(snapshot.records,auth.user);
   let data=engine.run(p); // Re-validates ownership, current price, and status on every retry.
   if(p.action==='uploadMedia'&&data.bytes){uploaded??=await uploadImage(data);engine.append('Media',uploaded.row);data={id:uploaded.id,ref:uploaded.ref};}
   const changes=changesOf(engine);
   if(!changes.length||await rpc('jh_commit',{p_expected_revision:snapshot.revision,p_changes:changes}))return res.status(200).json({ok:true,data});
  }
  throw new ApiError('Data sedang diperbarui pengguna lain. Coba kembali; untuk checkout periksa Pesanan Saya dahulu.',409,'WRITE_CONFLICT');
 }catch(error){return errorResponse(res,error);}
}
