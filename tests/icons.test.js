import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../public/',import.meta.url),files=readdirSync(new URL('icons/',root)).filter(x=>x.endsWith('.svg'));
test('all 17 icon files contain small native vectors without raster or external content',()=>{assert.equal(files.length,17);for(const file of files){const s=readFileSync(new URL('icons/'+file,root),'utf8');assert.match(s,/viewBox="0 0 64 64"/);assert.match(s,/<path|<rect|<circle/);assert.doesNotMatch(s,/<image|<script|foreignObject|base64|href=/i);assert.ok(Buffer.byteLength(s)<2200,file);assert.match(s,/#1E293B/);assert.match(s,/#10B981/);}});
test('reusable inline renderer follows requested size and assigns unique gradient references',()=>{const ctx=vm.createContext({icon:()=>'<svg>fallback</svg>'});vm.runInContext(readFileSync(new URL('assets/icons.js',root),'utf8'),ctx);const first=ctx.icon('home',24),second=ctx.icon('home',18);assert.match(first,/width="24" height="24"/);assert.match(second,/width="18" height="18"/);assert.match(first,/aria-hidden="true"/);const ids=[...first.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);assert.ok(ids.every(id=>!second.includes('id="'+id+'"')));assert.equal(ctx.icon('clock'),'<svg>fallback</svg>');});
