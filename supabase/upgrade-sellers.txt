-- JASAhub admin penjual terpisah. Run the ENTIRE file once. Safe to rerun.
-- Existing admin accounts remain website owners; newly invited staff use seller.
begin;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('customer','admin','seller'));

create or replace function public.jh_snapshot(p_user_id uuid,p_admin boolean)
returns jsonb language sql stable security invoker set search_path='' as $jh_snapshot$
 with scope as (
  select coalesce(bool_or(active and role='admin' and p_admin),false) as root,
         coalesce(bool_or(active and role='seller' and p_admin),false) as seller
  from public.profiles where id=p_user_id
 )
 select jsonb_build_object(
  'revision',(select revision from public.jh_revision where id),
  'records',jsonb_build_object(
   'PromoUsage',coalesce((select jsonb_agg(jsonb_build_object('code',u.code,'total',u.total,'mine',u.mine)) from (select data->>'promoCode' code,count(*) total,count(*) filter(where data->>'userId'=p_user_id::text) mine from public.orders where coalesce(data->>'deletedAt','')='' and coalesce(data->>'promoCode','')<>'' group by data->>'promoCode') u),'[]'::jsonb),
   'Staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role,'active',active)) from public.profiles where role in ('admin','seller')),'[]'::jsonb),
   'Products',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.products),'[]'::jsonb),
   'Categories',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.categories),'[]'::jsonb),
   'Packages',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.packages),'[]'::jsonb),
   'Previews',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.previews),'[]'::jsonb),
   'Orders',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.orders where (select root from scope) or data->>'userId'=p_user_id::text or ((select seller from scope) and data->>'sellerId'=p_user_id::text)),'[]'::jsonb),
   'Media',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.media m where (select root from scope)
     or coalesce(m.data->>'kind','') not in ('attachment','deliverable')
     or (m.data->>'ownerId'=p_user_id::text and coalesce(m.data->>'orderId','')='')
     or exists(select 1 from public.orders o where o.record_id=m.data->>'orderId' and coalesce(o.data->>'deletedAt','')='' and (o.data->>'userId'=p_user_id::text or ((select seller from scope) and o.data->>'sellerId'=p_user_id::text)))),'[]'::jsonb),
   'Settings',coalesce((select jsonb_agg(data || jsonb_build_object('_row',ordinal) order by ordinal) from public.settings),'[]'::jsonb),
   'Users',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'phone',coalesce(phone,''),'username',coalesce(username,''),
    'role',role,'active',active,'createdAt',created_at
   ) order by created_at,id) from public.profiles where (select root from scope) or id=p_user_id or ((select seller from scope) and exists(select 1 from public.orders o where coalesce(o.data->>'deletedAt','')='' and o.data->>'sellerId'=p_user_id::text and o.data->>'userId'=profiles.id::text))),'[]'::jsonb)
  )
 );
$jh_snapshot$;


create or replace function public.jh_catalog_snapshot()
returns jsonb language sql stable security invoker set search_path='' as $jh_catalog$
 select jsonb_build_object(
  'Staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'role',role,'active',active)) from public.profiles where role in ('admin','seller')),'[]'::jsonb),
  'Products',coalesce((select jsonb_agg(data order by ordinal) from public.products),'[]'::jsonb),
  'Categories',coalesce((select jsonb_agg(data order by ordinal) from public.categories),'[]'::jsonb),
  'Packages',coalesce((select jsonb_agg(data order by ordinal) from public.packages),'[]'::jsonb),
  'Previews',coalesce((select jsonb_agg(data order by ordinal) from public.previews),'[]'::jsonb),
  'Reviews',coalesce((select jsonb_agg(jsonb_build_object('productId',data->>'productId','review',data->'review','status','Selesai')) from public.orders where coalesce(data->>'deletedAt','')='' and data->>'status'='Selesai' and data->'review' is not null and coalesce(data->'review'->>'visible','true')='true'),'[]'::jsonb),
  'Settings',coalesce((select jsonb_agg(data order by ordinal) from public.settings
   where data->>'key'=any(array['whatsapp','paymentInfo','siteName','siteDescription','heroTitle','heroDescription','footerText','contactInfo','logoUrl','qrisImage','logoAssetVersion']) or data->>'key' like 'seller:%'),'[]'::jsonb),
  'Orders',coalesce((select jsonb_agg(jsonb_build_object('productId',counts.product_id,'count',counts.order_count,'status','active'))
   from (select data->>'productId' as product_id,count(*) as order_count from public.orders where coalesce(data->>'deletedAt','')='' group by data->>'productId') as counts),'[]'::jsonb)
 );
$jh_catalog$;


revoke all on function public.jh_snapshot(uuid,boolean) from public,anon,authenticated;
grant execute on function public.jh_snapshot(uuid,boolean) to service_role;
revoke all on function public.jh_catalog_snapshot() from public,anon,authenticated;
grant execute on function public.jh_catalog_snapshot() to service_role;

-- Called only by the server after authenticating the website owner.
create or replace function public.jh_set_seller_role(p_actor uuid,p_target uuid,p_enable boolean)
returns jsonb language plpgsql security invoker set search_path='' as $jh_staff$
declare target public.profiles%rowtype;
begin
 -- Match commit lock order so revocation also invalidates in-flight writes.
 perform 1 from public.jh_revision where id for update;
 if p_enable is null or not exists(select 1 from public.profiles where id=p_actor and active and role='admin') then
  raise exception 'Owner access required' using errcode='42501';
 end if;
 select * into target from public.profiles where id=p_target for update;
 if not found or not target.active or target.role='admin' or p_target=p_actor then
  raise exception 'Cannot change this account';
 end if;
 if (p_enable and target.role<>'customer') or (not p_enable and target.role<>'seller') then
  raise exception 'Account access has changed; reload';
 end if;
 update public.profiles set role=case when p_enable then 'seller' else 'customer' end,session_version=session_version+1 where id=p_target;
 update public.jh_revision set revision=revision+1 where id;
 return jsonb_build_object('success',true,'id',p_target,'role',case when p_enable then 'seller' else 'customer' end);
end;
$jh_staff$;
revoke all on function public.jh_set_seller_role(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.jh_set_seller_role(uuid,uuid,boolean) to service_role;
commit;
