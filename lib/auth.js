import {createHmac} from 'node:crypto';
import {sb,rpc,profile,publicUser,ApiError} from './supabase.js';
import {setSession,fromAuth,authenticate} from './session.js';
export function phone(value){let s=String(value||'').replace(/[\s()+-]/g,'');if(s.startsWith('0'))s='62'+s.slice(1);if(!/^628\d{7,11}$/.test(s))throw new ApiError('Gunakan nomor Indonesia aktif, contoh 081234567890.');return s;}
export function text(value,max,min=0){const s=String(value??'').trim();if(s.length<min||s.length>max)throw new ApiError(`Panjang isian harus ${min}–${max} karakter.`);return s;}
function password(value,min=6){if(typeof value!=='string'||value.length<min||value.length>128)throw new ApiError(`Password harus ${min}–128 karakter.`);return value;}
export const loginEmail=phone=>'u.'+phone+'@accounts.jasahub.invalid';
export async function limit(req,action,identity='',max=30,seconds=900){
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const secret=process.env.SESSION_SECRET;if(!secret)throw Error('SESSION_SECRET missing');
 const key=createHmac('sha256',secret).update(action+':'+ip+':'+identity).digest('hex');
 if(!await rpc('jh_rate_limit',{p_key:key,p_max:max,p_seconds:seconds}))throw new ApiError('Terlalu banyak percobaan. Coba lagi beberapa menit kemudian.',429,'RATE_LIMIT');
}
async function login(req,res,email,pass){
 let session;try{session=await sb('/auth/v1/token?grant_type=password',{method:'POST',publicKey:true,body:{email,password:pass}});}catch(error){if([400,401,422].includes(error.upstreamStatus))throw new ApiError('Nomor, username, atau password salah.',401,'BAD_LOGIN');throw error;}
 const row=await profile(session.user.id);if(!row?.active)throw new ApiError('Akun tidak aktif.',403);
 setSession(res,fromAuth(session,row));return {token:'cookie',user:publicUser(row)};
}
export async function authAction(req,res,p){
 if(p.action==='challenge')return {legacy:false,salt:'',iterations:0};
 if(p.action==='register'){
  await limit(req,'register','',5,3600);
  const number=phone(p.phone),name=text(p.name,80,2),pass=password(p.password);
  try{await sb('/auth/v1/admin/users',{method:'POST',body:{email:loginEmail(number),password:pass,email_confirm:true,user_metadata:{name,phone:number,phone_verified:false}}});}
  catch(error){if([400,422,409].includes(error.upstreamStatus))throw new ApiError('Nomor sudah terdaftar atau akun tidak dapat dibuat. Coba masuk atau hubungi admin.');throw error;}
  return login(req,res,loginEmail(number),pass);
 }
 if(p.action==='login'){
  await limit(req,'login-global','',60,900);
  const identifier=text(p.phone||p.username,80,1).toLowerCase();await limit(req,'login',identifier,15,900);
  let email;
  try{email=loginEmail(phone(identifier));}catch{
   const rows=await sb('/rest/v1/profiles?username=eq.'+encodeURIComponent(identifier)+'&select=login_email');email=rows[0]?.login_email||'unknown@accounts.jasahub.invalid';
  }
  return login(req,res,email,password(p.password,1));
 }
 if(p.action==='logout'){
  try{const auth=await authenticate(req,res,{optional:true});if(auth)await sb('/auth/v1/logout?scope=local',{method:'POST',token:auth.session.access,publicKey:true});}finally{setSession(res,null);}
  return {success:true};
 }
 const auth=await authenticate(req,res,{optional:p.action==='me'});if(p.action==='me')return auth?.user||null;
 if(p.action==='updateProfile'){
  const number=phone(p.phone),name=text(p.name,80,2);
  const email=auth.row.username?auth.row.login_email:loginEmail(number);
  try{await sb('/auth/v1/admin/users/'+auth.row.id,{method:'PUT',body:{email,email_confirm:true,user_metadata:{name,phone:number,phone_verified:false}}});}
  catch(error){if([400,422,409,500].includes(error.upstreamStatus))throw new ApiError('Nama/nomor belum dapat disimpan. Pastikan nomor belum dipakai akun lain.');throw error;}
  return publicUser(await profile(auth.row.id));
 }
 if(p.action==='changePassword'){
  await limit(req,'password',auth.row.id,5,900);
  try{await sb('/auth/v1/token?grant_type=password',{method:'POST',publicKey:true,body:{email:auth.row.login_email,password:password(p.oldPassword,1)}});}
  catch(error){if([400,401,422].includes(error.upstreamStatus))throw new ApiError('Password lama tidak cocok.');throw error;}
  const pass=password(p.newPassword);
  await sb('/auth/v1/admin/users/'+auth.row.id,{method:'PUT',body:{password:pass}});
  // Version update invalidates all other application sessions immediately.
  await rpc('jh_invalidate_sessions',{p_user_id:auth.row.id});
  return login(req,res,auth.row.login_email,pass);
 }
 throw new ApiError('Aksi akun tidak dikenal.');
}
