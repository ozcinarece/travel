-- #140 Program saat hesabı ve gezi modu.
--
-- KK1 (yuvarlama yok): kalış süresi 15 dk'nın katı olmak zorunda değil — "Saatleri kaydır" / "Kaydır" fiilen geçen süreyi
-- tam dakika yazar. Panelde [–][+] hâlâ 15 dk adımla değiştirir; alt sınır 15, üst sınır 480 aynı.
alter table public.stops drop constraint if exists stops_minutes_check;
alter table public.stops add constraint stops_minutes_check check (minutes between 15 and 480);

-- KK9: konumla algılanan varış (stops.arrived_at / arrived_by) grupla yalnız gezi sırasında paylaşılır ("Odunpazarı
-- Evleri'ne vardı · 12 dk önce"); koordinat hiç yazılmaz. Seyahat bitince (bitiş tarihinden bir gün sonra, seyahat diliminde)
-- varışlar ve "vardı" değişiklik kayıtları silinir. "Mekan gezildi" sayımı (#144) konum algılamasına dayanmaz; etkilenmez.

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
      -- Geçersiz saat dilimi tek satırda bile tüm temizliği düşürmesin (yazımda da doğrulanır, aşağıda).
      and tr.tz in (select name from pg_catalog.pg_timezone_names)
      and tr.end_date < (now() at time zone tr.tz)::date - 1
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
        and tr.tz in (select name from pg_catalog.pg_timezone_names)
        and tr.end_date < (now() at time zone tr.tz)::date - 1
    );
  return n;
end;
$$;

-- trips.tz üyelerce değiştirilebilir: yalnız geçerli IANA adı yazılır (gece temizliği ve tüm saat hesapları buna dayanır).
create or replace function public.trips_tz_dogrula()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.tz) then
    raise exception 'geçersiz saat dilimi: %', new.tz using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_tz_dogrula on public.trips;
create trigger trips_tz_dogrula
before insert or update of tz on public.trips
for each row execute function public.trips_tz_dogrula();

revoke execute on function public.gecmis_varislari_temizle(uuid) from public, anon;
grant execute on function public.gecmis_varislari_temizle(uuid) to authenticated;

-- Günlük temizlik: pg_cron varsa her gece 03:17'de (UTC). Yoksa (yerel test kümesi) atlanır; uygulama geçmiş seyahatin
-- Program'ı açılınca aynı işlevi o seyahat için çağırır.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('gecmis-varislari-temizle', '17 3 * * *', 'select public.gecmis_varislari_temizle()');
  end if;
exception when others then
  raise notice 'pg_cron zamanlanamadı: %', sqlerrm;
end;
$$;
