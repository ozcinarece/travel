-- #43: "Vardık" → "Tamamlandı" + otomatik tamamlanma (PRD 3.7 KK7–KK8, §5.4).
-- arrived_at/arrived_by kalır (konumla sessizce yazılır, istatistik); zamanlama completed_at ile akar.
alter table public.stops
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references auth.users (id) on delete set null,
  add column if not exists auto_completed boolean not null default false;
