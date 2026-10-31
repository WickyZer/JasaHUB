import {sb,ApiError} from './supabase.js';
export const BUCKET='jasahub-media';
export function objectPath(path){if(!/^[A-Za-z0-9_/-]+\.(png|jpg|webp)$/.test(path||'')||path.includes('..'))throw new ApiError('Jalur gambar tidak valid.');return path.split('/').map(encodeURIComponent).join('/');}
export async function uploadImage(input){
 const extension=input.mime==='image/jpeg'?'jpg':input.mime.split('/')[1];
 const path=input.kind+'/'+input.key+'.'+extension;
 try{await sb('/storage/v1/object/'+BUCKET+'/'+objectPath(path),{method:'POST',body:input.bytes,headers:{'Content-Type':input.mime,'x-upsert':'false','cache-control':'max-age=86400'}});}
 catch(error){if(error.upstreamStatus!==409&&error.upstreamCode!=='Duplicate')throw error;}
 return {id:input.key,ref:'storage:'+input.key,row:{id:input.key,fileId:input.key,path,name:input.kind+'-'+input.key+'.'+extension,mime:input.mime,size:input.bytes.length,kind:input.kind,ownerId:input.ownerId,createdAt:new Date().toISOString()}};
}
export async function downloadImage(row){
 if(!['image/png','image/jpeg','image/webp'].includes(row.mime))throw Error('Unsupported media type');
 const response=await sb('/storage/v1/object/authenticated/'+BUCKET+'/'+objectPath(row.path),{raw:true});
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>1500000)throw Error('Media too large');return bytes;
}
