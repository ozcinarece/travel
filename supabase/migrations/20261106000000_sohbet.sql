-- #184 Sohbet (kanvas 26): mesajlar (metin · mekan kartı · oylama · fotoğraf), oylamalar ve oyları, okuma durumu (okunmamış
-- rozeti, "okundu"), fotoğraf kovası. Plan ve harcama değişikliklerinin sohbetteki gri satırları mevcut değişiklik akışından
-- (changes) okunur; mesaj olarak ayrıca yazılmaz (aynı veri iki yerde tutulmaz, "Geri al" aynı kayıt üzerinden çalışır).
--
-- Google içeriği kuralı (PRD §7): mekan mesajı yalnız place_id taşır; ad ve fotoğraf uygulamada oturum önbelleğinden ya da
-- places-light'tan gelir. Oylama seçeneğinin metni kullanıcının düzenlediği etikettir (otel etiketi gibi).
--
-- Kişi sütunları auth.users'a bağlı değildir (harcamalar gibi): seyahatten ayrılan birinin mesajı ve oyu kalır.
-- Not: Listem'in mekan oyları `oylar` tablosunda (#141); oylama oyları `oylama_oylari`.

-- ---------------------------------------------------------------- tablolar

create table public.oylamalar (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  soru text not null check (char_length(trim(soru)) between 1 and 120),
  kapanis_at timestamptz,
  olusturan uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, trip_id)
);

create table public.oylama_secenekleri (
  id uuid primary key default gen_random_uuid(),
  oylama_id uuid not null references public.oylamalar (id) on delete cascade,
  sira smallint not null check (sira between 1 and 4),
  metin text not null check (char_length(trim(metin)) between 1 and 80),
  place_id text check (char_length(place_id) <= 300),
  unique (oylama_id, sira),
  unique (id, oylama_id)
);

-- Oylama başına kişi başına tek oy; oy değiştirilebilir (aynı satır güncellenir), geri çekilmez.
create table public.oylama_oylari (
  oylama_id uuid not null,
  trip_id uuid not null,
  secenek_id uuid not null,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (oylama_id, user_id),
  foreign key (oylama_id, trip_id) references public.oylamalar (id, trip_id) on delete cascade,
  foreign key (secenek_id, oylama_id) references public.oylama_secenekleri (id, oylama_id) on delete cascade
);

create index oylama_oylari_trip_idx on public.oylama_oylari (trip_id);

create table public.mesajlar (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Gönderen; null yalnız sistem mesajı için ayrılmıştır (istemci yazamaz).
  user_id uuid default auth.uid(),
  tur text not null check (tur in ('metin', 'mekan', 'oylama', 'foto')),
  metin text not null default '' check (char_length(metin) <= 2000),
  place_id text check (char_length(place_id) <= 300),
  oylama_id uuid,
  -- Storage: sohbet/{trip_id}/… (yalnız üyeler).
  foto_yolu text check (char_length(foto_yolu) <= 200),
  created_at timestamptz not null default now(),
  silindi_at timestamptz,
  foreign key (oylama_id, trip_id) references public.oylamalar (id, trip_id) on delete cascade,
  -- Silinmemiş mesajın türüne göre içeriği dolu olmalı.
  constraint tur_icerigi check (
    silindi_at is not null
    or (tur = 'metin' and char_length(trim(metin)) > 0)
    or (tur = 'mekan' and place_id is not null)
    or (tur = 'oylama' and oylama_id is not null)
    or (tur = 'foto' and foto_yolu is not null)
  )
);

create index mesajlar_trip_idx on public.mesajlar (trip_id, created_at desc);

