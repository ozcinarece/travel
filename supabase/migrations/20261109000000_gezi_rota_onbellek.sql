-- #192 Önerilen gezi haritası: kuş uçuşu yerine gerçek yol. Bir günün ardışık durakları arasındaki bacaklar bir kez hesaplanır
-- (Edge Function `gezi-rota`, gün başına tek yürüyüş isteği) ve en çok 30 gün saklanır — Google Routes koşulu: konum (polyline
-- dahil) ≤ 30 gün. Seyahatlerdeki walk_cache ile aynı anlam: saniye / metre / polyline yürüyüş rotasıdır; yürüyüş 40 dk'yı
-- aşarsa `mod` = 'DRIVE' ve araç rotası arac_* sütunlarında (mevcut bacak modu kuralı). "Seyahatime al" bacakları fetched_at
-- korunarak seyahatin walk_cache'ine kopyalar (gezi_rotasini_seyahate_kopyala).

create table public.gezi_rota_onbellek (
  gezi_gun_id uuid not null references public.gezi_gunleri (id) on delete cascade,
  kimden_durak_id uuid not null references public.gezi_duraklari (id) on delete cascade,
  kime_durak_id uuid not null references public.gezi_duraklari (id) on delete cascade,
  mod text not null check (mod in ('WALK', 'DRIVE')),
  polyline text not null,
  saniye integer not null check (saniye > 0),
  metre integer not null check (metre >= 0),
  arac_saniye integer,
  arac_metre integer,
  arac_polyline text,
  fetched_at timestamptz not null default now(),
  primary key (gezi_gun_id, kimden_durak_id, kime_durak_id)
);

-- KK1: okuma yayınlı gezide herkese (anon dahil; önerilen gezi oturumsuz da açılır), yayınlanmamışta yalnız admin (BO önizleme).
-- Yazma yalnız service_role (Edge Function); istemci yazamaz.
alter table public.gezi_rota_onbellek enable row level security;
create policy gezi_rota_onbellek_select on public.gezi_rota_onbellek for select to anon, authenticated
  using (exists (select 1 from public.gezi_gunleri gg where gg.id = gezi_gun_id and public.gezi_yayinda(gg.gezi_id)));
create policy gezi_rota_onbellek_admin on public.gezi_rota_onbellek for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.gezi_rota_onbellek from anon, authenticated;

-- KK7: editör / BO / içerik hattı bir günün duraklarını değiştirirse (ekleme, silme, sıra, konum, gün) o günün bacakları silinir;
-- sonraki açılışta gün tek istekte yeniden hesaplanır. Süre, ad, kategori değişikliği rotayı etkilemez.
create or replace function public.gezi_rota_onbellek_bosalt()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.gezi_rota_onbellek where gezi_gun_id = old.gezi_gun_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    delete from public.gezi_rota_onbellek where gezi_gun_id = new.gezi_gun_id;
  end if;
  return null;
end;
$$;
revoke execute on function public.gezi_rota_onbellek_bosalt() from public, anon, authenticated;

create trigger gezi_duraklari_rota_bosalt
after insert or delete or update of sira, lat, lng, gezi_gun_id on public.gezi_duraklari
for each row execute function public.gezi_rota_onbellek_bosalt();

-- KK5: "Seyahatime al" — gezinin önbellekteki (≤ 30 gün) bacakları seyahatin walk_cache'ine, fetched_at korunarak. Duraklar
-- seyahatte Google kimliğiyle anılır; eşleşmeyi istemci verir (gezi durağının place_id'si boş olabilir, istemci adıyla çözer):
-- p_eslesme = [{"durak_id": …, "place_id": …}]. Çağıran seyahatin üyesi olmalı; gezi yayında olmalı (ya da çağıran admin).
-- walk_cache'te daha taze satır varsa ezilmez. Kopyalanan bacak sayısını döner.
create or replace function public.gezi_rotasini_seyahate_kopyala(p_trip uuid, p_eslesme jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  if auth.uid() is null or not public.is_member(p_trip) then
    raise exception 'seyahat bulunamadı' using errcode = '42501';
  end if;
  with e as (
    select (x ->> 'durak_id')::uuid as durak_id, x ->> 'place_id' as place_id
    from jsonb_array_elements(case when jsonb_typeof(p_eslesme) = 'array' then p_eslesme else '[]'::jsonb end) x
    where x ->> 'durak_id' ~ '^[0-9a-f-]{36}$' and x ->> 'place_id' ~ '^[A-Za-z0-9_-]{10,255}$'
  ),
  kaynak as (
    select distinct on (a.place_id, b.place_id)
      a.place_id as from_key, b.place_id as to_key, r.saniye, r.metre, r.polyline, r.mod, r.arac_saniye, r.arac_metre, r.arac_polyline, r.fetched_at
    from public.gezi_rota_onbellek r
    join e a on a.durak_id = r.kimden_durak_id
    join e b on b.durak_id = r.kime_durak_id
    join public.gezi_gunleri gg on gg.id = r.gezi_gun_id
    where r.fetched_at >= now() - interval '30 days'
      and a.place_id <> b.place_id
      and (public.gezi_yayinda(gg.gezi_id) or public.is_admin())
    order by a.place_id, b.place_id, r.fetched_at desc
  )
  insert into public.walk_cache (trip_id, from_key, to_key, seconds, meters, polyline, mode, drive_seconds, drive_meters, drive_polyline, fetched_at)
  select p_trip, from_key, to_key, saniye, metre, polyline, mod, arac_saniye, arac_metre, arac_polyline, fetched_at from kaynak
  on conflict (trip_id, from_key, to_key) do update set
    seconds = excluded.seconds, meters = excluded.meters, polyline = excluded.polyline, mode = excluded.mode,
    drive_seconds = excluded.drive_seconds, drive_meters = excluded.drive_meters, drive_polyline = excluded.drive_polyline,
    fetched_at = excluded.fetched_at
  where public.walk_cache.fetched_at < excluded.fetched_at or public.walk_cache.polyline is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.gezi_rotasini_seyahate_kopyala(uuid, jsonb) from public, anon;
grant execute on function public.gezi_rotasini_seyahate_kopyala(uuid, jsonb) to authenticated;

-- KK6: günlük temizlik — 31 günü aşan rota satırları silinir (Google koşulu: tazelenmeyen konum tutulmaz). Okumada 30 günü geçen
-- bacak zaten yeniden hesaplanır; seyahatlerin walk_cache'i de aynı kurala bağlı olduğu için birlikte temizlenir.
create or replace function public.rota_onbellegi_temizle()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.gezi_rota_onbellek where fetched_at < now() - interval '31 days';
  delete from public.walk_cache where fetched_at < now() - interval '31 days';
$$;
revoke execute on function public.rota_onbellegi_temizle() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('rota-onbellegi-temizle', '29 3 * * *', 'select public.rota_onbellegi_temizle()');
  end if;
exception when others then
  raise notice 'pg_cron zamanlanamadı: %', sqlerrm;
end;
$$;
