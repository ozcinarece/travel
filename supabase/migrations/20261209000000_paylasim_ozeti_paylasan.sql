-- #432 2/3b: alıcı ekranı (`Sos_v6_Alici`) için paylasim_ozeti'ne üç alan: `paylasan` (linki gönderenin adı; kişi adları
-- anahtarı kapalıyken de, Ürün kararı 21 Kasım), `id` (girişli açılış olayının hedefi) ve durak başına `dakika`.
-- #510 (Ece kararı, 26 Kasım): "Kişi adlarını göster" anahtarı kalktı, adlar hep gizli. Özet `kisi_adlari` alanını artık hiç
-- döndürmez; diğer üyelerin adı linki açana gitmez. İstemci `kisi_adlari_acik` kolonunu yazamaz (yetki aşağıda geri alınır).
-- Kolonun kendisi veri silen bir migration'la ayrıca kalkacak (§4, elle çalıştırılır); burada otomatik migrate durmasın diye yok.
-- Gövdenin geri kalanı 20261207000000 ile aynı; Google'a yeni istek yok, saklanan Google verisi değişmez.
create or replace function public.paylasim_ozeti(p_token text) returns jsonb
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
    -- Olay hedefi (girişli açılışta paylasim_acildi).
    'id', g.id,
    -- 2/3b (Ürün kararı, 21 Kasım): başlık "Ayşe paylaştı"; yalnız linki gönderen kişinin adı döner (#510: diğerleri hiç).
    'paylasan', (select m.display_name from public.members m where m.trip_id = t.id and m.user_id = g.olusturan),
    'ad', coalesce(t.name, t.city_label),
    'sehir', t.city_label,
    'gun_sayisi', (select count(*) from public.days d where d.trip_id = t.id),
    'durak_sayisi', (select count(*) from public.stops s where s.trip_id = t.id),
    'kisi_sayisi', (select count(*) from public.members m where m.trip_id = t.id),
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
          -- Planlanan süre (seyahatin kendi verisi, Google değil); hazır gezi durağında "Müze · 45 dk".
          'dakika', s.minutes,
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

-- #510: anahtar kalktı; istemci kolonu ne oluşturmada ne güncellemede yazabilir (varsayılan false kalır).
revoke insert (kisi_adlari_acik), update (kisi_adlari_acik) on public.gezi_paylasim from authenticated;
