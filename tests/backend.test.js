import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '../lib/engine.js';
import {changesOf} from '../lib/supabase.js';
import {seal,unseal,authenticate,setSession} from '../lib/session.js';
import {validatePost} from '../lib/http.js';
import handler from '../api/rpc.js';
import catalog from '../api/jasa.js';
import {fixture,customer,admin,checkout,response} from './fixtures.js';
process.env.SESSION_SECRET='1'.repeat(64);process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='private-test-service-key';process.env.SUPABASE_ANON_KEY='public-test-key';
const profile=(user=customer())=>({...user,created_at:user.createdAt,session_version:0,login_email:'u.'+user.phone+'@accounts.jasahub.invalid'});
const request=(body,user=customer())=>({method:'POST',headers:{'content-type':'application/json',host:'example.com',origin:'https://example.com',cookie:'jh_session='+seal({access:user.id,refresh:'refresh-token',expires:Date.now()/1000+3600,version:0})},body});
const restoreFetch=fn=>{const previous=globalThis.fetch;globalThis.fetch=fn;return()=>{globalThis.fetch=previous;};};
test('server price, authenticated identity, and idempotency are enforced',()=>{
 assert.throws(()=>createEngine(fixture(),customer()).run({...checkout(),expectedPrice:1}),/Harga telah berubah/);
 const data=fixture(),engine=createEngine(data,customer());const order=engine.run({...checkout(),price:1,userId:admin().id,status:'Selesai'});
 assert.equal(order.userId,customer().id);assert.equal(order.price,50000);assert.equal(order.status,'Belum Dibayar');assert.equal(engine.run(checkout()).id,order.id);assert.equal(engine.adds.length,1);
});
test('customer cannot access admin or another customer order',()=>{
 const f=fixture();f.Orders=[{id:'other',userId:admin().id,status:'Belum Dibayar'}];const engine=createEngine(f,customer());
 assert.deepEqual(engine.run({action:'orders'}),[]);assert.throws(()=>engine.run({action:'adminData'}),/Akses admin/);assert.throws(()=>engine.run({action:'updateOrder'}),/Akses admin/);
});
test('manual payment verification and exact three states remain unchanged',()=>{
 const f=fixture(),c=createEngine(f,customer());const order=c.run(checkout());c.run({action:'confirmPayment',id:order.id});assert.equal(f.Orders[0].status,'Belum Dibayar');
 const a=createEngine(f,admin());assert.throws(()=>a.run({action:'updateOrder',id:order.id,status:'Selesai'}),/Verifikasi/);
 assert.throws(()=>a.run({action:'updateOrder',id:order.id,status:'Proses Pengerjaan'}),/Centang/);
 a.run({action:'updateOrder',id:order.id,status:'Proses Pengerjaan',paymentVerified:true});assert.equal(f.Orders[0].paymentStatus,'Lunas');
 a.run({action:'updateOrder',id:order.id,status:'Selesai'});assert.ok(f.Orders[0].completedAt);
 assert.throws(()=>a.run({action:'updateOrder',id:order.id,status:'Belum Dibayar'}),/tidak dapat/);
});
test('deleting a package preserves retained IDs and creates atomic changes',()=>{
 const f=fixture(),engine=createEngine(f,admin());engine.run({action:'saveProduct',id:'svc-logo',title:'Logo Website',category:'Design',description:'Pembuatan logo website bisnis.',active:true,packages:[{name:'Basic',price:50000,days:2,revisions:2,features:'Logo PNG dan revisi'}]});
 const changes=changesOf(engine);assert.ok(changes.some(x=>x.table==='Packages'&&x.ordinal===2&&x.delete));assert.equal(f.Packages[0].id,'pkg-basic');assert.throws(()=>engine.run({action:'saveProduct',id:'svc-logo',title:'Logo',category:'Design',description:'Logo website bisnis',packages:[]}),/minimal satu/);
});
test('catalog keeps nested package contract and never exposes customers',()=>{
 const data=createEngine(fixture()).catalog();assert.equal(data.products[0].packages.length,2);assert.ok(!JSON.stringify(data).includes(customer().id));
});
test('upload checks image signature and only accepts registered storage refs',()=>{
 const engine=createEngine(fixture(),admin());
 assert.throws(()=>engine.run({action:'uploadMedia',kind:'qris',data:'data:image/png;base64,'+Buffer.from('fake image fake image').toString('base64'),requestId:'a'.repeat(32)}),/Isi file/);
 assert.throws(()=>createEngine(fixture(),customer()).run({action:'uploadMedia'}),/Akses admin/);
});
test('session cookies are encrypted, HttpOnly, and tamper resistant',()=>{
 const value=seal({access:'a-secret-token',refresh:'a-refresh-token',version:0});assert.ok(!value.includes('secret'));assert.equal(unseal(value).access,'a-secret-token');assert.equal(unseal(value.slice(0,-4)+'AAAA'),null);
 const res=response();setSession(res,{access:'a',refresh:'r',version:0});assert.match(res.headers['Set-Cookie'],/HttpOnly; SameSite=Lax/);
});
test('transient Supabase failure preserves session cookie',async()=>{
 const res=response(),restore=restoreFetch(async()=>{throw Error('offline');});
 try{await assert.rejects(authenticate(request({}),res));assert.ok(!res.headers['Set-Cookie']);}finally{restore();}
});
test('expired access token refreshes without requiring login',async()=>{
 const res=response();const req=request({});req.headers.cookie='jh_session='+seal({access:'expired',refresh:'refresh-old',expires:1,version:0});
 const restore=restoreFetch(async url=>url.includes('grant_type=refresh_token')?Response.json({access_token:'new-token',refresh_token:'new-refresh',expires_in:3600}):url.endsWith('/auth/v1/user')?Response.json({id:customer().id}):Response.json([profile()]));
 try{assert.equal((await authenticate(req,res)).user.id,customer().id);assert.match(res.headers['Set-Cookie'],/jh_session=/);}finally{restore();}
});
test('invalidated session version is rejected and cookie cleared',async()=>{
 const res=response(),restore=restoreFetch(async url=>url.endsWith('/auth/v1/user')?Response.json({id:customer().id}):Response.json([{...profile(),session_version:1}]));
 try{await assert.rejects(authenticate(request({}),res),/Sesi berakhir/);assert.match(res.headers['Set-Cookie'],/Max-Age=0/);}finally{restore();}
});
test('cross-origin writes and malformed requests are rejected',()=>{
 assert.throws(()=>validatePost({...request({}),headers:{host:'example.com',origin:'https://other.com','content-type':'application/json'}}),/Origin/);
 assert.throws(()=>validatePost({...request({}),body:'not-json'}),/JSON/);
});
test('RPC retries transaction conflict then creates exactly one order',async()=>{
 const f=fixture();let revision=1,commits=0;const restore=restoreFetch(async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:customer().id});
  if(url.includes('/profiles?'))return Response.json([profile()]);
  if(url.endsWith('/jh_rate_limit'))return Response.json(true);
  if(url.endsWith('/jh_snapshot'))return Response.json({revision,records:structuredClone(f)});
  if(url.endsWith('/jh_commit')){
   const p=JSON.parse(options.body);commits++;if(commits===1){revision++;return Response.json(false);}
   assert.equal(p.p_expected_revision,revision);for(const op of p.p_changes)if(op.table==='Orders')f.Orders.push(op.data);revision++;return Response.json(true);
  }
  throw Error('Unexpected route');
 });
 try{const res=response();await handler(request(checkout()),res);assert.equal(res.code,200);assert.equal(commits,2);assert.equal(f.Orders.length,1);assert.equal(res.headers['Cache-Control'],'private, no-store');}finally{restore();}
});
test('catalog caches success only and never sets an authentication cookie',async()=>{
 let calls=0;const restore=restoreFetch(async()=>{calls++;return Response.json(fixture());});
 try{const res=response();await catalog({method:'GET',query:{}},res);assert.equal(res.code,200);assert.match(res.headers['Cache-Control'],/s-maxage=600/);assert.ok(!res.headers['Set-Cookie']);assert.equal(calls,1);}finally{restore();}
 const restoreFailure=restoreFetch(async()=>Response.json({code:'test'},{status:500}));
 try{const res=response();await catalog({method:'GET',query:{}},res);assert.equal(res.code,503);assert.equal(res.headers['Cache-Control'],'private, no-store');assert.ok(!JSON.stringify(res.body).includes('private-test-service-key'));}finally{restoreFailure();}
});
test('forged role in request body cannot access admin',async()=>{
 const restore=restoreFetch(async url=>url.endsWith('/auth/v1/user')?Response.json({id:customer().id}):url.includes('/profiles?')?Response.json([profile()]):Response.json({revision:1,records:fixture()}));
 try{const res=response();await handler(request({action:'adminData',role:'admin',userId:admin().id}),res);assert.equal(res.code,400);assert.match(res.body.error,/Akses admin/);}finally{restore();}
});

