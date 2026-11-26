-- #407 Arkadaşlar sekmesi (kanvas `Ana_v6_Arkadaslar`). Yeni tablo: paylasim_begeni. Veri silme yok; Google'a istek yok.
-- KK1: kişiler = şu an benimle aynı seyahatin üyesi olan kişiler (ben hariç).
-- KK2: akış = bu kişilerin açık paylaşım linkleri (#432 KK7); oluşturan seyahatten çıktıysa link kapalı sayılır.
-- KK3: `gezi_paylasim`'ın select kuralı değişmez; okuma yalnız bu `security definer` fonksiyonlarla. Token akışta dönmez;
--      kart alıcı ekranını paylaşımın kimliğiyle açar (`paylasim_ozeti_kimlik`, `paylasim_harita_izni_kimlik`,
--      `paylasimdan_al_kimlik`). Seyahatten çıkan kişi, artık birlikte bir seyahati yoksa, paylaşımları görmez.
-- KK3b: ♥ kişi başına bir kez; yalnız akışı görebilen beğenir; sayı akışta döner, kim beğendi dönmez.

-- Ben ve p_kisi şu an aynı seyahatin üyesiyiz (ben hariç).
create function public.birlikte_gezdik(p_kisi uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_kisi is not null and p_kisi <> auth.uid() and exists (
    select 1 from public.members a join public.members b on b.trip_id = a.trip_id
    where a.user_id = auth.uid() and b.user_id = p_kisi)
$$;

-- Paylaşım açık, oluşturanı hâlâ seyahatinde ve oluşturanla birlikte gezdik.
create function public.paylasim_gorebilir(p_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gezi_paylasim g
    where g.id = p_id and g.acik
      and exists (select 1 from public.members m where m.trip_id = g.trip_id and m.user_id = g.olusturan)
      and public.birlikte_gezdik(g.olusturan))
$$;

-- KK1: kişi satırı. Ad, ortak seyahatlerden en son katılınandaki görünen ad (zaten o seyahatte görünüyor); en son katılan önde.
create function public.arkadaslarim() returns table (user_id uuid, ad text, foto text)
language sql stable security definer set search_path = ''
as $$
  select x.user_id, x.ad, (select p.photo_url from public.profiles p where p.id = x.user_id)
  from (
    select distinct on (b.user_id) b.user_id, b.display_name as ad, b.joined_at
    from public.members a
    join public.members b on b.trip_id = a.trip_id and b.user_id <> a.user_id
    where a.user_id = auth.uid()
    order by b.user_id, b.joined_at desc
  ) x
  order by x.joined_at desc, x.user_id
$$;

-- KK3b: beğeni. Kim beğendi yalnız beğenene görünür; sayı `arkadas_paylasimlari` ile döner.
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

-- KK2: akış, yeniden eskiye. Paylaşanın yalnız ilk adı (linkteki gibi); token, tarih ve diğer üyelerin adı dönmez.
-- `kapak`: kapak tonu için paylaşımın kimliği (alıcı ekranı da aynı kimlikle açılır).
create function public.arkadas_paylasimlari() returns table (
  id uuid, paylasan uuid, paylasan_ad text, sehir text, ad text, olusturuldu timestamptz,
  gun_sayisi integer, durak_sayisi integer, kisi_sayisi integer, kisi_kip text, begeni_sayisi integer, begendim boolean)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.olusturan,
    (regexp_match((select m.display_name from public.members m where m.trip_id = g.trip_id and m.user_id = g.olusturan),
                  '[^[:space:] ]+'))[1],
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
    (select count(*) from public.paylasim_begeni b where b.paylasim_id = g.id)::integer,
    exists (select 1 from public.paylasim_begeni b where b.paylasim_id = g.id and b.user_id = auth.uid())
  from public.gezi_paylasim g
  join public.trips t on t.id = g.trip_id
  where g.acik
    and exists (select 1 from public.members m where m.trip_id = g.trip_id and m.user_id = g.olusturan)
    and public.birlikte_gezdik(g.olusturan)
  order by g.created_at desc
  limit 50
$$;

-- KK3: kart alıcı ekranını kimlikle açar. Yalnız görebilen kişi; token istemciye gitmez. Açılış sayacı linkteki gibi artar.
create function public.paylasim_ozeti_kimlik(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.paylasim_gorebilir(p_id) then
    return null;
  end if;
  return public.paylasim_ozeti((select g.token from public.gezi_paylasim g where g.id = p_id));
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

revoke all on function public.birlikte_gezdik(uuid), public.paylasim_gorebilir(uuid), public.arkadaslarim(),
  public.arkadas_paylasimlari(), public.paylasim_ozeti_kimlik(uuid), public.paylasim_harita_izni_kimlik(uuid),
  public.paylasimdan_al_kimlik(uuid)
  from public, anon, authenticated;
grant execute on function public.birlikte_gezdik(uuid), public.paylasim_gorebilir(uuid), public.arkadaslarim(),
  public.arkadas_paylasimlari(), public.paylasim_ozeti_kimlik(uuid), public.paylasim_harita_izni_kimlik(uuid),
  public.paylasimdan_al_kimlik(uuid)
  to authenticated;
