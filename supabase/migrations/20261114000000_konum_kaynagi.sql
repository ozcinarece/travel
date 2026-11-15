-- #205 KK1 · KK4 · KK6: içerik tablolarında konumun kaynağı.
-- Google koşulları: place_id süresiz saklanabilir, enlem/boylam en çok 30 gün (PRD §7). İçerik tablolarındaki konum bugüne
-- kadar Google'dan geldi ve süresiz tutuldu. Bu migration kaynağı kayda yazar ve sorunu sayıyla görünür kılar; taşıma (OSM
-- eşleştirmesi) ve günlük yenileme ayrı adımda (#205 KK2–KK3).
--
-- konum_kaynagi:
--   osm        — OpenStreetMap (ODbL, atıfla süresiz); osm_id zorunlu ("node/123", "way/45", "relation/6").
--   elle       — BO'da haritadan işaretlendi; Google verisi değil.
--   google_30g — Google'dan; google_fetched_at'ten 30 gün sonra yenilenmeli ya da başka kaynağa geçmeli.
--
-- Mevcut satırlar google_30g işaretlenir; google_fetched_at olarak satırın (durakta gezinin) created_at'i yazılır: konumun
-- Google'dan alındığı en geç an. Yeni satırlarda varsayılan google_30g + now(): bugünkü bütün yazıcılar (hat `yukle`, BO
-- Autocomplete) Google konumu yazar. OSM ya da elle konum yazan, konum_kaynagi'ni açıkça verir.

alter table public.sehirler
  add column konum_kaynagi text not null default 'google_30g' check (konum_kaynagi in ('osm', 'elle', 'google_30g')),
  add column osm_id text check (osm_id is null or osm_id ~ '^(node|way|relation)/[0-9]{1,19}$'),
  add column google_fetched_at timestamptz;
alter table public.yerler
  add column konum_kaynagi text not null default 'google_30g' check (konum_kaynagi in ('osm', 'elle', 'google_30g')),
  add column osm_id text check (osm_id is null or osm_id ~ '^(node|way|relation)/[0-9]{1,19}$'),
  add column google_fetched_at timestamptz;
alter table public.gezi_duraklari
  add column konum_kaynagi text not null default 'google_30g' check (konum_kaynagi in ('osm', 'elle', 'google_30g')),
  add column osm_id text check (osm_id is null or osm_id ~ '^(node|way|relation)/[0-9]{1,19}$'),
  add column google_fetched_at timestamptz;

-- Tetikleyiciler devre dışı: updated_at ve diğer yan etkiler bu işaretlemeden etkilenmesin.
alter table public.sehirler disable trigger user;
alter table public.yerler disable trigger user;
alter table public.gezi_duraklari disable trigger user;
update public.sehirler set google_fetched_at = created_at;
update public.yerler set google_fetched_at = created_at;
update public.gezi_duraklari d set google_fetched_at = coalesce(
  (select g.created_at from public.gezi_gunleri gg join public.geziler g on g.id = gg.gezi_id where gg.id = d.gezi_gun_id),
  now());
alter table public.sehirler enable trigger user;
alter table public.yerler enable trigger user;
alter table public.gezi_duraklari enable trigger user;

alter table public.sehirler
  alter column google_fetched_at set default now(),
  add constraint sehirler_konum_kaynak_tutarli check (
    (konum_kaynagi <> 'osm' or osm_id is not null)
    and (konum_kaynagi <> 'google_30g' or google_fetched_at is not null));
alter table public.yerler
  alter column google_fetched_at set default now(),
  add constraint yerler_konum_kaynak_tutarli check (
    (konum_kaynagi <> 'osm' or osm_id is not null)
    and (konum_kaynagi <> 'google_30g' or google_fetched_at is not null));
alter table public.gezi_duraklari
  alter column google_fetched_at set default now(),
  add constraint gezi_duraklari_konum_kaynak_tutarli check (
    (konum_kaynagi <> 'osm' or osm_id is not null)
    and (konum_kaynagi <> 'google_30g' or google_fetched_at is not null));

