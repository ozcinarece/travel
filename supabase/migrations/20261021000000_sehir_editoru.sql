-- #111: şehir editörü (Genel · Rehber bölümleri · Fotoğraflar), rehberde mekan bağlama, kullanıcı yönetimi.

-- ---------------------------------------------------------------- şehirler
-- Karo kapağı (kare) `kapak_url`; geniş kapak (3:2) şehir rehberi kapağı ve ana sayfa şehir kartı.
alter table public.sehirler
  add column genis_kapak_url text,
  add column updated_at timestamptz not null default now();
create trigger sehirler_updated_at before update on public.sehirler
  for each row execute function public.updated_at_yaz();

-- ---------------------------------------------------------------- şehir rehberi
-- Bölüm türleri (uygulama sekmeleri) aynı kalır; sıra sürükle-sırala ile tek deyimde değişir (ertelenebilir tekil).
alter table public.sehir_rehberi
  add column updated_at timestamptz not null default now(),
  add constraint sehir_rehberi_sira_pozitif check (sira >= 1),
  add constraint sehir_rehberi_sira_tekil unique (sehir_id, sira) deferrable initially immediate;
create trigger sehir_rehberi_updated_at before update on public.sehir_rehberi
  for each row execute function public.updated_at_yaz();

-- ---------------------------------------------------------------- içerik fotoğrafları: şehirler + rol bilgileri
-- Yükleme tarayıcıda WebP'ye çevrilir; ana dosya (≤ 2400 px) satırda, `@1200` ve `@400` kopyaları yanında.
alter table public.icerik_fotolari
  drop constraint icerik_fotolari_yol_check,
  drop constraint icerik_fotolari_sahip_tur_check,
  drop constraint icerik_fotolari_check,
  add constraint icerik_fotolari_yol_check check (yol ~ '^(geziler|yerler|sehirler)/[0-9a-f-]{36}/[^/]+$'),
  add constraint icerik_fotolari_sahip_tur_check check (sahip_tur in ('gezi', 'yer', 'sehir')),
  add constraint icerik_fotolari_klasor_check check (
    split_part(yol, '/', 2)::uuid = sahip_id
    and split_part(yol, '/', 1) = case sahip_tur when 'gezi' then 'geziler' when 'yer' then 'yerler' else 'sehirler' end),
  add column kaynak text check (kaynak in ('kendi', 'telifsiz', 'izinli')),
  add column genislik integer check (genislik > 0),
  add column yukseklik integer check (yukseklik > 0),
  -- Seçili foto satırı: "2400×1600 · 1,1 MB · Ece · 12 Eki".
  add column bayt integer check (bayt > 0),
  -- Yükleyenin adı (Google hesabındaki ilk ad), yoksa e-postası.
  add column yukleyen text default (coalesce(nullif(split_part(auth.jwt() -> 'user_metadata' ->> 'full_name', ' ', 1), ''), auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------- yazılardaki mekanlar
-- Rehber / gezi / yer yazısında `[metin](mekan:place_id)` (satır) ve `::mekan[place_id]` (kart). Kayıtta yazıdan
-- çıkarılıp buraya yazılır; uygulama Öneriler sayfasını ve "N mekan" sayılarını buradan okur. Yalnız place_id saklanır.
create table public.icerik_mekanlari (
  sahip_tur text not null check (sahip_tur in ('rehber', 'gezi', 'yer')),
  sahip_id uuid not null,
  place_id text not null check (place_id ~ '^[A-Za-z0-9_-]{10,255}$'),
  bicim text not null check (bicim in ('kart', 'satir')),
  sira integer not null check (sira >= 1),
  primary key (sahip_tur, sahip_id, sira)
);
create index icerik_mekanlari_place_idx on public.icerik_mekanlari (place_id);

alter table public.icerik_mekanlari enable row level security;
create policy icerik_mekanlari_select on public.icerik_mekanlari for select to anon, authenticated using (true);
create policy icerik_mekanlari_admin on public.icerik_mekanlari for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Sahibin mekan listesini tek işlemde değiştirir. `yerler`'de olmayan place_id için taslak yer satırı açar
-- (sahibin şehrinde; ad editörün yazdığı / onayladığı metin, kategori ve konum Google'ın izin verilen alanları).
-- p_mekanlar: [{place_id, bicim, ad?, kategori?, lat?, lng?}] yazıdaki sırayla. Döner: açılan yer sayısı.
create function public.icerik_mekanlari_yaz(p_sahip_tur text, p_sahip_id uuid, p_mekanlar jsonb) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_sehir uuid;
  v_acilan integer;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  v_sehir := case p_sahip_tur
    when 'rehber' then (select sehir_id from public.sehir_rehberi where id = p_sahip_id)
    when 'gezi' then (select sehir_id from public.geziler where id = p_sahip_id)
    when 'yer' then (select sehir_id from public.yerler where id = p_sahip_id)
  end;
  if v_sehir is null then
    raise exception 'sahip bulunamadı' using errcode = '23503';
  end if;
  delete from public.icerik_mekanlari where sahip_tur = p_sahip_tur and sahip_id = p_sahip_id;
  insert into public.icerik_mekanlari (sahip_tur, sahip_id, place_id, bicim, sira)
    select p_sahip_tur, p_sahip_id, m ->> 'place_id', m ->> 'bicim', i::integer
    from jsonb_array_elements(coalesce(p_mekanlar, '[]'::jsonb)) with ordinality as e(m, i);
  with yeni as (
    select distinct on (m ->> 'place_id') m
    from jsonb_array_elements(coalesce(p_mekanlar, '[]'::jsonb)) m
    where nullif(trim(m ->> 'ad'), '') is not null and m ? 'lat' and m ? 'lng'
      and not exists (select 1 from public.yerler y where y.place_id = m ->> 'place_id')
  )
  insert into public.yerler (sehir_id, place_id, ad, kategori, lat, lng, yayin)
    select v_sehir, m ->> 'place_id', left(trim(m ->> 'ad'), 120), m ->> 'kategori', (m ->> 'lat')::double precision, (m ->> 'lng')::double precision, false
    from yeni;
  get diagnostics v_acilan = row_count;
  return v_acilan;
end;
$$;
revoke execute on function public.icerik_mekanlari_yaz(text, uuid, jsonb) from public, anon;
grant execute on function public.icerik_mekanlari_yaz(text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- kullanıcılar (KK2)
-- Liste: ad, e-posta, kayıt, seyahat sayısı (üyelik), son görülme, admin mi. Anonim hesaplar hariç. Yalnız admin.
create function public.yonetim_kullanicilar(p_ara text default null, p_limit integer default 200)
returns table (id uuid, ad text, eposta text, kayit timestamptz, seyahat_sayisi bigint, son_gorulme timestamptz, admin boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  return query
    select u.id, p.name, u.email::text, u.created_at,
      (select count(*) from public.members m where m.user_id = u.id),
      u.last_sign_in_at,
      exists (select 1 from public.admin_kullanicilar a where a.email = lower(u.email))
    from auth.users u
    left join public.profiles p on p.id = u.id
    where not coalesce(u.is_anonymous, false)
      and (nullif(trim(p_ara), '') is null
        or p.name ilike '%' || trim(p_ara) || '%'
        or u.email ilike '%' || trim(p_ara) || '%'
        or p.username ilike '%' || trim(p_ara) || '%')
    order by u.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;
revoke execute on function public.yonetim_kullanicilar(text, integer) from public, anon;
grant execute on function public.yonetim_kullanicilar(text, integer) to authenticated;

-- KVKK hesap silme (admin): kullanıcının kendi silmesiyle aynı kural (prepare_account_deletion) — sahibi olduğu
-- seyahat en eski misafir olmayan üyeye devredilir, üye yoksa silinir; üyelikler ve profil cascade ile gider.
-- Admin kendini (Profil'den siler) ve başka bir admini (önce adminliği kaldırılır) silemez.
create function public.yonetim_hesap_sil(p_id uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s record;
  varis uuid;
  varis_ad text;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  if p_id = auth.uid() then
    raise exception 'kendi hesabını Profil''den sil' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users u join public.admin_kullanicilar a on a.email = lower(u.email) where u.id = p_id) then
    raise exception 'önce adminliği kaldır' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_id) then
    raise exception 'kullanıcı yok' using errcode = 'P0002';
  end if;
  for s in select m.trip_id, m.display_name from public.members m where m.user_id = p_id and m.role = 'owner' loop
    select m.user_id, m.display_name into varis, varis_ad from public.members m
    where m.trip_id = s.trip_id and m.user_id <> p_id
    order by m.guest, m.joined_at
    limit 1;
    if varis is null then
      delete from public.trips where id = s.trip_id;
    else
      update public.members set role = 'owner' where trip_id = s.trip_id and user_id = varis;
      update public.trips set owner_id = varis where id = s.trip_id;
      insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
      values (s.trip_id, p_id, 'trips', s.trip_id::text, 'ownership_transferred', to_jsonb(s.display_name), to_jsonb(varis_ad));
      delete from public.members where trip_id = s.trip_id and user_id = p_id;
    end if;
  end loop;
  delete from auth.users where id = p_id;
end;
$$;
revoke execute on function public.yonetim_hesap_sil(uuid) from public, anon;
grant execute on function public.yonetim_hesap_sil(uuid) to authenticated;

-- Son admin kaldırılamaz (panel kilitlenmesin).
create function public.admin_kullanicilar_son_kalan() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.admin_kullanicilar) then
    raise exception 'son admin kaldırılamaz' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger admin_kullanicilar_en_az_bir after delete on public.admin_kullanicilar
  deferrable initially immediate for each row execute function public.admin_kullanicilar_son_kalan();
