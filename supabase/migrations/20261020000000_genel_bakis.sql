-- #110: backoffice genel bakış — Edge Function / Google istek sayacı, panel ayarları, davet olayları, tek çağrılık özet.

-- KK5: günlük sayaç. cagri = Edge Function çağrısı (kullanım), google = Google'a giden istek (maliyet; önbellek sayılmaz).
create table public.api_sayac (
  gun date not null default ((now() at time zone 'Europe/Istanbul')::date),
  fonksiyon text not null check (fonksiyon ~ '^[a-z0-9-]{2,40}$'),
  cagri integer not null default 0 check (cagri >= 0),
  google integer not null default 0 check (google >= 0),
  primary key (gun, fonksiyon)
);
alter table public.api_sayac enable row level security;
revoke all on public.api_sayac from anon, authenticated;
grant select on public.api_sayac to authenticated;
create policy api_sayac_admin on public.api_sayac for select to authenticated using ((select public.is_admin()));

-- Yalnız Edge Function'lar (service_role) artırır.
create function public.api_sayac_artir(p_fonksiyon text, p_cagri integer default 0, p_google integer default 0) returns void
language sql security definer set search_path = ''
as $$
  insert into public.api_sayac as s (fonksiyon, cagri, google) values (p_fonksiyon, greatest(p_cagri, 0), greatest(p_google, 0))
  on conflict (gun, fonksiyon) do update set cagri = s.cagri + excluded.cagri, google = s.google + excluded.google;
$$;
revoke execute on function public.api_sayac_artir(text, integer, integer) from public, anon, authenticated;
grant execute on function public.api_sayac_artir(text, integer, integer) to service_role;

