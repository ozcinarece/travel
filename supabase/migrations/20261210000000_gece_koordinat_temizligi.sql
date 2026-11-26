-- #516 (#513): 30 günü geçen Google koordinatı her gece boşalır, `PLACES_YENILE_ACIK` kapısından bağımsız (PRD §7).
-- Kapı artık yalnız ücretli yenilemeyi (Place Details, places-yenile iş akışı) tutar. Boşaltma Google'a istek atmaz: yalnız
-- `update … set lat = null` (places, trips şehri ve oteli, stays; `places_koordinat_bosalt`, 20261127000000). Satır silinmez;
-- place_id, damga ve kullanıcının yazdığı her şey kalır.
-- Her çalışma kaynak başına boşaltılan satır sayısını yazar (yalnız sayı; içerik, place_id ya da koordinat yok). Masaya
-- yazmak için: supabase-sql iş akışıyla `select * from public.gece_temizligi_kayit order by calisti desc limit 1`.
-- #330 (Ece kararı A) gibi başka gece temizlikleri `gece_temizligi()` içine ayrı adım olarak eklenir.

create table public.gece_temizligi_kayit (
  id bigint generated always as identity primary key,
  calisti timestamptz not null default now(),
  yer integer not null check (yer >= 0),
  seyahat integer not null check (seyahat >= 0),
  otel integer not null check (otel >= 0),
  konaklama integer not null check (konaklama >= 0)
);
alter table public.gece_temizligi_kayit enable row level security;
revoke all on public.gece_temizligi_kayit from public, anon, authenticated;
-- Politika yok: RLS açık + yetki yok → anon / authenticated hiçbir satıra erişemez.

create function public.gece_temizligi()
returns public.gece_temizligi_kayit
language plpgsql security definer set search_path = ''
as $$
declare
  b record;
  k public.gece_temizligi_kayit;
begin
  -- 1. Google koordinatı: 30 günü geçen her koordinat boşalır.
  select * into b from public.places_koordinat_bosalt(null, 30);
  -- (Sonraki adımlar buraya; ör. #330.)
  insert into public.gece_temizligi_kayit (yer, seyahat, otel, konaklama)
  values (b.yer, b.seyahat, b.otel, b.konaklama)
  returning * into k;
  return k;
end;
$$;
revoke execute on function public.gece_temizligi() from public, anon, authenticated;
grant execute on function public.gece_temizligi() to service_role;

-- Her gece 03:15 İstanbul (00:15 UTC; pg_cron UTC ile çalışır). pg_cron yoksa (yerel test kümesi) atlanır.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('gece-temizligi', '15 0 * * *', 'select public.gece_temizligi()');
  end if;
exception when others then
  raise notice 'pg_cron zamanlanamadı: %', sqlerrm;
end;
$$;
