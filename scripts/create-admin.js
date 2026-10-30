// Local only: npm run create-admin. Never runs automatically during deployment.
import {sb} from '../lib/supabase.js';
import {phone} from '../lib/auth.js';
const username=String(process.env.ADMIN_USERNAME||'').trim().toLowerCase();
const name=String(process.env.ADMIN_NAME||'Admin JASAhub').trim();
const password=process.env.ADMIN_PASSWORD;
if(!/^[a-z0-9_.-]{3,60}$/.test(username)||!password||password.length<6)throw Error('Isi ADMIN_USERNAME dan ADMIN_PASSWORD (minimal 6 karakter) di .env.');
const number=process.env.ADMIN_PHONE?phone(process.env.ADMIN_PHONE):null;
const rows=await sb('/rest/v1/profiles?username=eq.'+encodeURIComponent(username)+'&select=id');
if(rows.length)throw Error('Username admin sudah ada. Script tidak mereset password atau menimpa akun.');
const email='admin.'+username+'@accounts.jasahub.invalid';
const created=await sb('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true,user_metadata:{name,phone:number||'',phone_verified:false}}});
await sb('/rest/v1/profiles?id=eq.'+created.id,{method:'PATCH',body:{role:'admin',username}});
console.log('Akun admin dibuat. Masuk melalui website menggunakan username yang diatur. Password tidak dicetak.');
