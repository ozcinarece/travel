-- #234 KK1–KK4: silinen seyahatin sohbet fotoğrafları ve fişleri Storage'da kalmaz.
-- Seyahat silinince (istemcinin silmesi ya da hesap silmede prepare_account_deletion) `trips` için after delete tetikleyicisi
-- `sohbet` ve `fisler` kovaları için kuyruğa birer satır yazar. Dosyaları `kova-temizle` Edge Function'ı Storage API ile
-- siler (SQL ile storage.objects silmek dosyanın kendisini silmez). Fonksiyon günde bir kez GitHub Actions'tan
-- (kova-temizle.yml) service_role ile çağrılır. Kuyruk ve yardımcılar yalnız service_role'e açıktır.

-- KK1: kuyruk. RLS açık, politika yok: anon ve authenticated (yönetici dahil) okuyamaz ve yazamaz.
create table public.silinecek_klasorler (
  kova text not null check (kova in ('sohbet', 'fisler')),
  trip_id uuid not null,
  eklendi timestamptz not null default now(),
  silindi timestamptz,
  primary key (kova, trip_id)
);
alter table public.silinecek_klasorler enable row level security;
revoke all on public.silinecek_klasorler from public, anon, authenticated;
grant select, insert, update, delete on public.silinecek_klasorler to service_role;

-- KK2: tetikleyici. Silinen seyahat başına iki satır; aynı satır zaten varsa dokunulmaz.
create function public.trips_klasor_kuyrugu() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.silinecek_klasorler (kova, trip_id)
  values ('sohbet', old.id), ('fisler', old.id)
  on conflict (kova, trip_id) do nothing;
  return old;
end;
$$;
revoke execute on function public.trips_klasor_kuyrugu() from public, anon, authenticated;

create trigger trips_klasor_kuyrugu after delete on public.trips
  for each row execute function public.trips_klasor_kuyrugu();

-- KK3: temizleyicinin işi. Silinmemiş, seyahati artık olmayan en eski en çok p_adet (≤ 50) klasör ve içindeki dosya adları
-- (klasör başına en çok 1000; fazlası sonraki turda). Önek yalnız kuyruk satırından kurulur: `{trip_id}/`.
create function public.kova_temizle_listesi(p_adet integer default 50)
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
     and not exists (select 1 from public.trips t where t.id = k.trip_id)
   order by k.eklendi, k.kova, k.trip_id
   limit least(greatest(coalesce(p_adet, 0), 0), 50);
$$;
revoke execute on function public.kova_temizle_listesi(integer) from public, anon, authenticated;
grant execute on function public.kova_temizle_listesi(integer) to service_role;

-- Klasör boşaldıysa `silindi` doldurulur; dosya kaldıysa (yarıda kalan tur) satır açık kalır, sonraki tur devam eder.
-- Seyahat yeniden varsa (olmaması gerekir) dokunulmaz.
create function public.kova_temizle_bitir(p_kova text, p_trip_id uuid) returns boolean
language sql security definer set search_path = ''
as $$
  update public.silinecek_klasorler k
     set silindi = now()
   where k.kova = p_kova and k.trip_id = p_trip_id and k.silindi is null
     and not exists (select 1 from public.trips t where t.id = k.trip_id)
     and not exists (select 1 from storage.objects o where o.bucket_id = k.kova and o.name like k.trip_id::text || '/%')
  returning true;
$$;
revoke execute on function public.kova_temizle_bitir(text, uuid) from public, anon, authenticated;
grant execute on function public.kova_temizle_bitir(text, uuid) to service_role;
