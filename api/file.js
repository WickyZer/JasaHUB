import {sb,ApiError} from '../lib/supabase.js';
import {authenticate} from '../lib/session.js';
import {downloadPrivateFile} from '../lib/private-files.js';
import {noStore,errorResponse} from '../lib/http.js';
export default async function handler(req,res){
 noStore(res);
 try{
  if(req.method!=='GET')throw new ApiError('Gunakan GET.',405);
  const id=req.query?.id;if(!/^[a-f0-9]{32}$/.test(id||''))throw new ApiError('ID berkas tidak valid.');
  const {user}=await authenticate(req,res);
  const list=await sb('/rest/v1/media?'+new URLSearchParams({'data->>fileId':'eq.'+id,select:'data'}));const row=list[0]?.data;
  if(!row||!['attachment','deliverable'].includes(row.kind))throw new ApiError('Berkas tidak ditemukan.',404);
  let allowed=user.role==='admin'||row.ownerId===user.id;
  if(!allowed&&row.orderId){const orders=await sb('/rest/v1/orders?'+new URLSearchParams({record_id:'eq.'+row.orderId,select:'data'}));allowed=orders[0]?.data.userId===user.id;}
  if(!allowed)throw new ApiError('Berkas tidak ditemukan.',404);
  const bytes=await downloadPrivateFile(row);
  res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(row.name));res.setHeader('X-Content-Type-Options','nosniff');return res.status(200).send(bytes);
 }catch(e){return errorResponse(res,e);}
}
