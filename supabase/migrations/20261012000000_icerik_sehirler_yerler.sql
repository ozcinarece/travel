-- #98 / #97: içerik tabloları (backoffice'in temeli; şimdilik seed ile). Sütunlar #97 issue'sundaki gibi; `yerler`e
-- lat/lng eklendi (seyahatin mekan havuzuna eklemek ve haritada göstermek için zorunlu). Herkes yayınlı içeriği okur;
-- yazma yalnız service_role (backoffice issue'sunda admin politikası gelir).
create table public.sehirler (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (char_length(ad) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  kapak_url text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  yayin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.yerler (
  id uuid primary key default gen_random_uuid(),
  sehir_id uuid not null references public.sehirler (id) on delete cascade,
  -- Google place_id; backoffice doldurur. Boşsa istemci adıyla çözer (Autocomplete) ve yalnız bellekte tutar.
  place_id text,
  ad text not null check (char_length(ad) between 1 and 120),
  -- Google birincil tipi (museum, park, mosque…) — kategori etiketi ve pin rengi buradan (lib/kategori, lib/pinIkonu).
  kategori text,
  rehber_md text,
  kapak_url text,
  one_cikan_sira integer,
  yayin boolean not null default false,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

create index yerler_sehir_idx on public.yerler (sehir_id, one_cikan_sira);

alter table public.sehirler enable row level security;
alter table public.yerler enable row level security;

create policy sehirler_select on public.sehirler for select to anon, authenticated using (yayin);
create policy yerler_select on public.yerler for select to anon, authenticated
  using (yayin and exists (select 1 from public.sehirler s where s.id = sehir_id and s.yayin));

-- #98 KK2: seyahatin adı ("Eskişehir Gezisi"); boşsa ekranlar şehir etiketini gösterir.
alter table public.trips add column name text check (name is null or char_length(name) between 1 and 80);

-- ---------------------------------------------------------------- seed: Eskişehir (içerik ekibi backoffice'ten düzenler)
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values
  ('11111111-1111-4111-8111-000000000001', 'Eskişehir', 'eskisehir', 39.7767, 30.5206, true);

insert into public.yerler (sehir_id, ad, kategori, lat, lng, one_cikan_sira, yayin, rehber_md) values
  ('11111111-1111-4111-8111-000000000001', 'Odunpazarı Evleri', 'historical_landmark', 39.7636, 30.5256, 1, true,
   'Osmanlı dönemi ahşap evlerin restore edildiği tarihi mahalle. Dar sokaklar, cam atölyeleri ve küçük müzeler yürüyerek gezilir; öğleden sonra ışığı fotoğraf için en iyisi.'),
  ('11111111-1111-4111-8111-000000000001', 'Kurşunlu Külliyesi', 'mosque', 39.7627, 30.5261, 2, true,
   '16. yüzyıl Mimar Sinan dönemi külliyesi; avlusundaki lületaşı atölyeleri gezilebilir.'),
  ('11111111-1111-4111-8111-000000000001', 'Sazova Parkı', 'park', 39.7536, 30.4556, 3, true,
   'Bilim Sanat ve Kültür Parkı: masal şatosu, korsan gemisi, hayvanat bahçesi. Çocuklu geziler için yarım gün ayır.'),
  ('11111111-1111-4111-8111-000000000001', 'Kent Park', 'park', 39.7757, 30.5004, 4, true,
   'Porsuk kıyısında yapay plajı olan geniş park; gün batımında seyir noktası.'),
  ('11111111-1111-4111-8111-000000000001', 'Odunpazarı Modern Müze', 'museum', 39.7646, 30.5236, 5, true,
   'Kengo Kuma tasarımı ahşap bina; çağdaş sanat koleksiyonu. Pazartesi kapalı.'),
  ('11111111-1111-4111-8111-000000000001', 'Eti Arkeoloji Müzesi', 'museum', 39.7700, 30.5231, 6, true,
   'Frig ve Roma dönemi buluntuları; Odunpazarı turuyla birleştir.'),
  ('11111111-1111-4111-8111-000000000001', 'Porsuk Çayı Adalar', 'viewpoint', 39.7772, 30.5185, 7, true,
   'Şehir merkezinde kanal boyu yürüyüş, gondol turu ve kafeler.'),
  ('11111111-1111-4111-8111-000000000001', 'Çağdaş Cam Sanatları Müzesi', 'museum', 39.7640, 30.5248, 8, true,
   'Odunpazarı''nda cam sanatı; bitişikteki atölyelerden küçük hediyelik alınabilir.');
