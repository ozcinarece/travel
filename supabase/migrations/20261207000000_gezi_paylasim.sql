-- #432 1/3: gezi paylaşımı (link). KK3 tablo + token + kapatma, KK5 girişsiz özet, KK6 kaynak_paylasim, KK8 ölçüm.
-- Link: https://…/r/g/{token} (Ürün kararı 1; `app.config.ts`'teki `/r/` önekini kullanır, native değişiklik yok).
-- Girişsiz okuma tabloya politika açılarak değil, `security definer` `paylasim_ozeti(token)` ile yapılır. Notlar, harcamalar,
-- sohbet, konum (canlı), davet token'ı ve otel hiç dönmez (KK2). Durak adı Google'dan değil: yalnız yayındaki kendi
-- içeriğimizden (yer ya da hazır gezi durağı) gelir, yoksa null ve istemci tür adını yazar (Ürün kararı 2b; Places 0).
-- Bağımlılık: #428'in 20261206 migration'ı önce gider (olay türü listesi onun listesinin üstüne kurulur).

-- 24 karakter base64url (18 rastgele bayt = 144 bit): tahmin edilemez (KK3).
create function public.paylasim_token_uret() returns text
language sql volatile set search_path = ''
as $$ select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_') $$;

create table public.gezi_paylasim (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  olusturan uuid default auth.uid() references auth.users (id) on delete set null,
  token text not null unique default public.paylasim_token_uret() check (token ~ '^[A-Za-z0-9_-]{24}$'),
  kisi_adlari_acik boolean not null default false,
  acik boolean not null default true,
  -- KK8: girişsiz açılış sayacı; IP, user-agent ya da kim olduğu yazılmaz (Ürün kararı 3).
  acilma_sayisi integer not null default 0 check (acilma_sayisi >= 0),
  -- Ürün kararı 2: token başına günlük en çok 200 harita yüklemesi (Maps JS, yükleme başına ücretli).
  harita_gunu date,
  harita_sayisi integer not null default 0 check (harita_sayisi >= 0),
  created_at timestamptz not null default now(),
  kapatildi_at timestamptz,
  constraint kapali_damgasi check (acik = (kapatildi_at is null))
);
-- Kişi başına seyahat başına tek açık link: "Linki gönder" ikinci kez basılınca aynı link döner.
create unique index gezi_paylasim_acik_tek on public.gezi_paylasim (trip_id, olusturan) where acik;
create index gezi_paylasim_trip on public.gezi_paylasim (trip_id);

alter table public.gezi_paylasim enable row level security;
revoke all on public.gezi_paylasim from public, anon, authenticated;
grant select on public.gezi_paylasim to authenticated;
grant insert (trip_id, kisi_adlari_acik) on public.gezi_paylasim to authenticated;
grant update (acik, kisi_adlari_acik) on public.gezi_paylasim to authenticated;

