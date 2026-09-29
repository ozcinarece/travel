-- Gezi Planlayıcı v1 — başlangıç şeması (PRD v0.2 §8, teknik not v0.2 §3.1 ve §5)
--
-- Google içeriği kuralı (PRD §7): Google'dan yalnızca place_id, lat/lng (≤ 30 gün,
-- google_fetched_at) ve primary_type saklanır. Ad, puan, saat, fotoğraf saklanmaz.
-- Şehir ve otel adı kullanıcının düzenleyebildiği etikettir (city_label, hotel_label).

-- ---------------------------------------------------------------- tipler

create type public.map_visibility as enum ('friends', 'everyone', 'me');
create type public.next_trip_window as enum ('bu_ay', 'uc_ay', 'daha_sonra', 'bilmiyorum');
create type public.member_role as enum ('owner', 'member');

-- ---------------------------------------------------------------- tablolar

-- PRD'deki `users`: auth.users ile karışmasın diye `profiles`.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  photo_url text,
  map_visibility public.map_visibility not null default 'friends',
  next_trip_window public.next_trip_window,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  city_place_id text not null,
  city_label text not null check (char_length(city_label) between 1 and 80),
  lat double precision not null,
  lng double precision not null,
  google_fetched_at timestamptz not null default now(),
  tz text not null,
  start_date date,
  end_date date,
  day_start time not null default '09:00',
  day_end time not null default '20:00',
  hotel_place_id text,
  hotel_lat double precision,
  hotel_lng double precision,
  hotel_label text check (char_length(hotel_label) <= 80),
  hotel_fetched_at timestamptz,
  invite_token text not null unique,
  created_at timestamptz not null default now(),
  constraint tarihler_birlikte check ((start_date is null) = (end_date is null)),
  constraint tarih_sirasi check (end_date >= start_date),
  constraint otel_konumu check ((hotel_lat is null) = (hotel_lng is null)),
  constraint gun_araligi check (day_end > day_start)
);

create table public.members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  guest boolean not null default false,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index members_user_idx on public.members (user_id);

-- Seyahatin mekan havuzu. Güne atanmamış mekan = places var, stops yok.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id text not null,
  primary_type text,
  lat double precision not null,
  lng double precision not null,
  google_fetched_at timestamptz not null default now(),
  default_minutes integer not null default 45 check (default_minutes between 15 and 480),
  added_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (trip_id, place_id),
  unique (id, trip_id)
);

create table public.days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  index integer not null check (index >= 1),
  date date,
  start_time time,
  end_time time,
  order_manual boolean not null default false,
  unique (trip_id, index) deferrable initially deferred,
  unique (id, trip_id)
);

-- Bileşik yabancı anahtarlar durağın günü ve mekanının aynı seyahatte olmasını garanti eder.
create table public.stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_id uuid not null,
  place_ref uuid not null unique,
  order_key text not null collate "C",
  minutes integer not null check (minutes between 15 and 480 and minutes % 15 = 0),
  arrived_at timestamptz,
  arrived_by uuid references auth.users (id) on delete set null,
  skipped boolean not null default false,
  foreign key (day_id, trip_id) references public.days (id, trip_id) on delete cascade,
  foreign key (place_ref, trip_id) references public.places (id, trip_id) on delete cascade
);

create index stops_day_idx on public.stops (day_id, order_key);

-- Yalnızca route-matrix Edge Function'ı (service_role) yazar.
create table public.walk_cache (
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_key text not null,
  to_key text not null,
  seconds integer not null,
  meters integer not null,
  fetched_at timestamptz not null default now(),
  primary key (trip_id, from_key, to_key)
);

-- İstemci yazamaz; tetikleyici yazar (PRD §5.5).
create table public.changes (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  entity text not null,
  entity_id text not null,
  field text,
  old jsonb,
  new jsonb,
  at timestamptz not null default now()
);

create index changes_trip_idx on public.changes (trip_id, at desc);

-- ---------------------------------------------------------------- yardımcılar

create or replace function public.is_member(t uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.members m where m.trip_id = t and m.user_id = auth.uid());
$$;

