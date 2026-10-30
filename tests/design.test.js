import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Script} from 'node:vm';
const file=path=>readFileSync(new URL('../'+path,import.meta.url));
const html=file('public/index.html').toString(),js=file('public/assets/jasahub.js').toString();
test('all script/style paths resolve and no frontend secret or legacy backend remains',()=>{
 new Script(js);new Script(file('public/assets/emerald.js').toString());
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
