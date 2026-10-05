-- Şema, RLS ve RPC testleri. Her beklenti sağlanmazsa hata fırlatır (psql ON_ERROR_STOP).
-- Kişiler: A = sahip, B = hesaplı ikinci kullanıcı, G = misafir (anonim), X = dışarıdan biri.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set G '''99999999-0000-0000-0000-000000000003'''
\set X '''eeeeeeee-0000-0000-0000-000000000004'''

insert into auth.users (id, is_anonymous) values
  (:A, false), (:B, false), (:G, true), (:X, false);

create function pg_temp.as_user(u uuid, anonim boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'is_anonymous', anonim)::text, false);
$$;

-- Beklenen hata kodu gelmezse başarısız olur.
create function pg_temp.hata_bekle(sorgu text, kod text) returns void
language plpgsql as $$
begin
  execute sorgu;
  raise exception 'HATA BEKLENİYORDU (%): %', kod, sorgu;
exception when others then
  if sqlstate = kod then return; end if;
  if sqlerrm like 'HATA BEKLENİYORDU%' then raise; end if;
  raise exception 'beklenen %, gelen % (%): %', kod, sqlstate, sqlerrm, sorgu;
end;
$$;

grant execute on function pg_temp.as_user(uuid, boolean), pg_temp.hata_bekle(text, text) to anon, authenticated;

-- 1 ── A profil ve 4 günlük seyahat oluşturur
set role authenticated;
select pg_temp.as_user(:A);
insert into public.profiles (id, name, username) values (:A, 'Ece', 'ece');
-- 0.3 yönlendirme cevabı ve damgası kendi satırına yazılır
update public.profiles set next_trip_window = 'bu_ay', onboarding_done_at = now() where id = auth.uid();
do $$ begin assert (select next_trip_window from public.profiles where id = auth.uid()) = 'bu_ay', 'yönlendirme cevabı kaydedilir'; end $$;
-- İstemci gibi RETURNING ile: dönen satır SELECT politikasından geçmeli (tetikleyici henüz üye yazmadan).
insert into public.trips (owner_id, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date)
values (:A, 'ChIJ-roma', 'Roma', 'IT', 41.9, 12.49, 'Europe/Rome', '2026-10-12', '2026-10-15')
returning id;
select pg_temp.hata_bekle($$update public.trips set country_code = 'ita'$$, '23514');

do $$
declare s record;
begin
  select * into s from public.trips;
  assert s.day_end = '20:00', 'gün bitişi varsayılanı 20:00';
  assert s.invite_token ~ '^[0-9A-Za-z]{8}$', 'token 8 karakter base62: ' || s.invite_token;
  assert (select count(*) from public.days where trip_id = s.id) = 4, '4 gün oluşmalı';
  assert (select max(date) from public.days where trip_id = s.id) = '2026-10-15', 'son gün tarihi';
  assert (select role from public.members where trip_id = s.id) = 'owner', 'A sahip';
  assert (select display_name from public.members where trip_id = s.id) = 'Ece', 'ad profilden';
end $$;

select pg_temp.hata_bekle(
  $$insert into public.profiles (id, name, username) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'Buyuk')$$,
  '23514');

reset role;
select id as trip from public.trips \gset
set role authenticated;

-- 2 ── X seyahati göremez; anon davet özetini görür
select pg_temp.as_user(:X);
do $$ begin assert (select count(*) from public.trips) = 0, 'X seyahati görmemeli'; end $$;
select pg_temp.hata_bekle(
  format($$insert into public.places (trip_id, place_id, lat, lng, added_by)
    values (%L, 'p', 0, 0, 'eeeeeeee-0000-0000-0000-000000000004')$$, :'trip'),
  '42501');

reset role;
select invite_token as token from public.trips \gset
select set_config('test.token', :'token', false);
set role anon;
select pg_temp.as_user(null);
do $$ begin assert (select count(*) from public.trips) = 0, 'anon tabloyu okuyamaz'; end $$;
select * from public.invite_preview(:'token');
do $$
begin
  assert (select member_count from public.invite_preview(current_setting('test.token'))) = 1, 'özet üye sayısı';
end $$;
select pg_temp.hata_bekle($$select public.join_trip('x', 'y')$$, '42501');

