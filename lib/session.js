import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {sb,profile,publicUser,ApiError} from './supabase.js';
const COOKIE='jh_session';
function key(){const s=process.env.SESSION_SECRET;if(!/^[a-f0-9]{64}$/i.test(s||''))throw Error('SESSION_SECRET must be 64 hex characters');return Buffer.from(s,'hex');}
export function seal(data){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const body=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');}
export function unseal(value){try{const bytes=Buffer.from(value,'base64url');const decipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());}catch{return null;}}
export function readSession(req){const value=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return value?unseal(value):null;}
export function setSession(res,data){const secure=process.env.NODE_ENV==='production';const value=data?seal(data):'';if(value.length>3800)throw Error('Session cookie exceeds size limit');res.setHeader('Set-Cookie',`${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${data?30*86400:0}${secure?'; Secure':''}`);}
export function fromAuth(session,row){if(!session.access_token||!session.refresh_token)throw Error('Invalid auth response');return {access:session.access_token,refresh:session.refresh_token,expires:Math.floor(Date.now()/1000)+Number(session.expires_in||3600),version:row.session_version};}
export async function authenticate(req,res,{optional=false}={}){
 let session=readSession(req);if(!session){if(optional)return null;throw new ApiError('Silakan masuk terlebih dahulu.',401,'AUTH_REQUIRED');}
 async function authRequest(path,options){
  try{return await sb(path,options);}catch(error){
   if([400,401,403].includes(error.upstreamStatus)){error.invalidSession=true;}throw error;
  }
 }
 try{
  if(session.expires<Date.now()/1000+60){
   const renewed=await authRequest('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh},publicKey:true});
   session={access:renewed.access_token,refresh:renewed.refresh_token,expires:Math.floor(Date.now()/1000)+Number(renewed.expires_in||3600),version:session.version};
   setSession(res,session);
  }
  const auth=await authRequest('/auth/v1/user',{token:session.access,publicKey:true});
  // Configuration/database permission failures do not invalidate a valid session.
  const row=await profile(auth.id);
  if(!row||!row.active||row.session_version!==session.version){const error=new ApiError('Sesi berakhir. Silakan masuk kembali.',401,'SESSION_EXPIRED');error.invalidSession=true;throw error;}
  return {session,row,user:publicUser(row),auth};
 }catch(error){
  if(error.invalidSession){setSession(res,null);if(optional)return null;throw new ApiError('Sesi berakhir. Silakan masuk kembali.',401,'SESSION_EXPIRED');}
  throw error;
 }
}
