import {sb,rpc,ApiError,publicUser} from './supabase.js';
import {isRoot} from './access.js';
import {phone} from './auth.js';
export async function staffAction(p,user){
 if(!isRoot(user))throw new ApiError('Hanya pemilik website yang dapat mengelola admin penjual.',403);
 if(p.action==='staffAccounts'){const rows=await sb('/rest/v1/profiles?role=in.(admin,seller)&select=id,name,phone,role,active,created_at&order=created_at');return rows.map(publicUser);}
 if(p.action==='findStaffAccount'){const number=phone(p.phone);const rows=await sb('/rest/v1/profiles?'+new URLSearchParams({phone:'eq.'+number,select:'id,name,phone,role,active,created_at',limit:'1'}));if(!rows[0])throw new ApiError('Akun belum terdaftar. Minta rekan mendaftar sendiri terlebih dahulu.');return publicUser(rows[0]);}
 if(p.action==='setSellerRole'){
  if(!/^[a-f0-9-]{36}$/i.test(p.id||'')||typeof p.enable!=='boolean'||p.confirm!==true)throw new ApiError('Periksa akun lalu konfirmasikan perubahan akses.');
  try{return await rpc('jh_set_seller_role',{p_actor:user.id,p_target:p.id,p_enable:p.enable});}
  catch(e){if(['PGRST202','42883'].includes(e.upstreamCode))throw new ApiError('Jalankan supabase/upgrade-sellers.sql di SQL Editor Supabase terlebih dahulu.');if(['P0001','42501','23514'].includes(e.upstreamCode))throw new ApiError('Akses tidak dapat diubah. Akun harus aktif dan bukan pemilik website. Muat ulang daftar admin.');throw e;}
 }
 throw new ApiError('Aksi admin penjual tidak dikenal.');
}
