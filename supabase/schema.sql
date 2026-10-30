rollback; -- Clear any failed transaction from the previous installation attempt.
-- JASAhub Vercel + Supabase - complete installer (revision 2).
-- Paste the ENTIRE file in a NEW SQL query. Run all, not a selected fragment.
-- No password columns and no hardcoded admin credentials.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 legacy_id text unique,
 name text not null check(length(name) between 2 and 80),
 phone text unique,
 username text unique check(username is null or username=lower(username)),
 login_email text unique,
 role text not null default 'customer' check(role in ('customer','admin')),
 active boolean not null default true,
 session_version integer not null default 0,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant all on public.profiles to service_role;

create or replace function public.jh_sync_auth_profile() returns trigger
language plpgsql security definer set search_path='' as $jh_body_1$
begin
 insert into public.profiles(id,name,phone,login_email)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),'Pelanggan'),nullif(new.raw_user_meta_data->>'phone',''),new.email)
 on conflict(id) do update set name=excluded.name,phone=excluded.phone,login_email=excluded.login_email;
 -- Role, active, username, legacy_id and session_version are NOT user metadata.
 return new;
end;
$jh_body_1$;
revoke all on function public.jh_sync_auth_profile() from public,anon,authenticated;
drop trigger if exists jh_auth_profile on auth.users;
create trigger jh_auth_profile after insert or update of email,raw_user_meta_data on auth.users
for each row execute function public.jh_sync_auth_profile();

create table if not exists public.jh_revision(id boolean primary key default true check(id),revision bigint not null default 0);
insert into public.jh_revision(id) values(true) on conflict do nothing;
alter table public.jh_revision enable row level security;
revoke all on public.jh_revision from anon,authenticated;
grant all on public.jh_revision to service_role;

-- JSONB preserves every old content field without changing the frontend contract.
-- Use the existing JASAhub admin UI to edit these records.
create table if not exists public.products (
 record_id text primary key,
 ordinal bigint generated always as identity unique,
 data jsonb not null check(jsonb_typeof(data)='object')
);
alter table public.products enable row level security;
revoke all on public.products from anon,authenticated;
grant all on public.products to service_role;

create table if not exists public.categories (
 record_id text primary key,
 ordinal bigint generated always as identity unique,
 data jsonb not null check(jsonb_typeof(data)='object')
);
alter table public.categories enable row level security;
revoke all on public.categories from anon,authenticated;
grant all on public.categories to service_role;

create table if not exists public.packages (
 record_id text primary key,
 ordinal bigint generated always as identity unique,
 data jsonb not null check(jsonb_typeof(data)='object')
);
alter table public.packages enable row level security;
revoke all on public.packages from anon,authenticated;
grant all on public.packages to service_role;

create table if not exists public.previews (
 record_id text primary key,
 ordinal bigint generated always as identity unique,
 data jsonb not null check(jsonb_typeof(data)='object')
);
alter table public.previews enable row level security;
revoke all on public.previews from anon,authenticated;
grant all on public.previews to service_role;

create table if not exists public.orders (
 record_id text primary key,
 ordinal bigint generated always as identity unique,
 data jsonb not null check(jsonb_typeof(data)='object')
);
alter table public.orders enable row level security;
revoke all on public.orders from anon,authenticated;
grant all on public.orders to service_role;

create table if not exists public.media (
 record_id text primary key,
 ordinal bigint generated always as identity unique,
 data jsonb not null check(jsonb_typeof(data)='object')
);
alter table public.media enable row level security;
revoke all on public.media from anon,authenticated;
grant all on public.media to service_role;

create table if not exists public.settings (
 record_id text primary key,
 ordinal bigint generated always as identity unique,
 data jsonb not null check(jsonb_typeof(data)='object')
);
alter table public.settings enable row level security;
revoke all on public.settings from anon,authenticated;
grant all on public.settings to service_role;

grant usage,select on all sequences in schema public to service_role;
create unique index if not exists jh_order_request on public.orders((data->>'userId'),(data->>'requestId')) where coalesce(data->>'requestId','')<>'';
create index if not exists jh_orders_user on public.orders((data->>'userId'));
create index if not exists jh_package_product on public.packages((data->>'productId'));
create index if not exists jh_preview_product on public.previews((data->>'productId'));
-- This changes only the validation constraint, never drops any table/data.
alter table public.orders drop constraint if exists jh_order_status;
alter table public.orders add constraint jh_order_status
 check(coalesce(data->>'status','') in ('Belum Dibayar','Proses Pengerjaan','Selesai'));

create or replace function public.jh_bump_revision() returns trigger
language plpgsql security invoker set search_path='' as $jh_body_2$
begin update public.jh_revision set revision=revision+1 where id;return null;end;
$jh_body_2$;
drop trigger if exists jh_revision_changed on public.products;
create trigger jh_revision_changed after insert or update or delete on public.products
for each statement execute function public.jh_bump_revision();
drop trigger if exists jh_revision_changed on public.categories;
create trigger jh_revision_changed after insert or update or delete on public.categories
for each statement execute function public.jh_bump_revision();
drop trigger if exists jh_revision_changed on public.packages;
create trigger jh_revision_changed after insert or update or delete on public.packages
for each statement execute function public.jh_bump_revision();
drop trigger if exists jh_revision_changed on public.previews;
create trigger jh_revision_changed after insert or update or delete on public.previews
for each statement execute function public.jh_bump_revision();
drop trigger if exists jh_revision_changed on public.orders;
create trigger jh_revision_changed after insert or update or delete on public.orders
for each statement execute function public.jh_bump_revision();
drop trigger if exists jh_revision_changed on public.media;
create trigger jh_revision_changed after insert or update or delete on public.media
for each statement execute function public.jh_bump_revision();
drop trigger if exists jh_revision_changed on public.settings;
create trigger jh_revision_changed after insert or update or delete on public.settings
for each statement execute function public.jh_bump_revision();
drop trigger if exists jh_revision_changed on public.profiles;
create trigger jh_revision_changed after insert or update or delete on public.profiles
for each statement execute function public.jh_bump_revision();