create or replace function public.is_owner(t uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.trip_id = t and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.is_anonymous()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- 8 karakter base62 (~47 bit), PRD 3.10 KK1.
create or replace function public.new_invite_token()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alfabe constant text := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  bayt bytea := extensions.gen_random_bytes(8);
  sonuc text := '';
begin
  for i in 0..7 loop
    -- 248 = 4 × 62: üstündeki değerler reddedilmez ama sapma < %1; token tahmini için önemsiz.
    sonuc := sonuc || substr(alfabe, (get_byte(bayt, i) % 62) + 1, 1);
  end loop;
  return sonuc;
end;
$$;

alter table public.trips alter column invite_token set default public.new_invite_token();

-- ---------------------------------------------------------------- tetikleyiciler

-- Yeni seyahat: sahibi üye olarak eklenir, günler oluşturulur (tarihsiz → 1 gün).
create or replace function public.trips_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ad text;
  gun_sayisi integer;
begin
  select p.name into ad from public.profiles p where p.id = new.owner_id;
  insert into public.members (trip_id, user_id, display_name, role)
  values (new.id, new.owner_id, coalesce(ad, 'Sahip'), 'owner');

  gun_sayisi := coalesce(new.end_date - new.start_date + 1, 1);
  insert into public.days (trip_id, index, date)
  select new.id, g, new.start_date + (g - 1)
  from generate_series(1, gun_sayisi) g;
  return new;
end;
$$;

create trigger trips_after_insert
after insert on public.trips
for each row execute function public.trips_after_insert();

-- Sahiplik ve davet token'ı yalnızca RPC'lerle değişir.
create or replace function public.trips_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.owner_id is distinct from old.owner_id or new.invite_token is distinct from old.invite_token then
      raise exception 'owner_id ve invite_token doğrudan değiştirilemez' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger trips_guard
before update on public.trips
for each row execute function public.trips_guard();

-- PRD 3.8 KK3: notu yalnızca ekleyen ve sahip düzenler.
create or replace function public.places_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.added_by is distinct from old.added_by then
      raise exception 'added_by değiştirilemez' using errcode = '42501';
    end if;
    if new.note is distinct from old.note
       and auth.uid() is distinct from old.added_by
       and not public.is_owner(old.trip_id) then
      raise exception 'notu yalnızca ekleyen ya da sahip düzenler' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger places_guard
before update on public.places
for each row execute function public.places_guard();

-- Değişiklik akışı (PRD §5.5, 3.7 KK9): her yazma satır ya da alan bazında kaydedilir.
create or replace function public.log_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  eski jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  yeni jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  satir jsonb := coalesce(yeni, eski);
  seyahat uuid := case when tg_table_name = 'trips' then (satir ->> 'id')::uuid else (satir ->> 'trip_id')::uuid end;
  varlik_id text := coalesce(satir ->> 'id', satir ->> 'user_id');
  alan text;
begin
  -- Seyahat silinirken alt satırların silinmesini kaydetmeye gerek yok.
  if tg_op = 'DELETE' and not exists (select 1 from public.trips where id = seyahat) then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    for alan in select jsonb_object_keys(yeni) loop
      if alan not in ('google_fetched_at', 'hotel_fetched_at') and (eski -> alan) is distinct from (yeni -> alan) then
        insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
        values (seyahat, auth.uid(), tg_table_name, varlik_id, alan, eski -> alan, yeni -> alan);
      end if;
    end loop;
  else
    insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
    values (seyahat, auth.uid(), tg_table_name, varlik_id, null, eski, yeni);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trips_log after update on public.trips for each row execute function public.log_change();
create trigger members_log after insert or update or delete on public.members for each row execute function public.log_change();
create trigger places_log after insert or update or delete on public.places for each row execute function public.log_change();
create trigger days_log after insert or update or delete on public.days for each row execute function public.log_change();
create trigger stops_log after insert or update or delete on public.stops for each row execute function public.log_change();

-- ---------------------------------------------------------------- RPC'ler

-- PRD 0.2 KK1: yazarken müsaitlik kontrolü.
create or replace function public.username_available(u text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select u ~ '^[a-z0-9_.]{3,24}$'
     and not exists (select 1 from public.profiles p where p.username = u);
$$;

-- PRD 3.10 KK2: /r/{token} sayfasının özeti; giriş gerektirmez, yalnızca özet döner.
create or replace function public.invite_preview(token text)
returns table (
  city_label text,
  start_date date,
  end_date date,
  hotel_label text,
  member_count bigint,
  place_count bigint,
  inviter_name text
)
language sql stable security definer set search_path = ''
as $$
  select t.city_label, t.start_date, t.end_date, t.hotel_label,
         (select count(*) from public.members m where m.trip_id = t.id),
         (select count(*) from public.places p where p.trip_id = t.id),
         (select m.display_name from public.members m where m.trip_id = t.id and m.role = 'owner')
  from public.trips t
  where t.invite_token = token;
$$;

-- PRD 3.10 KK3: davetle katılım. Misafir anonim oturumla gelir (guest = true).
-- Hız sınırı Edge/API katmanında uygulanır.
create or replace function public.join_trip(token text, ad text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  seyahat uuid;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli' using errcode = '42501';
  end if;
  select t.id into seyahat from public.trips t where t.invite_token = token;
  if seyahat is null then
    raise exception 'davet geçersiz' using errcode = 'P0002';
  end if;
  insert into public.members (trip_id, user_id, guest, display_name)
  values (seyahat, auth.uid(), public.is_anonymous(), trim(ad))
  on conflict (trip_id, user_id) do update set display_name = excluded.display_name;
  return seyahat;
end;
$$;

-- PRD 3.10 KK1: sahip linki iptal eder → yeni token.
create or replace function public.rotate_invite_token(t uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  yeni text := public.new_invite_token();
begin
  if not public.is_owner(t) then
    raise exception 'yalnızca sahip' using errcode = '42501';
  end if;
  update public.trips set invite_token = yeni where id = t;
  return yeni;
end;
$$;

-- Hesap silme (App Store zorunluluğu, v1 Profil). Sahip olunan seyahat en eski üyeye
-- devredilir; başka üye yoksa silinir. auth.users kaydını hesap-sil Edge Function'ı siler.
create or replace function public.prepare_account_deletion()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s record;
  varis uuid;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli' using errcode = '42501';
  end if;
  for s in select m.trip_id from public.members m where m.user_id = auth.uid() and m.role = 'owner' loop
    select m.user_id into varis from public.members m
    where m.trip_id = s.trip_id and m.user_id <> auth.uid()
    order by m.guest, m.joined_at
    limit 1;
    if varis is null then
      delete from public.trips where id = s.trip_id;
    else
      update public.members set role = 'owner' where trip_id = s.trip_id and user_id = varis;
      update public.trips set owner_id = varis where id = s.trip_id;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.members enable row level security;
alter table public.places enable row level security;
alter table public.days enable row level security;
alter table public.stops enable row level security;
alter table public.walk_cache enable row level security;
alter table public.changes enable row level security;

-- profiles: ad ve kullanıcı adı üyelere görünür; herkes yalnızca kendi satırını yazar.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and not public.is_anonymous());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- trips: misafir seyahat oluşturamaz; her üye düzenler; yalnızca sahip siler.
create policy trips_select on public.trips for select to authenticated using (public.is_member(id));
create policy trips_insert on public.trips for insert to authenticated
  with check (owner_id = auth.uid() and not public.is_anonymous());
create policy trips_update on public.trips for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));
create policy trips_delete on public.trips for delete to authenticated using (public.is_owner(id));

-- members: ekleme yalnızca join_trip ve tetikleyiciyle; kişi kendi adını değiştirir;
-- sahip üyeyi çıkarır, üye kendisi ayrılır (sahip ayrılamaz, önce devretmeli).
create policy members_select on public.members for select to authenticated using (public.is_member(trip_id));
create policy members_update on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_delete on public.members for delete to authenticated
  using ((public.is_owner(trip_id) and user_id <> auth.uid()) or (user_id = auth.uid() and role = 'member'));
revoke update on public.members from authenticated;
grant update (display_name) on public.members to authenticated;

-- PRD 3.4 KK7: mekan ekleyenin kimliğiyle kaydedilir.
create policy places_select on public.places for select to authenticated using (public.is_member(trip_id));
create policy places_insert on public.places for insert to authenticated
  with check (public.is_member(trip_id) and added_by = auth.uid());
create policy places_update on public.places for update to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));
create policy places_delete on public.places for delete to authenticated using (public.is_member(trip_id));
create policy days_all on public.days for all to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));
create policy stops_all on public.stops for all to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));

create policy walk_cache_select on public.walk_cache for select to authenticated using (public.is_member(trip_id));
create policy changes_select on public.changes for select to authenticated using (public.is_member(trip_id));

-- ---------------------------------------------------------------- yetkiler

revoke execute on all functions in schema public from public, anon;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.username_available(text) to authenticated;
grant execute on function public.join_trip(text, text) to authenticated;
grant execute on function public.rotate_invite_token(uuid) to authenticated;
grant execute on function public.prepare_account_deletion() to authenticated;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.is_anonymous() to authenticated;

-- ---------------------------------------------------------------- Realtime (PRD §5.5)

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.trips, public.members, public.places, public.days, public.stops;
  end if;
end;
$$;
