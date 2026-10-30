export class ApiError extends Error {
 constructor(message,status=400,code='VALIDATION'){super(message);this.publicMessage=message;this.status=status;this.code=code;}
}
export function config(){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 if(!/^https:\/\/[a-zA-Z0-9.-]+$/.test(url||''))throw Error('SUPABASE_URL not configured');
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY,anon=process.env.SUPABASE_ANON_KEY;
 if(!service||!anon)throw Error('Supabase keys not configured');
 return {url,service,anon};
}
export async function sb(path,{method='GET',body,token,publicKey=false,headers={},raw=false}={}){
 const c=config();const key=publicKey?c.anon:c.service;
 const response=await fetch(c.url+path,{method,headers:{apikey:key,Authorization:'Bearer '+(token||key),...(body!==undefined&&!Buffer.isBuffer(body)?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 if(!response.ok){
  let error;try{error=await response.json();}catch{error={};}
  const e=new Error('Supabase request failed');e.upstreamStatus=response.status;e.upstreamCode=error.code||error.error_code||'';throw e;
 }
 if(raw)return response;
 if(response.status===204)return null;
 const text=await response.text();return text?JSON.parse(text):null;
}
export const rpc=(name,body={})=>sb('/rest/v1/rpc/'+name,{method:'POST',body});
export async function profile(id){const rows=await sb('/rest/v1/profiles?id=eq.'+encodeURIComponent(id)+'&select=*');return rows[0]||null;}
export function publicUser(row){return {id:row.id,name:row.name,phone:row.phone||'',username:row.username||'',role:row.role,active:row.active,createdAt:row.created_at};}
export function changesOf(engine){
 const clean=o=>{const x={...o};delete x._row;return x;};
 return [...engine.changes.map(({name,row})=>({table:name,ordinal:row._row,delete:name==='Settings'?!row.key:!row.id,data:clean(row)})),...engine.adds.map(({name,row})=>({table:name,data:clean(row)}))];
}
