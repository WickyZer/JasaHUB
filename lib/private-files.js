import {sb} from './supabase.js';
export const FILE_BUCKET='jasahub-files';
export async function uploadPrivateFile(input){
 const path=input.ownerId+'/'+input.key+'.'+input.ext;
 try{await sb('/storage/v1/object/'+FILE_BUCKET+'/'+path,{method:'POST',body:input.bytes,headers:{'Content-Type':input.mime,'x-upsert':'false'}});}catch(e){if(e.upstreamStatus!==409&&e.upstreamCode!=='Duplicate')throw e;}
 return {id:input.key,row:{id:input.key,fileId:input.key,path,name:input.name,mime:input.mime,size:input.bytes.length,kind:input.kind,ownerId:input.ownerId,orderId:input.orderId,createdAt:new Date().toISOString()}};
}
export async function downloadPrivateFile(row){
 if(!/^[a-f0-9-]+\/[a-f0-9]{32}\.[a-z0-9]+$/.test(row.path))throw Error('Invalid path');
 const res=await sb('/storage/v1/object/authenticated/'+FILE_BUCKET+'/'+row.path,{raw:true});return Buffer.from(await res.arrayBuffer());
}