-- Yalnız seyahatin hesabı olan üyesi kendi adına link oluşturur; misafir (anonim) oturum açamaz (Ürün kararı, #435).
-- Yalnız seyahatin üyesi kendi adına link oluşturur; linki yalnız oluşturan görür, değiştirir ve kapatır. Silme yok (kapatılır).
create policy gezi_paylasim_select on public.gezi_paylasim for select to authenticated using (olusturan = auth.uid());
create policy gezi_paylasim_insert on public.gezi_paylasim for insert to authenticated
  with check (olusturan = auth.uid() and public.is_member(trip_id) and not public.is_anonymous());
create policy gezi_paylasim_update on public.gezi_paylasim for update to authenticated
  using (olusturan = auth.uid()) with check (olusturan = auth.uid());

-- Kapalı link yeniden açılmaz (yeni link oluşturulur); kapatma damgası burada basılır.
create function public.gezi_paylasim_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not old.acik and new.acik then
    raise exception 'kapatılan paylaşım yeniden açılamaz' using errcode = '42501';
  end if;
  if old.acik and not new.acik then
    new.kapatildi_at := now();
  end if;
  return new;
end;
$$;
create trigger gezi_paylasim_guard before update on public.gezi_paylasim
  for each row execute function public.gezi_paylasim_guard();

-- KK6: "Seyahatime al" ile kurulan seyahat hangi paylaşımdan geldi. Yalnız paylasimdan_al yazar.
alter table public.trips add column kaynak_paylasim uuid references public.gezi_paylasim (id) on delete set null;

create function public.trips_kaynak_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.kaynak_paylasim is distinct from (case when tg_op = 'UPDATE' then old.kaynak_paylasim end) then
    raise exception 'kaynak_paylasim doğrudan yazılamaz' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger trips_kaynak_guard before insert or update of kaynak_paylasim on public.trips
  for each row execute function public.trips_kaynak_guard();

-- Oluşturan seyahatten çıkınca linkleri kapanır; aynı kişi yeniden üye olursa eski link canlanmaz.
create function public.gezi_paylasim_uye_cikti() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.gezi_paylasim set acik = false
   where trip_id = old.trip_id and olusturan = old.user_id and acik;
  return old;
end;
$$;
create trigger gezi_paylasim_uye_cikti after delete on public.members
  for each row execute function public.gezi_paylasim_uye_cikti();

-- Açık ve oluşturanı hâlâ seyahatin üyesi olan link. Oluşturan seyahatten çıktıysa link kapalı sayılır.
create function public.paylasim_gecerli(p_token text) returns public.gezi_paylasim
language sql stable security definer set search_path = ''
as $$
  select g.* from public.gezi_paylasim g
  where g.token = p_token and g.acik
    and exists (select 1 from public.members m where m.trip_id = g.trip_id and m.user_id = g.olusturan)
$$;

-- KK5: girişsiz salt okunur özet. Bilinmeyen token → null; kapalı → {"kapali": true}; açık → özet ve sayaç +1.
-- İstemci aynı oturumda bir kez çağırır (Ürün kararı 3).
create function public.paylasim_ozeti(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  g public.gezi_paylasim;
  t public.trips;
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
  update public.gezi_paylasim set acilma_sayisi = acilma_sayisi + 1 where id = g.id;
  select * into t from public.trips where id = g.trip_id;
  return jsonb_build_object(
    'kapali', false,
    'ad', coalesce(t.name, t.city_label),
    'sehir', t.city_label,
    'gun_sayisi', (select count(*) from public.days d where d.trip_id = t.id),
    'durak_sayisi', (select count(*) from public.stops s where s.trip_id = t.id),
    'kisi_sayisi', (select count(*) from public.members m where m.trip_id = t.id),
    -- KK2: "Kişi adları görünsün" kapalıysa (varsayılan) ad hiç dönmez.
    'kisi_adlari', case when g.kisi_adlari_acik then
      (select coalesce(jsonb_agg(m.display_name order by m.joined_at), '[]'::jsonb) from public.members m where m.trip_id = t.id)
    end,
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
          -- PRD §7: Google koordinatı yalnız 30 gün içinde alınmışsa döner; eskiyse null (istemci haritaya koymaz).
          'lat', case when p.google_fetched_at > now() - interval '30 days' then p.lat end,
          'lng', case when p.google_fetched_at > now() - interval '30 days' then p.lng end
        ) order by s.order_key)
        from public.stops s join public.places p on p.id = s.place_ref
        where s.day_id = d.id), '[]'::jsonb)) order by d.index)
      from public.days d where d.trip_id = t.id), '[]'::jsonb)
  );
end;
$$;

-- Ürün kararı 2: "Haritada gör"e basınca istemci sorar; açık linkte günde 200 yüklemeye kadar true.
create function public.paylasim_harita_izni(p_token text) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n integer;
begin
  update public.gezi_paylasim g
     set harita_sayisi = case when g.harita_gunu = current_date then g.harita_sayisi + 1 else 1 end,
         harita_gunu = current_date
   where g.id = (public.paylasim_gecerli(p_token)).id
     and not (g.harita_gunu = current_date and g.harita_sayisi >= 200)
  returning harita_sayisi into n;
  return n is not null;
end;
$$;

