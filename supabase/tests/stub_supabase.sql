-- Supabase ortamının migration testleri için gereken en küçük taklidi:
-- roller, auth şeması (uid/jwt), extensions.pgcrypto ve public şemadaki varsayılan yetkiler.
-- Yalnızca yerel/CI Postgres'te çalışır; Supabase projesine uygulanmaz.

-- Roller küme genelidir; tekrar çalıştırmada var olabilir.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create schema extensions;
create extension pgcrypto schema extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  is_anonymous boolean not null default false
);

create function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase public şemasında yeni nesnelere bu varsayılan yetkileri verir.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
