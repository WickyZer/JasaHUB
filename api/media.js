import {sb} from '../lib/supabase.js';
import {downloadImage} from '../lib/media.js';
import {noStore,errorResponse} from '../lib/http.js';
export default async function handler(req,res){
 noStore(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 const id=req.query?.id;
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{10,100}$/.test(id)||Object.keys(req.query).length!==1)return res.status(400).json({ok:false,error:'ID gambar tidak valid.'});
 try{
  const query=new URLSearchParams({'data->>fileId':'eq.'+id,select:'data'});
  const rows=await sb('/rest/v1/media?'+query);
  const row=rows[0]?.data;if(!row||['attachment','deliverable'].includes(row.kind))return res.status(404).json({ok:false,error:'Gambar tidak ditemukan.'});
  const bytes=await downloadImage(row);
  res.removeHeader('Vercel-CDN-Cache-Control');
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=86400, stale-while-revalidate=60');
  res.setHeader('Content-Type',row.mime);return res.status(200).send(bytes);
 }catch(error){return errorResponse(res,error);}
}
