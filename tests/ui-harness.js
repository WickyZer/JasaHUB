// Deterministic renderer comparison. This verifies HTML output, not browser pixels.
import {createContext,Script} from 'node:vm';
import {createEngine} from '../lib/engine.js';
import {fixture,customer,admin} from './fixtures.js';
export function renderViews(source){
 const nodes=new Map();
 function node(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,value:'',dataset:{},style:{},open:false,contains:()=>false,classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},removeAttribute(){},addEventListener(){},querySelector:s=>node(selector+' '+s),querySelectorAll:()=>[],focus(){},scrollTo(){},scrollIntoView(){},showModal(){this.open=true;},close(){this.open=false;},insertBefore(){},append(){}});return nodes.get(selector);}
 const document={querySelector:node,querySelectorAll:()=>[],body:node('body'),documentElement:node('html'),addEventListener(){},activeElement:null};
 const storage={getItem:()=>null,setItem(){},removeItem(){}};
 const location={hash:'#catalog',protocol:'https:',origin:'https://example.com'};
 const frozen=Date.parse('2026-10-30T08:00:00Z');
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[frozen]));}static now(){return frozen;}}
 const context=createContext({document,window:{addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false})},location,localStorage:storage,sessionStorage:storage,console,Intl,Date:FixedDate,URL,TextEncoder,Uint8Array,crypto:{getRandomValues:a=>a.fill(1),subtle:{}},MutationObserver:class{observe(){}},IntersectionObserver:class{observe(){}unobserve(){}},matchMedia:()=>({matches:false}),setTimeout:()=>1,clearTimeout(){},AbortController,Error});
 source=source.replace(/boot\(\);\s*$/,'');
 new Script(source+`\nglobalThis.view={S,catalog,card,renderService,checkout,auth,orderCard,renderAdminOrders,updateMobileChrome};`).runInContext(context);
 const {view}=context;const data=createEngine(fixture()).catalog();Object.assign(view.S,{...data,user:customer(),token:'cookie',category:'Semua Jasa',search:'',sort:'featured',priceRange:'all',loadError:false,adminStatus:'all',adminSearch:''});
 const outputs={};
 outputs.card=view.card(data.products[0]);view.catalog();outputs.catalog=node('#page').innerHTML;outputs.grid=node('#serviceGrid').innerHTML;
 location.hash='#service/svc-logo';view.renderService('svc-logo');view.updateMobileChrome();outputs.detail=node('#page').innerHTML;outputs.dock=node('#checkoutDock').innerHTML;outputs.mobileNav=node('#mobileBottomNav').innerHTML;
 view.checkout();outputs.checkout=node('#modalBody').innerHTML;
 view.auth('login');outputs.login=node('#modalBody').innerHTML;view.auth('register');outputs.register=node('#modalBody').innerHTML;
 const order={id:'JH-TEST',userId:customer().id,title:'Jasa Pembuatan Logo Website',status:'Belum Dibayar',packageName:'Basic',price:50000,brief:'Buat logo bisnis dengan tema ungu.',deadline:'2026-11-15',createdAt:'2026-10-01T00:00:00Z',revisions:2};
 outputs.order=view.orderCard(order);view.S.admin={products:data.products,categories:data.categories,orders:[order],customers:[customer(),admin()],settings:data.settings};view.renderAdminOrders();outputs.adminOrders=node('#adminOrderList').innerHTML;
 // Compare element structure of settings separately: storage explanations intentionally change.
 return outputs;
}
