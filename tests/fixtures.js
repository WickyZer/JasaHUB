export function fixture(){
 return {
 Products:[{_row:1,id:'svc-logo',title:'Jasa Pembuatan Logo Website',category:'Design',description:'Logo untuk website dan identitas bisnis Anda.',shortDescription:'Logo untuk website',price:50000,days:2,revisions:2,thumbnail:'',featured:true,active:true,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',badge:'Populer'}],
 Categories:[{_row:1,id:'cat-design',name:'Design',active:true,icon:'pen'}],
 Packages:[{_row:1,id:'pkg-basic',productId:'svc-logo',name:'Basic',price:50000,days:2,revisions:2,features:'Logo PNG\nDua revisi',active:true,sort:0},{_row:2,id:'pkg-premium',productId:'svc-logo',name:'Premium',price:100000,days:3,revisions:3,features:'Logo PNG dan sumber',active:true,sort:1}],
 Previews:[],Orders:[],Media:[],
 Settings:[{_row:1,key:'whatsapp',value:'6281234567890'},{_row:2,key:'qrisImage',value:'https://example.com/qris.png'},{_row:3,key:'siteName',value:'JASAhub.id'}],
 Users:[customer(),admin()]
 };
}
export const customer=()=>({id:'10000000-0000-4000-8000-000000000001',name:'Pelanggan',phone:'6281234567890',role:'customer',active:true,createdAt:'2026-10-01T00:00:00Z'});
export const admin=()=>({id:'10000000-0000-4000-8000-000000000002',name:'Admin',phone:'6281234567891',role:'admin',username:'fadhil_admin',active:true,createdAt:'2026-10-01T00:00:00Z'});
export const checkout=()=>({action:'createOrder',productId:'svc-logo',packageId:'pkg-basic',expectedPrice:50000,deadline:new Date(Date.now()+10*86400000).toISOString().slice(0,10),brief:'Buat logo website dengan warna ungu.',requestId:'checkout-request-123'});
export function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},removeHeader(k){delete this.headers[k];},status(code){this.code=code;return this;},json(data){this.body=data;return this;},send(data){this.body=data;return this;},end(){return this;}};}
