-- #144 (kanvas 20 · 22): Seyahatler kartlarındaki somut durum çipleri, geçmiş seyahatte "N mekan gezildi", Profil sayıları
-- ve "Tekrar kur" (aynı plan, yeni tarih). Hepsi çağıranın yetkisiyle (security invoker): RLS üye olunan seyahatleri süzer.
--
-- "Mekan gezildi" kuralı (KK5): bitiş tarihi (seyahatin saat diliminde) geçmiş seyahatlerde bir güne atanmış ve atlanmamış
-- duraklar, place_id'ye göre tekil. Tarihsiz seyahat sayılmaz; konum algılaması (arrived_at) sayıma girmez. Şehir sayısı aynı
-- mantıkla: en az bir gezilen mekanı olan bitmiş seyahatlerin şehirleri (city_place_id) tekil.

create function public.seyahat_bitti(p_end date, p_tz text) returns boolean
language sql stable set search_path = ''
as $$
  select p_end is not null and p_end < (now() at time zone p_tz)::date;
$$;

-- Seyahat başına: gün sayısı, en az bir durağı olan gün, güne atanmamış mekan, gezilen mekan (yalnız bitmiş seyahatte).
create function public.seyahat_durumlari()
returns table (trip_id uuid, gun integer, planli_gun integer, atanmamis integer, gezilen integer)
language sql stable set search_path = ''
as $$
  select t.id,
    (select count(*)::integer from public.days d where d.trip_id = t.id),
    (select count(distinct s.day_id)::integer from public.stops s where s.trip_id = t.id),
    (select count(*)::integer from public.places p where p.trip_id = t.id
       and not exists (select 1 from public.stops s where s.place_ref = p.id)),
    case when public.seyahat_bitti(t.end_date, t.tz) then
      (select count(distinct p.place_id)::integer from public.stops s join public.places p on p.id = s.place_ref
        where s.trip_id = t.id and not s.skipped)
    else 0 end
  from public.trips t
  where public.is_member(t.id);
$$;

-- Profil: seyahat (üye olunan tümü) · mekan gezildi · şehir.
create function public.profil_sayilari() returns jsonb
language sql stable set search_path = ''
as $$
  with gezilen as (
    select t.city_place_id, p.place_id
    from public.trips t
    join public.stops s on s.trip_id = t.id and not s.skipped
    join public.places p on p.id = s.place_ref
    where public.is_member(t.id) and public.seyahat_bitti(t.end_date, t.tz)
  )
  select jsonb_build_object(
    'seyahat', (select count(*) from public.trips t where public.is_member(t.id)),
    'gezilen', (select count(distinct place_id) from gezilen),
    'sehir', (select count(distinct city_place_id) from gezilen)
  );
$$;

-- Tekrar kur: kaynak seyahatin mekanları (not ve süreleriyle) ve gün planı yeni seyahate; gün sırası (index) eşlenir, yeni
-- seyahatte karşılığı olmayan günün durakları listede (atanmamış) kalır. Varış / atlama / tamamlama kopyalanmaz. Hedefte zaten
-- olan mekan ve durak dokunulmadan kalır. Dönen: kopyalanan durak sayısı.
create function public.seyahati_kopyala(p_kaynak uuid, p_hedef uuid) returns integer
language plpgsql set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_member(p_kaynak) or not public.is_member(p_hedef) then
    raise exception 'seyahat bulunamadı' using errcode = '42501';
  end if;
  -- google_fetched_at kopyalanır: koordinatın 30 günlük tazelik damgası (PRD §7) sıfırlanmaz.
  insert into public.places (trip_id, place_id, primary_type, lat, lng, google_fetched_at, default_minutes, note, added_by)
  select p_hedef, p.place_id, p.primary_type, p.lat, p.lng, p.google_fetched_at, p.default_minutes, p.note, auth.uid()
  from public.places p where p.trip_id = p_kaynak
  on conflict (trip_id, place_id) do nothing;

  update public.days nd set start_time = od.start_time, end_time = od.end_time, order_manual = od.order_manual
  from public.days od
  where od.trip_id = p_kaynak and nd.trip_id = p_hedef and nd.index = od.index;

  insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
  select p_hedef, nd.id, np.id, s.order_key, s.minutes
  from public.stops s
  join public.days od on od.id = s.day_id
  join public.places op on op.id = s.place_ref
  join public.days nd on nd.trip_id = p_hedef and nd.index = od.index
  join public.places np on np.trip_id = p_hedef and np.place_id = op.place_id
  where s.trip_id = p_kaynak
    and not exists (select 1 from public.stops x where x.place_ref = np.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.seyahat_bitti(date, text), public.seyahat_durumlari(), public.profil_sayilari(), public.seyahati_kopyala(uuid, uuid) from public, anon;
grant execute on function public.seyahat_bitti(date, text), public.seyahat_durumlari(), public.profil_sayilari(), public.seyahati_kopyala(uuid, uuid) to authenticated;
