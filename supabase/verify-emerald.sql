select id,not public as private_files from storage.buckets where id='jasahub-files';
select role_name,
 has_function_privilege(role_name,'public.jh_snapshot(uuid,boolean)','execute') as can_snapshot,
 has_function_privilege(role_name,'public.jh_catalog_snapshot()','execute') as can_catalog,
 has_function_privilege(role_name,'public.jh_commit(bigint,jsonb)','execute') as can_commit
from (values('anon'),('authenticated')) as roles(role_name);
