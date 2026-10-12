-- #100 B: şehir rehberi — bölüm yazıları (backoffice'ten; şimdilik seed). Sütunlar issue'daki gibi.
-- Rehber sayfasının 2 cümlelik özeti için `sehirler.ozet`.
alter table public.sehirler add column ozet text check (ozet is null or char_length(ozet) <= 400);

create table public.sehir_rehberi (
  id uuid primary key default gen_random_uuid(),
  sehir_id uuid not null references public.sehirler (id) on delete cascade,
  bolum text not null check (bolum in ('ulasim', 'yemek', 'mahalle', 'ipucu')),
  baslik text not null check (char_length(baslik) between 1 and 120),
  ozet text check (ozet is null or char_length(ozet) <= 200),
  yazi_md text,
  sira integer not null default 1,
  created_at timestamptz not null default now(),
  unique (sehir_id, bolum)
);
create index sehir_rehberi_sehir_idx on public.sehir_rehberi (sehir_id, sira);

alter table public.sehir_rehberi enable row level security;
-- Herkes yayınlı şehrin rehberini okur; yazma yalnız service_role (backoffice issue'sunda admin politikası gelir).
create policy sehir_rehberi_select on public.sehir_rehberi for select to anon, authenticated
  using (exists (select 1 from public.sehirler s where s.id = sehir_id and s.yayin));

-- ---------------------------------------------------------------- seed: Eskişehir
update public.sehirler set ozet = 'Anadolu''nun öğrenci şehri: nehir kıyısı, tarihi Odunpazarı ve çibörek. İki güne sığar, üç gün rahat eder.'
  where id = '11111111-1111-4111-8111-000000000001';

insert into public.sehir_rehberi (sehir_id, bolum, baslik, ozet, yazi_md, sira) values
  ('11111111-1111-4111-8111-000000000001', 'ulasim', 'Nasıl gidilir, nasıl gezilir', 'YHT 1,5 sa · merkez yürünür · tramvay', E'# Nasıl gidilir, nasıl gezilir\n\nAnkara''dan YHT ile 1,5 saat, İstanbul''dan 3 saat. Gar şehir merkezinde; Odunpazarı''na tramvayla 10 dakika.\n\nMerkez yürünür: Porsuk kıyısı, Köprübaşı ve Odunpazarı birbirine 20 dakika. Sazova Parkı için tramvay ya da 10 dakikalık taksi.\n\n> Tramvay kartını (EsKart) gardaki büfeden alın; tek kart birkaç kişi için okutulabilir.', 1),
  ('11111111-1111-4111-8111-000000000001', 'yemek', 'Ne yenir', 'Çibörek, met helvası, balaban', E'# Ne yenir\n\nÇibörek Tatarlardan kalan şehir klasiği: kıymalı, ince hamurlu, sıcak yenir. Odunpazarı''ndaki küçük dükkânlarda porsiyon başına 3–4 tane.\n\nBalaban kebap öğle için, met helvası ve nuga helva tatlı için. Porsuk kıyısı kafeleri akşam çayı için.\n\n- Çibörek: Odunpazarı\n- Balaban: Köprübaşı\n- Met helvası: çarşı', 2),
  ('11111111-1111-4111-8111-000000000001', 'mahalle', 'Mahalleler', 'Odunpazarı · Porsuk kıyısı · Sazova', E'# Mahalleler\n\n**Odunpazarı** — renkli Osmanlı evleri, Kurşunlu Külliyesi, Lületaşı Müzesi; yarım gün.\n\n**Porsuk kıyısı** — köprüler, gondol, kafeler; akşam yürüyüşü.\n\n**Sazova** — Bilim Sanat ve Kültür Parkı, masal şatosu, korsan gemisi; çocuklu aileler için yarım gün.', 3),
  ('11111111-1111-4111-8111-000000000001', 'ipucu', 'İpuçları', 'Pazartesi müzeler kapalı · sabah erken', E'# İpuçları\n\n- Müzelerin çoğu pazartesi kapalı.\n- Odunpazarı''na sabah erken gidin; öğleden sonra kalabalık.\n- Hafta sonu YHT biletleri erken biter; birkaç gün önce alın.\n- Kış rüzgârlı; nehir kıyısında kat gerekir.', 4);
