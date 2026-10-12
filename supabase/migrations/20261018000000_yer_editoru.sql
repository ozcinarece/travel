-- #108: backoffice yer editörü — sesli anlatım (v2) sütunu, düzenleme zamanı, öne çıkan sırası tekilliği, place_id biçimi.

-- KK4: v2 sesli anlatım (liste 91); şimdilik yalnız sütun, panel "Ses · yakında".
alter table public.yerler
  add column ses_url text,
  add column updated_at timestamptz not null default now();

create trigger yerler_updated_at before update on public.yerler
  for each row execute function public.updated_at_yaz();

-- KK2 / KK7: öne çıkan sırası şehir içinde tekil (boş = öne çıkmıyor). Sıralama değişikliği tek deyimde yapılabilsin diye
-- kısıt ertelenebilir.
alter table public.yerler
  add constraint yerler_one_cikan_tekil unique (sehir_id, one_cikan_sira) deferrable initially immediate,
  add constraint yerler_one_cikan_pozitif check (one_cikan_sira is null or one_cikan_sira >= 1);

-- KK7: Google place_id biçimi (boş kalabilir: istemci adla çözer, #97).
alter table public.yerler
  add constraint yerler_place_id_bicim check (place_id is null or place_id ~ '^[A-Za-z0-9_-]{10,255}$');