create or replace function public.jh_snapshot(p_user_id uuid,p_admin boolean)
returns jsonb language sql stable security invoker set search_path='' as $jh_snapshot$
 select jsonb_build_object(
  'revision',(select revision from public.jh_revision where id),
  'records',jsonb_build_object(
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
  'Settings',coalesce((select jsonb_agg(data order by ordinal) from public.settings
   where data->>'key'=any(array['whatsapp','paymentInfo','siteName','siteDescription','heroTitle','heroDescription','footerText','contactInfo','logoUrl','qrisImage'])),'[]'::jsonb),
  'Orders',coalesce((select jsonb_agg(jsonb_build_object('productId',counts.product_id,'count',counts.order_count,'status','active'))
   from (select data->>'productId' as product_id,count(*) as order_count from public.orders group by data->>'productId') as counts),'[]'::jsonb)
 );
$jh_catalog$;

-- Compare-and-swap prevents lost updates. One transaction commits ALL record changes.
create or replace function public.jh_commit(p_expected_revision bigint,p_changes jsonb)
returns boolean language plpgsql security invoker set search_path='' as $jh_body_3$
declare rev bigint;op jsonb;t text;d jsonb;key text;n bigint;
begin
 select revision into rev from public.jh_revision where id for update;
 if rev<>p_expected_revision then return false;end if;
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>1000 then raise exception 'invalid change batch';end if;
 for op in select value from jsonb_array_elements(p_changes) loop
  t=lower(op->>'table');
  if t<>all(array['products','categories','packages','previews','orders','media','settings']) then raise exception 'invalid table';end if;
  d=(op->'data')-'_row';
  if (op->>'ordinal') is not null then
   if coalesce((op->>'delete')::boolean,false) then
    execute format('delete from public.%I where ordinal=$1',t) using (op->>'ordinal')::bigint;
   else
    key=case when t='settings' then d->>'key' else d->>'id' end;
    execute format('update public.%I set data=$1 where ordinal=$2 and record_id=$3',t) using d,(op->>'ordinal')::bigint,key;
    get diagnostics n=row_count;if n<>1 then raise exception 'stale record';end if;
   end if;
  else
   key=case when t='settings' then d->>'key' else d->>'id' end;
   if coalesce(key,'')='' then raise exception 'missing record key';end if;
   execute format('insert into public.%I(record_id,data) values($1,$2)',t) using key,d;
  end if;
 end loop;
 return true;
end;
$jh_body_3$;

-- Persistent limiter shared by all Vercel instances; stores HMAC keys only.
create table if not exists public.jh_limits(key text primary key,hits integer not null,until_at timestamptz not null);
alter table public.jh_limits enable row level security;
revoke all on public.jh_limits from anon,authenticated;
grant all on public.jh_limits to service_role;
create or replace function public.jh_rate_limit(p_key text,p_max integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $jh_body_4$
declare n integer;begin
 insert into public.jh_limits(key,hits,until_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when public.jh_limits.until_at<=now() then 1 else public.jh_limits.hits+1 end,
 until_at=case when public.jh_limits.until_at<=now() then now()+make_interval(secs=>p_seconds) else public.jh_limits.until_at end returning hits into n;
 -- Bounded cleanup; no request identifiers or plaintext credentials are retained.
 delete from public.jh_limits where key in(select key from public.jh_limits where until_at<now()-interval '1 day' limit 100);
 return n<=p_max;
end;
$jh_body_4$;

-- PRIVATE bucket: registered images are served through Vercel /api/media.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('jasahub-media','jasahub-media',false,1500000,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
-- No anon/authenticated Storage write policy is granted.

revoke all on function public.jh_snapshot(uuid,boolean) from public,anon,authenticated;
revoke all on function public.jh_catalog_snapshot() from public,anon,authenticated;
revoke all on function public.jh_commit(bigint,jsonb) from public,anon,authenticated;
revoke all on function public.jh_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.jh_bump_revision() from public,anon,authenticated;
grant execute on function public.jh_snapshot(uuid,boolean) to service_role;
grant execute on function public.jh_catalog_snapshot() to service_role;
grant execute on function public.jh_commit(bigint,jsonb) to service_role;
grant execute on function public.jh_rate_limit(text,integer,integer) to service_role;
grant execute on function public.jh_bump_revision() to service_role;

create or replace function public.jh_invalidate_sessions(p_user_id uuid)
returns void language sql security invoker set search_path='' as $jh_body_5$
update public.profiles set session_version=session_version+1 where id=p_user_id;
$jh_body_5$;
revoke all on function public.jh_invalidate_sessions(uuid) from public,anon,authenticated;
grant execute on function public.jh_invalidate_sessions(uuid) to service_role;

commit;
