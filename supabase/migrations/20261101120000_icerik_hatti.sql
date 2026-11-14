-- İçerik hattı (docs/07-icerik-hatti.md): AI gezi editörünün hazırladığı geziyi BO'ya TASLAK olarak yükleyen ve silen
-- işlevler, şehir listesi ve yükleme kontrolü, icerik-google Edge Function'ının günlük bütçe denetimi ve Genel bakış'ta
-- maliyeti. Yazan işlevler yalnız `postgres` (Yönetim API, GitHub Actions'taki hat) tarafından çalıştırılır: public, anon,
-- authenticated ve service_role'den execute yetkisi kaldırılır. Hat hiçbir şeyi yayınlamaz; yayındaki satıra dokunmaz.

-- ---------------------------------------------------------------- Google maliyeti
-- icerik-google istekleri: metin araması Text Search Enterprise (35 $ / 1000), detay Place Details Enterprise (20 $ / 1000).
-- Tek fiyat (35) tutulur: tahmin üst sınırdır (Genel bakış'taki diğer kalemlerle aynı yaklaşım).
update public.yonetim_ayarlari set deger = deger || '{"icerik": 35}'::jsonb
where anahtar = 'google_birim_fiyat' and jsonb_typeof(deger) = 'object' and not deger ? 'icerik';

-- Bugünkü (Türkiye günü) tahmini Google harcaması, USD. Fonksiyon → kalem eşlemesi yonetim_genel ile aynı; icerik-google
-- kendi fiyatıyla. Fiyatı olmayan kalem 0 sayılır.
create function public.google_harcama_bugun() returns numeric
language sql stable security definer set search_path = ''
as $$
  with fiyat as (select deger from public.yonetim_ayarlari where anahtar = 'google_birim_fiyat'),
  kalem as (
    select
      case
        when s.fonksiyon in ('places-full', 'places-light', 'places-nearby', 'places-autocomplete', 'resolve-link') then 'mekan'
        when s.fonksiyon = 'places-photo' then 'foto'
        when s.fonksiyon in ('route-legs', 'route-matrix') then 'rota'
        when s.fonksiyon = 'places-reviews' then 'yorum'
        when s.fonksiyon = 'icerik-google' then 'icerik'
      end as ad,
      s.google
    from public.api_sayac s where s.gun = (now() at time zone 'Europe/Istanbul')::date
  )
  select coalesce(sum(k.google * coalesce((select (f.deger ->> k.ad)::numeric from fiyat f where jsonb_typeof(f.deger) = 'object'), 0)) / 1000, 0)
  from kalem k where k.ad is not null;
$$;
revoke execute on function public.google_harcama_bugun() from public, anon, authenticated, service_role;
comment on function public.google_harcama_bugun() is
  'Bugünkü tahmini Google harcaması (USD). Fonksiyon → kalem eşlemesi yonetim_genel_temel ile aynı olmalı; yeni bir Google fonksiyonu eklenince ikisi de güncellenir (docs/07, #170).';

-- icerik-google Google'a gitmeden önce sorar: bugünkü harcama + bu isteğin üst sınır maliyeti (p_istek × icerik fiyatı)
-- günlük bütçeyi aşar mı? Bütçe tanımlı değilse sınır yok. Yalnız service_role (Edge Function).
create function public.icerik_google_butcesi(p_istek integer) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_butce numeric := (select (deger #>> '{}')::numeric from public.yonetim_ayarlari where anahtar = 'google_gunluk_butce' and jsonb_typeof(deger) = 'number');
  v_fiyat numeric := coalesce((select (deger ->> 'icerik')::numeric from public.yonetim_ayarlari where anahtar = 'google_birim_fiyat' and jsonb_typeof(deger) = 'object'), 35);
  v_harcanan numeric := public.google_harcama_bugun();
begin
  return jsonb_build_object(
    'harcanan', round(v_harcanan, 2),
    'butce', v_butce,
    'yeterli', v_butce is null or v_harcanan + greatest(coalesce(p_istek, 0), 0) * v_fiyat / 1000 <= v_butce);
end;
$$;
revoke execute on function public.icerik_google_butcesi(integer) from public, anon, authenticated;
-- UYARI: bu yetki icerik-google'ın yetki sınırıdır (#171): işlevi çağırabilen taşıyıcı service_role sayılır. authenticated
-- ya da anon'a execute VERİLMEZ; verilirse giriş yapan herkes Google bütçesini harcayabilir (rls_test bunu yakalar).
grant execute on function public.icerik_google_butcesi(integer) to service_role;

-- Genel bakış (BO-0) kalemleri sabit (mekan · foto · rota · yorum; panel değişmez): içerik hattının istekleri Mekan
-- kalemine eklenir, Mekan birim fiyatı o günün karışık fiyatı olur. İstek sayısı gerçek, tahmini dolar doğru kalır.
alter function public.yonetim_genel(integer) rename to yonetim_genel_temel;
revoke execute on function public.yonetim_genel_temel(integer) from public, anon, authenticated, service_role;

create function public.yonetim_genel(p_gun integer default 7) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  o jsonb := public.yonetim_genel_temel(p_gun);
  v_icerik numeric := coalesce((select sum(google) from public.api_sayac
    where gun = (now() at time zone 'Europe/Istanbul')::date and fonksiyon = 'icerik-google'), 0);
  v_mekan numeric;
  v_fiyat jsonb;
  v_f_mekan numeric;
  v_f_icerik numeric;
begin
  if v_icerik = 0 then
    return o;
  end if;
  v_mekan := coalesce((o #>> '{google,mekan}')::numeric, 0);
  v_fiyat := o #> '{google,fiyat}';
  o := jsonb_set(o, '{google,mekan}', to_jsonb(v_mekan + v_icerik));
  if jsonb_typeof(v_fiyat) = 'object' then
    v_f_mekan := coalesce((v_fiyat ->> 'mekan')::numeric, 0);
    v_f_icerik := coalesce((v_fiyat ->> 'icerik')::numeric, v_f_mekan);
    o := jsonb_set(o, '{google,fiyat,mekan}', to_jsonb(round((v_mekan * v_f_mekan + v_icerik * v_f_icerik) / (v_mekan + v_icerik), 4)));
  end if;
  return o;
end;
$$;
revoke execute on function public.yonetim_genel(integer) from public, anon;
grant execute on function public.yonetim_genel(integer) to authenticated;
comment on function public.yonetim_genel(integer) is
  'Sarmal: yonetim_genel_temel + icerik-google istekleri Mekan kalemine (karışık birim fiyat) (#170). create or replace ile değiştirilirse sarmal korunmalı.';

-- ---------------------------------------------------------------- şehirler ve kontrol (hat okur; yalnız postgres)

-- Şehirler: slug, ad, yayında mı, geziler (slug, gün, durak, durum). Kullanıcı verisi yok.
create function public.icerik_sehirler() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', s.slug, 'ad', s.ad, 'yayin', s.yayin,
      'geziler', (select coalesce(jsonb_agg(jsonb_build_object(
          'slug', g.slug, 'gun', g.gun_sayisi, 'durak', g.mekan_sayisi,
          'durum', case when not g.yayin then 'taslak' when g.yayin_at > now() then 'planli' else 'yayinda' end
        ) order by g.sira nulls last, g.slug), '[]'::jsonb)
        from public.geziler g where g.sehir_id = s.id)
    ) order by s.slug), '[]'::jsonb)
  from public.sehirler s;
$$;
revoke execute on function public.icerik_sehirler() from public, anon, authenticated, service_role;

-- Yükleme kontrolü: yayında mı, gün ve durak sayıları, place_id'si eksik durak, yazıdaki mekanlar, updated_at.
create function public.icerik_gezi_kontrol(p_slug text) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
      'gezi_id', g.id, 'slug', g.slug, 'sehir', s.slug, 'sehir_yayin', s.yayin,
      'yayin', g.yayin, 'yayin_at', g.yayin_at,
      'durum', case when not g.yayin then 'taslak' when g.yayin_at > now() then 'planli' else 'yayinda' end,
      'gun_sayisi', g.gun_sayisi, 'mekan_sayisi', g.mekan_sayisi,
      'gunler', (select coalesce(jsonb_agg(jsonb_build_object('sira', gg.sira,
          'durak', (select count(*) from public.gezi_duraklari d where d.gezi_gun_id = gg.id)) order by gg.sira), '[]'::jsonb)
        from public.gezi_gunleri gg where gg.gezi_id = g.id),
      'place_id_eksik', (select count(*) from public.gezi_duraklari d join public.gezi_gunleri gg on gg.id = d.gezi_gun_id
        where gg.gezi_id = g.id and nullif(d.place_id, '') is null),
      'mekan_kart', (select count(*) from public.icerik_mekanlari m where m.sahip_tur = 'gezi' and m.sahip_id = g.id and m.bicim = 'kart'),
      'mekan_satir', (select count(*) from public.icerik_mekanlari m where m.sahip_tur = 'gezi' and m.sahip_id = g.id and m.bicim = 'satir'),
      'foto', (select count(*) from public.icerik_fotolari f where f.sahip_tur = 'gezi' and f.sahip_id = g.id),
      'kapak', g.kapak_url is not null,
      'updated_at', g.updated_at)
  from public.geziler g join public.sehirler s on s.id = g.sehir_id
  where g.slug = p_slug;
$$;
revoke execute on function public.icerik_gezi_kontrol(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- taslak yükle

-- Hata kodları: 22023 geçersiz veri · 23505 slug / şehir zaten var · 42501 yayındaki satır · P0002 bulunamadı.
-- p_veri: { sehir: {slug} | {yeni: {ad, slug, lat, lng}}, gezi: {slug, baslik, ozet, yazar_ad, yazi_md},
--           gunler: [{baslik, duraklar: [{place_id, ad, kategori, sure_dk, lat, lng}]}] }
-- Tek işlem: herhangi bir hata hiçbir şey yazmaz. yayin=false ve yayin_at=null her zaman işlevin kendisinden gelir.
create function public.icerik_gezi_taslak_yukle(p_veri jsonb, p_yeniden boolean default false) returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_gezi jsonb := p_veri -> 'gezi';
  v_sehir jsonb := p_veri -> 'sehir';
  v_gunler jsonb := p_veri -> 'gunler';
  v_slug text;
  v_baslik text;
  v_ozet text;
  v_yazi text;
  v_yazar text;
  v_sehir_id uuid;
  v_yeni_sehir boolean := false;
  v_var record;
  v_yeniden boolean := false;
  v_gezi_id uuid;
  v_gun_id uuid;
  g record;
  d record;
  v_yer text;
  v_mekan integer;
  v_sonuc jsonb;
begin
  if jsonb_typeof(p_veri) is distinct from 'object' or jsonb_typeof(v_gezi) is distinct from 'object' then
    raise exception 'veri bir nesne olmalı ve "gezi" alanını içermeli' using errcode = '22023';
  end if;

  -- Yayın yalnız BO'dan, Ece'nin elinden.
  if v_gezi ? 'yayin' and v_gezi -> 'yayin' <> 'false'::jsonb then
    raise exception 'gezi.yayin kabul edilmez: hat yalnız taslak yükler, yayını Ece BO''dan yapar' using errcode = '22023';
  end if;
  if v_gezi ? 'yayin_at' and v_gezi -> 'yayin_at' <> 'null'::jsonb then
    raise exception 'gezi.yayin_at kabul edilmez: yayın tarihini Ece BO''dan verir' using errcode = '22023';
  end if;

  -- Gezi alanları (tablo kısıtları + akla yatkın üst sınırlar).
  v_slug := v_gezi ->> 'slug';
  if v_slug is null or v_slug !~ '^[a-z0-9-]{2,80}$' then
    raise exception 'gezi.slug yalnız küçük harf, rakam ve tire içermeli; 2–80 karakter (gelen: %)', coalesce(v_slug, 'boş') using errcode = '22023';
  end if;
  v_baslik := btrim(v_gezi ->> 'baslik');
  if v_baslik is null or char_length(v_baslik) not between 1 and 120 then
    raise exception 'gezi.baslik 1–120 karakter olmalı' using errcode = '22023';
  end if;
  v_ozet := nullif(btrim(v_gezi ->> 'ozet'), '');
  if char_length(v_ozet) > 200 then
    raise exception 'gezi.ozet en çok 200 karakter olmalı' using errcode = '22023';
  end if;
  v_yazi := v_gezi ->> 'yazi_md';
  if v_yazi is null or btrim(v_yazi) = '' or char_length(v_yazi) > 20000 then
    raise exception 'gezi.yazi_md dolu olmalı ve en çok 20000 karakter' using errcode = '22023';
  end if;
  v_yazar := nullif(btrim(v_gezi ->> 'yazar_ad'), '');
  if char_length(v_yazar) > 80 then
    raise exception 'gezi.yazar_ad en çok 80 karakter olmalı' using errcode = '22023';
  end if;

  -- Günler ve duraklar: önce tümü denetlenir, sonra yazılır.
  if jsonb_typeof(v_gunler) is distinct from 'array' or jsonb_array_length(v_gunler) not between 1 and 30 then
    raise exception 'gunler 1–30 gün içeren bir dizi olmalı' using errcode = '22023';
  end if;
  for g in select e.value as gun, e.ordinality as i from jsonb_array_elements(v_gunler) with ordinality e loop
    if jsonb_typeof(g.gun) is distinct from 'object' then
      raise exception '%. gün bir nesne olmalı', g.i using errcode = '22023';
    end if;
    if char_length(btrim(g.gun ->> 'baslik')) > 80 then
      raise exception '%. gün: başlık en çok 80 karakter olmalı', g.i using errcode = '22023';
    end if;
    if jsonb_typeof(g.gun -> 'duraklar') is distinct from 'array' or jsonb_array_length(g.gun -> 'duraklar') < 1 then
      raise exception '%. gün: en az 1 durak olmalı', g.i using errcode = '22023';
    end if;
    if jsonb_array_length(g.gun -> 'duraklar') > 30 then
      raise exception '%. gün: en çok 30 durak olabilir', g.i using errcode = '22023';
    end if;
    for d in select e.value as durak, e.ordinality as i from jsonb_array_elements(g.gun -> 'duraklar') with ordinality e loop
      if jsonb_typeof(d.durak) is distinct from 'object' then
        raise exception '%. gün %. durak bir nesne olmalı', g.i, d.i using errcode = '22023';
      end if;
      if coalesce(d.durak ->> 'place_id', '') !~ '^[A-Za-z0-9_-]{10,255}$' then
        raise exception '%. gün %. durak: place_id geçersiz', g.i, d.i using errcode = '22023';
      end if;
      if char_length(btrim(coalesce(d.durak ->> 'ad', ''))) not between 1 and 120 then
        raise exception '%. gün %. durak: ad 1–120 karakter olmalı', g.i, d.i using errcode = '22023';
      end if;
      if jsonb_typeof(d.durak -> 'sure_dk') is distinct from 'number' or (d.durak ->> 'sure_dk') !~ '^[0-9]+$'
        or (d.durak ->> 'sure_dk')::integer not between 15 and 480 then
        raise exception '%. gün %. durak: sure_dk 15–480 arası tam sayı olmalı', g.i, d.i using errcode = '22023';
      end if;
      if jsonb_typeof(d.durak -> 'lat') is distinct from 'number' or jsonb_typeof(d.durak -> 'lng') is distinct from 'number'
        or abs((d.durak ->> 'lat')::double precision) > 90 or abs((d.durak ->> 'lng')::double precision) > 180 then
        raise exception '%. gün %. durak: lat ve lng dolu olmalı', g.i, d.i using errcode = '22023';
      end if;
      if d.durak ? 'kategori' and d.durak -> 'kategori' <> 'null'::jsonb and coalesce(d.durak ->> 'kategori', '') !~ '^[a-z0-9_]{1,60}$' then
        raise exception '%. gün %. durak: kategori Google birincil tipi olmalı (ör. museum)', g.i, d.i using errcode = '22023';
      end if;
    end loop;
  end loop;

  -- Şehir: slug'la bulunur; yoksa yalnız `yeni` verilmişse (Ece onayıyla) taslak açılır.
  if jsonb_typeof(v_sehir) is distinct from 'object' then
    raise exception 'sehir alanı gerekli: {slug} ya da {yeni: {ad, slug, lat, lng}}' using errcode = '22023';
  end if;
  if v_sehir ? 'yeni' then
    if coalesce(v_sehir #>> '{yeni,slug}', '') !~ '^[a-z0-9-]{2,60}$' then
      raise exception 'sehir.yeni.slug yalnız küçük harf, rakam ve tire; 2–60 karakter' using errcode = '22023';
    end if;
    if char_length(btrim(coalesce(v_sehir #>> '{yeni,ad}', ''))) not between 1 and 80 then
      raise exception 'sehir.yeni.ad 1–80 karakter olmalı' using errcode = '22023';
    end if;
    if jsonb_typeof(v_sehir #> '{yeni,lat}') is distinct from 'number' or jsonb_typeof(v_sehir #> '{yeni,lng}') is distinct from 'number'
      or abs((v_sehir #>> '{yeni,lat}')::double precision) > 90 or abs((v_sehir #>> '{yeni,lng}')::double precision) > 180 then
      raise exception 'sehir.yeni: lat ve lng dolu olmalı' using errcode = '22023';
    end if;
    if exists (select 1 from public.sehirler where slug = v_sehir #>> '{yeni,slug}') then
      raise exception 'şehir zaten var: %; sehir.slug kullan', v_sehir #>> '{yeni,slug}' using errcode = '23505';
    end if;
    insert into public.sehirler (ad, slug, lat, lng, yayin)
    values (btrim(v_sehir #>> '{yeni,ad}'), v_sehir #>> '{yeni,slug}', (v_sehir #>> '{yeni,lat}')::double precision, (v_sehir #>> '{yeni,lng}')::double precision, false)
    returning id into v_sehir_id;
    v_yeni_sehir := true;
  else
    select id into v_sehir_id from public.sehirler where slug = v_sehir ->> 'slug';
    if v_sehir_id is null then
      raise exception 'şehir bulunamadı: %; yeni şehir için Ece''nin onayıyla sehir.yeni ver', coalesce(v_sehir ->> 'slug', 'boş') using errcode = 'P0002';
    end if;
  end if;

  -- Gezi: slug varsa reddedilir; p_yeniden yalnız taslağı (yayin=false) yeniden yazar. Yayındaki geziye dokunulmaz.
  select id, yayin into v_var from public.geziler where slug = v_slug for update;
  if found then
    if not coalesce(p_yeniden, false) then
      raise exception 'bu slug''la bir gezi zaten var: %; üzerine yazmak için Ece''nin onayıyla yeniden yükle', v_slug using errcode = '23505';
    end if;
    if v_var.yayin then
      raise exception 'yayındaki gezi değiştirilemez: %', v_slug using errcode = '42501';
    end if;
    update public.geziler set sehir_id = v_sehir_id, baslik = v_baslik, ozet = v_ozet, yazi_md = v_yazi, yazar_ad = v_yazar,
      yayin = false, yayin_at = null
    where id = v_var.id;
    delete from public.gezi_gunleri where gezi_id = v_var.id;
    v_gezi_id := v_var.id;
    v_yeniden := true;
  else
    insert into public.geziler (sehir_id, baslik, slug, ozet, yazi_md, yazar_ad, yayin, yayin_at)
    values (v_sehir_id, v_baslik, v_slug, v_ozet, v_yazi, v_yazar, false, null)
    returning id into v_gezi_id;
  end if;

  for g in select e.value as gun, e.ordinality as i from jsonb_array_elements(v_gunler) with ordinality e loop
    insert into public.gezi_gunleri (gezi_id, sira, baslik)
    values (v_gezi_id, g.i, nullif(btrim(g.gun ->> 'baslik'), ''))
    returning id into v_gun_id;
    insert into public.gezi_duraklari (gezi_gun_id, sira, place_id, ad, kategori, sure_dk, lat, lng)
    select v_gun_id, e.ordinality, e.value ->> 'place_id', btrim(e.value ->> 'ad'), nullif(e.value ->> 'kategori', ''),
      (e.value ->> 'sure_dk')::integer, (e.value ->> 'lat')::double precision, (e.value ->> 'lng')::double precision
    from jsonb_array_elements(g.gun -> 'duraklar') with ordinality e;
  end loop;

  -- Yazıdaki mekanlar (BO'nun icerik_mekanlari_yaz kuralı: yazı sırasıyla, satır içi bağlantı = satir, ::mekan[] = kart).
  -- Taslak yer satırı açılmaz: gezi silinince geride sahipsiz yer kalmasın.
  delete from public.icerik_mekanlari where sahip_tur = 'gezi' and sahip_id = v_gezi_id;
  insert into public.icerik_mekanlari (sahip_tur, sahip_id, place_id, bicim, sira)
  select 'gezi', v_gezi_id, coalesce(x.m[3], x.m[2]), case when x.m[3] is not null then 'kart' else 'satir' end, x.i::integer
  from regexp_matches(v_yazi, '\[([^\]\n]+)\]\(mekan:([A-Za-z0-9_-]{10,255})\)|^::mekan\[([A-Za-z0-9_-]{10,255})\][ \t]*$', 'gn')
    with ordinality as x(m, i);
  get diagnostics v_mekan = row_count;

  select jsonb_build_object(
      'gezi_id', ge.id, 'slug', ge.slug, 'gun_sayisi', ge.gun_sayisi, 'mekan_sayisi', ge.mekan_sayisi,
      'updated_at', ge.updated_at, 'yazidaki_mekan', v_mekan, 'yeni_sehir', v_yeni_sehir, 'yeniden', v_yeniden)
  into v_sonuc
  from public.geziler ge where ge.id = v_gezi_id;
  return v_sonuc;
end;
$$;
revoke execute on function public.icerik_gezi_taslak_yukle(jsonb, boolean) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- taslak sil

-- Yalnız yayin=false geziyi siler (günler ve duraklar cascade; yazıdaki mekan kayıtları da). Fotoğrafı olan taslak
-- silinmez: dosyalar kovada sahipsiz kalmasın, önce BO'dan kaldırılır.
create function public.icerik_gezi_taslak_sil(p_slug text) returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v record;
  v_sonuc jsonb;
begin
  select g.id, g.slug, g.yayin, g.gun_sayisi, g.mekan_sayisi into v from public.geziler g where g.slug = p_slug for update;
  if not found then
    raise exception 'gezi bulunamadı: %', coalesce(p_slug, 'boş') using errcode = 'P0002';
  end if;
  if v.yayin then
    raise exception 'yayındaki gezi silinemez: %', p_slug using errcode = '42501';
  end if;
  if exists (select 1 from public.icerik_fotolari f where f.sahip_tur = 'gezi' and f.sahip_id = v.id) then
    raise exception 'taslağın fotoğrafları var: önce BO''dan kaldırılmalı (%)', p_slug using errcode = '42501';
  end if;
  v_sonuc := jsonb_build_object('gezi_id', v.id, 'slug', v.slug, 'gun_sayisi', v.gun_sayisi, 'mekan_sayisi', v.mekan_sayisi);
  delete from public.icerik_mekanlari where sahip_tur = 'gezi' and sahip_id = v.id;
  delete from public.geziler where id = v.id;
  return v_sonuc;
end;
$$;
revoke execute on function public.icerik_gezi_taslak_sil(text) from public, anon, authenticated, service_role;
