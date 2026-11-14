-- #200 KK3–KK5 (kanvas 28): "Günlere dağıt" tek işlemde ve değişiklik geçmişinde TEK kayıt. Sığmayan mekanlar için seçilen yol
-- (süreleri kısalt / günleri uzat / listede kalsın) istemcide hesaplanır (saf, testli); bu fonksiyon yazar:
--   p_duraklar: [{day_id, place_ref, order_key, minutes}] — yeni duraklar (gün ve mekan bu seyahatin);
--   p_sureler:  [{id, minutes}] — kısalan mevcut duraklar (yalnız durak süresi; mekanın varsayılan süresi değişmez);
--   p_bitisler: [{id, end_time}] — uzayan günler (en geç 22:00, günün başlangıcından sonra).
-- Satır tetikleyicileri (log_change) her değişikliği yine yazar; hepsi işlemin `dagit` kaydına `grup` ile bağlanır. Akış
-- (Son değişiklikler, sohbetteki sistem satırları) yalnız grupsuz satırları okur: dağıtım tek satır, "Geri al" hepsini döndürür.
alter table public.changes add column grup bigint;
comment on column public.changes.grup is '#200: toplu işlemin (ör. Günlere dağıt) kaydına bağlı satır; akışta ayrıca görünmez, kayıtla birlikte geri alınır.';
create index changes_grup_idx on public.changes (grup) where grup is not null;

create function public.gunlere_dagit(p_trip uuid, p_duraklar jsonb, p_sureler jsonb, p_bitisler jsonb)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  n integer := 0;
  n_sure integer := 0;
  n_gun integer := 0;
  k bigint;
begin
  if auth.uid() is null or not public.is_member(p_trip) then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_duraklar, '[]')) <> 'array' or jsonb_typeof(coalesce(p_sureler, '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_bitisler, '[]')) <> 'array' then
    raise exception 'geçersiz istek' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_bitisler, '[]')) x where (x ->> 'end_time')::time > time '22:00') then
    raise exception 'gün en geç 22:00''de biter' using errcode = '22023';
  end if;

  update public.days g set end_time = (x ->> 'end_time')::time
    from jsonb_array_elements(coalesce(p_bitisler, '[]')) x, public.trips t
    where g.id = (x ->> 'id')::uuid and g.trip_id = p_trip and t.id = p_trip
      and (x ->> 'end_time')::time > coalesce(g.start_time, t.day_start);
  get diagnostics n_gun = row_count;

  update public.stops s set minutes = least(480, greatest(15, (x ->> 'minutes')::integer))
    from jsonb_array_elements(coalesce(p_sureler, '[]')) x
    where s.id = (x ->> 'id')::uuid and s.trip_id = p_trip;
  get diagnostics n_sure = row_count;

  insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
  select p_trip, d.id, p.id, x ->> 'order_key', least(480, greatest(15, (x ->> 'minutes')::integer))
  from jsonb_array_elements(coalesce(p_duraklar, '[]')) x
  join public.days d on d.id = (x ->> 'day_id')::uuid and d.trip_id = p_trip
  join public.places p on p.id = (x ->> 'place_ref')::uuid and p.trip_id = p_trip
  on conflict (place_ref) do nothing;
  get diagnostics n = row_count;

  insert into public.changes (trip_id, user_id, entity, entity_id, new)
    values (p_trip, (select u.id from auth.users u where u.id = auth.uid()), 'dagit', p_trip::text,
            jsonb_build_object('mekan', n, 'kisalt', n_sure > 0, 'uzat', n_gun > 0))
    returning id into k;
  update public.changes set grup = k
    where trip_id = p_trip and at = now() and id < k and grup is null and entity in ('stops', 'days');
  return k;