-- Okunmamış rozeti ve "okundu": kişinin sohbeti son açtığı an.
create table public.mesaj_okuma (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  son_okunan_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- ---------------------------------------------------------------- tetikleyiciler

-- Yumuşak silme: yalnız silindi_at yazılabilir (sütun yetkisi); silinen mesajın içeriği temizlenir, oylaması kalır (oylar
-- görünmez olur ama veri bozulmaz).
create or replace function public.mesajlar_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.silindi_at is not null then
    raise exception 'silinmiş mesaj değiştirilemez' using errcode = '42501';
  end if;
  if new.silindi_at is not null then
    new.metin := '';
    new.place_id := null;
    new.foto_yolu := null;
  end if;
  return new;
end;
$$;

create trigger mesajlar_guard
before update on public.mesajlar
for each row execute function public.mesajlar_guard();

-- Oy: seçenek o oylamanın, oylama bu seyahatin ve açık olmalı.
create or replace function public.oylama_oylari_guard()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  o public.oylamalar;
begin
  select * into o from public.oylamalar where id = new.oylama_id;
  if o.id is null or o.trip_id <> new.trip_id then
    raise exception 'oylama bulunamadı' using errcode = '22023';
  end if;
  if o.kapanis_at is not null and o.kapanis_at <= now() then
    raise exception 'oylama kapandı' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.oylama_id <> old.oylama_id or new.trip_id <> old.trip_id) then
    raise exception 'oy sahibi değiştirilemez' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger oylama_oylari_guard
before insert or update on public.oylama_oylari
for each row execute function public.oylama_oylari_guard();

-- ---------------------------------------------------------------- RPC'ler

-- KK3: oylama + 2–4 seçenek + sohbetteki oylama mesajı tek işlemde. p_secenekler: [{"metin": …, "place_id": … | null}].
create or replace function public.oylama_olustur(p_trip_id uuid, p_soru text, p_secenekler jsonb, p_kapanis timestamptz, p_metin text default '')
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  oylama uuid;
  mesaj uuid;
  adet integer := coalesce(jsonb_array_length(case when jsonb_typeof(p_secenekler) = 'array' then p_secenekler end), 0);
begin
  if not public.is_member(p_trip_id) then
    raise exception 'seyahat bulunamadı' using errcode = '42501';
  end if;
  if adet < 2 or adet > 4 then
    raise exception 'oylamada 2–4 seçenek olur' using errcode = '22023';
  end if;
  if p_kapanis is not null and p_kapanis <= now() then
    raise exception 'kapanış ileride olmalı' using errcode = '22023';
  end if;
  insert into public.oylamalar (trip_id, soru, kapanis_at) values (p_trip_id, trim(p_soru), p_kapanis) returning id into oylama;
  insert into public.oylama_secenekleri (oylama_id, sira, metin, place_id)
  select oylama, e.sira, trim(e.deger ->> 'metin'), nullif(e.deger ->> 'place_id', '')
  from jsonb_array_elements(p_secenekler) with ordinality as e(deger, sira);
  insert into public.mesajlar (trip_id, tur, metin, oylama_id) values (p_trip_id, 'oylama', coalesce(trim(p_metin), ''), oylama) returning id into mesaj;
  return mesaj;
end;
$$;

-- KK8: sohbet açıkken okundu (sunucu saatiyle).
create or replace function public.sohbet_okundu(p_trip_id uuid)
returns void
language sql volatile security invoker set search_path = ''
as $$
  insert into public.mesaj_okuma (trip_id, user_id, son_okunan_at) values (p_trip_id, auth.uid(), now())
  on conflict (trip_id, user_id) do update set son_okunan_at = excluded.son_okunan_at;
$$;

-- KK8: okunmamış = başkalarının, son okumadan (hiç okumadıysa katılımdan) sonraki silinmemiş mesajları.
create or replace function public.sohbet_okunmamis(p_trip_id uuid)
returns integer
language sql stable security invoker set search_path = ''
as $$
  select count(*)::integer
  from public.mesajlar m
  where m.trip_id = p_trip_id
    and m.silindi_at is null
    and m.user_id is distinct from auth.uid()
    and m.created_at > coalesce(
      (select o.son_okunan_at from public.mesaj_okuma o where o.trip_id = p_trip_id and o.user_id = auth.uid()),
      (select mb.joined_at from public.members mb where mb.trip_id = p_trip_id and mb.user_id = auth.uid()),
      '-infinity'::timestamptz
    );
