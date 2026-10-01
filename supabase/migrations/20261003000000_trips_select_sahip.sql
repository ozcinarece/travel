-- trips RETURNING düzeltmesi.
-- `insert into trips ... returning id` çağrısında Postgres dönen satırı SELECT politikasıyla denetler
-- ve bu denetim AFTER INSERT tetikleyicisinden (sahibi üye yapan trips_after_insert) ÖNCE çalışır;
-- is_member(id) o anda yanlış döner → "new row violates row-level security policy".
-- Sahip her zaman üyedir; politikaya owner_id = auth.uid() eklemek davranışı genişletmez, yalnızca sırayı çözer.
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using (public.is_member(id) or owner_id = auth.uid());