-- Panel ayarları (#111 Ayarlar düzenler). Yalnız admin.
create table public.yonetim_ayarlari (
  anahtar text primary key check (anahtar ~ '^[a-z0-9_]{2,60}$'),
  deger jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger yonetim_ayarlari_updated_at before update on public.yonetim_ayarlari
  for each row execute function public.updated_at_yaz();
alter table public.yonetim_ayarlari enable row level security;
revoke all on public.yonetim_ayarlari from anon;
create policy yonetim_ayarlari_admin on public.yonetim_ayarlari for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
insert into public.yonetim_ayarlari (anahtar, deger) values ('google_aylik_butce', '25000');

-- KK1 paylaşım: uygulama davet linki paylaşınca / açılınca yazar (mobil tarafa ricası #110'da).
alter table public.olaylar drop constraint olaylar_tur_check,
  add constraint olaylar_tur_check check (tur in ('gezi_goruntulendi', 'gezi_alindi', 'yer_eklendi', 'davet_paylasildi', 'davet_acildi'));
create index olaylar_tur_zaman_idx on public.olaylar (tur, created_at desc);

-- KK1–KK4: tek çağrıda genel bakış (admin değilse 42501). Günler Türkiye saatiyle; aralık p_gun gün.
create function public.yonetim_ozet(p_gun integer default 30) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz constant text := 'Europe/Istanbul';
  v_bugun date := (now() at time zone v_tz)::date;
  v_bas timestamptz := now() - make_interval(days => p_gun);
  v_onceki timestamptz := now() - make_interval(days => 2 * p_gun);
  v_hafta_bas timestamptz := (date_trunc('week', now() at time zone v_tz)) at time zone v_tz;
  v_ay_bas date := date_trunc('month', v_bugun)::date;
  sonuc jsonb;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  if p_gun not between 1 and 366 then
    raise exception 'aralık 1–366 gün' using errcode = '22023';
  end if;

  with
  alinan as (
    select o.created_at, o.hedef_id, o.meta, g.mekan_sayisi
    from public.olaylar o left join public.geziler g on g.id = o.hedef_id
    where o.tur = 'gezi_alindi' and o.created_at > v_onceki
  ),
  alinan_tur as (
    select created_at, hedef_id,
      coalesce(meta ->> 'secenek',
        case when coalesce((meta ->> 'durak')::int, 0) = 0 then 'mekan'
             when (meta ->> 'durak')::int >= coalesce(mekan_sayisi, 0) then 'tum'
             else 'gunler' end) as secenek
    from alinan
  ),
  haftalar as (
    select generate_series(date_trunc('week', now() at time zone v_tz) - interval '11 weeks', date_trunc('week', now() at time zone v_tz), interval '1 week')::date as hafta
  ),
  en_cok as (
    select g.id, g.baslik, s.ad as sehir, g.gun_sayisi,
      (select count(*) from public.olaylar o where o.hedef_id = g.id and o.tur = 'gezi_goruntulendi' and o.created_at > v_bas) as goruntu,
      (select count(*) from public.olaylar o where o.hedef_id = g.id and o.tur = 'gezi_alindi' and o.created_at > v_bas) as alindi,
      (select count(*) from public.kaydedilenler k where k.hedef_id = g.id and k.tur = 'gezi' and k.created_at > v_bas) as kalp
    from public.geziler g join public.sehirler s on s.id = g.sehir_id
  )
  select jsonb_build_object(
    'aralik_gun', p_gun,
    'kullanici', jsonb_build_object(
      'toplam', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false)),
      'son7', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and u.created_at > now() - interval '7 days')),
    'seyahat', jsonb_build_object(
      'toplam', (select count(*) from public.trips),
      'bu_hafta', (select count(*) from public.trips where created_at >= v_hafta_bas),
      'onceki_hafta', (select count(*) from public.trips where created_at >= v_hafta_bas - interval '7 days' and created_at < v_hafta_bas)),
    'gezi_alindi', jsonb_build_object(
      'toplam', (select count(*) from alinan_tur where created_at > v_bas),
      'onceki', (select count(*) from alinan_tur where created_at <= v_bas),
      'tum', (select count(*) from alinan_tur where created_at > v_bas and secenek = 'tum'),
      'gunler', (select count(*) from alinan_tur where created_at > v_bas and secenek = 'gunler'),
      'mekan', (select count(*) from alinan_tur where created_at > v_bas and secenek = 'mekan')),
    'paylasim', jsonb_build_object(
      'paylasildi', (select count(*) from public.olaylar where tur = 'davet_paylasildi' and created_at > v_bas),
      'paylasildi_onceki', (select count(*) from public.olaylar where tur = 'davet_paylasildi' and created_at > v_onceki and created_at <= v_bas),
      'acildi', (select count(*) from public.olaylar where tur = 'davet_acildi' and created_at > v_bas),
      -- Uygulama davet olaylarını yazmaya başlayana kadar kart linkle katılımı gösterir.
      'olay_var', exists (select 1 from public.olaylar where tur in ('davet_paylasildi', 'davet_acildi')),
      'katilim', (select count(*) from public.members m where m.role <> 'owner' and m.joined_at > v_bas),
      'katilim_onceki', (select count(*) from public.members m where m.role <> 'owner' and m.joined_at > v_onceki and m.joined_at <= v_bas)),
    'google', jsonb_build_object(
      'ay', (select coalesce(sum(google), 0) from public.api_sayac where gun >= v_ay_bas),
      'onceki_ay', (select coalesce(sum(google), 0) from public.api_sayac where gun >= (v_ay_bas - interval '1 month')::date and gun < v_ay_bas),
      'butce', (select (deger #>> '{}')::numeric from public.yonetim_ayarlari where anahtar = 'google_aylik_butce')),
    'haftalik', (select coalesce(jsonb_agg(jsonb_build_object(
        'hafta', h.hafta,
        'kullanici', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and (u.created_at at time zone v_tz)::date >= h.hafta and (u.created_at at time zone v_tz)::date < h.hafta + 7),
        'seyahat', (select count(*) from public.trips t where (t.created_at at time zone v_tz)::date >= h.hafta and (t.created_at at time zone v_tz)::date < h.hafta + 7)
      ) order by h.hafta), '[]'::jsonb) from haftalar h),
    'en_cok_alinan', (select coalesce(jsonb_agg(to_jsonb(e) order by e.alindi desc, e.goruntu desc), '[]'::jsonb)
      from (select * from en_cok where alindi > 0 or goruntu > 0 order by alindi desc, goruntu desc limit 4) e),
    'bugun', jsonb_build_object(
      'kullanici', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and (u.created_at at time zone v_tz)::date = v_bugun),
      'seyahat', (select count(*) from public.trips t where (t.created_at at time zone v_tz)::date = v_bugun),
      'gezi_alindi', (select count(*) from public.olaylar o where o.tur = 'gezi_alindi' and (o.created_at at time zone v_tz)::date = v_bugun),
      'kesfet', (select coalesce(sum(cagri), 0) from public.api_sayac where gun = v_bugun and fonksiyon = 'places-nearby'),
      'mekan_paneli', (select coalesce(sum(cagri), 0) from public.api_sayac where gun = v_bugun and fonksiyon = 'places-full'),
      'yorum', (select coalesce(sum(cagri), 0) from public.api_sayac where gun = v_bugun and fonksiyon = 'places-reviews'))
  ) into sonuc;
  return sonuc;
end;
$$;

revoke execute on function public.yonetim_ozet(integer) from public, anon;
grant execute on function public.yonetim_ozet(integer) to authenticated;
