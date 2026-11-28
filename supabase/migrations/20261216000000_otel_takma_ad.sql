-- #584 (#248, #250): otel adı Google'dan süresiz saklanmaz (PRD §7, T1; Google şartları §3.2.3(a)(iii)).
-- KK1: `place_id`'li otelde yalnız place_id + koordinat (stays.google_fetched_at / trips.hotel_fetched_at, ≤ 30 gün,
--      #262) kalır; ad ekranda places-light ile canlı okunur (istemcide oturum önbelleği, DB'ye yazılmaz).
-- KK2: kullanıcı otele kendi takma adını verebilir (`stays.takma_ad`); bu kullanıcı verisidir, saklanır.
-- Bu dosya veri silmez, otomatik yayına çıkar: yeni sütun + yeni yazımlarda Google adını tutmayan tetikleyici. Eski
-- satırlardaki Google adlarını temizleyen migration ayrıdır (20261216100000_otel_google_adi_temizligi.sql; veri
-- siler, Ece onaylı, `main`'den elle çalıştırılır). Google'a yeni istek yok.

-- KK2: takma ad. Yetki mevcut `stays_update` politikasıyla aynı: seyahatin her üyesi yazabilir (otel de öyle).
alter table public.stays
  add column takma_ad text check (takma_ad is null or char_length(btrim(takma_ad)) between 1 and 80);
comment on column public.stays.takma_ad is
  '#584 KK2: kullanıcının otele verdiği ad (ör. "Bizim otel"); kullanıcı verisi. Görünen ad: takma_ad, yoksa place_id''li otelde canlı Google adı (saklanmaz), place_id''siz noktada label.';
comment on column public.stays.label is
  '#584: yalnız place_id''siz (haritadan seçilen) noktanın adı. place_id doluysa null (stays_google_adi_tutma tetikleyicisi).';

-- KK1: istemci ne yazarsa yazsın (eski derlemeler #248 öncesi JS'le Google adını label'a yazar) place_id'li otelin adı
-- saklanmaz. Eski satırlara dokunmaz; yalnız eklenen ya da label/place_id'si yazılan satır.
create or replace function public.stays_google_adi_tutma()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.place_id is not null then
    new.label := null;
  end if;
  return new;
end;
$$;

create trigger stays_google_adi_tutma
before insert or update of label, place_id on public.stays
for each row execute function public.stays_google_adi_tutma();

-- Aynı kural eski trips.hotel_* alanları için (#268; eski derlemeler 3.3 ekranından hâlâ yazar).
create or replace function public.trips_google_otel_adi_tutma()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.hotel_place_id is not null then
    new.hotel_label := null;
  end if;
  return new;
end;
$$;

create trigger trips_google_otel_adi_tutma
before insert or update of hotel_label, hotel_place_id on public.trips
for each row execute function public.trips_google_otel_adi_tutma();
