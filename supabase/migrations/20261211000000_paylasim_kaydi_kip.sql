-- #517 (Gezi paylaşımı 2/3c). Yeni tablo ya da veri silme yok; Google'a yeni istek yok, saklanan Google verisi değişmez.
-- KK1: link oluşunca ve kapanınca `changes`'a kayıt düşer; seyahatin bütün üyeleri Sohbet'te ve Grup › Son değişiklikler'de
--      gri satırı görür (changes_select politikası). Kayıtta token yok: field = 'acik', old/new yalnız true/false.
--      Bu kayıt geri alınamaz (degisikligi_geri_al `gezi_paylasim` varlığını tanımaz, 22023).
-- KK3: özet seyahatin kipini döndürür (`kisi_kip`: 'gidiyor' | 'geziyor' | 'gezdi'); tarih döndürülmez.
-- KK-ek1 (#515 incelemesi): linkte paylaşanın yalnız ilk adı döner (sekme, bölünmez boşluk dahil her boşlukta bölünür).
-- KK8 (#530 incelemesi 2): üye, seyahatte kim açmış olursa olsun açık link var mı öğrenir (`paylasim_acik_var`); token dönmez.
-- KK-ek2 (#515 incelemesi): girişsiz açılış sayacı token başına günde en çok 500 artar.

create function public.gezi_paylasim_log() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  -- Linki yalnız oluşturan açar ve kapatır; oluşturan seyahatten çıkınca da onun linki kapanır (gezi_paylasim_uye_cikti).
  kim uuid := (select u.id from auth.users u where u.id = new.olusturan);
begin
  -- Seyahat silinirken (cascade) kayıt yazılmaz.
  if not exists (select 1 from public.trips where id = new.trip_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
    values (new.trip_id, kim, 'gezi_paylasim', new.id::text, 'acik', null, 'true'::jsonb);
  elsif old.acik and not new.acik then
    insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
    values (new.trip_id, kim, 'gezi_paylasim', new.id::text, 'acik', 'true'::jsonb, 'false'::jsonb);
  end if;
  return new;
end;
$$;
revoke execute on function public.gezi_paylasim_log() from public, anon, authenticated;

create trigger gezi_paylasim_log after insert or update of acik on public.gezi_paylasim
  for each row execute function public.gezi_paylasim_log();

-- KK-ek2: günlük açılış tavanı (harita izninin kalıbı).
alter table public.gezi_paylasim
  add column acilma_gunu date,
  add column acilma_gun_sayisi integer not null default 0 check (acilma_gun_sayisi >= 0);

-- Gövde 20261209000000 ile aynı; değişenler: sayaç tavanı, `paylasan` ilk kelime, `kisi_kip`.
create or replace function public.paylasim_ozeti(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  g public.gezi_paylasim;
  t public.trips;
  bugun date;
  ad text;
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
  -- KK-ek2: günde en çok 500 artış sayılır; tavandan sonra özet döner ama sayaç durur.
  update public.gezi_paylasim x
     set acilma_sayisi = x.acilma_sayisi + 1,
         acilma_gun_sayisi = case when x.acilma_gunu = current_date then x.acilma_gun_sayisi + 1 else 1 end,
         acilma_gunu = current_date
   where x.id = g.id
     and not (x.acilma_gunu = current_date and x.acilma_gun_sayisi >= 500);
  select * into t from public.trips where id = g.trip_id;
  -- KK3: istemcideki geziModu ile aynı: tarihsiz ya da başlamamış "gidiyor", tarihler içinde "geziyor", dönüş geçtiyse "gezdi".
  bugun := (now() at time zone coalesce(t.tz, 'Europe/Istanbul'))::date;
  -- KK-ek1: ilk boşluksuz parça. [[:space:]] C yerelinde U+00A0'ı kapsamadığı için açıkça eklendi; baştaki boşluk da atlanır.
  ad := (regexp_match((select m.display_name from public.members m where m.trip_id = t.id and m.user_id = g.olusturan),
                      '[^[:space:]\u00a0]+'))[1];
  return jsonb_build_object(
    'kapali', false,
    'id', g.id,
    -- KK-ek1: yalnız ilk kelime ("Ayşe paylaştı"); soyadı linki olana gitmez. Diğer üyelerin adı hiç dönmez (#510).
    'paylasan', ad,
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

-- KK8 (#530 incelemesi 2): seyahatte (kim açmış olursa olsun) açık link var mı. Yalnız üyeye true döner; token ya da kim açtı dönmez.
create function public.paylasim_acik_var(p_trip uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_member(p_trip) and exists (select 1 from public.gezi_paylasim g where g.trip_id = p_trip and g.acik)
$$;
revoke execute on function public.paylasim_acik_var(uuid) from public, anon;
grant execute on function public.paylasim_acik_var(uuid) to authenticated;
