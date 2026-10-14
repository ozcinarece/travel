-- #181 KK4: Gezi sayfasının ⋯ menüsünden "Tarihleri değiştir". Günler tarihle birlikte kayar: ilk N gün yeni tarihlerini alır,
-- uzayan seyahate sona gün eklenir (son günün bitiş otelinden başlar ve oraya döner), kısalan seyahatin sondaki günleri silinir
-- (durakları cascade ile kalkar; mekanlar listede kalır, "güne atanmamış" olur). Tek işlem; çağıranın yetkisiyle (RLS:
-- seyahatin her üyesi düzenler). Değişiklikler mevcut akışa (changes) düşer.
create or replace function public.seyahat_tarihlerini_degistir(p_trip_id uuid, p_start date, p_end date)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  yeni_sayi integer;
  eski_sayi integer;
  son_otel uuid;
begin
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'geçersiz tarih aralığı' using errcode = '22023';
  end if;
  yeni_sayi := p_end - p_start + 1;
  if yeni_sayi > 60 then
    raise exception 'seyahat en çok 60 gün' using errcode = '22023';
  end if;
  if not public.is_member(p_trip_id) then
    raise exception 'seyahat bulunamadı' using errcode = '42501';
  end if;

  update public.trips set start_date = p_start, end_date = p_end where id = p_trip_id;
  select count(*) into eski_sayi from public.days where trip_id = p_trip_id;

  -- Kısalan seyahat: sondaki günler (durakları cascade).
  delete from public.days where trip_id = p_trip_id and index > yeni_sayi;
  -- Kalan günler yeni tarihlerini alır.
  update public.days set date = p_start + (index - 1) where trip_id = p_trip_id and date is distinct from p_start + (index - 1);
  -- Uzayan seyahat: son günün bitiş otelinden başlayıp oraya dönen yeni günler.
  if yeni_sayi > eski_sayi then
    select coalesce(end_stay_id, start_stay_id) into son_otel from public.days where trip_id = p_trip_id order by index desc limit 1;
    insert into public.days (trip_id, index, date, start_stay_id, end_stay_id)
    select p_trip_id, g, p_start + (g - 1), son_otel, son_otel
    from generate_series(eski_sayi + 1, yeni_sayi) g;
  end if;
  return yeni_sayi;
end;
$$;

revoke all on function public.seyahat_tarihlerini_degistir(uuid, date, date) from public, anon;
grant execute on function public.seyahat_tarihlerini_degistir(uuid, date, date) to authenticated;
