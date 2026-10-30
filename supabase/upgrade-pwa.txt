-- JASAhub Emerald PWA upgrade. Run once before deploying new code. Safe to rerun.
begin;
create or replace function public.jh_snapshot(p_user_id uuid,p_admin boolean)
returns jsonb language sql stable security invoker set search_path='' as $jh_snapshot$
 select jsonb_build_object(
  'revision',(select revision from public.jh_revision where id),
  'records',jsonb_build_object(
   'PromoUsage',coalesce((select jsonb_agg(jsonb_build_object('code',u.code,'total',u.total,'mine',u.mine)) from (select data->>'promoCode' code,count(*) total,count(*) filter(where data->>'userId'=p_user_id::text) mine from public.orders where coalesce(data->>'deletedAt','')='' and coalesce(data->>'promoCode','')<>'' group by data->>'promoCode') u),'[]'::jsonb),
   'Products',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.products),'[]'::jsonb),
   'Categories',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.categories),'[]'::jsonb),
   'Packages',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.packages),'[]'::jsonb),
   'Previews',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.previews),'[]'::jsonb),
   'Orders',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.orders where p_admin or data->>'userId'=p_user_id::text),'[]'::jsonb),
   'Media',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.media),'[]'::jsonb),
   'Settings',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.settings),'[]'::jsonb),
   'Users',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'phone',coalesce(phone,''),'username',coalesce(username,''),
    'role',role,'active',active,'createdAt',created_at
   ) order by created_at,id) from public.profiles where p_admin or id=p_user_id),'[]'::jsonb)
  )
 );
$jh_snapshot$;


create or replace function public.jh_catalog_snapshot()
returns jsonb language sql stable security invoker set search_path='' as $jh_catalog$
 select jsonb_build_object(
  'Products',coalesce((select jsonb_agg(data order by ordinal) from public.products),'[]'::jsonb),
  'Categories',coalesce((select jsonb_agg(data order by ordinal) from public.categories),'[]'::jsonb),
  'Packages',coalesce((select jsonb_agg(data order by ordinal) from public.packages),'[]'::jsonb),
  'Previews',coalesce((select jsonb_agg(data order by ordinal) from public.previews),'[]'::jsonb),
  'Reviews',coalesce((select jsonb_agg(jsonb_build_object('productId',data->>'productId','review',data->'review','status','Selesai')) from public.orders where coalesce(data->>'deletedAt','')='' and data->>'status'='Selesai' and data->'review' is not null and coalesce(data->'review'->>'visible','true')='true'),'[]'::jsonb),
  'Settings',coalesce((select jsonb_agg(data order by ordinal) from public.settings
   where data->>'key'=any(array['whatsapp','paymentInfo','siteName','siteDescription','heroTitle','heroDescription','footerText','contactInfo','logoUrl','qrisImage','logoAssetVersion'])),'[]'::jsonb),
  'Orders',coalesce((select jsonb_agg(jsonb_build_object('productId',counts.product_id,'count',counts.order_count,'status','active'))
   from (select data->>'productId' as product_id,count(*) as order_count from public.orders where coalesce(data->>'deletedAt','')='' group by data->>'productId') as counts),'[]'::jsonb)
 );
$jh_catalog$;


revoke all on function public.jh_snapshot(uuid,boolean) from public,anon,authenticated;
grant execute on function public.jh_snapshot(uuid,boolean) to service_role;
revoke all on function public.jh_catalog_snapshot() from public,anon,authenticated;
grant execute on function public.jh_catalog_snapshot() to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('jasahub-files','jasahub-files',false,1500000,array['application/pdf','image/png','image/jpeg','image/webp','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do nothing;
commit;
