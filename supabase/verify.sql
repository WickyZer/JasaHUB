-- Read-only checks after running schema.sql.
select table_name, row_security
from (
 select c.relname table_name,c.relrowsecurity row_security
 from pg_class c join pg_namespace n on c.relnamespace=n.oid
 where n.nspname='public' and c.relname in ('profiles','products','categories','packages','previews','orders','media','settings','jh_revision','jh_limits')
) checks order by table_name;
-- Every result below must be false for anon/authenticated.
select r, f,
 has_function_privilege(r,'public.'||f,'EXECUTE') as can_execute
from unnest(array['anon','authenticated']) r
cross join unnest(array['jh_snapshot(uuid,boolean)','jh_catalog_snapshot()','jh_commit(bigint,jsonb)','jh_rate_limit(text,integer,integer)','jh_invalidate_sessions(uuid)']) f;
select id,public,file_size_limit from storage.buckets where id='jasahub-media';
select role,count(*) from public.profiles group by role;
select 'products' name,count(*) from public.products
union all select 'packages',count(*) from public.packages
union all select 'orders',count(*) from public.orders
union all select 'media',count(*) from public.media;
