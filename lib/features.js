import {randomUUID} from 'node:crypto';
export function featureKit({records,user,append,patch,fail}) {
 const rows=n=>records[n]||[];
 const clean=o=>{const r={...o};delete r._row;return r;};
 const text=(v,min=0,max=2000)=>{const s=String(v??'').trim();if(s.length<min||s.length>max)fail(`Panjang isian harus ${min}–${max} karakter.`);return s;};
 const int=(v,min,max)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)fail(`Angka harus ${min}–${max}.`);return n;};
 const now=()=>new Date().toISOString();
 const id=()=>randomUUID().replaceAll('-','');
 const readPromos=()=>{try{return JSON.parse(rows('Settings').find(x=>x.key==='promotions')?.value||'[]');}catch{return [];}};
 const admin=()=>{if(user?.role!=='admin')fail('Akses admin diperlukan.');};
 const orderFor=(key)=>{const o=rows('Orders').find(x=>x.id===key);if(!o||(o.userId!==user.id&&user.role!=='admin'))fail('Pesanan tidak ditemukan.');return o;};
 function event(o,message,type='progress') {const timeline=[...(o.timeline||[]),{id:id(),message:text(message,3,1000),type,createdAt:now()}];patch('Orders',o,{timeline,updatedAt:now()});}
 function service(p){const product=rows('Products').find(x=>x.id===p.productId&&(x.active===true||x.active==='true'));if(!product)fail('Jasa tidak tersedia.');return product;}
 function quote(p){
  const product=service(p),pkg=rows('Packages').find(x=>x.id===p.packageId&&x.productId===product.id&&(x.active===true||x.active==='true'));
  if(!pkg)fail('Paket tidak tersedia.');
  const ids=p.addonIds||[];if(!Array.isArray(ids)||ids.length>12||new Set(ids).size!==ids.length)fail('Pilihan tambahan tidak valid.');
  const addons=ids.map(key=>{const a=(product.options?.addons||[]).find(x=>x.id===key);if(!a)fail('Paket tambahan sudah berubah. Muat ulang detail.');return {...a};});
  const subtotal=Number(pkg.price)+addons.reduce((s,a)=>s+a.price,0);let discount=0,promo=null;
  const code=text(p.promoCode,0,30).toUpperCase();
  if(code){promo=readPromos().find(x=>x.code===code&&x.active);const t=Date.now();
   if(!promo||t<Date.parse(promo.startsAt)||t>Date.parse(promo.endsAt))fail('Kode promo tidak aktif atau sudah berakhir.');
   if(promo.productIds.length&&!promo.productIds.includes(product.id))fail('Promo tidak berlaku untuk jasa ini.');
   if(subtotal<promo.minSpend)fail('Subtotal belum memenuhi minimum promo.');
   const used=rows('Orders').filter(o=>o.promoCode===code);const aggregate=rows('PromoUsage').find(x=>x.code===code);
   if((aggregate?Number(aggregate.total):used.length)>=promo.limit||(aggregate?Number(aggregate.mine):used.filter(o=>o.userId===user.id).length)>=promo.perUser)fail('Batas pemakaian promo telah tercapai.');
   discount=promo.type==='percent'?Math.floor(subtotal*promo.value/100):promo.value;
   if(promo.maxDiscount)discount=Math.min(discount,promo.maxDiscount);
   discount=Math.min(discount,subtotal-1000);
  }
  return {product,pkg,addons,subtotal,discount,total:subtotal-discount,promoCode:code,days:Number(pkg.days)+addons.reduce((s,a)=>s+a.days,0),revisions:Number(pkg.revisions)+addons.reduce((s,a)=>s+a.revisions,0)};
 }
 function validateOrder(p,q){
  if(p.expectedTotal!==undefined&&Number(p.expectedTotal)!==q.total)fail('Total telah berubah. Terapkan ulang kode promo dan periksa ringkasan.');
  if((q.addons.length||q.promoCode)&&p.expectedTotal===undefined)fail('Periksa ringkasan harga sebelum memesan.');
  const answers={};for(const field of q.product.options?.fields||[])answers[field.id]=text(p.answers?.[field.id],field.required?1:0,1500);
  const keys=p.attachmentIds||[];if(!Array.isArray(keys)||keys.length>5||new Set(keys).size!==keys.length)fail('Maksimal lima lampiran.');
  const attachments=keys.map(key=>{const file=rows('Media').find(x=>x.fileId===key&&x.kind==='attachment'&&x.ownerId===user.id&&!x.orderId);if(!file)fail('Lampiran tidak tersedia atau sudah digunakan.');return {id:key,name:file.name};});
  return {subtotal:q.subtotal,discount:q.discount,promoCode:q.promoCode,addons:q.addons,answers,answerLabels:Object.fromEntries((q.product.options?.fields||[]).map(f=>[f.id,f.label])),attachments,revisionTotal:q.revisions,revisionRequests:[],deliverables:[],timeline:[{id:id(),message:'Pesanan dibuat; menunggu pembayaran.',type:'created',createdAt:now()}],comboItems:q.product.options?.comboItems||[]};
 }
 function attach(o){for(const f of o.attachments||[]){const m=rows('Media').find(x=>x.fileId===f.id);patch('Media',m,{orderId:o.id});}}
 function run(p){
  if(p.action==='quoteOrder'){const q=quote(p);return {subtotal:q.subtotal,discount:q.discount,total:q.total,days:q.days,revisions:q.revisions,promoCode:q.promoCode};}
  if(p.action==='uploadAttachment'||p.action==='uploadDeliverable'){
   const result=p.action==='uploadDeliverable';let o;if(result){admin();o=orderFor(p.orderId);if(o.status==='Belum Dibayar')fail('Verifikasi pembayaran sebelum mengirim hasil.');}
   const key=String(p.requestId||'');if(!/^[a-f0-9]{32}$/.test(key))fail('ID unggahan tidak valid.');
   const existing=rows('Media').find(x=>x.id===key);if(existing){if(existing.ownerId!==user.id)fail('Unggahan tidak tersedia.');return {id:key,name:existing.name};}
   const name=text(p.name,1,120).replace(/[\\/\r\n]/g,'_');const ext=name.split('.').pop().toLowerCase();
   const types={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
   const m=String(p.data||'').match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
   if(!m||!types[ext]||m[1]!==types[ext]||m[2].length>2000000)fail('Format tidak didukung atau file melebihi 1,5 MB.');
   const bytes=Buffer.from(m[2],'base64');if(bytes.length<12||bytes.length>1500000)fail('Ukuran berkas tidak valid.');
   const ok=ext==='pdf'?bytes.subarray(0,5).toString()==='%PDF-':['zip','docx','xlsx','pptx'].includes(ext)?bytes[0]===80&&bytes[1]===75:ext==='png'?bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a':['jpg','jpeg'].includes(ext)?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
   if(!ok)fail('Isi file tidak sesuai format.');
   if(result&&(o.deliverables||[]).length>=20)fail('Maksimal 20 file hasil per pesanan.');
   return {bytes,mime:types[ext],ext,key,name,ownerId:user.id,orderId:o?.id||'',kind:result?'deliverable':'attachment',stage:p.stage==='final'?'final':'preview'};
  }
  if(p.action==='submitReview'){
   const o=orderFor(p.id);if(o.userId!==user.id||o.status!=='Selesai')fail('Ulasan hanya untuk pesanan selesai milik sendiri.');if(o.review)fail('Pesanan ini sudah diulas.');
   patch('Orders',o,{review:{rating:int(p.rating,1,5),text:text(p.text,5,1200),author:user.name.split(' ')[0],createdAt:now(),visible:true},updatedAt:now()});return {success:true};
  }
  if(p.action==='saveServiceOptions'){
   admin();const product=rows('Products').find(x=>x.id===p.id);if(!product)fail('Jasa tidak ditemukan.');
   if(!Array.isArray(p.addons)||p.addons.length>12||!Array.isArray(p.fields)||p.fields.length>8)fail('Maksimal 12 tambahan dan 8 pertanyaan.');
   const addons=p.addons.map(a=>({id:a.id&&/^[a-f0-9]{32}$/.test(a.id)?a.id:id(),name:text(a.name,3,80),price:int(a.price,0,100000000),days:int(a.days,0,365),revisions:int(a.revisions,0,20)}));
   const fields=p.fields.map(f=>({id:f.id&&/^[a-f0-9]{32}$/.test(f.id)?f.id:id(),label:text(f.label,3,120),required:f.required===true}));
   const comboIds=p.comboIds||[];if(!Array.isArray(comboIds)||comboIds.length>8||new Set(comboIds).size!==comboIds.length)fail('Pilihan combo tidak valid.');
   const comboItems=comboIds.map(key=>{const x=rows('Products').find(x=>x.id===key&&x.id!==product.id&&x.active===true);if(!x)fail('Pilih komponen combo yang aktif.');return {id:x.id,title:x.title};});
   if(comboItems.length===1)fail('Combo minimal berisi dua jasa.');
   patch('Products',product,{options:{addons,fields,comboItems},updatedAt:now()});return {success:true};
  }
  if(p.action==='savePromo'){
   admin();const code=text(p.code,3,30).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(code))fail('Kode promo hanya huruf, angka, - dan _.');
   const startsAt=new Date(p.startsAt),endsAt=new Date(p.endsAt);if(!Number.isFinite(+startsAt)||!Number.isFinite(+endsAt)||endsAt<=startsAt)fail('Periode promo tidak valid.');
   const productIds=p.productIds||[];if(!Array.isArray(productIds)||productIds.some(key=>!rows('Products').some(x=>x.id===key)))fail('Jasa promo tidak valid.');
   const type=p.type==='percent'?'percent':'fixed';const promo={code,type,value:int(p.value,1,type==='percent'?100:100000000),minSpend:int(p.minSpend,0,100000000),maxDiscount:int(p.maxDiscount,0,100000000),limit:int(p.limit,1,1000000),perUser:int(p.perUser,1,1000000),startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),productIds,active:p.active===true};
   const list=readPromos();const at=list.findIndex(x=>x.code===code);if(at>=0)list[at]=promo;else {if(list.length>=100)fail('Maksimal 100 promo.');list.push(promo);}
   const r=rows('Settings').find(x=>x.key==='promotions');if(r)patch('Settings',r,{value:JSON.stringify(list)});else append('Settings',{key:'promotions',value:JSON.stringify(list)});return {success:true};
  }
  if(p.action==='addProgress'){admin();const o=orderFor(p.id);if(o.status==='Belum Dibayar')fail('Verifikasi pembayaran sebelum mencatat progres.');event(o,p.message);return {success:true};}
  if(p.action==='moderateReview'){admin();const o=orderFor(p.id);if(!o.review)fail('Ulasan tidak ditemukan.');patch('Orders',o,{review:{...o.review,visible:p.visible===true}});return {success:true};}
  if(p.action==='resolveRevision'){admin();const o=orderFor(p.id);const list=(o.revisionRequests||[]).map(x=>x.id===p.revisionId?{...x,resolvedAt:now()}:x);patch('Orders',o,{revisionRequests:list});return {success:true};}
  return undefined;
 }
 function finishUpload(input,row){
  if(input.kind==='deliverable'){const o=orderFor(input.orderId);patch('Orders',o,{deliverables:[...(o.deliverables||[]),{id:row.fileId,name:row.name,stage:input.stage,createdAt:now()}]});event(o,input.stage==='final'?'File hasil final tersedia.':'Preview pekerjaan tersedia.','file');}
 }
 return {run,quote,validateOrder,attach,event,readPromos,finishUpload};
}