-- 3 ── G misafir olarak katılır, mekan ekler; seyahat ya da profil oluşturamaz
set role authenticated;
select pg_temp.as_user(:G, true);
select public.join_trip(:'token', ' Mert ');
do $$
begin
  assert (select guest from public.members where user_id = auth.uid()), 'misafir guest=true';
  assert (select display_name from public.members where user_id = auth.uid()) = 'Mert', 'ad kırpılır';
  assert (select count(*) from public.trips) = 1, 'G seyahati görür';
end $$;
insert into public.places (trip_id, place_id, primary_type, lat, lng, default_minutes, added_by, note)
select id, 'ChIJ-forum', 'tourist_attraction', 41.89, 12.48, 60, :G, 'bilet ortak' from public.trips;
select pg_temp.hata_bekle(
  $$insert into public.places (trip_id, place_id, lat, lng, added_by)
    select id, 'ChIJ-baska', 0, 0, 'aaaaaaaa-0000-0000-0000-000000000001' from public.trips$$,
  '42501');
select pg_temp.hata_bekle(
  $$insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz)
    values ('99999999-0000-0000-0000-000000000003', 'c', 'Paris', 0, 0, 'Europe/Paris')$$,
  '42501');
select pg_temp.hata_bekle(
  $$insert into public.profiles (id, name, username) values ('99999999-0000-0000-0000-000000000003', 'Mert', 'mert')$$,
  '42501');
select pg_temp.hata_bekle($$update public.trips set invite_token = 'abcdefgh'$$, '42501');
select pg_temp.hata_bekle($$select public.rotate_invite_token(id) from public.trips$$, '42501');

-- 4 ── A mekan ekler; G A'nın notunu değiştiremez, sahip G'ninkini değiştirebilir
select pg_temp.as_user(:A);
insert into public.places (trip_id, place_id, primary_type, lat, lng, default_minutes, added_by, note)
select id, 'ChIJ-kolezyum', 'tourist_attraction', 41.89, 12.49, 90, :A, 'erken git' from public.trips;
update public.places set note = 'sahip düzeltti' where place_id = 'ChIJ-forum';

select pg_temp.as_user(:G, true);
select pg_temp.hata_bekle($$update public.places set note = 'x' where place_id = 'ChIJ-kolezyum'$$, '42501');
select pg_temp.hata_bekle(
  $$update public.places set added_by = '99999999-0000-0000-0000-000000000003' where place_id = 'ChIJ-kolezyum'$$,
  '42501');
update public.places set default_minutes = 120 where place_id = 'ChIJ-kolezyum';
do $$
begin
  assert (select default_minutes from public.places where place_id = 'ChIJ-kolezyum') = 120,
    'üye başkasının mekanında süreyi değiştirebilir';
end $$;

-- 5 ── B katılır; duraklar aynı seyahatin günü ve mekanıyla sınırlı
select pg_temp.as_user(:B);
insert into public.profiles (id, name, username) values (:B, 'Deniz', 'deniz');
select public.join_trip(:'token', 'Deniz');
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
select d.trip_id, d.id, p.id, 'a0', 90
from public.days d join public.places p on p.trip_id = d.trip_id
where d.index = 1 and p.place_id = 'ChIJ-kolezyum';
select pg_temp.hata_bekle(
  $$insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
    select d.trip_id, d.id, p.id, 'a1', 30
    from public.days d join public.places p on p.trip_id = d.trip_id
    where d.index = 2 and p.place_id = 'ChIJ-kolezyum'$$,
  '23505');
select pg_temp.hata_bekle(
  $$update public.stops set minutes = 50$$,
  '23514');
update public.stops set arrived_at = now(), arrived_by = auth.uid();
-- #43: Tamamlandı (üye yazar) ve otomatik tamamlanma bayrağı.
update public.stops set completed_at = now(), completed_by = auth.uid(), auto_completed = false;
update public.stops set completed_at = null, completed_by = null, auto_completed = true;
select pg_temp.hata_bekle(
  $$insert into public.walk_cache (trip_id, from_key, to_key, seconds, meters)
    select id, 'hotel', 'x', 60, 80 from public.trips$$,
  '42501');

