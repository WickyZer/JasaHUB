import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {renderViews} from './ui-harness.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const file=path=>readFileSync(new URL('../'+path,import.meta.url));
const baseline=JSON.parse(readFileSync(new URL('design-baseline.json',import.meta.url),'utf8'));
const html=file('public/index.html').toString(),js=file('public/assets/jasahub.js').toString();
test('original CSS, document structure and logo bytes remain identical',()=>{
 assert.deepEqual([...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>hash(m[1])),baseline.styleSha256);
 assert.equal(hash(html.slice(0,html.indexOf('<script src='))),baseline.markupBeforeScriptSha256);
 assert.equal(hash(file('public/assets/logo.png')),baseline.logoSha256);
});
test('eleven UI renderers match the original website HTML output',()=>{
 for(const [name,result] of Object.entries(renderViews(js)))assert.equal(hash(result),baseline.rendererSha256[name],name);
});
test('all script/style paths resolve and no frontend secret or legacy backend remains',()=>{
 new Script(js);
 for(const match of html.matchAll(/(?:src|href)="(\/[^"?#]*)"/g))assert.ok(existsSync(new URL('../public'+match[1],import.meta.url)),match[1]);
 assert.ok(html.includes('<script src="/assets/jasahub.js" defer></script>'));
 assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|GOOGLE_PRIVATE_KEY|script\.google\.com/.test(js));
 assert.ok(!/catchAll|\/(\.\*)/.test(file('vercel.json').toString()));
});
test('SQL restricts data and transaction functions to server service role',()=>{
 const sql=file('supabase/schema.sql').toString();
 for(const name of ['jh_snapshot(uuid,boolean)','jh_catalog_snapshot()','jh_commit(bigint,jsonb)','jh_rate_limit(text,integer,integer)']){
  assert.ok(sql.includes('revoke all on function public.'+name+' from public,anon,authenticated;'));
  assert.ok(sql.includes('grant execute on function public.'+name+' to service_role;'));
 }
 assert.ok(sql.includes('for update;'));assert.ok(sql.includes('if rev<>p_expected_revision then return false;'));
 assert.ok(sql.includes('enable row level security'));assert.ok(sql.includes("values('jasahub-media','jasahub-media',false"));
});
