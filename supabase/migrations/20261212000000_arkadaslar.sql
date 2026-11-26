-- #407 Arkadaşlar sekmesi (kanvas `Ana_v6_Arkadaslar`). Yeni tablo: paylasim_begeni. Veri silme yok; Google'a istek yok.
-- KK1: kişiler = şu an benimle aynı seyahatin üyesi olan kişiler (ben hariç).
-- KK2: akış = bu kişilerin açık paylaşım linkleri (#432 KK7); oluşturan seyahatten çıktıysa link kapalı sayılır.
-- KK3: `gezi_paylasim`'ın select kuralı değişmez; okuma yalnız bu `security definer` fonksiyonlarla. Token akışta dönmez;
--      kart alıcı ekranını paylaşımın kimliğiyle açar (`paylasim_ozeti_kimlik`, `paylasim_harita_izni_kimlik`,
--      `paylasimdan_al_kimlik`). Seyahatten çıkan kişi, artık birlikte bir seyahati yoksa, paylaşımları görmez.
-- KK3b: ♥ kişi başına bir kez; yalnız akışı görebilen beğenir. Sayı ve kim beğendi istemciye dönmez (#533 incelemesi, soru 1).
-- #533 incelemesi: akışa yalnız bu sürümden sonra açılan linkler girer (`akista`); izleyen kendi seyahatinin paylaşımını görmez;
-- misafir oturum akışı görmez; adlar ilk kelimeye iner; akıştan açılış 500/gün tavanına sayılmaz (yalnız `acilma_sayisi`).

-- İnceleme 2: eski açık linkler bir akışta görüneceği bilinmeden açıldı. Var olan satırlar false, bundan sonrakiler true.
-- İstemci bu kolonu yazamaz (insert/update kolon izinleri 20261207000000'da).
alter table public.gezi_paylasim add column akista boolean not null default false;
alter table public.gezi_paylasim alter column akista set default true;

-- Görünen addan ilk boşluksuz parça; küme #530'daki `paylasim_ozeti` ile aynı (JS `\s`).
create function public.ilk_kelime(p text) returns text
language sql immutable set search_path = ''
as $$
  select (regexp_match(p, '[^[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+'))[1]
$$;

-- Ben ve p_kisi şu an aynı seyahatin üyesiyiz (ben hariç).
create function public.birlikte_gezdik(p_kisi uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_kisi is not null and p_kisi <> auth.uid() and exists (
    select 1 from public.members a join public.members b on b.trip_id = a.trip_id
    where a.user_id = auth.uid() and b.user_id = p_kisi)
$$;

-- Paylaşım açık, akışa açık, oluşturanı hâlâ seyahatinde ve oluşturanla birlikte gezdik; misafir oturum değil.
create function public.paylasim_gorebilir(p_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select not public.is_anonymous() and exists (
    select 1 from public.gezi_paylasim g
    where g.id = p_id and g.acik and g.akista
      and exists (select 1 from public.members m where m.trip_id = g.trip_id and m.user_id = g.olusturan)
      and public.birlikte_gezdik(g.olusturan))
$$;

-- KK1: kişi satırı. Ad, ortak seyahatlerden en son katılınandaki görünen adın ilk kelimesi; en son katılan önde.
create function public.arkadaslarim() returns table (user_id uuid, ad text, foto text)
language sql stable security definer set search_path = ''
as $$
  select x.user_id, public.ilk_kelime(x.ad), (select p.photo_url from public.profiles p where p.id = x.user_id)
  from (
    select distinct on (b.user_id) b.user_id, b.display_name as ad, b.joined_at
    from public.members a
    join public.members b on b.trip_id = a.trip_id and b.user_id <> a.user_id
    where a.user_id = auth.uid()
    order by b.user_id, b.joined_at desc
  ) x
  order by x.joined_at desc, x.user_id
$$;

-- KK3b: beğeni. Kim beğendi yalnız beğenene görünür; sayı istemciye dönmez.
create table public.paylasim_begeni (
  paylasim_id uuid not null references public.gezi_paylasim (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (paylasim_id, user_id)
);
create index paylasim_begeni_kullanici on public.paylasim_begeni (user_id);
alter table public.paylasim_begeni enable row level security;
revoke all on public.paylasim_begeni from public, anon, authenticated;
grant select, delete on public.paylasim_begeni to authenticated;
grant insert (paylasim_id) on public.paylasim_begeni to authenticated;
create policy paylasim_begeni_select on public.paylasim_begeni for select to authenticated using (user_id = auth.uid());
create policy paylasim_begeni_insert on public.paylasim_begeni for insert to authenticated
  with check (user_id = auth.uid() and public.paylasim_gorebilir(paylasim_id));
create policy paylasim_begeni_delete on public.paylasim_begeni for delete to authenticated using (user_id = auth.uid());

-- KK2: akış, yeniden eskiye. Paylaşanın yalnız ilk adı (linkteki gibi) ve fotoğrafı (kişi satırındakiyle aynı yüz); token,
-- tarih, ♥ sayısı ve diğer üyelerin adı dönmez. İzleyenin üyesi olduğu seyahatin paylaşımı akışa girmez (inceleme 1).
create function public.arkadas_paylasimlari() returns table (
  id uuid, paylasan uuid, paylasan_ad text, foto text, sehir text, ad text, olusturuldu timestamptz,
  gun_sayisi integer, durak_sayisi integer, kisi_sayisi integer, kisi_kip text, begendim boolean)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.olusturan,
    public.ilk_kelime((select m.display_name from public.members m where m.trip_id = g.trip_id and m.user_id = g.olusturan)),
    (select p.photo_url from public.profiles p where p.id = g.olusturan),
    t.city_label, t.name, g.created_at,
    (select count(*) from public.days d where d.trip_id = t.id)::integer,
    (select count(*) from public.stops s where s.trip_id = t.id)::integer,
    (select count(*) from public.members m where m.trip_id = t.id)::integer,
    -- #517 KK3 ile aynı kural (geziModu): tarihsiz ya da başlamamış "gidiyor", sürüyor "geziyor", bitti "gezdi".
    case
      when t.start_date is null or t.end_date is null
        or t.start_date > (now() at time zone coalesce(t.tz, 'Europe/Istanbul'))::date then 'gidiyor'
      when t.end_date < (now() at time zone coalesce(t.tz, 'Europe/Istanbul'))::date then 'gezdi'
      else 'geziyor' end,
    exists (select 1 from public.paylasim_begeni b where b.paylasim_id = g.id and b.user_id = auth.uid())
  from public.gezi_paylasim g
  join public.trips t on t.id = g.trip_id
  where public.paylasim_gorebilir(g.id)
    and not exists (select 1 from public.members m where m.trip_id = g.trip_id and m.user_id = auth.uid())
  order by g.created_at desc
  limit 50
$$;

-- Özetin gövdesi, `paylasim_ozeti` (20261211000000) ile birebir; sayaç dışarıda. Yalnız bu dosyadaki fonksiyonlar çağırır.
create function public.paylasim_ozeti_govde(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  g public.gezi_paylasim;
  t public.trips;
  bugun date;
begin
  select * into g from public.gezi_paylasim where id = p_id;
  select * into t from public.trips where id = g.trip_id;
  bugun := (now() at time zone coalesce(t.tz, 'Europe/Istanbul'))::date;
  return jsonb_build_object(
    'kapali', false,
    'id', g.id,
    'paylasan', public.ilk_kelime((select m.display_name from public.members m where m.trip_id = t.id and m.user_id = g.olusturan)),
    'ad', t.name,
    'sehir', t.city_label,
    'gun_sayisi', (select count(*) from public.days d where d.trip_id = t.id),
    'durak_sayisi', (select count(*) from public.stops s where s.trip_id = t.id),
    'kisi_sayisi', (select count(*) from public.members m where m.trip_id = t.id),
    'kisi_kip', case
      when t.start_date is null or t.end_date is null or t.start_date > bugun then 'gidiyor'
      when t.end_date < bugun then 'gezdi'
      else 'geziyor' end,
    'gunler', coalesce((
      select jsonb_agg(jsonb_build_object('gun', d.index, 'duraklar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ad', coalesce(
            (select y.ad from public.yerler y where y.place_id = p.place_id and y.yayin order by y.created_at limit 1),
            (select gd.ad from public.gezi_duraklari gd
               join public.gezi_gunleri gg on gg.id = gd.gezi_gun_id
               join public.geziler gz on gz.id = gg.gezi_id
             where gd.place_id = p.place_id and gz.yayin order by gz.created_at limit 1)),
          'tur', p.primary_type,
          'dakika', s.minutes,
          -- PRD §7: Google koordinatı yalnız 30 gün içinde alınmışsa döner; eskiyse null.
          'lat', case when p.google_fetched_at > now() - interval '30 days' then p.lat end,
          'lng', case when p.google_fetched_at > now() - interval '30 days' then p.lng end
        ) order by s.order_key)
        from public.stops s join public.places p on p.id = s.place_ref
        where s.day_id = d.id), '[]'::jsonb)) order by d.index)
      from public.days d where d.trip_id = t.id), '[]'::jsonb)
  );
end;
$$;

-- Davranış aynı; gövde artık `paylasim_ozeti_govde`de (kimlikle açılış aynı gövdeyi sayaç tavanı olmadan kullanır).
create or replace function public.paylasim_ozeti(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  g public.gezi_paylasim;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24}$' then
    return null;
  end if;
  g := public.paylasim_gecerli(p_token);
  if g.id is null then
    if exists (select 1 from public.gezi_paylasim x where x.token = p_token) then
      return jsonb_build_object('kapali', true);
    end if;
    return null;
  end if;
  -- KK-ek2 (#517): günde en çok 500 artış sayılır; tavandan sonra özet döner ama sayaç durur.
  update public.gezi_paylasim x
     set acilma_sayisi = x.acilma_sayisi + 1,
         acilma_gun_sayisi = case when x.acilma_gunu = current_date then x.acilma_gun_sayisi + 1 else 1 end,
         acilma_gunu = current_date
   where x.id = g.id
     and not (x.acilma_gunu = current_date and x.acilma_gun_sayisi >= 500);
  return public.paylasim_ozeti_govde(g.id);
end;
$$;

-- KK3: kart alıcı ekranını kimlikle açar. Yalnız görebilen kişi; token istemciye gitmez. Açılış `acilma_sayisi`'na sayılır
-- ama 500/gün tavanına sayılmaz (tavan dışarı sızan linke karşı; inceleme, soru 4).
-- Akışta görülmüş ama sonra kapanan paylaşımda `{kapali, paylasan}` döner: ekran "{ad} bu paylaşımı kapattı." der (inceleme 4).
create function public.paylasim_ozeti_kimlik(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  g public.gezi_paylasim;
begin
  if public.is_anonymous() then
    return null;
  end if;
  if not public.paylasim_gorebilir(p_id) then
    select * into g from public.gezi_paylasim x where x.id = p_id and x.akista;
    if g.id is null or (g.olusturan is not null and not public.birlikte_gezdik(g.olusturan)) then
      return null;
    end if;
    return jsonb_build_object('kapali', true, 'paylasan', public.ilk_kelime((
      select b.display_name from public.members a join public.members b on b.trip_id = a.trip_id
      where a.user_id = auth.uid() and b.user_id = g.olusturan order by b.joined_at desc limit 1)));
  end if;
  update public.gezi_paylasim x set acilma_sayisi = x.acilma_sayisi + 1 where x.id = p_id;
  return public.paylasim_ozeti_govde(p_id);
end;
$$;

create function public.paylasim_harita_izni_kimlik(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.paylasim_gorebilir(p_id) then
    return false;
  end if;
  return public.paylasim_harita_izni((select g.token from public.gezi_paylasim g where g.id = p_id));
end;
$$;

create function public.paylasimdan_al_kimlik(p_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.paylasim_gorebilir(p_id) then
    raise exception 'paylaşım kapalı ya da yok' using errcode = 'P0002';
  end if;
  return public.paylasimdan_al((select g.token from public.gezi_paylasim g where g.id = p_id));
end;
$$;

revoke all on function public.ilk_kelime(text), public.paylasim_ozeti_govde(uuid) from public, anon, authenticated;
revoke all on function public.birlikte_gezdik(uuid), public.paylasim_gorebilir(uuid), public.arkadaslarim(),
  public.arkadas_paylasimlari(), public.paylasim_ozeti_kimlik(uuid), public.paylasim_harita_izni_kimlik(uuid),
  public.paylasimdan_al_kimlik(uuid)
  from public, anon, authenticated;
grant execute on function public.birlikte_gezdik(uuid), public.paylasim_gorebilir(uuid), public.arkadaslarim(),
  public.arkadas_paylasimlari(), public.paylasim_ozeti_kimlik(uuid), public.paylasim_harita_izni_kimlik(uuid),
  public.paylasimdan_al_kimlik(uuid)
  to authenticated;
