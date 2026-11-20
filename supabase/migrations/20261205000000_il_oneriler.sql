-- #401 KK2–KK4: il önerileri. Rehber her il için sıralı ve kategorili bir liste yazar (icerik/iller/<il>.json); içerik hattı
-- (`il` adımı) listeyi taslak olarak yükler; Ece BO'da sırayı, kategoriyi, amaçları ve `neden`i değiştirir, yeri gizler ya da
-- gösterir, yeni yer ekler ve listeyi yayınlar.
--
-- Google verisi (PRD §7): yalnız place_id, primary_type ve (Google'dan alındıysa) lat/lng + google_fetched_at. Ad ve `neden`
-- Rehber'in ya da Ece'nin metnidir. Konum OSM'den gelir; OSM konumu süresizdir.
--
-- Yetki: yayındaki listenin görünür satırlarını herkes okur; taslak liste ve gizli satır yalnız admin'e görünür. Yalnız admin
-- yazar. Yükleme fonksiyonu yalnız içerik hattının (postgres) çağrısıdır.

-- Kategori listesi tek yerde (Ece, 19 Kasım 15:52). Değiştirmek yeni migration ister.
create function public.il_kategori_listesi() returns text[]
language sql immutable parallel safe set search_path = ''
as $$ select array['doga', 'yemek', 'tatli_kahve', 'muze', 'tarih', 'carsi', 'aktivite', 'manzara']::text[] $$;

-- Liste başı: il başına bir satır. `yayinda` bütün listenin yayın durumudur (Yayınla düğmesi).
create table public.il_listeleri (
  il_slug text primary key check (il_slug ~ '^[a-z0-9-]{2,60}$'),
  il text not null check (char_length(btrim(il)) between 1 and 60),
  yayinda boolean not null default false,
  yayinlandi_at timestamptz,
  -- Son değişikliği yapan: içerik hattı ('rehber') ya da BO ('yonetim'). BO başlığındaki "son değişiklik" satırı.
  degistiren text not null default 'yonetim' check (degistiren in ('rehber', 'yonetim')),
  degisti_at timestamptz not null default now()
);

create table public.il_oneriler (
  id uuid primary key default gen_random_uuid(),
  il_slug text not null references public.il_listeleri (il_slug) on delete cascade,
  sira integer not null check (sira > 0),
  ad text not null check (char_length(btrim(ad)) between 1 and 120),
  kategori text not null check (kategori = any (public.il_kategori_listesi())),
  amaclar text[] not null default '{}' check (public.amac_dizisi_gecerli(amaclar)),
  ilce text check (ilce is null or char_length(btrim(ilce)) between 1 and 60),
  merkeze_km numeric(6, 1) check (merkeze_km is null or merkeze_km >= 0),
  neden text check (neden is null or char_length(neden) <= 90),
  osm text check (osm is null or osm ~ '^(node|way|relation)/[0-9]{1,19}$'),
  place_id text check (place_id is null or char_length(place_id) between 1 and 300),
  primary_type text,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  google_fetched_at timestamptz,
  -- Gizlenen yer uygulamada görünmez ama listede kalır (kanvas BO_IlOnerileri).
  gorunur boolean not null default true,
  -- Sürükleyerek sıralama tek UPDATE ile yapılır; tekillik deyim sonunda denetlenir.
  constraint il_oneriler_sira_tekil unique (il_slug, sira) deferrable initially immediate,
  constraint il_oneriler_konum_cift check ((lat is null) = (lng is null))
);
create index il_oneriler_place_id on public.il_oneriler (place_id) where place_id is not null;

alter table public.il_listeleri enable row level security;
alter table public.il_oneriler enable row level security;

create policy il_listeleri_oku on public.il_listeleri for select to anon, authenticated using (yayinda);
create policy il_oneriler_oku on public.il_oneriler for select to anon, authenticated
  using (gorunur and exists (select 1 from public.il_listeleri l where l.il_slug = il_oneriler.il_slug and l.yayinda));
create policy il_listeleri_admin on public.il_listeleri for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy il_oneriler_admin on public.il_oneriler for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.il_listeleri, public.il_oneriler to anon, authenticated;
grant insert, update, delete on public.il_listeleri, public.il_oneriler to authenticated;

-- BO'daki her değişiklik listenin "son değişiklik" satırını günceller (yükleme fonksiyonu 'rehber' yazar).
create function public.il_listesi_degisti() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if current_setting('gezi.il_yukleme', true) = 'evet' then return null; end if;
  update public.il_listeleri set degistiren = 'yonetim', degisti_at = now()
   where il_slug = coalesce(new.il_slug, old.il_slug);
  return null;
end $$;
revoke execute on function public.il_listesi_degisti() from public, anon, authenticated;
create trigger il_oneriler_degisti after insert or update or delete on public.il_oneriler
  for each row execute function public.il_listesi_degisti();

-- KK4: sürükleyerek sıralama. Verilen sıra 1..n olur (silme sonrası boşluk da kapanır). Çağıranın yetkisiyle çalışır (RLS:
-- yalnız admin yazar); listede olmayan ya da eksik kimlik reddedilir.
create function public.il_oneri_sirala(p_il text, p_idler uuid[]) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_admin() then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_idler is null or cardinality(p_idler) <> (select count(distinct x) from unnest(p_idler) x) then
    raise exception 'sıra listesi tekrarsız olmalı' using errcode = '22023';
  end if;
  select count(*) into n from public.il_oneriler where il_slug = p_il;
  if n <> cardinality(p_idler) or exists (select 1 from unnest(p_idler) x where not exists (select 1 from public.il_oneriler o where o.id = x and o.il_slug = p_il)) then
    raise exception 'sıra listesi ilin bütün yerlerini içermeli' using errcode = '22023';
  end if;
  update public.il_oneriler o set sira = t.i
    from unnest(p_idler) with ordinality t(id, i)
   where o.id = t.id and o.sira <> t.i;
end $$;
revoke execute on function public.il_oneri_sirala(text, uuid[]) from public, anon;
grant execute on function public.il_oneri_sirala(text, uuid[]) to authenticated;

-- KK3: içerik hattının `il` adımı. Liste taslak olarak (yeniden) yazılır; yayındaki listeye dokunulmaz (BO'dan düzenlenir).
-- Girdi: { il, slug, oneriler: [{ sira, ad, kategori, amaclar, ilce, merkeze_km, neden, osm, place_id, lat, lng }] }.
-- lat/lng yalnız OSM'den gelir (hat okur); Google konumu yazılmaz. Biçim denetimi tablonun check'lerindedir.
create function public.icerik_il_taslak_yukle(p_veri jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_slug text := p_veri ->> 'slug';
  v_il text := p_veri ->> 'il';
  v_liste public.il_listeleri;
  v_yeni boolean := false;
  v_n integer;
  v_konum integer;
begin
  if v_slug is null or v_il is null or jsonb_typeof(p_veri -> 'oneriler') <> 'array' then
    raise exception 'il, slug ve oneriler gerekli' using errcode = '22023';
  end if;
  select * into v_liste from public.il_listeleri where il_slug = v_slug for update;
  if found and v_liste.yayinda then
    raise exception 'il listesi yayında (%); BO''dan düzenle ya da önce yayından kaldır', v_slug using errcode = '55000';
  end if;
  v_yeni := not found;
  perform set_config('gezi.il_yukleme', 'evet', true);
  insert into public.il_listeleri (il_slug, il, degistiren, degisti_at) values (v_slug, v_il, 'rehber', now())
    on conflict (il_slug) do update set il = excluded.il, degistiren = 'rehber', degisti_at = now();
  delete from public.il_oneriler where il_slug = v_slug;
  insert into public.il_oneriler (il_slug, sira, ad, kategori, amaclar, ilce, merkeze_km, neden, osm, place_id, lat, lng)
  select v_slug, (o ->> 'sira')::integer, btrim(o ->> 'ad'), o ->> 'kategori', public.amac_dizisi(o -> 'amaclar'),
         nullif(btrim(o ->> 'ilce'), ''), (o ->> 'merkeze_km')::numeric, nullif(btrim(o ->> 'neden'), ''),
         o ->> 'osm', o ->> 'place_id', (o ->> 'lat')::double precision, (o ->> 'lng')::double precision
    from jsonb_array_elements(p_veri -> 'oneriler') o;
  get diagnostics v_n = row_count;
  select count(*) into v_konum from public.il_oneriler where il_slug = v_slug and lat is not null;
  perform set_config('gezi.il_yukleme', '', true);
  return jsonb_build_object('slug', v_slug, 'yer', v_n, 'konum', v_konum, 'yeni', v_yeni);
end $$;
revoke execute on function public.icerik_il_taslak_yukle(jsonb) from public, anon, authenticated, service_role;