test('registration preserves phone UI while credentials remain in Supabase Auth',async()=>{
 let created;const restore=restoreFetch(async(url,options)=>{
  if(url.endsWith('/jh_rate_limit'))return Response.json(true);
  if(url.endsWith('/auth/v1/admin/users')){created=JSON.parse(options.body);return Response.json({id:customer().id});}
  if(url.includes('grant_type=password'))return Response.json({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:customer().id}});
  if(url.includes('/profiles?'))return Response.json([profile()]);throw Error('Unexpected request');
 });
 try{const res=response();const req=request({action:'register',phone:'081234567890',name:'Pelanggan',password:'correct-password',role:'admin'});delete req.headers.cookie;await handler(req,res);
  assert.equal(res.code,200);assert.equal(created.email,'u.6281234567890@accounts.jasahub.invalid');assert.ok(!created.user_metadata.role);assert.equal(res.body.data.user.role,'customer');assert.equal(res.body.data.token,'cookie');assert.ok(!JSON.stringify(res.body).includes('correct-password'));assert.match(res.headers['Set-Cookie'],/HttpOnly/);
 }finally{restore();}
});
test('database permission errors preserve valid session rather than logging user out',async()=>{
 const restore=restoreFetch(async url=>url.endsWith('/auth/v1/user')?Response.json({id:customer().id}):Response.json({code:'permission_denied'},{status:403}));
 try{const res=response();await assert.rejects(authenticate(request({}),res));assert.ok(!res.headers['Set-Cookie']);}finally{restore();}
});
test('logout clears cookie even during connection failure',async()=>{
 const restore=restoreFetch(async()=>{throw Error('offline');});
 try{const res=response();await handler(request({action:'logout'}),res);assert.equal(res.code,503);assert.match(res.headers['Set-Cookie'],/Max-Age=0/);}finally{restore();}
});
test('media endpoint serves only registered images and caches successful bytes',async()=>{
 const {default:media}=await import('../api/media.js');let storageRequests=0;
 const restore=restoreFetch(async url=>{
  if(url.includes('/rest/v1/media?'))return Response.json([{data:{fileId:'a'.repeat(32),mime:'image/png',path:'qris/'+ 'a'.repeat(32)+'.png'}}]);
  if(url.includes('/storage/v1/object/authenticated/')){storageRequests++;return new Response(Buffer.from([137,80,78,71]));}
  throw Error('unexpected');
 });
 try{const res=response();await media({method:'GET',query:{id:'a'.repeat(32)}},res);assert.equal(res.code,200);assert.equal(res.headers['Content-Type'],'image/png');assert.match(res.headers['Cache-Control'],/s-maxage=86400/);assert.equal(storageRequests,1);
 const invalid=response();await media({method:'GET',query:{id:'../../secret'}},invalid);assert.equal(invalid.code,400);assert.equal(storageRequests,1);
 }finally{restore();}
});
