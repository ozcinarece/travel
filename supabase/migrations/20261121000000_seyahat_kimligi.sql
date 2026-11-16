-- #263: seyahat kimliği istemciden seçilemez; silinmiş bir seyahatin kimliği yeniden kullanılamaz.
-- Neden: fiş ve sohbet dosyalarının Storage politikaları `{trip_id}/` klasörüne ve üyeliğe bağlı. Silinmiş seyahatin
-- kimliğiyle yeni seyahat açılabilseydi eski üye diğer üyelerin eski dosyalarını okuyabilir, kova-temizle de klasörü atlardı.

-- KK1: anon ve authenticated için kimlik her zaman sunucuda üretilir; verilen değer yok sayılır. İstemci ve
-- geziden_seyahat RPC'si zaten kimlik göndermiyor (RPC security definer olduğu için burada sahibinin rolüyle çalışır).
-- Tetikleyici invoker: current_user çağıranın rolüdür. Adındaki `a_` sırayı belirler: kuyruk denetiminden önce çalışır.
create function public.trips_kimlik_sunucuda() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.id := gen_random_uuid();
  end if;
  return new;
end;
$$;
revoke execute on function public.trips_kimlik_sunucuda() from public, anon, authenticated;

create trigger trips_a_kimlik_sunucuda before insert on public.trips
  for each row execute function public.trips_kimlik_sunucuda();

-- KK2: silinecek_klasorler kuyruğundaki (kapanmış olsa da) bir kimlikle seyahat eklenemez; service_role ve RPC'ler dahil.
-- Kuyruk yalnız service_role'e açık olduğu için denetim security definer; dışarıya kimlik sızdırmaz (yalnız hata kodu).
create function public.trips_kuyruk_denetimi() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.silinecek_klasorler k where k.trip_id = new.id) then
    raise exception 'bu seyahat kimliği kullanılamaz' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke execute on function public.trips_kuyruk_denetimi() from public, anon, authenticated;

create trigger trips_b_kuyruk_denetimi before insert on public.trips
  for each row execute function public.trips_kuyruk_denetimi();

-- KK3: aynı seyahat ikinci kez silinirse (KK2 ile artık olmamalı, ama kuyruk satırı kapanmışsa) satır yeniden açılır.
create or replace function public.trips_klasor_kuyrugu() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.silinecek_klasorler (kova, trip_id)
  values ('sohbet', old.id), ('fisler', old.id)
  on conflict (kova, trip_id) do update set silindi = null, eklendi = now();
  return old;
end;
$$;
revoke execute on function public.trips_klasor_kuyrugu() from public, anon, authenticated;