-- KK5/KK6: "Seyahatime al". Girişli kullanıcı için tarihsiz yeni seyahat kurar: aynı gün sayısı, duraklar, süreler.
-- Koordinatın 30 günlük damgası (google_fetched_at) kopyalanır, sıfırlanmaz (emsal seyahati_kopyala). 30 günü geçen
-- koordinat kopyalanmaz (null; place_id ve damga kalır, PRD §7). Notlar kopyalanmaz.
create function public.paylasimdan_al(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  g public.gezi_paylasim;
  t public.trips;
  v_trip uuid;
  v_gun integer;
begin
  if auth.uid() is null then
    raise exception 'oturum yok' using errcode = '42501';
  end if;
  g := public.paylasim_gecerli(p_token);
  if g.id is null then
    raise exception 'paylaşım kapalı ya da yok' using errcode = 'P0002';
  end if;
  select * into t from public.trips where id = g.trip_id;
  select count(*) into v_gun from public.days where trip_id = t.id;

  insert into public.trips (owner_id, name, city_place_id, city_label, country_code, lat, lng, tz, google_fetched_at,
                            day_start, day_end, kaynak_paylasim)
  values (auth.uid(), t.name, t.city_place_id, t.city_label, t.country_code, t.lat, t.lng, t.tz, t.google_fetched_at,
          t.day_start, t.day_end, g.id)
  returning id into v_trip;
  if v_gun > 1 then
    insert into public.days (trip_id, index, date) select v_trip, i, null from generate_series(2, v_gun) i;
  end if;
  update public.days nd set start_time = od.start_time, end_time = od.end_time, order_manual = od.order_manual
  from public.days od
  where od.trip_id = t.id and nd.trip_id = v_trip and nd.index = od.index;

  insert into public.places (trip_id, place_id, primary_type, lat, lng, google_fetched_at, default_minutes, added_by)
  select v_trip, p.place_id, p.primary_type,
         case when p.google_fetched_at > now() - interval '30 days' then p.lat end,
         case when p.google_fetched_at > now() - interval '30 days' then p.lng end,
         p.google_fetched_at, p.default_minutes, auth.uid()
  from public.places p
  where p.trip_id = t.id and exists (select 1 from public.stops s where s.place_ref = p.id);

  insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
  select v_trip, nd.id, np.id, s.order_key, s.minutes
  from public.stops s
  join public.days od on od.id = s.day_id
  join public.places op on op.id = s.place_ref
  join public.days nd on nd.trip_id = v_trip and nd.index = od.index
  join public.places np on np.trip_id = v_trip and np.place_id = op.place_id
  where s.trip_id = t.id;

  insert into public.olaylar (user_id, tur, hedef_id) values (auth.uid(), 'paylasimdan_alindi', g.id);
  return v_trip;
end;
$$;

revoke all on function public.paylasim_token_uret(), public.gezi_paylasim_guard(), public.trips_kaynak_guard(), public.gezi_paylasim_uye_cikti(),
  public.paylasim_gecerli(text), public.paylasim_ozeti(text), public.paylasim_harita_izni(text), public.paylasimdan_al(text)
  from public, anon, authenticated;
grant execute on function public.paylasim_token_uret() to authenticated;
grant execute on function public.paylasim_ozeti(text), public.paylasim_harita_izni(text) to anon, authenticated;
grant execute on function public.paylasimdan_al(text) to authenticated;

-- KK8: paylasim_olustu (hedef_id: paylaşım), paylasim_acildi (girişli açılış; girişsizde yalnız sayaç), paylasimdan_alindi.
alter table public.olaylar drop constraint if exists olaylar_tur_check;
alter table public.olaylar add constraint olaylar_tur_check
  check (tur in ('gezi_goruntulendi', 'gezi_alindi', 'yer_eklendi', 'davet_paylasildi', 'davet_acildi', 'davet_katildi', 'sihirbaz_bitti', 'plan_kuruldu',
                 'ana_kart_acildi', 'ana_ara', 'planlamaya_devam', 'plan_hazir_davet', 'sekme_acildi', 'banner_acildi', 'raf_kart_acildi',
                 'paylasim_olustu', 'paylasim_acildi', 'paylasimdan_alindi'));
