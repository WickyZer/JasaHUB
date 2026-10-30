import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '../lib/engine.js';
import {deletionTicket} from '../lib/order-deletion.js';
import {changesOf} from '../lib/supabase.js';
import {fixture,admin,customer,checkout} from './fixtures.js';
import {readFileSync,existsSync} from 'node:fs';
import {Script} from 'node:vm';
process.env.SESSION_SECRET='7'.repeat(64);
test('admin deletion requires first-stage ticket, final confirmation, correct identity and unchanged order',()=>{
 const r=fixture(),c=createEngine(r,customer()),a=createEngine(r,admin());const o=c.run(checkout());
 assert.throws(()=>c.run({action:'prepareDeleteOrder',id:o.id}),/admin/);
 assert.throws(()=>c.run({action:'deleteOrder',id:o.id,confirm:true}),/admin/);
 assert.throws(()=>a.run({action:'deleteOrder',id:o.id,confirm:true}),/Konfirmasi/);
 const ticket=a.run({action:'prepareDeleteOrder',id:o.id}).ticket;
 assert.throws(()=>a.run({action:'deleteOrder',id:o.id,ticket,confirm:false}),/Konfirmasi/);
 assert.throws(()=>a.run({action:'deleteOrder',id:o.id,ticket:ticket+'x',confirm:true}),/Konfirmasi/);
 const other={...admin(),id:'other-admin'};
 assert.throws(()=>createEngine(r,other).run({action:'deleteOrder',id:o.id,ticket,confirm:true}),/Konfirmasi/);
 r.Orders[0].updatedAt='changed';assert.throws(()=>a.run({action:'deleteOrder',id:o.id,ticket,confirm:true}),/Konfirmasi/);
});
test('expired confirmation rejected and archive hides order, reviews and dashboard data',()=>{
 const r=fixture(),c=createEngine(r,customer());const o=c.run(checkout());r.Orders[0]._row=10;
 r.Orders[0].status='Selesai';r.Orders[0].review={rating:5,text:'Bagus',author:'A',visible:true};
 const a=createEngine(r,admin());const clock=Date.now;let old;try{Date.now=()=>clock()-6*60000;old=deletionTicket(r.Orders[0],admin());}finally{Date.now=clock;}
 assert.throws(()=>a.run({action:'deleteOrder',id:o.id,ticket:old,confirm:true}),/Konfirmasi/);
 const ticket=a.run({action:'prepareDeleteOrder',id:o.id}).ticket;a.run({action:'deleteOrder',id:o.id,ticket,confirm:true});
 assert.ok(r.Orders[0].deletedAt);assert.equal(r.Orders[0].deletedBy,admin().id);assert.equal(r.Orders[0].id,o.id);
 assert.equal(createEngine(r,customer()).run({action:'orders'}).length,0);
 assert.equal(a.run({action:'adminData'}).orders.length,0);
 assert.equal(createEngine(r).catalog().products[0].reviews.length,0);
 assert.equal(createEngine(r).catalog().products[0].orderCount,0);
 assert.throws(()=>c.run(checkout()),/dihapus admin/);
 assert.ok(changesOf(a).some(x=>x.table==='Orders'&&x.ordinal===10&&!x.delete&&x.data.deletedAt));
});
test('manifest icons exist with declared PNG dimensions and bootstrap remains classic-script valid',()=>{
 const root=new URL('../public/',import.meta.url);const html=readFileSync(new URL('index.html',root),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root)));
 assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/#catalog');
 for(const icon of manifest.icons){const bytes=readFileSync(new URL('.'+icon.src,root));const size=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
 for(const m of html.matchAll(/(?:src|href)="(\/[^"?#]*)"/g))assert.ok(existsSync(new URL('.'+m[1],root)),m[1]);
 for(const f of ['assets/jasahub.js','assets/emerald.js','assets/pwa.js','sw.js'])new Script(readFileSync(new URL(f,root),'utf8'));
 const sw=readFileSync(new URL('sw.js',root),'utf8');assert.ok(sw.includes("url.pathname.startsWith('/api/')"));
});
