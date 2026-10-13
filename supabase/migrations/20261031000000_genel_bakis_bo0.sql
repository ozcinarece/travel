-- #157 genel bakış (kanvas BO-0): ilk saatlik plan süresi, davet oranı, kurulan plan, alınan hazır gezi, bu hafta grafiği,
-- Google API bugün (tahmini harcama / günlük bütçe), en çok alınan geziler, içerik sağlığı. Olaylar mobil PR'lardan
-- (#146 davet_*, #149 plan_kuruldu, #153 gezi_alindi); yorum sınırı #152'nin ayarı. Olay hiç yoksa ilgili parça
-- `olay_var: false` döner (panel "veri bekleniyor" yazar, sıfır göstermez).

-- Günlük bütçe (USD) ve kalem başına birim fiyat (USD / 1000 Google isteği; liste fiyatına yakın varsayılan, ücretsiz
-- kota düşülmez → tahmin üst sınırdır). Ayarlar ekranı gelince panelden değişir.
insert into public.yonetim_ayarlari (anahtar, deger) values
  ('google_gunluk_butce', '10'),
  ('google_birim_fiyat', '{"mekan": 17, "foto": 7, "rota": 5, "yorum": 20}')
on conflict (anahtar) do nothing;

create function public.yonetim_genel(p_gun integer default 7) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz constant text := 'Europe/Istanbul';
  v_bugun date := (now() at time zone v_tz)::date;
  -- Dönem: Bugün = Türkiye günü başından; 7 / 30 gün = son N gün. Önceki dönem aynı uzunlukta hemen öncesi.
  v_bas timestamptz := case when p_gun = 1 then v_bugun::timestamp at time zone v_tz else now() - make_interval(days => p_gun) end;
  v_onceki timestamptz := v_bas - case when p_gun = 1 then interval '1 day' else make_interval(days => p_gun) end;
  v_hafta date := date_trunc('week', now() at time zone v_tz)::date;
  sonuc jsonb;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  if p_gun not in (1, 7, 30) then
    raise exception 'dönem 1, 7 ya da 30 gün' using errcode = '22023';
  end if;

  with
  -- Kullanıcının ilk planı (her kullanıcı bir kez); süre sihirbaz başlangıcından (meta.sure_sn).
  ilk_plan as (
    select distinct on (o.user_id) o.user_id, o.created_at, nullif(o.meta ->> 'sure_sn', '')::numeric as sure
    from public.olaylar o where o.tur = 'plan_kuruldu'
    order by o.user_id, o.created_at
  ),
  donem_ilk as (select sure from ilk_plan where created_at > v_bas and sure is not null),
  kurulan as (select t.id from public.trips t where t.created_at > v_bas),
  paylasilan as (
    select distinct o.hedef_id from public.olaylar o
    where o.tur = 'davet_paylasildi' and o.hedef_id in (select id from kurulan)
  ),
  katilan as (
    select distinct o.hedef_id from public.olaylar o
    where o.tur = 'davet_katildi' and o.hedef_id in (select hedef_id from paylasilan)
  ),
  alinan as (
    select o.hedef_id, count(distinct o.user_id) as sayi
    from public.olaylar o where o.tur = 'gezi_alindi' and o.created_at > v_bas and o.hedef_id is not null
    group by o.hedef_id
  ),
  gunler as (select (v_hafta + i)::date as gun from generate_series(0, 6) i),
  sayac as (
    select
      case
        when s.fonksiyon in ('places-full', 'places-light', 'places-nearby', 'places-autocomplete', 'resolve-link') then 'mekan'
        when s.fonksiyon = 'places-photo' then 'foto'
        when s.fonksiyon in ('route-legs', 'route-matrix') then 'rota'
        when s.fonksiyon = 'places-reviews' then 'yorum'
      end as kalem,
      s.google
    from public.api_sayac s where s.gun = v_bugun
  ),
  -- Uygulamada görünen bölümler (#156 `gizli` sütunu; o migration'dan önce de çalışsın diye satırdan okunur).
  gorunen as (
    select r.id, r.sehir_id, r.yazi_md from public.sehir_rehberi r where not coalesce((to_jsonb(r) ->> 'gizli')::boolean, false)
  ),
  sehir_bolum as (
    select r.sehir_id, count(*) as bolum,
      count(*) filter (where nullif(trim(regexp_replace(coalesce(r.yazi_md, ''), '^#\s+[^\n]*\n*', '')), '') is null) as bos
    from gorunen r group by r.sehir_id
  ),
  sehir_mekan as (
    select r.sehir_id, count(distinct m.place_id) as mekan
    from gorunen r join public.icerik_mekanlari m on m.sahip_tur = 'rehber' and m.sahip_id = r.id
    group by r.sehir_id
  )
  select jsonb_build_object(
    'donem', p_gun,
    'ilk_plan', jsonb_build_object(
      'olay_var', exists (select 1 from public.olaylar where tur = 'plan_kuruldu'),
      'n', (select count(*) from donem_ilk),
      'medyan_sn', (select percentile_cont(0.5) within group (order by sure) from donem_ilk)),
    'davet', jsonb_build_object(
      'olay_var', exists (select 1 from public.olaylar where tur = 'davet_paylasildi'),
      'kurulan', (select count(*) from kurulan),
      'paylasilan', (select count(*) from paylasilan),
      'katilan', (select count(*) from katilan)),
    'plan', jsonb_build_object(
      'olay_var', exists (select 1 from public.olaylar where tur = 'plan_kuruldu'),
      'sayi', (select count(*) from public.olaylar where tur = 'plan_kuruldu' and created_at > v_bas),
      'onceki', (select count(*) from public.olaylar where tur = 'plan_kuruldu' and created_at > v_onceki and created_at <= v_bas)),
    'gezi', jsonb_build_object(
      'olay_var', exists (select 1 from public.olaylar where tur = 'gezi_alindi'),
      'sayi', (select coalesce(sum(sayi), 0) from alinan),
      'en_cok', (select g.baslik from alinan a join public.geziler g on g.id = a.hedef_id order by a.sayi desc, g.baslik limit 1)),
    'hafta', (select jsonb_agg(jsonb_build_object(
        'gun', g.gun,
        'plan', (select count(*) from public.olaylar o where o.tur = 'plan_kuruldu' and (o.created_at at time zone v_tz)::date = g.gun),
        'katilim', (select count(*) from public.olaylar o where o.tur = 'davet_katildi' and (o.created_at at time zone v_tz)::date = g.gun)
      ) order by g.gun) from gunler g),
    'hafta_olay_var', exists (select 1 from public.olaylar where tur in ('plan_kuruldu', 'davet_katildi')),
    'google', jsonb_build_object(
      'mekan', (select coalesce(sum(google), 0) from sayac where kalem = 'mekan'),
      'foto', (select coalesce(sum(google), 0) from sayac where kalem = 'foto'),
      'rota', (select coalesce(sum(google), 0) from sayac where kalem = 'rota'),
      'yorum', (select coalesce(sum(google), 0) from sayac where kalem = 'yorum'),
      'butce', (select (deger #>> '{}')::numeric from public.yonetim_ayarlari where anahtar = 'google_gunluk_butce'),
      'fiyat', (select deger from public.yonetim_ayarlari where anahtar = 'google_birim_fiyat'),
      'yorum_sinir', (select (deger #>> '{}')::integer from public.yonetim_ayarlari where anahtar = 'yorum_gunluk_sinir')),
    'en_cok_alinan', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'baslik', e.baslik, 'kapak_url', e.kapak_url, 'sayi', e.sayi) order by e.sayi desc, e.baslik), '[]'::jsonb)
      from (select g.id, g.baslik, g.kapak_url, a.sayi from alinan a join public.geziler g on g.id = a.hedef_id order by a.sayi desc, g.baslik limit 3) e),
    'icerik', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'ad', s.ad,
        'kapak', s.kapak_url is not null, 'genis_kapak', s.genis_kapak_url is not null,
        'bolum', coalesce(b.bolum, 0), 'bos_bolum', coalesce(b.bos, 0), 'mekan', coalesce(m.mekan, 0),
        'gezi', (select count(*) from public.geziler g where g.sehir_id = s.id and public.gezi_yayinda(g.id))
      ) order by s.ad), '[]'::jsonb)
      from public.sehirler s left join sehir_bolum b on b.sehir_id = s.id left join sehir_mekan m on m.sehir_id = s.id
      where s.yayin)
  ) into sonuc;
  return sonuc;
end;
$$;
revoke execute on function public.yonetim_genel(integer) from public, anon;
grant execute on function public.yonetim_genel(integer) to authenticated;
