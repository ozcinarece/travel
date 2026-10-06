-- #45: tamamlanan durağı puanlama (5 yıldız + hızlı etiketler + kısa not). Üye başına mekan başına tek kayıt.
-- Gezi sonu (v2) ve Haritam'ı (v2) besler; gezi bitince tekrar sorulmaz.
create table public.stop_ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_ref uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  tags text[] not null default '{}' check (tags <@ array['sakin', 'sabah', 'kalabalik', 'fotograf', 'tekrar']::text[]),
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  foreign key (place_ref, trip_id) references public.places (id, trip_id) on delete cascade,
  unique (place_ref, user_id)
);

alter table public.stop_ratings enable row level security;

-- Üyeler seyahatin puanlarını görür (not "arkadaşlar görür"); yalnız kendi puanını yazar/değiştirir/siler.
create policy stop_ratings_select on public.stop_ratings for select to authenticated using (public.is_member(trip_id));
create policy stop_ratings_insert on public.stop_ratings for insert to authenticated
  with check (public.is_member(trip_id) and user_id = auth.uid());
create policy stop_ratings_update on public.stop_ratings for update to authenticated
  using (user_id = auth.uid()) with check (public.is_member(trip_id) and user_id = auth.uid());
create policy stop_ratings_delete on public.stop_ratings for delete to authenticated using (user_id = auth.uid());

-- #45 pin paneli "gezgin ipuçları": tüm kullanıcıların etiket toplamı, aynı Google mekanı için; ≥ 3 kişi işaretlediyse.
-- Satır/not/kimlik sızmaz; yalnız etiket + kişi sayısı döner.
create function public.mekan_ipuclari(p_place_id text)
returns table (tag text, kisi integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.tag, count(distinct r.user_id)::integer as kisi
  from public.stop_ratings r
  join public.places p on p.id = r.place_ref
  cross join lateral unnest(r.tags) as t(tag)
  where p.place_id = p_place_id
  group by t.tag
  having count(distinct r.user_id) >= 3
  order by kisi desc
  limit 4;
$$;

revoke all on function public.mekan_ipuclari(text) from public, anon;
grant execute on function public.mekan_ipuclari(text) to authenticated;
