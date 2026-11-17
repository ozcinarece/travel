-- #266 KK1–KK2: iki örtük korumayı açık kurala çevirir. Ekranda değişiklik yok; veri silinmez.

-- KK1: seyahat kimliği hiçbir rol için değiştirilemez (service_role ve sahip rolü dahil). Bugün bunu yalnız FK'ların NO ACTION
-- davranışı engelliyordu; kimlik değişseydi Storage klasörleri (`{trip_id}/`) ve silme kuyruğu eşleşmesi bozulurdu (#263).
create or replace function public.trips_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'seyahat kimliği değiştirilemez' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') then
    if new.owner_id is distinct from old.owner_id or new.invite_token is distinct from old.invite_token then
      raise exception 'owner_id ve invite_token doğrudan değiştirilemez' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- KK2: silme kuyruğunda satır silinemez. Satır silinirse o seyahatin kimliği yeniden kullanılabilir hâle gelir
-- (`trips_kuyruk_denetimi`, #263). kova-temizle yalnız `kova_temizle_bitir` ile satırı kapatır (update), silmez.
revoke delete on public.silinecek_klasorler from service_role;
