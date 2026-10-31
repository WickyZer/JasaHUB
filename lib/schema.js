export const TABLES = {
  Products: ['ownerId','id','title','category','description','price','days','revisions','thumbnail','featured','active','createdAt','updatedAt','shortDescription','badge'],
  Orders: ['sellerId','sellerName','paymentWhatsapp','paymentQris','paymentInfo','id','userId','productId','title','price','days','revisions','brief','materialUrl','deadline','status','paymentStatus','paymentReference','resultUrl','adminNote','requestId','createdAt','updatedAt','packageId','packageName','customerNote','paymentVerifiedAt','paymentVerifiedBy','completedAt','legacyStatus','proofOpenedAt'],
  Categories: ['id','name','active','icon'],
  Packages: ['id','productId','name','price','days','revisions','features','active','sort'],
  Previews: ['id','productId','image','caption','sort'],
  Media: ['ownerId','id','fileId','name','mime','size','kind','createdAt'],
  Settings: ['key','value']
};
