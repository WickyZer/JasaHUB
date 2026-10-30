// npm run import -- /absolute/path/to/extracted-export
// Idempotent for unchanged exports; checkpoints contain IDs, never old passwords.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {sb} from '../lib/supabase.js';
import {phone,loginEmail} from '../lib/auth.js';
import {BUCKET,objectPath} from '../lib/media.js';
const directory=resolve(process.argv[2]||'legacy-export');
const bundle=JSON.parse(await readFile(join(directory,'data.json'),'utf8'));
if(bundle.format!=='jasahub-legacy-v1'||!bundle.records)throw Error('Format ekspor tidak sesuai.');
if(bundle.missingMedia?.length)throw Error('Ada media yang gagal diekspor. Perbaiki akses Drive dan ekspor ulang sebelum impor.');
const records=bundle.records,checkpointPath='migration-checkpoint.json';
let state;try{state=JSON.parse(await readFile(checkpointPath,'utf8'));}catch{state={project:process.env.SUPABASE_URL,users:{},completed:[]};}
if(state.project!==process.env.SUPABASE_URL)throw Error('Checkpoint berasal dari proyek lain. Pindahkan file checkpoint sebelum mengganti proyek.');
const save=()=>writeFile(checkpointPath,JSON.stringify(state,null,2),{mode:0o600});
const resetPath='reset-passwords.json';let resets=[];try{resets=JSON.parse(await readFile(resetPath,'utf8'));}catch{}
function yes(v){return v===true||String(v).toLowerCase()==='true';}
function convertRef(value){return typeof value==='string'?value.replace(/^drive:/,'storage:'):value;}
function validRow(row){const out={...row};delete out._row;delete out.exportPath;for(const key of ['active','featured'])if(key in out)out[key]=yes(out[key]);for(const key of ['thumbnail','image','logoUrl','qrisImage'])if(key in out)out[key]=convertRef(out[key]);return out;}
async function upsert(table,rows){
 for(let i=0;i<rows.length;i+=100)await sb('/rest/v1/'+table+'?on_conflict=record_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:rows.slice(i,i+100).map(data=>({record_id:String(table==='settings'?data.key:data.id),data}))});
}
// Preflight every file before making any changes.
for(const media of records.Media||[]){
 if(!/^media\/[A-Za-z0-9_-]{10,100}\.(png|jpg|webp)$/.test(media.exportPath||''))throw Error('Jalur media ekspor tidak valid.');
 const bytes=await readFile(join(directory,media.exportPath));if(bytes.length>1500000)throw Error('Ada media melebihi batas 1,5 MB. Optimalkan sebelum migrasi.');
}
if(process.argv.includes('--dry-run')){console.log('Ekspor valid. Ringkasan jumlah record:',JSON.stringify(Object.fromEntries(Object.entries(records).map(([k,v])=>[k,v.length]))));process.exit(0);}
for(const user of records.Users||[]){
 if(state.users[user.id])continue;
 const existing=await sb('/rest/v1/profiles?legacy_id=eq.'+encodeURIComponent(user.id)+'&select=id');
 if(existing[0]){state.users[user.id]=existing[0].id;await save();continue;}
 const username=String(user.username||'').trim().toLowerCase();let number=null;try{if(user.phone)number=phone(user.phone);}catch{throw Error('Nomor akun lama tidak valid. Perbaiki data sumber sebelum impor.');}
 const email=number?loginEmail(number):'admin.'+(username||String(user.id).toLowerCase())+'@accounts.jasahub.invalid';
 let pass=String(user.password||'');
 const needsReset=pass.length<6;
 if(needsReset){let item=resets.find(x=>x.legacyId===user.id);if(!item){item={legacyId:user.id,username,phone:number,password:randomBytes(18).toString('base64url')};resets.push(item);await writeFile(resetPath,JSON.stringify(resets,null,2),{mode:0o600});}pass=item.password;}
 // Recover if a previous import created Auth but stopped before saving legacy_id.
 let profiles=await sb('/rest/v1/profiles?login_email=eq.'+encodeURIComponent(email)+'&select=id,legacy_id');
 let id;
 if(profiles[0]){
  if(profiles[0].legacy_id&&profiles[0].legacy_id!==user.id)throw Error('Identitas akun bertabrakan; impor dihentikan.');
  if(!profiles[0].legacy_id)throw Error('Akun email sudah ada tanpa legacy_id. Verifikasi kepemilikan di dashboard lalu isi legacy_id sebelum melanjutkan.');
  id=profiles[0].id;
 }else{
  const created=await sb('/auth/v1/admin/users',{method:'POST',body:{email,password:pass,email_confirm:true,user_metadata:{name:String(user.name||'Pelanggan'),phone:number||'',phone_verified:false}}});id=created.id;
  await sb('/rest/v1/profiles?id=eq.'+id,{method:'PATCH',body:{legacy_id:user.id,username:username||null,role:user.role==='admin'?'admin':'customer',active:yes(user.active),created_at:user.createdAt||new Date().toISOString()}});
 }
 state.users[user.id]=id;await save();
}
for(const media of records.Media||[]){
 const extension=media.mime==='image/jpeg'?'jpg':media.mime==='image/webp'?'webp':'png';
 const path='legacy/'+media.fileId+'.'+extension;
 const bytes=await readFile(join(directory,media.exportPath));
 try{await sb('/storage/v1/object/'+BUCKET+'/'+objectPath(path),{method:'POST',body:bytes,headers:{'Content-Type':media.mime,'x-upsert':'false'}});}catch(error){if(error.upstreamStatus!==409&&error.upstreamCode!=='Duplicate')throw error;}
 media.path=path;
}
for(const name of ['Categories','Products','Packages','Previews','Media','Settings','Orders']){
 const rows=(records[name]||[]).map(validRow);
 if(name==='Settings')for(const row of rows)row.value=convertRef(row.value);
 if(name==='Orders')for(const row of rows){
  if(!state.users[row.userId])throw Error('Pemilik pesanan tidak ditemukan; impor dihentikan.');
  row.userId=state.users[row.userId];
  if(!['Belum Dibayar','Proses Pengerjaan','Selesai'].includes(row.status))row.status=['Diproses','Review Pelanggan','Revisi'].includes(row.status)||row.paymentStatus==='Lunas'?'Proses Pengerjaan':'Belum Dibayar';
  if(row.paymentVerifiedBy)row.paymentVerifiedBy=state.users[row.paymentVerifiedBy]||'';
 }
 await upsert(name.toLowerCase(),rows);state.completed.push(name);await save();
}
await writeFile('migration-report.json',JSON.stringify({project:state.project,completedAt:new Date().toISOString(),counts:Object.fromEntries(Object.entries(records).map(([k,v])=>[k,v.length])),passwordResets:resets.length},null,2),{mode:0o600});
console.log('Impor selesai. Periksa migration-report.json. Jika ada reset password, sampaikan kredensial dari reset-passwords.json secara privat.');
