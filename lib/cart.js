import {createHash,randomUUID} from 'node:crypto';
const fail=message=>{const e=new Error(message);e.publicMessage=message;throw e;};
function itemsOf(p){
 if(!Array.isArray(p.items)||p.items.length<1||p.items.length>10)fail('Keranjang harus berisi 1–10 jasa.');
 if(!/^[a-f0-9]{32}$/.test(p.requestId||''))fail('ID checkout keranjang tidak valid.');
 const ids=new Set();return p.items.map(x=>{if(!x||!/^([a-f0-9]{32})$/.test(x.lineId||'')||ids.has(x.lineId))fail('Item keranjang tidak valid atau duplikat.');ids.add(x.lineId);return {lineId:x.lineId,productId:x.productId,packageId:x.packageId,addonIds:x.addonIds||[],promoCode:x.promoCode||'',expectedPrice:x.expectedPrice,expectedTotal:x.expectedTotal,brief:x.brief,deadline:x.deadline,materialUrl:x.materialUrl||'',customerNote:x.customerNote||'',answers:x.answers||{},attachmentIds:[]};});
}
const fingerprint=items=>createHash('sha256').update(JSON.stringify(items.map(x=>({...x,answers:Object.fromEntries(Object.entries(x.answers).sort(([a],[b])=>a.localeCompare(b)))})))).digest('hex');
export function paymentGroups(orders){const groups=new Map();for(const o of orders){const key=JSON.stringify([o.sellerId||'',o.paymentWhatsapp||'',o.paymentQris||'',o.paymentInfo||'']);if(!groups.has(key))groups.set(key,{sellerId:o.sellerId||'',sellerName:o.sellerName||'JASAhub',whatsapp:o.paymentWhatsapp,qrisImage:o.paymentQris,paymentInfo:o.paymentInfo||'',total:0,orders:[]});const g=groups.get(key);g.total+=Number(o.price);g.orders.push(o);}return [...groups.values()];}
export function cartOperation(p,records,user,createEngine){
 const items=itemsOf(p),fp=fingerprint(items),old=(records.Orders||[]).filter(o=>o.userId===user.id&&o.cartRequestId===p.requestId);
 if(old.length){if(old.some(o=>o.deletedAt))fail('Sebagian pesanan keranjang ini sudah diarsipkan. Periksa Pesanan Saya sebelum membuat checkout baru.');if(old.length!==items.length||old.some(o=>o.cartFingerprint!==fp))fail('Checkout ini sudah pernah digunakan dengan isi berbeda. Periksa Pesanan Saya.');return {reused:true,batchId:old[0].cartBatchId,orders:old.map(o=>{const x={...o};delete x._row;return x;}),total:old.reduce((n,o)=>n+Number(o.price),0)};}
 if(p.action==='createCartOrders'&&items.some(x=>(records.Orders||[]).some(o=>o.userId===user.id&&o.requestId===p.requestId+':'+x.lineId)))fail('ID permintaan sudah digunakan. Periksa Pesanan Saya sebelum mencoba kembali.');
 if(p.action==='createCartOrders'&&items.some(x=>(records.Orders||[]).some(o=>o.userId===user.id&&o.cartLineId===x.lineId)))fail('Item ini sudah pernah dipesan. Periksa Pesanan Saya; tambahkan jasa kembali jika ingin membuat pesanan baru.');
 const staged=structuredClone(records),engine=createEngine(staged,user),orders=[],batchId='CART-'+randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
 for(const item of items){
  try{
   let input={...item,action:'createOrder',requestId:p.requestId+':'+item.lineId};
   if(p.action==='quoteCart'){const product=(staged.Products||[]).find(x=>x.id===item.productId),pkg=(staged.Packages||[]).find(x=>x.id===item.packageId&&x.productId===product?.id);const q=engine.run({action:'quoteOrder',...item});input={...input,expectedPrice:Number(pkg?.price),expectedTotal:q.total};}
   const order=engine.run(input),row=staged.Orders.find(o=>o.id===order.id);
   Object.assign(row,{cartBatchId:batchId,cartRequestId:p.requestId,cartLineId:item.lineId,cartFingerprint:fp});orders.push({...order,cartBatchId:batchId,cartLineId:item.lineId});
  }catch(e){if(e.publicMessage){e.publicMessage='Item '+(orders.length+1)+': '+e.publicMessage;e.message=e.publicMessage;}throw e;}
 }
 if(p.action==='quoteCart')return {total:orders.reduce((n,o)=>n+Number(o.price),0),items:orders.map(o=>({lineId:o.cartLineId,subtotal:o.subtotal,discount:o.discount,total:o.price,days:o.days,revisions:o.revisions,promoCode:o.promoCode})),groups:paymentGroups(orders).map(g=>({sellerName:g.sellerName,total:g.total,count:g.orders.length}))};
 return {staged,engine,result:{batchId,orders,total:orders.reduce((n,o)=>n+Number(o.price),0)}};
}
