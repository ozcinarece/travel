-- #197: şehrin Google kimliği ve saat dilimi tabloda — yeni seyahat açarken (Seyahatime al › Yeni seyahat, sihirbazın "Bu şehre
-- seyahat kur"u ve Nereye adımındaki rehberli şehir) şehir için Google'a gidilmez. Üçü de boş olabilir; boşsa istemci bugünkü
-- yola (Autocomplete + hafif yer) düşer.
--   place_id:  Google kimliği — süresiz saklanabilir (Google koşulu).
--   tz:        IANA saat dilimi adı (Europe/Istanbul) — Google içeriği değil; veritabanının tanımadığı ad yazılmaz (aşağıdaki
--              tetikleyici boş bırakır).
--   ulke_kodu: ISO 3166-1 alpha-2 — trips.country_code ile aynı kaynak ve anlam (adres bileşenlerinden; Google içeriği sayılmaz).
--              Seyahat açarken ülke kodu da gerektiği için (v2 Haritam'ın ülke görünümü) kimlikle birlikte tutulur.
-- Dolduran: BO "+ Şehir" (seçilen Google şehrinden, ek istek yok), içerik hattı (yeni şehirli yükleme; `sehirler` işlemi eksikleri
-- bir kez doldurur — mevcut şehirler için tek seferlik doldurma da budur).
alter table public.sehirler
  add column place_id text check (place_id is null or place_id ~ '^[A-Za-z0-9_-]{10,255}$'),
  add column tz text check (tz is null or char_length(tz) between 1 and 64),
  add column ulke_kodu text check (ulke_kodu is null or ulke_kodu ~ '^[A-Z]{2}$');

-- Geçersiz saat dilimi istemcide tarih hesaplarını düşürür: yazılmaz, boş kalır (istemci bugünkü yola düşer; hat yeniden dener).
-- Reddetmek yerine boşaltılır: veritabanının saat dilimi listesi Google'ınkinin gerisinde kalırsa BO'da şehir açmak düşmesin.
create or replace function public.sehirler_tz_denetle()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.tz is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.tz) then
    raise notice 'tanınmayan saat dilimi yazılmadı';
    new.tz := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.sehirler_tz_denetle() from public, anon, authenticated;
create trigger sehirler_tz_denetle before insert or update of tz on public.sehirler
  for each row execute function public.sehirler_tz_denetle();

-- İçerik hattı (yönetim API'si, postgres): şehrin kimliğini BİR KEZ yazar — dolu alan ezilmez. Hattın yazma yalnız
-- fonksiyonlardır (icerik_gezi_taslak_yukle / _sil gibi). Döner: yazıldı ve şehrin kimliği artık tam mı (place_id + tz).
create function public.icerik_sehir_kimligi_yaz(p_slug text, p_place_id text, p_tz text, p_ulke_kodu text)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  n integer;
begin
  update public.sehirler set
    place_id = coalesce(place_id, p_place_id),
    tz = coalesce(tz, p_tz),
    ulke_kodu = coalesce(ulke_kodu, p_ulke_kodu)
  where slug = p_slug and (place_id is null or tz is null or ulke_kodu is null);
  get diagnostics n = row_count;
  return n > 0 and exists (select 1 from public.sehirler where slug = p_slug and place_id is not null and tz is not null);
end;
$$;
revoke execute on function public.icerik_sehir_kimligi_yaz(text, text, text, text) from public, anon, authenticated, service_role;

-- `sehirler` işleminin listesi: kimliği eksik şehirleri doldurmak için konum ve kimlik durumu da (koordinat bizim içeriğimiz;
-- loga yazılmaz).
create or replace function public.icerik_sehirler() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', s.slug, 'ad', s.ad, 'yayin', s.yayin, 'lat', s.lat, 'lng', s.lng,
      'kimlik', s.place_id is not null and s.tz is not null,
      'geziler', (select coalesce(jsonb_agg(jsonb_build_object(
          'slug', g.slug, 'gun', g.gun_sayisi, 'durak', g.mekan_sayisi,
          'durum', case when not g.yayin then 'taslak' when g.yayin_at > now() then 'planli' else 'yayinda' end
        ) order by g.sira nulls last, g.slug), '[]'::jsonb)
        from public.geziler g where g.sehir_id = s.id)
    ) order by s.slug), '[]'::jsonb)
  from public.sehirler s;
$$;
revoke execute on function public.icerik_sehirler() from public, anon, authenticated, service_role;