$$;

revoke all on function public.oylama_olustur(uuid, text, jsonb, timestamptz, text), public.sohbet_okundu(uuid), public.sohbet_okunmamis(uuid) from public, anon;
grant execute on function public.oylama_olustur(uuid, text, jsonb, timestamptz, text), public.sohbet_okundu(uuid), public.sohbet_okunmamis(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.oylamalar enable row level security;
alter table public.oylama_secenekleri enable row level security;
alter table public.oylama_oylari enable row level security;
alter table public.mesajlar enable row level security;
alter table public.mesaj_okuma enable row level security;

-- Yalnız seyahat üyeleri okur ve yazar.
create policy mesajlar_select on public.mesajlar for select to authenticated using (public.is_member(trip_id));
create policy mesajlar_insert on public.mesajlar for insert to authenticated
  with check (public.is_member(trip_id) and user_id = auth.uid());
-- Kişi kendi mesajını siler (yumuşak: silindi_at); başka sütun yazılamaz.
create policy mesajlar_update on public.mesajlar for update to authenticated
  using (public.is_member(trip_id) and user_id = auth.uid())
  with check (public.is_member(trip_id) and user_id = auth.uid() and silindi_at is not null);
revoke update on public.mesajlar from authenticated;
grant update (silindi_at) on public.mesajlar to authenticated;

create policy oylamalar_select on public.oylamalar for select to authenticated using (public.is_member(trip_id));
create policy oylamalar_insert on public.oylamalar for insert to authenticated
  with check (public.is_member(trip_id) and olusturan = auth.uid());
revoke update, delete on public.oylamalar from authenticated;

create policy oylama_secenekleri_select on public.oylama_secenekleri for select to authenticated
  using (exists (select 1 from public.oylamalar o where o.id = oylama_id and public.is_member(o.trip_id)));
create policy oylama_secenekleri_insert on public.oylama_secenekleri for insert to authenticated
  with check (exists (select 1 from public.oylamalar o where o.id = oylama_id and o.olusturan = auth.uid() and public.is_member(o.trip_id)));
revoke update, delete on public.oylama_secenekleri from authenticated;

create policy oylama_oylari_select on public.oylama_oylari for select to authenticated using (public.is_member(trip_id));
create policy oylama_oylari_insert on public.oylama_oylari for insert to authenticated
  with check (public.is_member(trip_id) and user_id = auth.uid());
create policy oylama_oylari_update on public.oylama_oylari for update to authenticated
  using (public.is_member(trip_id) and user_id = auth.uid()) with check (public.is_member(trip_id) and user_id = auth.uid());
-- Oy değiştirme PostgREST upsert'iyle gelir (tüm sütunlar SET'te); kişi, oylama ve seyahatin değişmemesini tetikleyici denetler.
revoke delete on public.oylama_oylari from authenticated;

create policy mesaj_okuma_select on public.mesaj_okuma for select to authenticated using (public.is_member(trip_id));
create policy mesaj_okuma_insert on public.mesaj_okuma for insert to authenticated
  with check (public.is_member(trip_id) and user_id = auth.uid());
create policy mesaj_okuma_update on public.mesaj_okuma for update to authenticated
  using (user_id = auth.uid()) with check (public.is_member(trip_id) and user_id = auth.uid());
revoke delete on public.mesaj_okuma from authenticated;

-- ---------------------------------------------------------------- Storage: sohbet fotoğrafları (özel kova)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sohbet', 'sohbet', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Klasör bir seyahat kimliği ve çağıran üye (fis_seyahat_uyesi, #183: genel "seyahat klasörü" denetimi).
create policy sohbet_select on storage.objects for select to authenticated
  using (bucket_id = 'sohbet' and public.fis_seyahat_uyesi(name));
create policy sohbet_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sohbet' and public.fis_seyahat_uyesi(name));

-- ---------------------------------------------------------------- Realtime (#176: DELETE olayları süzülemez — burada DELETE yok)

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.mesajlar, public.oylama_oylari, public.mesaj_okuma;
  end if;
end;
$$;
