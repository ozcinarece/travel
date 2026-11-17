-- #234 KK6: tetikleyiciden (20261120000000_kova_temizle) önce silinmiş seyahatlerden kalan sohbet ve fiş klasörleri.
-- Tek seferlik iş, iki adım (Ece onayı, 15 Kasım):
--   1. Kuru çalıştırma: `yetim_klasorleri_kuyruga_al()` bu klasörleri kuyruğa `onay_bekliyor = true` ile yazar ve yalnız
--      yalnız üç sayıyı döndürür (klasör, dosya, MB). Hiçbir dosya silinmez; `kova-temizle` onay bekleyen satırı listelemez.
--      Liste kuyruk tablosunda kalır; repoya ya da loga yazılmaz.
--   2. Silme: Ürün sayıları onaylayınca `yetim_klasorleri_onayla(<klasör sayısı>)` işareti kaldırır; sayı o an onay bekleyen
--      satır sayısını tutmazsa hata verir ve hiçbir satırı açmaz. `kova-temizle` normal turunda siler; yetim satırlar
--      normal silmelerin arkasından gelir (`yetim`).
-- İkisi de yalnız service_role (ve postgres, supabase-sql işi) içindir.

alter table public.silinecek_klasorler add column onay_bekliyor boolean not null default false;
-- Kuru çalıştırmadan gelen satır. Temizleyici bunları normal (tetikleyiciden gelen) satırlardan sonra listeler, böylece
-- yeni silinen seyahatlerin dosyaları yetim kuyruğunun arkasında beklemez.
alter table public.silinecek_klasorler add column yetim boolean not null default false;

-- Temizleyici onay bekleyen satırı listelemez ve yetim satırları en sona alır (gövde 20261120000000 ile aynı, yalnız
-- `onay_bekliyor` koşulu ve sıralamanın başına `k.yetim` eklendi).
create or replace function public.kova_temizle_listesi(p_adet integer default 50)
returns table (kova text, trip_id uuid, dosyalar text[])
language sql stable security definer set search_path = ''
as $$
  select k.kova, k.trip_id,
         coalesce((select array_agg(o.name order by o.name)
                     from (select o.name from storage.objects o
                            where o.bucket_id = k.kova and o.name like k.trip_id::text || '/%'
                            order by o.name limit 1000) o), '{}')
    from public.silinecek_klasorler k
   where k.silindi is null
     and not k.onay_bekliyor
     and not exists (select 1 from public.trips t where t.id = k.trip_id)
   order by k.yetim, k.eklendi, k.kova, k.trip_id
   limit least(greatest(coalesce(p_adet, 0), 0), 50);
$$;

-- Seyahat normal yoldan silinirse (kimlik yine aynı olamaz ama satır önceden onay bekliyorsa) satır onay beklemez ve
-- normal satır gibi sıraya girer.
create or replace function public.trips_klasor_kuyrugu() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.silinecek_klasorler (kova, trip_id)
  values ('sohbet', old.id), ('fisler', old.id)
  on conflict (kova, trip_id) do update set silindi = null, eklendi = now(), onay_bekliyor = false, yetim = false;
  return old;
end;
$$;

-- KK6 adım 1 (kuru). Kovası sohbet ya da fisler olan, ilk klasör adı bir uuid olup hiçbir `trips.id` ile eşleşmeyen ve kuyrukta
-- olmayan klasörler `onay_bekliyor` ve `yetim` ile kuyruğa yazılır. Dönüş yalnız o an onay bekleyen bütün satırların
-- klasör, dosya ve MB sayısı (yeniden çalıştırmak aynı sayıyı verir); bunlar herkese açık Actions loguna düşer, başka metrik
-- döndürülmez. İlk klasörü uuid olmayan dosyalara dokunulmaz; varsa yalnız sayıları uyarı olarak verilir.
create function public.yetim_klasorleri_kuyruga_al()
returns table (klasor bigint, dosya bigint, mb numeric)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uuid_olmayan bigint;
begin
  with adaylar as (
    select distinct o.bucket_id as kova, split_part(o.name, '/', 1)::uuid as trip_id
      from storage.objects o
     where o.bucket_id in ('sohbet', 'fisler')
       and split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  insert into public.silinecek_klasorler (kova, trip_id, onay_bekliyor, yetim)
  select a.kova, a.trip_id, true, true
    from adaylar a
   where not exists (select 1 from public.trips t where t.id = a.trip_id)
  on conflict (kova, trip_id) do nothing;

  select count(*) into v_uuid_olmayan
    from storage.objects x
   where x.bucket_id in ('sohbet', 'fisler')
     and split_part(x.name, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  if v_uuid_olmayan > 0 then
    raise warning 'yetim_klasorleri_kuyruga_al: ilk klasörü uuid olmayan % dosya var; bunlara dokunulmadı', v_uuid_olmayan;
  end if;

  return query
  select (select count(*) from public.silinecek_klasorler k where k.onay_bekliyor),
         count(o.*),
         round(coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::numeric end), 0) / 1048576, 1)
    from public.silinecek_klasorler k
    join storage.objects o on o.bucket_id = k.kova and o.name like k.trip_id::text || '/%'
   where k.onay_bekliyor;
end;
$$;
revoke execute on function public.yetim_klasorleri_kuyruga_al() from public, anon, authenticated;
grant execute on function public.yetim_klasorleri_kuyruga_al() to service_role;

-- KK6 adım 2 (Ürün onayından sonra). `p_beklenen_klasor`: Ürün'ün onayladığı, kuru çalıştırmanın döndürdüğü klasör sayısı.
-- O an onay bekleyen satır sayısı bundan farklıysa (ör. onaydan sonra kuru çalıştırma yeniden koştu) hata verir, hiçbir satırı
-- açmaz. Tutarsa işaret kalkar; seyahati hâlâ yok olan satırlar `kova-temizle`'nin sonraki turlarında (turda en çok 50 klasör,
-- normal satırlardan sonra) silinir. Dönüş: onaylanan satır sayısı.
create function public.yetim_klasorleri_onayla(p_beklenen_klasor bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_bekleyen bigint;
  v_acilan bigint;
begin
  -- Aynı anda çalışan bir kuru çalıştırma sayıyı sayımla güncelleme arasında değiştiremesin.
  lock table public.silinecek_klasorler in share row exclusive mode;
  select count(*) into v_bekleyen from public.silinecek_klasorler k where k.onay_bekliyor;
  if p_beklenen_klasor is null or v_bekleyen <> p_beklenen_klasor then
    raise exception 'yetim_klasorleri_onayla: onay bekleyen % klasör var, onaylanan sayı %; hiçbir satır açılmadı',
      v_bekleyen, p_beklenen_klasor
      using errcode = 'P0001';
  end if;
  with o as (
    update public.silinecek_klasorler k set onay_bekliyor = false
     where k.onay_bekliyor
       and not exists (select 1 from public.trips t where t.id = k.trip_id)
    returning 1
  )
  select count(*) into v_acilan from o;
  return v_acilan;
end;
$$;
revoke execute on function public.yetim_klasorleri_onayla(bigint) from public, anon, authenticated;
grant execute on function public.yetim_klasorleri_onayla(bigint) to service_role;
