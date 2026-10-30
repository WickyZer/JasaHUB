-- JASAhub Vercel + Supabase. Run once in a NEW project's SQL Editor.
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
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,name,phone,login_email)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),'Pelanggan'),nullif(new.raw_user_meta_data->>'phone',''),new.email)
 on conflict(id) do update set name=excluded.name,phone=excluded.phone,login_email=excluded.login_email;
 -- Role, active, username, legacy_id and session_version are NOT user metadata.
 return new;
end $$;
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
do $$ declare t text;begin
 foreach t in array array['products','categories','packages','previews','orders','media','settings'] loop
  execute format('create table if not exists public.%I(record_id text primary key, ordinal bigint generated always as identity unique, data jsonb not null check(jsonb_typeof(data)=''object''))',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on all sequences in schema public to service_role;
create unique index if not exists jh_order_request on public.orders((data->>'userId'),(data->>'requestId')) where coalesce(data->>'requestId','')<>'';
create index if not exists jh_orders_user on public.orders((data->>'userId'));
create index if not exists jh_package_product on public.packages((data->>'productId'));
create index if not exists jh_preview_product on public.previews((data->>'productId'));
do $$ begin
 if not exists(select 1 from pg_constraint where conname='jh_order_status') then
  alter table public.orders add constraint jh_order_status check(data->>'status' in ('Belum Dibayar','Proses Pengerjaan','Selesai'));
 end if;
end $$;

create or replace function public.jh_bump_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
begin update public.jh_revision set revision=revision+1 where id;return null;end $$;
do $$ declare t text;begin
 foreach t in array array['products','categories','packages','previews','orders','media','settings','profiles'] loop
  execute format('drop trigger if exists jh_revision_changed on public.%I',t);
  execute format('create trigger jh_revision_changed after insert or update or delete on public.%I for each statement execute function public.jh_bump_revision()',t);
 end loop;
end $$;

create or replace function public.jh_snapshot(p_user_id uuid,p_admin boolean)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; n text;t text;items jsonb;
begin
 result=jsonb_build_object('revision',(select revision from public.jh_revision where id),'records','{}'::jsonb);
 foreach n in array array['Products','Categories','Packages','Previews','Orders','Media','Settings'] loop
  t=lower(n);
  if n='Orders' and not p_admin then
   select coalesce(jsonb_agg(data||jsonb_build_object('_row',ordinal) order by ordinal),'[]'::jsonb) into items from public.orders where data->>'userId'=p_user_id::text;
  else
   execute format('select coalesce(jsonb_agg(data||jsonb_build_object(''_row'',ordinal) order by ordinal),''[]''::jsonb) from public.%I',t) into items;
  end if;
  result=jsonb_set(result,array['records',n],items);
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',coalesce(phone,''),'username',coalesce(username,''),'role',role,'active',active,'createdAt',created_at)),'[]'::jsonb)
 into items from public.profiles where p_admin or id=p_user_id;
 result=jsonb_set(result,'{records,Users}',items);
 return result;
end $$;

create or replace function public.jh_catalog_snapshot()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb='{}'::jsonb;n text;items jsonb;
begin
 foreach n in array array['Products','Categories','Packages','Previews'] loop
  execute format('select coalesce(jsonb_agg(data order by ordinal),''[]''::jsonb) from public.%I',lower(n)) into items;
  result=jsonb_set(result,array[n],items);
 end loop;
 select coalesce(jsonb_agg(data),'[]'::jsonb) into items from public.settings where data->>'key'=any(array['whatsapp','paymentInfo','siteName','siteDescription','heroTitle','heroDescription','footerText','contactInfo','logoUrl','qrisImage']);
 result=jsonb_set(result,'{Settings}',items);
 select coalesce(jsonb_agg(jsonb_build_object('productId',product_id,'count',n,'status','active')),'[]'::jsonb) into items
 from (select data->>'productId' product_id,count(*) n from public.orders group by data->>'productId') counts;
 return jsonb_set(result,'{Orders}',items);
end $$;

-- Compare-and-swap prevents lost updates. One transaction commits ALL record changes.
create or replace function public.jh_commit(p_expected_revision bigint,p_changes jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
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
end $$;

-- Persistent limiter shared by all Vercel instances; stores HMAC keys only.
create table if not exists public.jh_limits(key text primary key,hits integer not null,until_at timestamptz not null);
alter table public.jh_limits enable row level security;
revoke all on public.jh_limits from anon,authenticated;
grant all on public.jh_limits to service_role;
create or replace function public.jh_rate_limit(p_key text,p_max integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;begin
 insert into public.jh_limits(key,hits,until_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when public.jh_limits.until_at<=now() then 1 else public.jh_limits.hits+1 end,
 until_at=case when public.jh_limits.until_at<=now() then now()+make_interval(secs=>p_seconds) else public.jh_limits.until_at end returning hits into n;
 -- Bounded cleanup; no request identifiers or plaintext credentials are retained.
 delete from public.jh_limits where key in(select key from public.jh_limits where until_at<now()-interval '1 day' limit 100);
 return n<=p_max;
end $$;

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
returns void language sql security invoker set search_path='' as $$
 update public.profiles set session_version=session_version+1 where id=p_user_id;
$$;
revoke all on function public.jh_invalidate_sessions(uuid) from public,anon,authenticated;
grant execute on function public.jh_invalidate_sessions(uuid) to service_role;

commit;
