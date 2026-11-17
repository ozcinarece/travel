-- #234 KK6: tetikleyiciden (20261120000000_kova_temizle) önce silinmiş seyahatlerden kalan sohbet ve fiş klasörleri.
-- Tek seferlik iş, iki adım (Ece onayı, 15 Kasım):
--   1. Kuru çalıştırma: `yetim_klasorleri_kuyruga_al()` bu klasörleri kuyruğa `onay_bekliyor = true` ile yazar ve yalnız
--      sayıları döndürür (klasör, dosya, MB). Hiçbir dosya silinmez; `kova-temizle` onay bekleyen satırı listelemez.
--      Liste kuyruk tablosunda kalır; repoya ya da loga yazılmaz.
--   2. Silme: Ürün sayıları onaylayınca `yetim_klasorleri_onayla()` işareti kaldırır; `kova-temizle` normal turunda siler.
-- İkisi de yalnız service_role (ve postgres, supabase-sql işi) içindir.

alter table public.silinecek_klasorler add column onay_bekliyor boolean not null default false;

-- Temizleyici onay bekleyen satırı listelemez (gövde 20261120000000 ile aynı, yalnız `onay_bekliyor` koşulu eklendi).
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
   order by k.eklendi, k.kova, k.trip_id
   limit least(greatest(coalesce(p_adet, 0), 0), 50);
$$;

-- Seyahat normal yoldan silinirse (kimlik yine aynı olamaz ama satır önceden onay bekliyorsa) satır onay beklemez.
create or replace function public.trips_klasor_kuyrugu() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.silinecek_klasorler (kova, trip_id)
  values ('sohbet', old.id), ('fisler', old.id)
  on conflict (kova, trip_id) do update set silindi = null, eklendi = now(), onay_bekliyor = false;
  return old;
end;
$$;

-- KK6 adım 1 (kuru). Kovası sohbet ya da fisler olan, ilk klasör adı bir uuid olup hiçbir `trips.id` ile eşleşmeyen ve kuyrukta
-- olmayan klasörler `onay_bekliyor` ile kuyruğa yazılır. Dönüş: o an onay bekleyen bütün satırların sayıları (yeniden
-- çalıştırmak aynı sayıyı verir). `uuid_olmayan`: ilk klasörü uuid olmayan dosya sayısı; bunlara dokunulmaz.
create function public.yetim_klasorleri_kuyruga_al()
returns table (klasor bigint, dosya bigint, mb numeric, yeni bigint, uuid_olmayan bigint, seyahat bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_yeni bigint;
begin
  with adaylar as (
    select distinct o.bucket_id as kova, split_part(o.name, '/', 1)::uuid as trip_id
      from storage.objects o
     where o.bucket_id in ('sohbet', 'fisler')
       and split_part(o.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), eklenen as (
    insert into public.silinecek_klasorler (kova, trip_id, onay_bekliyor)
    select a.kova, a.trip_id, true
      from adaylar a
     where not exists (select 1 from public.trips t where t.id = a.trip_id)
    on conflict (kova, trip_id) do nothing
    returning 1
  )
  select count(*) into v_yeni from eklenen;

  return query
  select (select count(*) from public.silinecek_klasorler k where k.onay_bekliyor),
         count(o.*),
         round(coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::numeric end), 0) / 1048576, 1),
         v_yeni,
         (select count(*) from storage.objects x
           where x.bucket_id in ('sohbet', 'fisler')
             and split_part(x.name, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
         (select count(*) from public.trips)
    from public.silinecek_klasorler k
    join storage.objects o on o.bucket_id = k.kova and o.name like k.trip_id::text || '/%'
   where k.onay_bekliyor;
end;
$$;
revoke execute on function public.yetim_klasorleri_kuyruga_al() from public, anon, authenticated;
grant execute on function public.yetim_klasorleri_kuyruga_al() to service_role;

-- KK6 adım 2 (Ürün onayından sonra). İşaret kalkar; seyahati hâlâ yok olan satırlar `kova-temizle`'nin sonraki turlarında
-- (turda en çok 50 klasör) silinir. Dönüş: onaylanan satır sayısı.
create function public.yetim_klasorleri_onayla() returns bigint
language sql security definer set search_path = ''
as $$
  with o as (
    update public.silinecek_klasorler k set onay_bekliyor = false
     where k.onay_bekliyor
       and not exists (select 1 from public.trips t where t.id = k.trip_id)
    returning 1
  )
  select count(*) from o;
$$;
revoke execute on function public.yetim_klasorleri_onayla() from public, anon, authenticated;
grant execute on function public.yetim_klasorleri_onayla() to service_role;
