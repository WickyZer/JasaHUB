/* Every staff operation is checked against server-authenticated identity. */
export const isRoot=user=>user?.active!==false&&user?.role==='admin';
export const isStaff=user=>user?.active!==false&&['admin','seller'].includes(user?.role);
export const managesProduct=(user,product)=>!!product&&(isRoot(user)||user?.role==='seller'&&!!product.ownerId&&product.ownerId===user.id);
export const managesOrder=(user,order)=>!!order&&(isRoot(user)||user?.role==='seller'&&!!order.sellerId&&order.sellerId===user.id);
export function authorizeStaffAction(p,records,user,fail){
 const products=records.Products||[],orders=(records.Orders||[]).filter(o=>!o.deletedAt);
 const rootOnly=['saveCategory','updateCategory','deleteCategory','saveSettings','savePromo'];
 if(rootOnly.includes(p.action)&&!isRoot(user))fail('Hanya pemilik website yang dapat mengubah pengaturan global.');
 const productActions=['saveProduct','deleteProduct','saveServiceOptions','savePreview','reorderPreviews','deletePreview'];
 if(productActions.includes(p.action)){
  if(!isStaff(user))fail('Akses admin diperlukan.');
  let key=['savePreview','reorderPreviews'].includes(p.action)?p.productId:p.id;
  if(p.action==='deletePreview'){const preview=(records.Previews||[]).find(x=>x.id===p.id);key=preview?.productId;}
  if(!(p.action==='saveProduct'&&!p.id)&&!managesProduct(user,products.find(x=>x.id===key)))fail('Jasa tidak ditemukan atau bukan milik Anda.');
 }
 if(['prepareDeleteOrder','deleteOrder','updateOrder','addProgress','resolveRevision','moderateReview','uploadDeliverable'].includes(p.action)){
  if(!isStaff(user))fail('Akses admin diperlukan.');
  if(!managesOrder(user,orders.find(x=>x.id===(p.action==='uploadDeliverable'?p.orderId:p.id))))fail('Pesanan tidak ditemukan atau bukan milik Anda.');
 }
 if(p.action==='saveSellerSettings'&&!isStaff(user))fail('Akses admin diperlukan.');
 if(p.action==='uploadMedia'){if(!isStaff(user))fail('Akses admin diperlukan.');if(user.role==='seller'&&!['thumbnail','preview','qris'].includes(p.kind))fail('Jenis unggahan tidak diizinkan untuk akun ini.');}
}
