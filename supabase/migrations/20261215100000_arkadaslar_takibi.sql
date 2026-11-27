-- #540 (#533 incelemesi): akış sorgusu izleyenden başlar (KK3), kimlikle açılış sayacı kişi başına günde bir (KK4), sahipsiz
-- paylaşım hiçbir şey döndürmez (KK5). Yeni tablo: paylasim_acilisi. Veri silme yok; Google'a istek yok.

-- KK3: akış sorgusunun son adımı; arkadaşın açık ve akışa açık linkleri.
create index gezi_paylasim_olusturan_akista on public.gezi_paylasim (olusturan) where acik and akista;

-- KK4: kimlikle açılışta kim, hangi paylaşımı, en son hangi gün açtı. Satır (paylaşım, kişi) başına bir tane; gün ilerledikçe
-- üzerine yazılır, böylece tablo günle büyümez ve geçmiş açılışlar tutulmaz. Paylaşım ya da kişi silinince satır da gider.
-- İstemciye kapalı: yalnız `paylasim_ozeti_kimlik` (security definer) yazar.
create table public.paylasim_acilisi (
  paylasim_id uuid not null references public.gezi_paylasim (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  gun date not null,
  primary key (paylasim_id, user_id)
);
create index paylasim_acilisi_kullanici on public.paylasim_acilisi (user_id);
alter table public.paylasim_acilisi enable row level security;
revoke all on public.paylasim_acilisi from public, anon, authenticated;

-- KK3: sorgu ben (members) → arkadaş (members) → arkadaşın açık, akıştaki linkleri (kısmi indeks) sırasıyla kurulur; bütün açık
-- paylaşımları taramaz. Koşullar `paylasim_gorebilir` ile aynı: misafir değil, oluşturan hâlâ seyahatinde, birlikte gezdik;
-- izleyenin üyesi olduğu seyahatin linki girmez. Dönen alanlar ve sıra değişmedi.
create or replace function public.arkadas_paylasimlari() returns table (
  id uuid, paylasan uuid, paylasan_ad text, foto text, sehir text, ad text, olusturuldu timestamptz,
  gun_sayisi integer, durak_sayisi integer, kisi_sayisi integer, kisi_kip text, begendim boolean)
language sql stable security definer set search_path = ''
as $$
  with arkadas as (
    select distinct b.user_id
    from public.members a
    join public.members b on b.trip_id = a.trip_id and b.user_id <> a.user_id
    where a.user_id = auth.uid() and not public.is_anonymous()
  )
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
  from arkadas k
  join public.gezi_paylasim g on g.olusturan = k.user_id and g.acik and g.akista
  join public.trips t on t.id = g.trip_id
  where exists (select 1 from public.members m where m.trip_id = g.trip_id and m.user_id = g.olusturan)
    and not exists (select 1 from public.members m where m.trip_id = g.trip_id and m.user_id = auth.uid())
  order by g.created_at desc
  limit 50
$$;

-- KK4: açılış `acilma_sayisi`'nı kişi başına günde en çok bir kez artırır (gün: `paylasim_ozeti`'ndeki `acilma_gunu` gibi
-- `current_date`). KK5: oluşturanı silinmiş (null) paylaşımda null döner; "kapalı" bilgisi de dönmez. Gerisi aynı.
create or replace function public.paylasim_ozeti_kimlik(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  g public.gezi_paylasim;
begin
  if public.is_anonymous() then
    return null;
  end if;
  select * into g from public.gezi_paylasim x where x.id = p_id;
  if g.id is null or g.olusturan is null then
    return null;
  end if;
  if not public.paylasim_gorebilir(p_id) then
    if not g.akista or not public.birlikte_gezdik(g.olusturan) then
      return null;
    end if;
    return jsonb_build_object('kapali', true, 'paylasan', public.ilk_kelime((
      select b.display_name from public.members a join public.members b on b.trip_id = a.trip_id
      where a.user_id = auth.uid() and b.user_id = g.olusturan order by b.joined_at desc limit 1)));
  end if;
  insert into public.paylasim_acilisi as a (paylasim_id, user_id, gun) values (p_id, auth.uid(), current_date)
    on conflict (paylasim_id, user_id) do update set gun = excluded.gun where a.gun < excluded.gun;
  if found then
    update public.gezi_paylasim x set acilma_sayisi = x.acilma_sayisi + 1 where x.id = p_id;
  end if;
  return public.paylasim_ozeti_govde(p_id);
end;
$$;

revoke all on function public.arkadas_paylasimlari(), public.paylasim_ozeti_kimlik(uuid) from public, anon, authenticated;
grant execute on function public.arkadas_paylasimlari(), public.paylasim_ozeti_kimlik(uuid) to authenticated;
