-- #101: bacağın ulaşım türü — kullanıcı seçimi (yürüme / araba) bacak ÇİFTİ bazında saklanır: sıra değişince aynı çift korunur,
-- çift bozulursa (araya durak girer / biri kalkar) satır kullanılmaz → bacak otomatiğe döner (KK1). Satır yoksa otomatik.
create table public.bacak_modlari (
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_key text not null,
  to_key text not null,
  mod text not null check (mod in ('yurume', 'araba')),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (trip_id, from_key, to_key)
);
alter table public.bacak_modlari enable row level security;
create policy bacak_modlari_all on public.bacak_modlari for all to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));

-- route-legs: yürüme ve araba yolu AYRI sütunlarda — `polyline` her zaman yürüme, `drive_polyline` araba (KK4: ikisi
-- birlikte istenir; araba yalnız 40 dk üstü, seçici açılınca ya da bacak araba seçiliyken). Eski DRIVE satırlarının polyline'ı
-- araba yoluydu: araba sütununa taşınır; yürüme yolu bir sonraki açılışta yeniden alınır (yalnız polyline'ı boş bacaklar istenir).
alter table public.walk_cache add column if not exists drive_polyline text;
update public.walk_cache set drive_polyline = polyline, polyline = null where mode = 'DRIVE' and drive_polyline is null;
