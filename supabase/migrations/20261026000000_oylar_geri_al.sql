-- #141 Listem: oylar (KK3) ve "Son değişiklikler · Geri al" (KK6). Herkes düzenler (yetki anahtarı yok); güvence geri almadır.

-- KK3: kişi başına mekan başına tek oy (👍). Mekan listeden çıkınca oyları da gider.
create table public.oylar (
  seyahat_id uuid not null references public.trips (id) on delete cascade,
  mekan uuid not null,
  kullanici uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mekan, kullanici),
  foreign key (mekan, seyahat_id) references public.places (id, trip_id) on delete cascade
);

create index oylar_seyahat_idx on public.oylar (seyahat_id);

alter table public.oylar enable row level security;
create policy oylar_select on public.oylar for select to authenticated using (public.is_member(seyahat_id));
create policy oylar_insert on public.oylar for insert to authenticated
  with check (kullanici = auth.uid() and public.is_member(seyahat_id) and not public.is_anonymous());
create policy oylar_delete on public.oylar for delete to authenticated using (kullanici = auth.uid());

-- KK6: bir değişikliği geri al. Aynı işlemde (aynı `at`) aynı satırda değişen alanlar birlikte eski haline döner; ekleme
-- silinir; silme (ve aynı işlemde silinen bağlı duraklar) geri yazılır. Yalnız plan verisi: places, stops, days (days'te
-- yalnız alan değişikliği — gün silme/ekleme günleri yeniden numaralar, geri alınamaz). Geri alma da değişiklik olarak kaydedilir.
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
begin
  select * into d from public.changes where id = c;
  if d.id is null then
    raise exception 'değişiklik yok' using errcode = 'P0002';
  end if;
  if not public.is_member(d.trip_id) or public.is_anonymous() then
    raise exception 'yetki yok' using errcode = '42501';
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

-- Oylar da canlı (Listem açıkken diğer üyelerin oyu 2 sn içinde görünür).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.oylar;
  end if;
end $$;