end;
$$;
revoke all on function public.gunlere_dagit(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.gunlere_dagit(uuid, jsonb, jsonb, jsonb) to authenticated;

-- Geri alma: #183'teki tanımın aynısı + toplu kayıt (dagit) dalı.
create or replace function public.degisikligi_geri_al(c bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d public.changes;
  eski jsonb;
  setler text;
  sutunlar text;
  r record;
  izinli text[];
  ekleyen uuid;
  h uuid;
  hr public.harcamalar;
  satir jsonb;
  k bigint;
begin
  select * into d from public.changes where id = c;
  if d.id is null then
    raise exception 'değişiklik yok' using errcode = 'P0002';
  end if;
  if not public.is_member(d.trip_id) or public.is_anonymous() then
    raise exception 'yetki yok' using errcode = '42501';
  end if;

  -- #200 KK5: "Günlere dağıt" tek kayıttır; geri alınca o işlemin bütün değişiklikleri birlikte döner: eklenen duraklar silinir,
  -- kısalan süreler ve uzayan gün bitişleri eski haline gelir. Geri alma da tek kayıt olarak düşer (dagit_geri).
  if d.entity = 'dagit' then
    delete from public.stops s using public.changes x
      where x.grup = d.id and x.entity = 'stops' and x.field is null and x.old is null
        and s.id = x.entity_id::uuid and s.trip_id = d.trip_id;
    update public.stops s set minutes = (x.old #>> '{}')::integer
      from public.changes x
      where x.grup = d.id and x.entity = 'stops' and x.field = 'minutes' and x.old is not null
        and s.id = x.entity_id::uuid and s.trip_id = d.trip_id;
    update public.days g set end_time = (x.old #>> '{}')::time
      from public.changes x
      where x.grup = d.id and x.entity = 'days' and x.field = 'end_time'
        and g.id = x.entity_id::uuid and g.trip_id = d.trip_id;
    insert into public.changes (trip_id, user_id, entity, entity_id, old)
      values (d.trip_id, (select u.id from auth.users u where u.id = auth.uid()), 'dagit_geri', d.trip_id::text, d.new)
      returning id into k;
    update public.changes set grup = k
      where trip_id = d.trip_id and at = now() and id < k and grup is null and entity in ('stops', 'days');
    return;
  end if;
  if d.entity = 'dagit_geri' then
    raise exception 'geri alınamaz' using errcode = '22023';
  end if;

  if d.entity = 'harcamalar' then
    h := d.entity_id::uuid;
    ekleyen := coalesce((select x.olusturan from public.harcamalar x where x.id = h), (coalesce(d.old, d.new) ->> 'olusturan')::uuid);
    if auth.uid() is distinct from ekleyen and not public.is_owner(d.trip_id) then
      raise exception 'harcamayı yalnız ekleyen ya da sahip değiştirir' using errcode = '42501';
    end if;
    if d.field is null and d.old is null then
      delete from public.harcamalar where id = h and trip_id = d.trip_id;
    elsif d.field is null then
      hr := jsonb_populate_record(null::public.harcamalar, d.old);
      if hr.stop_id is not null and not exists (select 1 from public.stops s where s.id = hr.stop_id) then
        hr.stop_id := null;
      end if;
      -- Ekleyenin hesabı silinmişse oluşturan boş; fiş dosyası harcama silinirken silindiği için bağ da boş.
      if hr.olusturan is not null and not exists (select 1 from auth.users u where u.id = hr.olusturan) then
        hr.olusturan := null;
      end if;
      hr.fis_yolu := null;
      insert into public.harcamalar select hr.* on conflict do nothing;
      insert into public.harcama_paylari
        select (jsonb_populate_record(null::public.harcama_paylari, x.old)).*
        from public.changes x
        where x.trip_id = d.trip_id and x.at = d.at and x.entity = 'harcama_paylari' and x.entity_id = d.entity_id and x.new is null
      on conflict do nothing;
    else
      if not exists (select 1 from public.harcamalar x where x.id = h and x.trip_id = d.trip_id) then
        raise exception 'geri alınamaz' using errcode = '22023';
      end if;
      select jsonb_object_agg(x.field, x.old), string_agg(format('%I = (y.r).%I', x.field, x.field), ', ')
        into eski, setler
        from public.changes x
        where x.trip_id = d.trip_id and x.entity = 'harcamalar' and x.entity_id = d.entity_id and x.at = d.at
          and x.field = any (array['aciklama', 'tutar_kurus', 'para_birimi', 'tl_kurus', 'kategori', 'odeyen_id', 'stop_id', 'fis_yolu']);
      if eski ? 'stop_id' and eski ->> 'stop_id' is not null
         and not exists (select 1 from public.stops s where s.id = (eski ->> 'stop_id')::uuid) then
        eski := jsonb_set(eski, '{stop_id}', 'null'::jsonb);
      end if;
      execute format('update public.harcamalar t set %s updated_at = now() from (select jsonb_populate_record(null::public.harcamalar, $1) as r) y where t.id = $2 and t.trip_id = $3',
                     coalesce(setler || ',', ''))
        using coalesce(eski, '{}'::jsonb), h, d.trip_id;
      -- Aynı işlemdeki pay değişiklikleri sondan başa geri alınır.
      for r in
        select x.old, x.new from public.changes x
        where x.trip_id = d.trip_id and x.at = d.at and x.entity = 'harcama_paylari' and x.entity_id = d.entity_id
        order by x.id desc
      loop
        if r.old is null then
          delete from public.harcama_paylari where harcama_id = h and user_id = (r.new ->> 'user_id')::uuid;
        elsif r.new is null then
          insert into public.harcama_paylari select (jsonb_populate_record(null::public.harcama_paylari, r.old)).* on conflict do nothing;
        else
          update public.harcama_paylari set pay_kurus = (r.old ->> 'pay_kurus')::bigint
          where harcama_id = h and user_id = (r.old ->> 'user_id')::uuid;
        end if;
      end loop;
    end if;
    return;
  end if;

  if d.entity = 'odesmeler' then
    satir := coalesce(d.old, d.new);
    if auth.uid() is distinct from (satir ->> 'kimden')::uuid and auth.uid() is distinct from (satir ->> 'kime')::uuid then
      raise exception 'ödeşmeyi yalnız iki taraf değiştirir' using errcode = '42501';
    end if;
    if d.old is null then
      delete from public.odesmeler where id = d.entity_id::uuid and trip_id = d.trip_id;
    else
      insert into public.odesmeler
        select o.id, o.trip_id, o.kimden, o.kime, o.tl_kurus,
               case when exists (select 1 from auth.users u where u.id = o.olusturan) then o.olusturan end, o.created_at
        from jsonb_populate_record(null::public.odesmeler, d.old) o
      on conflict do nothing;
    end if;
    return;
  end if;

  if d.field is not null then
    -- Geri alınabilir alanlar (beyaz liste); varış / tamamlama / kimlik alanları geri alınmaz.
    izinli := case d.entity
      when 'places' then array['note', 'default_minutes']
      when 'stops' then array['day_id', 'order_key', 'minutes', 'skipped']
      when 'days' then array['start_time', 'end_time', 'order_manual', 'start_stay_id', 'end_stay_id']
    end;
    if izinli is null then
      raise exception 'geri alınamaz' using errcode = '22023';
    end if;
    select jsonb_object_agg(x.field, x.old), string_agg(format('%I = (y.r).%I', x.field, x.field), ', ')
      into eski, setler
      from public.changes x
      where x.trip_id = d.trip_id and x.entity = d.entity and x.entity_id = d.entity_id and x.at = d.at
        and x.field = any (izinli);
    if setler is null then
      raise exception 'geri alınamaz' using errcode = '22023';
    end if;
    -- PRD 3.8 KK3: notu yalnız ekleyen ya da sahip değiştirir; tanımlayıcı yetkiyle çalışıldığı için places_guard burada
    -- devreye girmez, aynı kural burada uygulanır.
    if d.entity = 'places' and eski ? 'note' then
      select p.added_by into ekleyen from public.places p where p.id = d.entity_id::uuid and p.trip_id = d.trip_id;
      if auth.uid() is distinct from ekleyen and not public.is_owner(d.trip_id) then
        raise exception 'notu yalnızca ekleyen ya da sahip düzenler' using errcode = '42501';
      end if;
    end if;
    execute format('update public.%I t set %s from (select jsonb_populate_record(null::public.%I, $1) as r) y where t.id = $2 and t.trip_id = $3',
                   d.entity, setler, d.entity)
      using eski, d.entity_id::uuid, d.trip_id;
  elsif d.old is null then
    if d.entity not in ('places', 'stops') then
      raise exception 'geri alınamaz' using errcode = '22023';
    end if;
    execute format('delete from public.%I where id = $1 and trip_id = $2', d.entity) using d.entity_id::uuid, d.trip_id;
  else
    if d.entity not in ('places', 'stops') then
      raise exception 'geri alınamaz' using errcode = '22023';
    end if;
    -- Önce mekanlar, sonra aynı işlemde silinen duraklar (mekan silinince durağı da gider). Yalnız kayıtta olan sütunlar
    -- yazılır; sonradan eklenen NOT NULL sütunlar (ör. stops.auto_completed) tablo varsayılanını alır.
    for r in
      select x.entity, x.old from public.changes x
      where x.trip_id = d.trip_id and x.at = d.at and x.field is null and x.new is null and x.entity in ('places', 'stops')
        and x.old ->> 'trip_id' = d.trip_id::text
      order by case x.entity when 'places' then 0 else 1 end, x.id
    loop
      select string_agg(format('%I', a.attname), ', ' order by a.attnum) into sutunlar
        from pg_catalog.pg_attribute a
        where a.attrelid = format('public.%I', r.entity)::regclass and a.attnum > 0 and not a.attisdropped and r.old ? a.attname;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
                     r.entity, sutunlar, sutunlar, r.entity)
        using r.old;
    end loop;
  end if;
end;
$$;
revoke execute on function public.degisikligi_geri_al(bigint) from public, anon;
grant execute on function public.degisikligi_geri_al(bigint) to authenticated;
