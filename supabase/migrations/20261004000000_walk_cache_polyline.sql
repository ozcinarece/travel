-- #33: gerçek rota — walk_cache satırına kodlu polyline ve bacak modu (route-legs Edge Function yazar).
-- seconds/meters yürüyüş değeri olarak kalır (sıralama/tempo); DRIVE bacağında araç süresi ayrı sütunda.
alter table public.walk_cache
  add column if not exists polyline text,
  add column if not exists mode text not null default 'WALK' check (mode in ('WALK', 'DRIVE')),
  add column if not exists drive_seconds integer,
  add column if not exists drive_meters integer;
