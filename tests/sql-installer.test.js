import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../supabase/'+name,import.meta.url),'utf8');
const sql=read('schema.sql');
function statements(source){
 const result=[];let quote=null,start=0;
 for(let i=0;i<source.length;i++){
  if(quote){
   if(quote==="'"&&source[i]==="'"&&source[i+1]==="'"){i++;continue;}
   if(source.startsWith(quote,i)){i+=quote.length-1;quote=null;}
  }else if(source.startsWith('--',i)){const next=source.indexOf('\n',i);i=next<0?source.length:next;}
  else if(source[i]==="'")quote="'";
  else if(source[i]==='$'){const tag=source.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$/)?.[0];if(tag){quote=tag;i+=tag.length-1;}}
  else if(source[i]===';'){result.push(source.slice(start,i+1));start=i+1;}
 }
 assert.equal(quote,null,'Unclosed SQL string/function body');assert.equal(source.slice(start).trim(),'');return result;
}
test('installer copies are complete and contain no top-level procedural fragments',()=>{
 assert.equal(sql,read('schema-install.sql'));assert.equal(sql,read('schema-install.txt'));
 assert.ok(!/\bforeach\b/i.test(sql));assert.ok(!/\bdo\s+\$/i.test(sql));
 const parts=statements(sql);assert.equal(parts.filter(x=>/create or replace function/i.test(x)).length,7);
 assert.match(parts[0],/rollback;/i);assert.match(parts.at(-1),/commit;/i);
});
test('all content tables and revision triggers are emitted as explicit SQL',()=>{
 for(const table of ['products','categories','packages','previews','orders','media','settings']){
  assert.ok(sql.includes('create table if not exists public.'+table));
  assert.ok(sql.includes('alter table public.'+table+' enable row level security;'));
  assert.ok(sql.includes('grant all on public.'+table+' to service_role;'));
  assert.ok(sql.includes('create trigger jh_revision_changed after insert or update or delete on public.'+table));
 }
 assert.ok(sql.includes("'count',counts.order_count"));
});
