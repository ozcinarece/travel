-- #97: Ana sayfa içerik modeli — önerilen geziler (gezi · gün · durak), kaydedilenler (#100 ile ortak), olaylar.
-- Sütunlar issue'daki gibi; duraklarda `place_id` boş olabilir (backoffice doldurur; istemci adıyla çözer).
create table public.geziler (
  id uuid primary key default gen_random_uuid(),
  sehir_id uuid not null references public.sehirler (id) on delete cascade,
  baslik text not null check (char_length(baslik) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  kapak_url text,
  ozet text,
  yazi_md text,
  yazar_ad text,
  gun_sayisi integer not null default 1 check (gun_sayisi between 1 and 30),
  mekan_sayisi integer not null default 0 check (mekan_sayisi >= 0),
  yayin boolean not null default false,
  sira integer,
  created_at timestamptz not null default now()
);
create index geziler_sehir_idx on public.geziler (sehir_id, sira);

create table public.gezi_gunleri (
  id uuid primary key default gen_random_uuid(),
  gezi_id uuid not null references public.geziler (id) on delete cascade,
  sira integer not null check (sira >= 1),
  baslik text,
  unique (gezi_id, sira)
);

create table public.gezi_duraklari (
  id uuid primary key default gen_random_uuid(),
  gezi_gun_id uuid not null references public.gezi_gunleri (id) on delete cascade,
  sira integer not null check (sira >= 1),
  place_id text,
  ad text not null check (char_length(ad) between 1 and 120),
  kategori text,
  sure_dk integer not null default 45 check (sure_dk between 15 and 480),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  unique (gezi_gun_id, sira)
);

-- #97 / #100: kalp — gezi ya da yer.
create table public.kaydedilenler (
  user_id uuid not null references auth.users (id) on delete cascade,
  tur text not null check (tur in ('gezi', 'yer')),
  hedef_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tur, hedef_id)
);

-- Analitik olayları (PRD §10 tamamlayıcısı): istemci yalnız kendi adına yazar ve okur.
create table public.olaylar (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tur text not null check (tur in ('gezi_goruntulendi', 'gezi_alindi', 'yer_eklendi')),
  hedef_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index olaylar_user_idx on public.olaylar (user_id, created_at desc);

alter table public.geziler enable row level security;
alter table public.gezi_gunleri enable row level security;
alter table public.gezi_duraklari enable row level security;
alter table public.kaydedilenler enable row level security;
alter table public.olaylar enable row level security;

create policy geziler_select on public.geziler for select to anon, authenticated
  using (yayin and exists (select 1 from public.sehirler s where s.id = sehir_id and s.yayin));
create policy gezi_gunleri_select on public.gezi_gunleri for select to anon, authenticated
  using (exists (select 1 from public.geziler g where g.id = gezi_id and g.yayin));
create policy gezi_duraklari_select on public.gezi_duraklari for select to anon, authenticated
  using (exists (select 1 from public.gezi_gunleri gg join public.geziler g on g.id = gg.gezi_id where gg.id = gezi_gun_id and g.yayin));

create policy kaydedilenler_select on public.kaydedilenler for select to authenticated using (user_id = auth.uid());
create policy kaydedilenler_insert on public.kaydedilenler for insert to authenticated with check (user_id = auth.uid());
create policy kaydedilenler_delete on public.kaydedilenler for delete to authenticated using (user_id = auth.uid());

create policy olaylar_select on public.olaylar for select to authenticated using (user_id = auth.uid());
create policy olaylar_insert on public.olaylar for insert to authenticated with check (user_id = auth.uid());

-- Fotoğraflar: Supabase Storage `icerik/` (herkese açık okuma; yazma backoffice issue'sunda).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('icerik', 'icerik', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy icerik_select on storage.objects for select using (bucket_id = 'icerik');

-- ---------------------------------------------------------------- seed: Eskişehir'de iki gün (yazar: Ece)
insert into public.geziler (id, sehir_id, baslik, slug, ozet, yazi_md, yazar_ad, gun_sayisi, mekan_sayisi, yayin, sira) values
  ('33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000001',
   'Odunpazarı''ndan Porsuk''a iki gün', 'eskisehir-iki-gun',
   'Odunpazarı sokakları, Porsuk kıyısı, Sazova · 11 mekan',
   $md$Eskişehir küçük ama yoğun bir şehir: tarihi Odunpazarı'nın renkli ahşap evleri, Porsuk kıyısındaki kafeler ve Sazova'nın masal kalesi iki güne rahat sığar. Sabah erken Kurşunlu Külliyesi'yle başlayın; sokaklar hâlâ sessizken ışık en güzel hâlinde.

## 1. gün · Odunpazarı

Külliyeden çıkınca ahşap evlerin arasında yokuş yukarı yürüyün; Odunpazarı Modern Müze'nin önündeki meydan kahve molası için iyi bir yer. Cam müzesinin atölyelerinden küçük bir hediyelik alabilirsiniz.

> Çibörek için Hayri Usta'ya öğlen 12'den önce gidin; sıra 20 dakikayı geçmiyor.

## 2. gün · Porsuk

İkinci gün Porsuk boyunca yürüyüp Kent Park'a uzanın; akşamüstü gondol turu ve Adalar'daki kafeler günü yumuşak bitirir. Sazova'ya tramvayla gidin, çocuklu gezide yarım gün ayırın.$md$,
   'Ece', 2, 11, true, 1);

insert into public.gezi_gunleri (id, gezi_id, sira, baslik) values
  ('44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000001', 1, 'Odunpazarı'),
  ('44444444-4444-4444-8444-000000000002', '33333333-3333-4333-8333-000000000001', 2, 'Porsuk');

insert into public.gezi_duraklari (gezi_gun_id, sira, ad, kategori, sure_dk, lat, lng) values
  ('44444444-4444-4444-8444-000000000001', 1, 'Kurşunlu Külliyesi', 'mosque', 30, 39.7627, 30.5261),
  ('44444444-4444-4444-8444-000000000001', 2, 'Odunpazarı Evleri', 'historical_landmark', 90, 39.7636, 30.5256),
  ('44444444-4444-4444-8444-000000000001', 3, 'Odunpazarı Modern Müze', 'museum', 60, 39.7646, 30.5236),
  ('44444444-4444-4444-8444-000000000001', 4, 'Çağdaş Cam Sanatları Müzesi', 'museum', 45, 39.7640, 30.5248),
  ('44444444-4444-4444-8444-000000000001', 5, 'Kurtuluş Müzesi', 'museum', 60, 39.7655, 30.5247),
  ('44444444-4444-4444-8444-000000000001', 6, 'Hayri Usta Çibörek', 'restaurant', 60, 39.7748, 30.5190),
  ('44444444-4444-4444-8444-000000000002', 1, 'Sazova Parkı', 'park', 120, 39.7536, 30.4556),
  ('44444444-4444-4444-8444-000000000002', 2, 'Kent Park', 'park', 60, 39.7757, 30.5004),
  ('44444444-4444-4444-8444-000000000002', 3, 'Porsuk Çayı Adalar', 'viewpoint', 45, 39.7772, 30.5185),
  ('44444444-4444-4444-8444-000000000002', 4, 'Eti Arkeoloji Müzesi', 'museum', 60, 39.7700, 30.5231),
  ('44444444-4444-4444-8444-000000000002', 5, 'Haller Gençlik Merkezi', 'cafe', 30, 39.7742, 30.5222);