-- 6 ── Değişiklik akışı tetikleyiciyle dolar, istemci yazamaz
do $$
begin
  assert exists (select 1 from public.changes where entity = 'places' and field is null and user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
    'mekan ekleme kaydı';
  assert exists (select 1 from public.changes where entity = 'places' and field = 'default_minutes' and new = '120'),
    'alan bazlı güncelleme kaydı';
  assert exists (select 1 from public.changes where entity = 'stops' and field = 'arrived_at'
                 and user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'varış kaydı';
  assert exists (select 1 from public.changes where entity = 'stops' and field = 'completed_at'
                 and user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'Tamamlandı kaydı';
end $$;
select pg_temp.hata_bekle(
  $$insert into public.changes (trip_id, entity, entity_id) select id, 'x', 'y' from public.trips$$,
  '42501');

-- 7 ── Üyelik: misafir ayrılabilir, sahip kendini silemez, üye rolünü değiştiremez
select pg_temp.hata_bekle($$update public.members set role = 'owner' where user_id = auth.uid()$$, '42501');
select pg_temp.as_user(:A);
delete from public.members where user_id = :A;
do $$ begin assert (select count(*) from public.members) = 3, 'sahip kendini silememeli'; end $$;
select public.rotate_invite_token(id) from public.trips;

-- 8 ── Hesap silme: önce önizleme (A sahip → Deniz'e devir), sonra silme; auth kaydı gider, sahiplik B'ye geçer
do $$
declare o record;
begin
  select * into o from public.account_deletion_preview();
  assert o.outcome = 'transfer' and o.new_owner_name = 'Deniz',
    'önizleme Deniz''e devir olmalı, gelen: ' || coalesce(o.outcome, 'null') || '/' || coalesce(o.new_owner_name, 'null');
  assert (select count(*) from public.account_deletion_preview()) = 1, 'önizlemede tek seyahat';
end $$;
select pg_temp.as_user(:G, true);
do $$ begin assert (select count(*) from public.account_deletion_preview()) = 0, 'misafir sahip değil, önizleme boş'; end $$;
select pg_temp.as_user(:A);
select public.delete_account();
reset role;
do $$
begin
  assert not exists (select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'auth kaydı silinmeli';
  assert not exists (select 1 from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'profil silinmeli';
  assert (select added_by from public.places where place_id = 'ChIJ-kolezyum') is null, 'A''nın mekanı kalır, ekleyen boşalır';
  assert exists (select 1 from public.changes where field = 'ownership_transferred' and old = '"Ece"' and new = '"Deniz"'),
    'sahiplik devri adlarla kaydedilmeli';
  assert (select owner_id from public.trips) = 'bbbbbbbb-0000-0000-0000-000000000002', 'sahiplik B''ye geçmeli';
  assert (select role from public.members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'owner', 'B sahip rolünde';
  assert (select count(*) from public.members where role = 'owner') = 1, 'tek sahip kalmalı';
  assert not exists (select 1 from public.members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'A üyelikten çıkmalı';
  assert (select invite_token from public.trips) <> current_setting('test.token'), 'token yenilendi';
end $$;

-- 9 ── Seyahat silinince alt satırlar ve kayıtlar temizlenir
delete from public.trips;
do $$
begin
  assert (select count(*) from public.places) = 0 and (select count(*) from public.changes) = 0, 'cascade';
end $$;

-- 10 ── Avatar deposu: yalnızca kendi klasörüne yazılır, misafir yazamaz, herkes okur
set role authenticated;
select pg_temp.as_user(:A);
insert into storage.objects (bucket_id, name, owner)
values ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/avatar.jpg', :A);
select pg_temp.hata_bekle(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000002/avatar.jpg')$$,
  '42501');
select pg_temp.hata_bekle(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'avatar.jpg')$$,
  '42501');
update storage.objects set metadata = '{"v": 2}' where name like 'aaaaaaaa%';
select pg_temp.as_user(:G, true);
select pg_temp.hata_bekle(
  $$insert into storage.objects (bucket_id, name) values ('avatars', '99999999-0000-0000-0000-000000000003/avatar.jpg')$$,
  '42501');
-- delete/update politikaları satırı görünmez kılar, hata vermez: silme etkisiz kalmalı.
delete from storage.objects where name like 'aaaaaaaa%';
update storage.objects set metadata = '{"v": 3}' where name like 'aaaaaaaa%';
do $$
begin
  assert (select metadata from storage.objects where name like 'aaaaaaaa%') = '{"v": 2}', 'misafir başkasının avatarını değiştiremez';
end $$;
set role anon;
select pg_temp.as_user(null);
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'avatars') = 1, 'avatar herkese okunur'; end $$;
reset role;

\echo 'rls_test: TÜM TESTLER GEÇTİ'