-- google_30g satırda konum değişip google_fetched_at verilmediyse damga yenilenir (yeni Google konumu = yeni 30 gün).
-- Kaynak google_30g değilse damga silinir: artık Google koordinatı tutulmuyor. INSERT'te de çalışır: osm/elle ile eklenen
-- satır sütun varsayılanındaki now()'u taşımaz; google_30g ile damgasız eklenen satır now() alır.
create function public.konum_kaynagi_yaz() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.konum_kaynagi = 'google_30g' then
    if tg_op = 'UPDATE'
       and (new.lat, new.lng) is distinct from (old.lat, old.lng)
       and new.google_fetched_at is not distinct from old.google_fetched_at then
      new.google_fetched_at := now();
    elsif new.google_fetched_at is null then
      new.google_fetched_at := now();
    end if;
  else
    new.google_fetched_at := null;
  end if;
  return new;
end;
$$;

create trigger sehirler_konum_kaynagi before insert or update of lat, lng, konum_kaynagi, google_fetched_at, osm_id on public.sehirler
  for each row execute function public.konum_kaynagi_yaz();
create trigger yerler_konum_kaynagi before insert or update of lat, lng, konum_kaynagi, google_fetched_at, osm_id on public.yerler
  for each row execute function public.konum_kaynagi_yaz();
create trigger gezi_duraklari_konum_kaynagi before insert or update of lat, lng, konum_kaynagi, google_fetched_at, osm_id on public.gezi_duraklari
  for each row execute function public.konum_kaynagi_yaz();

-- KK6: kontrol. Yalnız sayılar (repo herkese açık; hat ve Actions loguna konum ya da ad yazılmaz).
-- suresi_gecen = google_30g ve google_fetched_at 30 günden eski: Google koşuluna aykırı tutulan koordinat. Hedef: 0.
create function public.konum_kaynagi_kontrol() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_object_agg(t.tablo, jsonb_build_object(
      'toplam', t.toplam, 'osm', t.osm, 'elle', t.elle, 'google_30g', t.google, 'suresi_gecen', t.suresi_gecen))
  from (
    select 'sehirler' as tablo, count(*) as toplam,
      count(*) filter (where konum_kaynagi = 'osm') as osm,
      count(*) filter (where konum_kaynagi = 'elle') as elle,
      count(*) filter (where konum_kaynagi = 'google_30g') as google,
      count(*) filter (where konum_kaynagi = 'google_30g' and google_fetched_at < now() - interval '30 days') as suresi_gecen
    from public.sehirler
    union all
    select 'yerler', count(*),
      count(*) filter (where konum_kaynagi = 'osm'),
      count(*) filter (where konum_kaynagi = 'elle'),
      count(*) filter (where konum_kaynagi = 'google_30g'),
      count(*) filter (where konum_kaynagi = 'google_30g' and google_fetched_at < now() - interval '30 days')
    from public.yerler
    union all
    select 'gezi_duraklari', count(*),
      count(*) filter (where konum_kaynagi = 'osm'),
      count(*) filter (where konum_kaynagi = 'elle'),
      count(*) filter (where konum_kaynagi = 'google_30g'),
      count(*) filter (where konum_kaynagi = 'google_30g' and google_fetched_at < now() - interval '30 days')
    from public.gezi_duraklari
  ) t;
$$;
revoke execute on function public.konum_kaynagi_kontrol() from public, anon, authenticated, service_role;

-- KK4: konum Google'ın saklanmasına izin verilen alanlarından değil (yalnız place_id süresiz; lat/lng ≤ 30 gün).
comment on function public.icerik_mekan_bilgileri(text[]) is
  '#172 KK7–KK8: kendi içeriğimizdeki mekanların adı (editörün metni), kategorisi (primary_type), konumu ve fotoğrafımız. '
  'Konum Google''dan geldiyse en çok 30 gün saklanır (yerler.konum_kaynagi = google_30g, google_fetched_at); kalıcı konum '
  'OSM ya da elle işaretlenmiş olandır (#205).';
