-- #56: otel her an ve gün bazında. Seyahatte kullanılan oteller `stays`; her günün başlangıç ve bitiş noktası
-- days.start_stay_id / end_stay_id (null = otel yok). trips.hotel_* artık okunmaz (eski derlemeler için 3.3 ekranı
-- yazmaya devam eder; bir sürüm sonra kaldırılır).
create table public.stays (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  -- PRD §7: Google adı saklanmaz; kullanıcı metni / seçimde gelen ad (≤ 80).
  label text check (label is null or char_length(label) <= 80),
  google_fetched_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, trip_id)
);

create index stays_trip_idx on public.stays (trip_id);

alter table public.days
  add column start_stay_id uuid references public.stays (id) on delete set null,
  add column end_stay_id uuid references public.stays (id) on delete set null;

-- Günün oteli aynı seyahatin oteli olmalı (bileşik FK "on delete set null" ile trip_id'yi de boşaltacağı için tetikleyici).
create or replace function public.days_stay_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Yalnız değişen alan denetlenir (otel silinirken FK "set null" iki alanı ayrı ayrı boşaltır).
  if new.start_stay_id is not null and (tg_op = 'INSERT' or new.start_stay_id is distinct from old.start_stay_id) and not exists (select 1 from public.stays s where s.id = new.start_stay_id and s.trip_id = new.trip_id) then
    raise exception 'başlangıç oteli bu seyahate ait değil' using errcode = '23503';
  end if;
  if new.end_stay_id is not null and (tg_op = 'INSERT' or new.end_stay_id is distinct from old.end_stay_id) and not exists (select 1 from public.stays s where s.id = new.end_stay_id and s.trip_id = new.trip_id) then
    raise exception 'bitiş oteli bu seyahate ait değil' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger days_stay_guard
before insert or update of start_stay_id, end_stay_id on public.days
for each row execute function public.days_stay_guard();

alter table public.stays enable row level security;

create policy stays_select on public.stays for select to authenticated using (public.is_member(trip_id));
create policy stays_insert on public.stays for insert to authenticated
  with check (public.is_member(trip_id) and created_by = auth.uid());
create policy stays_update on public.stays for update to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));
create policy stays_delete on public.stays for delete to authenticated using (public.is_member(trip_id));

-- Veri taşıma: oteli olan ve henüz stays satırı olmayan her seyahate bir stays satırı; tüm günler başlangıç = bitiş =
-- o otel. Fonksiyon olarak tutulur ki testte de çalıştırılabilsin (tekrar çağrılınca yalnız taşınmamışlara dokunur).
-- Taşıma değişiklik akışına yazılmaz (kullanıcı eylemi değil).
create or replace function public.stays_tasi_eski_oteller()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  yeniler uuid[];
begin
  with eklenen as (
    insert into public.stays (trip_id, place_id, lat, lng, label, google_fetched_at, created_by)
    select t.id, t.hotel_place_id, t.hotel_lat, t.hotel_lng, left(t.hotel_label, 80), t.hotel_fetched_at, t.owner_id
    from public.trips t
    where t.hotel_lat is not null and t.hotel_lng is not null
      and not exists (select 1 from public.stays s where s.trip_id = t.id)
    returning id
  )
  select coalesce(array_agg(id), '{}') into yeniler from eklenen;

  alter table public.days disable trigger days_log;
  update public.days d
  set start_stay_id = s.id, end_stay_id = s.id
  from public.stays s
  where s.id = any (yeniler) and s.trip_id = d.trip_id;
  alter table public.days enable trigger days_log;
  return coalesce(array_length(yeniler, 1), 0);
end;
$$;

revoke execute on function public.stays_tasi_eski_oteller() from public, anon, authenticated;
select public.stays_tasi_eski_oteller();

-- Değişiklik akışı: otel ekleme/silme; günün oteli değişikliği days_log ile alan bazında (start_stay_id, end_stay_id).
create trigger stays_log after insert or update or delete on public.stays for each row execute function public.log_change();


do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.stays;
  end if;
end;
$$;
