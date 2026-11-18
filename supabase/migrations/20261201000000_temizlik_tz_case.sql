-- #160 KK2: gecmis_varislari_temizle'de saat dilimi denetimi ile tarih karşılaştırması `case` içinde. İkisi `and` ile yan yana
-- dururken planlayıcı karşılaştırmayı önce değerlendirebiliyordu; tek bir geçersiz `tz` (eski satır, elle düzeltme) bütün gece
-- temizliğini "time zone not recognized" hatasıyla düşürürdü. Davranış başka bakımdan aynı (20261025000000_program_saatleri.sql).

create or replace function public.gecmis_varislari_temizle(t uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  -- Tek seyahat isteniyorsa yalnız üyesi temizletebilir (Program açılışında); parametresiz çağrı yalnız zamanlayıcı içindir
  -- (pg_cron'da oturum yok); oturumlu kullanıcı tüm seyahatleri taratamaz.
  if t is null and auth.uid() is not null then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  if t is not null and not public.is_member(t) then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  with biten as (
    select tr.id from public.trips tr
    where (t is null or tr.id = t)
      and tr.end_date is not null
      -- Geçersiz saat dilimi tek satırda bile tüm temizliği düşürmesin (yazımda da doğrulanır). `case` sırayı garanti eder:
      -- `and` ile yan yana yazılınca planlayıcı tarih karşılaştırmasını önce değerlendirebilir (#160 KK2).
      and case when tr.tz in (select name from pg_catalog.pg_timezone_names)
               then tr.end_date < (now() at time zone tr.tz)::date - 1 else false end
  ), temiz as (
    update public.stops s set arrived_at = null, arrived_by = null
    where s.trip_id in (select id from biten) and (s.arrived_at is not null or s.arrived_by is not null)
    returning s.trip_id
  )
  select count(*) into n from temiz;
  -- Varış kayıtları (ve az önceki temizliğin ürettikleri) değişiklik akışından da kalkar.
  delete from public.changes c
  where c.entity = 'stops' and c.field in ('arrived_at', 'arrived_by')
    and c.trip_id in (
      select tr.id from public.trips tr
      where (t is null or tr.id = t) and tr.end_date is not null
        and case when tr.tz in (select name from pg_catalog.pg_timezone_names)
                 then tr.end_date < (now() at time zone tr.tz)::date - 1 else false end
    );
  return n;
end;
$$;
