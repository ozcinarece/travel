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
-- #140: süre 15'in katı olmak zorunda değil; 15–480 dışı reddedilir.
select pg_temp.hata_bekle(
  $$update public.stops set minutes = 10$$,
  '23514');
update public.stops set arrived_at = now(), arrived_by = auth.uid();
-- #43: Tamamlandı (üye yazar) ve otomatik tamamlanma bayrağı.
update public.stops set completed_at = now(), completed_by = auth.uid(), auto_completed = false;
update public.stops set completed_at = null, completed_by = null, auto_completed = true;
-- #45: puanlama — üye kendi puanını yazar; etiket listesi sınırlı; başkası adına yazamaz.
insert into public.stop_ratings (trip_id, place_ref, stars, tags, note)
select p.trip_id, p.id, 5, array['sakin', 'fotograf'], 'sabah erken git' from public.places p where p.place_id = 'ChIJ-kolezyum';
select pg_temp.hata_bekle(
  $$insert into public.stop_ratings (trip_id, place_ref, stars, tags)
    select p.trip_id, p.id, 4, array['uydurma'] from public.places p where p.place_id = 'ChIJ-kolezyum'$$,
  '23514');
select pg_temp.hata_bekle(
  $$insert into public.stop_ratings (trip_id, place_ref, user_id, stars)
    select p.trip_id, p.id, 'aaaaaaaa-0000-0000-0000-000000000001', 3 from public.places p where p.place_id = 'ChIJ-kolezyum'$$,
  '42501');
update public.stop_ratings set stars = 4 where user_id = auth.uid();
do $$ begin
  assert (select count(*) from public.stop_ratings) = 1, 'üye seyahatin puanını görür';
  assert to_regprocedure('public.mekan_ipuclari(text)') is null, '#47: ipucu RPC kaldırıldı';
end $$;
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

-- 11 ── #56 gün bazlı otel (stays): üye ekler, günlere bağlar; başka seyahatin oteli bağlanamaz; başkası göremez;
-- otel silinince günler "otel yok" olur; günün oteli değişikliği akışa yazılır; eski hotel_* taşıması.
set role authenticated;
select pg_temp.as_user(:X);
insert into public.profiles (id, name, username) values (:X, 'Yabancı', 'yabanci');
insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date)
values (:X, 'ChIJ-paris', 'Paris', 48.85, 2.35, 'Europe/Paris', '2026-11-01', '2026-11-03');
insert into public.stays (trip_id, place_id, lat, lng, label) select id, 'ChIJ-ibis', 48.86, 2.34, 'Ibis' from public.trips;
select pg_temp.hata_bekle(
  $$insert into public.stays (trip_id, lat, lng, created_by) select id, 0, 0, 'bbbbbbbb-0000-0000-0000-000000000002' from public.trips$$,
  '42501');
update public.days set start_stay_id = (select id from public.stays), end_stay_id = (select id from public.stays) where index >= 2;
do $$
begin
  assert (select count(*) from public.days where start_stay_id is not null) = 2, '2. gün ve sonrası otelli';
  assert (select start_stay_id from public.days where index = 1) is null, '1. gün otelsiz';
  assert exists (select 1 from public.changes where entity = 'days' and field = 'start_stay_id'), 'günün oteli akışa yazılır';
  assert exists (select 1 from public.changes where entity = 'stays' and field is null), 'otel ekleme akışa yazılır';
end $$;

-- Başkasının seyahati ve oteli: B göremez; X kendi gününe başka seyahatin otelini bağlayamaz.
reset role;
insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'ChIJ-lyon', 'Lyon', 45.76, 4.83, 'Europe/Paris', '2026-12-01', '2026-12-01');
insert into public.stays (trip_id, lat, lng, label, created_by) select id, 45.76, 4.84, 'Lyon oteli', 'bbbbbbbb-0000-0000-0000-000000000002' from public.trips where city_label = 'Lyon';
select id as lstay from public.stays where label = 'Lyon oteli' \gset
set role authenticated;
select pg_temp.as_user(:X);
do $$ begin assert (select count(*) from public.stays) = 1, 'X yalnız kendi seyahatinin otelini görür'; end $$;
select pg_temp.hata_bekle(format($$update public.days set start_stay_id = %L where index = 1$$, :'lstay'), '23503');

-- Otel silinince günler otelsiz kalır.
delete from public.stays where label = 'Ibis';
do $$ begin assert (select count(*) from public.days where start_stay_id is not null or end_stay_id is not null) = 0, 'otel silinince günler null'; end $$;
reset role;

-- Eski trips.hotel_* taşıması: oteli olan, stays'i olmayan seyahate bir otel; tüm günler ona bağlanır; ikinci çağrı etkisiz.
insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date, hotel_place_id, hotel_lat, hotel_lng, hotel_label)
values ('eeeeeeee-0000-0000-0000-000000000004', 'ChIJ-nice', 'Nice', 43.70, 7.26, 'Europe/Paris', '2026-12-10', '2026-12-12', 'ChIJ-eski', 43.69, 7.27, 'Eski otel');
do $$
declare nice uuid := (select id from public.trips where city_label = 'Nice');
begin
  assert public.stays_tasi_eski_oteller() = 1, 'yalnız Nice taşınır (Lyon''un oteli zaten var, Paris''in hotel_* boş)';
  assert (select label from public.stays where trip_id = nice) = 'Eski otel', 'Nice için eski otel';
  assert (select count(*) from public.days where trip_id = nice and start_stay_id = end_stay_id and start_stay_id is not null) = 3, 'tüm günler eski otelde';
  assert not exists (select 1 from public.changes where trip_id = nice and entity = 'days' and field = 'start_stay_id'), 'taşıma akışa yazılmaz';
  assert public.stays_tasi_eski_oteller() = 0, 'ikinci çağrı etkisiz';
end $$;
select pg_temp.hata_bekle($$set role authenticated; select public.stays_tasi_eski_oteller()$$, '42501');
reset role;

-- ---------------------------------------------------------------- #98: içerik tabloları ve seyahat adı
reset role;
-- Seed: Eskişehir yayınlı; yayınsız bir şehir ve yayınsız bir yer eklenir (okunmamalı).
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('22222222-2222-4222-8222-000000000002', 'Taslak Şehir', 'taslak', 40, 30, false);
insert into public.yerler (sehir_id, ad, lat, lng, yayin) values ('11111111-1111-4111-8111-000000000001', 'Taslak Yer', 39.7, 30.5, false);
insert into public.yerler (sehir_id, ad, lat, lng, yayin) values ('22222222-2222-4222-8222-000000000002', 'Gizli Şehrin Yeri', 40, 30, true);
set role authenticated;
select pg_temp.as_user(:B);
do $$
begin
  assert (select count(*) from public.sehirler) = 1, 'yalnız yayınlı şehir okunur';
  assert (select count(*) from public.yerler) = 8, 'yalnız yayınlı şehrin yayınlı yerleri okunur (8 seed)';
  assert (select count(*) from public.yerler where one_cikan_sira = 1 and ad = 'Odunpazarı Evleri') = 1, 'öne çıkan sırası seed';
end $$;
-- İstemci içerik yazamaz (politika yok → RLS reddeder).
select pg_temp.hata_bekle($$insert into public.sehirler (ad, slug, lat, lng, yayin) values ('X', 'x-sehir', 1, 1, true)$$, '42501');
-- UPDATE politikası yok: satır görünmez, güncelleme sessizce 0 satır etkiler.
update public.yerler set yayin = false;
reset role;
do $$ begin assert (select count(*) from public.yerler where yayin) = 9, 'istemci içerik güncelleyemez (8 seed + gizli şehrin yeri)'; end $$;
set role authenticated;
set role anon;
select pg_temp.as_user(:G, true);
do $$ begin assert (select count(*) from public.sehirler) = 1, 'anonim de yayınlı şehri okur'; end $$;
reset role;

-- Seyahat adı: üye yazar, 80 karakter sınırı, boşsa null (X'in Nice seyahati bu noktada hâlâ var).
set role authenticated;
select pg_temp.as_user(:X);
update public.trips set name = 'Nice Gezisi' where city_label = 'Nice';
do $$ begin assert (select name from public.trips where city_label = 'Nice') = 'Nice Gezisi', 'seyahat adı yazılır'; end $$;
select pg_temp.hata_bekle($$update public.trips set name = repeat('a', 81) where city_label = 'Nice'$$, '23514');
reset role;

-- ---------------------------------------------------------------- #97: geziler, kaydedilenler, olaylar
reset role;
insert into public.geziler (sehir_id, baslik, slug, gun_sayisi, yayin) values ('11111111-1111-4111-8111-000000000001', 'Taslak gezi', 'taslak-gezi', 1, false);
set role authenticated;
select pg_temp.as_user(:B);
do $$
begin
  assert (select count(*) from public.geziler) = 1, 'yalnız yayınlı gezi okunur';
  assert (select count(*) from public.gezi_gunleri) = 2, 'yayınlı gezinin 2 günü';
  assert (select count(*) from public.gezi_duraklari) = 11, 'yayınlı gezinin 11 durağı';
  assert (select mekan_sayisi from public.geziler where slug = 'eskisehir-iki-gun') = 11, 'mekan sayısı seed';
end $$;
-- Kalp: yalnız kendi satırı; başkası adına yazılamaz, başkasınınki görünmez.
insert into public.kaydedilenler (user_id, tur, hedef_id) values (:B, 'gezi', '33333333-3333-4333-8333-000000000001');
select pg_temp.hata_bekle($$insert into public.kaydedilenler (user_id, tur, hedef_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'gezi', '33333333-3333-4333-8333-000000000001')$$, '42501');
select pg_temp.hata_bekle($$insert into public.kaydedilenler (user_id, tur, hedef_id) values ('bbbbbbbb-0000-0000-0000-000000000002', 'otel', '33333333-3333-4333-8333-000000000001')$$, '23514');
insert into public.olaylar (tur, hedef_id, meta) values ('gezi_goruntulendi', '33333333-3333-4333-8333-000000000001', '{"sayfa": 1}');
select pg_temp.as_user(:X);
do $$
begin
  assert (select count(*) from public.kaydedilenler) = 0, 'X başkasının kalbini görmez';
  assert (select count(*) from public.olaylar) = 0, 'X başkasının olayını görmez';
end $$;
select pg_temp.as_user(:B);
do $$ begin assert (select count(*) from public.kaydedilenler where tur = 'gezi') = 1, 'B kendi kalbini görür'; end $$;
delete from public.kaydedilenler where tur = 'gezi';
do $$ begin assert (select count(*) from public.kaydedilenler) = 0, 'kalp kaldırılır'; end $$;
reset role;

-- ---------------------------------------------------------------- #100: şehir rehberi
reset role;
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('11111111-1111-4111-8111-000000000099', 'Gizli Şehir', 'gizli-sehir', 40, 30, false)
  on conflict (id) do nothing;
insert into public.sehir_rehberi (sehir_id, bolum, baslik, sira) values ('11111111-1111-4111-8111-000000000099', 'yemek', 'Gizli', 1);
set role authenticated;
select pg_temp.as_user(:B);
do $$
begin
  assert (select count(*) from public.sehir_rehberi) = 4, 'yalnız yayınlı şehrin rehberi okunur (4 bölüm)';
  assert (select ozet from public.sehirler where slug = 'eskisehir') like 'Anadolu%', 'şehir özeti seed';
end $$;
select pg_temp.hata_bekle($$insert into public.sehir_rehberi (sehir_id, bolum, baslik) values ('11111111-1111-4111-8111-000000000001', 'ipucu', 'x')$$, '42501');
set role anon;
do $$ begin assert (select count(*) from public.sehir_rehberi) = 4, 'anon da yayınlı rehberi okur'; end $$;
reset role;

-- ---------------------------------------------------------------- #101: bacak modları (üye yazar, üye olmayan göremez)
reset role;
set role authenticated;
select pg_temp.as_user(:B);
insert into public.bacak_modlari (trip_id, from_key, to_key, mod) select id, 'A', 'B', 'araba' from public.trips limit 1;
update public.bacak_modlari set mod = 'yurume' where from_key = 'A';
do $$ begin assert (select mod from public.bacak_modlari where from_key = 'A') = 'yurume', 'üye bacak modunu değiştirir'; end $$;
select pg_temp.hata_bekle($$insert into public.bacak_modlari (trip_id, from_key, to_key, mod) select id, 'A', 'C', 'toplu' from public.trips limit 1$$, '23514');
select pg_temp.as_user(:X);
do $$ begin assert (select count(*) from public.bacak_modlari) = 0, 'üye olmayan bacak modunu görmez'; end $$;
select pg_temp.hata_bekle($$insert into public.bacak_modlari (trip_id, from_key, to_key, mod) values ('33333333-3333-4333-8333-000000000001', 'A', 'B', 'araba')$$, '42501');
select pg_temp.as_user(:B);
delete from public.bacak_modlari where from_key = 'A';
do $$ begin assert (select count(*) from public.bacak_modlari) = 0, 'otomatiğe dönüş = satır silinir'; end $$;
reset role;

-- ---------------------------------------------------------------- #106: backoffice yöneticisi (is_admin) ve içerik yazma
-- E = Ece (seed admin, doğrulanmış Google hesabı). S = aynı e-postayla doğrulanmamış kayıt. M = JWT'de Ece'nin
-- e-postası ama auth kaydında başka e-posta (eski/sahte JWT). B = sıradan hesap.
reset role;
\set E '''eceeceec-0000-0000-0000-000000000005'''
\set S '''55555555-0000-0000-0000-000000000006'''
\set M '''66666666-0000-0000-0000-000000000007'''
insert into auth.users (id, email, email_confirmed_at) values
  (:E, 'Ozcinar.Ece@gmail.com', now()),
  (:S, 'ozcinar.ece@gmail.com', null),
  (:M, 'baska@ornek.com', now());
update auth.users set email = 'b@ornek.com', email_confirmed_at = now() where id = :B;

create function pg_temp.as_email(u uuid, eposta text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'email', eposta)::text, false);
$$;
grant execute on function pg_temp.as_email(uuid, text) to anon, authenticated;

set role authenticated;
-- Yönetici değiller: doğrulanmamış aynı e-posta, JWT/kayıt uyuşmazlığı, sıradan hesap, misafir.
select pg_temp.as_email(:S, 'ozcinar.ece@gmail.com');
do $$ begin assert not public.is_admin(), 'doğrulanmamış e-posta admin olamaz'; end $$;
select pg_temp.as_email(:M, 'ozcinar.ece@gmail.com');
do $$ begin assert not public.is_admin(), 'JWT e-postası auth kaydıyla uyuşmazsa admin değil'; end $$;
select pg_temp.as_email(:B, 'b@ornek.com');
do $$
begin
  assert not public.is_admin(), 'sıradan hesap admin değil';
  assert (select count(*) from public.admin_kullanicilar) = 0, 'admin listesi admin olmayana görünmez';
  assert (select count(*) from public.sehirler) = 1, 'admin olmayan taslak şehri görmez';
end $$;
select pg_temp.hata_bekle($$insert into public.admin_kullanicilar (email) values ('b@ornek.com')$$, '42501');
select pg_temp.hata_bekle($$insert into public.geziler (sehir_id, baslik, slug) values ('11111111-1111-4111-8111-000000000001', 'x', 'x-gezi')$$, '42501');
select pg_temp.hata_bekle($$insert into storage.objects (bucket_id, name) values ('icerik', 'geziler/x/kapak.jpg')$$, '42501');
select pg_temp.as_user(:G, true);
do $$ begin assert not public.is_admin(), 'misafir admin değil'; end $$;
set role anon;
do $$ begin assert not public.is_admin(), 'oturumsuz admin değil'; end $$;
select pg_temp.hata_bekle($$select count(*) from public.admin_kullanicilar$$, '42501');

-- Ece: e-posta büyük/küçük harf duyarsız; taslak dahil okur; tüm içerik tablolarına yazar.
set role authenticated;
select pg_temp.as_email(:E, 'OZCINAR.ECE@gmail.com');
do $$
begin
  assert public.is_admin(), 'Ece admin';
  assert (select count(*) from public.admin_kullanicilar) = 1, 'admin listeyi görür';
  assert (select count(*) from public.sehirler where not yayin) = 2, 'admin taslak şehirleri görür';
  assert (select count(*) from public.yerler where not yayin) = 1, 'admin taslak yeri görür';
  assert (select count(*) from public.geziler where not yayin) = 1, 'admin taslak geziyi görür';
  assert (select count(*) from public.sehir_rehberi) = 5, 'admin yayınsız şehrin rehberini de görür';
end $$;
insert into public.sehirler (id, ad, slug, lat, lng) values ('77777777-7777-4777-8777-000000000001', 'Bursa', 'bursa', 40.19, 29.06);
insert into public.yerler (id, sehir_id, ad, lat, lng) values ('77777777-7777-4777-8777-000000000002', '77777777-7777-4777-8777-000000000001', 'Ulu Cami', 40.18, 29.06);
insert into public.geziler (id, sehir_id, baslik, slug) values ('77777777-7777-4777-8777-000000000003', '77777777-7777-4777-8777-000000000001', 'Bursa''da üç gün', 'bursa-uc-gun');
insert into public.gezi_gunleri (id, gezi_id, sira) values ('77777777-7777-4777-8777-000000000004', '77777777-7777-4777-8777-000000000003', 1);
insert into public.gezi_duraklari (gezi_gun_id, sira, ad, lat, lng) values ('77777777-7777-4777-8777-000000000004', 1, 'Ulu Cami', 40.18, 29.06);
insert into public.sehir_rehberi (sehir_id, bolum, baslik) values ('77777777-7777-4777-8777-000000000001', 'yemek', 'İskender');
insert into storage.objects (bucket_id, name) values ('icerik', 'geziler/77777777-7777-4777-8777-000000000003/kapak.jpg');
-- Admin yalnız `icerik` kovasına yazar; avatars kuralı değişmez.
select pg_temp.hata_bekle($$insert into storage.objects (bucket_id, name) values ('avatars', 'baskasi/a.jpg')$$, '42501');
update public.geziler set yayin = true where slug = 'bursa-uc-gun';
update public.sehirler set yayin = true where slug = 'bursa';
insert into public.admin_kullanicilar (email) values ('ikinci@ornek.com');
select pg_temp.hata_bekle($$insert into public.admin_kullanicilar (email) values ('Buyuk@Ornek.com')$$, '23514');
do $$ begin assert (select count(*) from public.admin_kullanicilar) = 2, 'admin yeni admin ekler'; end $$;

-- Yayınlanan içerik herkese görünür; taslak yer görünmez; admin olmayan silemez, admin siler.
select pg_temp.as_email(:B, 'b@ornek.com');
do $$
begin
  assert (select count(*) from public.geziler where slug = 'bursa-uc-gun') = 1, 'yayınlanan gezi herkese görünür';
  assert (select count(*) from public.yerler where ad = 'Ulu Cami') = 0, 'taslak yer görünmez';
end $$;
delete from public.geziler where slug = 'bursa-uc-gun';
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert (select count(*) from public.geziler where slug = 'bursa-uc-gun') = 1, 'admin olmayan gezi silemez'; end $$;
delete from public.sehirler where slug = 'bursa';
delete from public.admin_kullanicilar where email = 'ikinci@ornek.com';
do $$
begin
  assert (select count(*) from public.geziler where slug = 'bursa-uc-gun') = 0, 'admin şehri silince gezisi de gider (cascade)';
  assert (select count(*) from public.admin_kullanicilar) = 1, 'admin admin kaldırır';
end $$;
reset role;

-- ---------------------------------------------------------------- #107: gezi editörü (planlı yayın, sayılar, sıralama, fotoğraflar)
reset role;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
insert into public.geziler (id, sehir_id, baslik, slug) values ('88888888-8888-4888-8888-000000000001', '11111111-1111-4111-8111-000000000001', 'Editör gezisi', 'editor-gezisi');
insert into public.gezi_gunleri (id, gezi_id, sira, baslik) values
  ('88888888-8888-4888-8888-0000000000d1', '88888888-8888-4888-8888-000000000001', 1, 'Bir'),
  ('88888888-8888-4888-8888-0000000000d2', '88888888-8888-4888-8888-000000000001', 2, 'İki');
insert into public.gezi_duraklari (id, gezi_gun_id, sira, ad, lat, lng) values
  ('88888888-8888-4888-8888-0000000000a1', '88888888-8888-4888-8888-0000000000d1', 1, 'A', 39.7, 30.5),
  ('88888888-8888-4888-8888-0000000000a2', '88888888-8888-4888-8888-0000000000d1', 2, 'B', 39.7, 30.5),
  ('88888888-8888-4888-8888-0000000000a3', '88888888-8888-4888-8888-0000000000d1', 3, 'C', 39.7, 30.5);
do $$
begin
  assert (select gun_sayisi from public.geziler where slug = 'editor-gezisi') = 2, 'gün sayısı türetilir';
  assert (select mekan_sayisi from public.geziler where slug = 'editor-gezisi') = 3, 'mekan sayısı türetilir';
end $$;
-- Sürükle-sırala: tek çağrıda C, A, B (tekillik deyim sonunda denetlenir); günler ters çevrilir.
select public.gezi_duraklari_sirala('88888888-8888-4888-8888-0000000000d1', array['88888888-8888-4888-8888-0000000000a3', '88888888-8888-4888-8888-0000000000a1', '88888888-8888-4888-8888-0000000000a2']::uuid[]);
select public.gezi_gunleri_sirala('88888888-8888-4888-8888-000000000001', array['88888888-8888-4888-8888-0000000000d2', '88888888-8888-4888-8888-0000000000d1']::uuid[]);
do $$
begin
  assert (select string_agg(ad, '' order by sira) from public.gezi_duraklari where gezi_gun_id = '88888888-8888-4888-8888-0000000000d1') = 'CAB', 'duraklar sıralanır';
  assert (select sira from public.gezi_gunleri where baslik = 'İki') = 1, 'günler sıralanır';
end $$;
delete from public.gezi_duraklari where ad = 'B';
delete from public.gezi_gunleri where baslik = 'İki';
do $$
begin
  assert (select mekan_sayisi from public.geziler where slug = 'editor-gezisi') = 2, 'durak silinince sayı düşer';
  assert (select gun_sayisi from public.geziler where slug = 'editor-gezisi') = 1, 'gün silinince sayı düşer';
end $$;
-- Planlı yayın: zamanı gelmemiş gezi ve günleri uygulamada görünmez; zamanı geçince görünür.
update public.geziler set yayin = true, yayin_at = now() + interval '1 day' where slug = 'editor-gezisi';
insert into public.icerik_fotolari (yol, sahip_tur, sahip_id, altyazi) values ('geziler/88888888-8888-4888-8888-000000000001/kapak.jpg', 'gezi', '88888888-8888-4888-8888-000000000001', 'Kapak');
select pg_temp.hata_bekle($$insert into public.icerik_fotolari (yol, sahip_tur, sahip_id) values ('geziler/88888888-8888-4888-8888-000000000001/a.jpg', 'yer', '88888888-8888-4888-8888-000000000001')$$, '23514');
select pg_temp.as_email(:B, 'b@ornek.com');
do $$
begin
  assert (select count(*) from public.geziler where slug = 'editor-gezisi') = 0, 'planlı gezi görünmez';
  assert (select count(*) from public.gezi_gunleri where gezi_id = '88888888-8888-4888-8888-000000000001') = 0, 'planlı gezinin günü görünmez';
  assert (select count(*) from public.gezi_duraklari where gezi_gun_id = '88888888-8888-4888-8888-0000000000d1') = 0, 'planlı gezinin durağı görünmez';
  assert (select altyazi from public.icerik_fotolari where sahip_id = '88888888-8888-4888-8888-000000000001') = 'Kapak', 'fotoğraf altyazısı herkese okunur';
end $$;
-- Admin olmayan sıralayamaz (RLS: 0 satır), fotoğraf yazamaz.
select public.gezi_duraklari_sirala('88888888-8888-4888-8888-0000000000d1', array['88888888-8888-4888-8888-0000000000a1', '88888888-8888-4888-8888-0000000000a3']::uuid[]);
select pg_temp.hata_bekle($$insert into public.icerik_fotolari (yol, sahip_tur, sahip_id) values ('geziler/88888888-8888-4888-8888-000000000001/b.jpg', 'gezi', '88888888-8888-4888-8888-000000000001')$$, '42501');
reset role;
do $$ begin assert (select string_agg(ad, '' order by sira) from public.gezi_duraklari where gezi_gun_id = '88888888-8888-4888-8888-0000000000d1') = 'CA', 'admin olmayan sıralayamaz'; end $$;
update public.geziler set yayin_at = now() - interval '1 minute' where slug = 'editor-gezisi';
set role anon;
do $$
begin
  assert (select count(*) from public.geziler where slug = 'editor-gezisi') = 1, 'zamanı gelen gezi görünür';
  assert (select count(*) from public.gezi_duraklari where gezi_gun_id = '88888888-8888-4888-8888-0000000000d1') = 2, 'durakları görünür';
end $$;
reset role;

-- ---------------------------------------------------------------- #108: yer editörü (rehber kaydı, öne çıkan sırası, place_id)
reset role;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
insert into public.yerler (id, sehir_id, ad, place_id, kategori, lat, lng) values
  ('99999999-9999-4999-8999-000000000001', '11111111-1111-4111-8111-000000000001', 'Editör Yeri', 'ChIJabcdefgh12345', 'park', 39.7, 30.5);
update public.yerler set rehber_md = '## Ne zaman gidilir' || chr(10) || chr(10) || 'Sabah sakin.', ses_url = null where id = '99999999-9999-4999-8999-000000000001';
-- Öne çıkan sırası şehir içinde tekil; 0 ve negatif olmaz; başka şehirde aynı sıra serbest.
select pg_temp.hata_bekle($$update public.yerler set one_cikan_sira = 1 where id = '99999999-9999-4999-8999-000000000001'$$, '23505');
select pg_temp.hata_bekle($$update public.yerler set one_cikan_sira = 0 where id = '99999999-9999-4999-8999-000000000001'$$, '23514');
update public.yerler set one_cikan_sira = 99 where id = '99999999-9999-4999-8999-000000000001';
-- Tek deyimde iki yerin sırası takas edilebilir (ertelenebilir kısıt).
update public.yerler set one_cikan_sira = case one_cikan_sira when 1 then 2 else 1 end
  where sehir_id = '11111111-1111-4111-8111-000000000001' and one_cikan_sira in (1, 2);
do $$ begin assert (select one_cikan_sira from public.yerler where ad = 'Odunpazarı Evleri') = 2, 'öne çıkan sırası takas edilir'; end $$;
-- place_id biçimi.
select pg_temp.hata_bekle($$update public.yerler set place_id = 'kisa' where id = '99999999-9999-4999-8999-000000000001'$$, '23514');
select pg_temp.hata_bekle($$update public.yerler set place_id = 'ChIJ abc def ghi' where id = '99999999-9999-4999-8999-000000000001'$$, '23514');
-- Taslak yerin rehberi görünmez; yayınlanınca herkes okur; admin olmayan yazamaz.
select pg_temp.as_email(:B, 'b@ornek.com');
do $$ begin assert (select count(*) from public.yerler where id = '99999999-9999-4999-8999-000000000001') = 0, 'taslak yerin rehberi görünmez'; end $$;
update public.yerler set rehber_md = 'sabote' where id = '99999999-9999-4999-8999-000000000001';
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
update public.yerler set yayin = true where id = '99999999-9999-4999-8999-000000000001';
set role anon;
do $$
begin
  assert (select rehber_md from public.yerler where id = '99999999-9999-4999-8999-000000000001') like '## Ne zaman gidilir%', 'yayınlı yerin rehberi herkese okunur; admin olmayan yazamadı';
end $$;
reset role;

-- ---------------------------------------------------------------- #109: ana sayfa düzeni (taslak, yayın, görünen)
reset role;
-- Seed + ilk yayın: üç bölüm, mozaik kapalı (#132); taslak tablo anon'a kapalı, admin olmayana boş.
set role anon;
do $$
begin
  assert (select string_agg(tur, ',' order by sira) from public.ana_sayfa_gorunen) = 'tek_kart,serit', 'seed bölümleri sırayla görünür; mozaik yok (#132)';
  assert not exists (select 1 from public.ana_sayfa_gorunen where tur = 'mozaik'), '#132: anon ana_sayfa_gorunen''de mozaik görmez';
  assert (select count(*) from public.ana_sayfa_yayini) >= 1 and (select bolumler from public.ana_sayfa_yayini order by id desc limit 1) is not null, 'anon son yayını okur (izinli sütunlar)';
  assert (select icerik ->> 'gezi_id' from public.ana_sayfa_gorunen where tur = 'tek_kart') is not null, 'otomatik öne çıkan gezi çözülür';
end $$;
select pg_temp.hata_bekle($$select count(*) from public.ana_sayfa_bolumleri$$, '42501');
select pg_temp.hata_bekle($$select public.ana_sayfa_yayinla()$$, '42501');
-- #132 KK1: yayınlayanın e-postası sütun izniyle kapalı.
select pg_temp.hata_bekle($$select yayinlayan from public.ana_sayfa_yayini$$, '42501');
select pg_temp.hata_bekle($$select * from public.ana_sayfa_yayini$$, '42501');
set role authenticated;
select pg_temp.as_email(:B, 'b@ornek.com');
select pg_temp.hata_bekle($$select yayinlayan from public.ana_sayfa_yayini$$, '42501');
do $$ begin assert (select count(*) from public.ana_sayfa_bolumleri) = 0, 'admin olmayan taslağı görmez'; end $$;
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira) values ('serit', 'x', 9)$$, '42501');
select pg_temp.hata_bekle($$select public.ana_sayfa_yayinla()$$, '42501');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_yayini (bolumler) values ('[]')$$, '42501');
-- En çok alınan: B'nin aldığı editör gezisi öne çıkar.
insert into public.olaylar (tur, hedef_id) values ('gezi_alindi', '88888888-8888-4888-8888-000000000001'), ('gezi_alindi', '88888888-8888-4888-8888-000000000001');
do $$ begin assert public.ana_sayfa_en_cok_alinan() = '88888888-8888-4888-8888-000000000001', 'son 30 günde en çok alınan gezi'; end $$;

-- Admin: kapalı bölüm, gelecekte başlayan bölüm, şu an açık planlı bölüm; sıra çakışması; tek deyimde yer değiştirme.
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
insert into public.ana_sayfa_bolumleri (tur, baslik, sira, acik) values ('serit', 'Kapalı', 4, false);
insert into public.ana_sayfa_bolumleri (tur, baslik, sira, baslangic_at, bitis_at) values ('serit', 'Gelecek', 5, now() + interval '1 day', now() + interval '20 day');
insert into public.ana_sayfa_bolumleri (tur, baslik, sira, baslangic_at, bitis_at, icerik) values ('sehir_seckisi', 'Şimdi', 6, now() - interval '1 hour', now() + interval '1 day', '{"sehir_idler": []}');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira) values ('serit', 'Çakışan', 1)$$, '23505');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, baslangic_at, bitis_at) values ('serit', 'Ters', 7, now(), now() - interval '1 day')$$, '23514');
update public.ana_sayfa_bolumleri set sira = case sira when 1 then 2 else 1 end where sira in (1, 2);
-- Yayınlanmadan uygulama eski düzeni görür.
set role anon;
do $$ begin assert (select string_agg(baslik, ',' order by sira) from public.ana_sayfa_gorunen) = 'Öne çıkan gezi,Önerilen geziler', 'yayın öncesi eski düzen'; end $$;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert public.ana_sayfa_yayinla() is not null, 'admin yayınlar'; end $$;
set role anon;
do $$
begin
  assert (select string_agg(baslik, ',' order by sira) from public.ana_sayfa_gorunen) = 'Önerilen geziler,Öne çıkan gezi,Şimdi', 'yayından sonra: yeni sıra; kapalı (mozaik dahil) ve zamanı gelmemiş bölüm yok';
end $$;
reset role;

-- ---------------------------------------------------------------- #110: genel bakış (sayaç, ayarlar, özet)
reset role;
-- Sayaç yalnız service_role ile artar; aynı gün aynı işlev birikir.
set role service_role;
select public.api_sayac_artir('places-nearby', 1, 1);
select public.api_sayac_artir('places-nearby', 2, 0);
select public.api_sayac_artir('places-full', 1, 1);
reset role;
do $$
begin
  assert (select cagri from public.api_sayac where fonksiyon = 'places-nearby') = 3, 'çağrılar birikir';
  assert (select google from public.api_sayac where fonksiyon = 'places-nearby') = 1, 'Google istekleri ayrı sayılır';
end $$;
set role authenticated;
select pg_temp.as_email(:B, 'b@ornek.com');
select pg_temp.hata_bekle($$select public.api_sayac_artir('places-full', 1, 1)$$, '42501');
select pg_temp.hata_bekle($$select public.yonetim_ozet(30)$$, '42501');
do $$
begin
  assert (select count(*) from public.api_sayac) = 0, 'admin olmayan sayacı görmez';
  assert (select count(*) from public.yonetim_ayarlari) = 0, 'admin olmayan ayarları görmez';
end $$;
-- Davet olayları uygulamadan yazılabilir (kendi adına).
insert into public.olaylar (tur, hedef_id) values ('davet_paylasildi', null);
reset role;
-- Linkle katılım: sahip olmayan bir üye (önceki bölümlerdeki üyeliklerden bağımsız).
insert into public.members (trip_id, user_id, display_name)
  select id, :X, 'Katılan' from public.trips order by created_at limit 1
  on conflict (trip_id, user_id) do update set role = 'member', joined_at = now();
select set_config('test.kullanici', (select count(*) from auth.users where not coalesce(is_anonymous, false))::text, false),
  set_config('test.seyahat', (select count(*) from public.trips)::text, false),
  set_config('test.katilim', (select count(*) from public.members where role <> 'owner')::text, false);
set role anon;
select pg_temp.hata_bekle($$select public.yonetim_ozet(30)$$, '42501');
select pg_temp.hata_bekle($$select count(*) from public.yonetim_ayarlari$$, '42501');
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
select pg_temp.hata_bekle($$select public.yonetim_ozet(0)$$, '22023');
do $$
declare o jsonb := public.yonetim_ozet(30);
begin
  assert (o #>> '{kullanici,toplam}')::int = current_setting('test.kullanici')::int, 'kullanıcı: anonimler hariç';
  assert (o #>> '{seyahat,toplam}')::int = current_setting('test.seyahat')::int, 'seyahat toplamı';
  assert (o #>> '{gezi_alindi,toplam}')::int = 2, 'aralıktaki gezi alma (#109 testindeki 2 olay)';
  assert (o #>> '{gezi_alindi,mekan}')::int = 2, 'meta durak yok → yalnız mekan';
  assert (o #>> '{paylasim,paylasildi}')::int = 1, 'davet paylaşımı';
  assert (o #>> '{paylasim,olay_var}')::boolean, 'davet olayı var';
  assert jsonb_array_length(o -> 'en_cok_alinan') <= 4, 'tablo en çok 4 satır (kanvas)';
  assert (o #>> '{paylasim,katilim}')::int = current_setting('test.katilim')::int and current_setting('test.katilim')::int >= 1, 'linkle katılım (sahip hariç üye)';
  assert (o #>> '{google,ay}')::int = 2, 'bu ayki Google istekleri';
  assert (o #>> '{google,butce}')::int = 25000, 'bütçe ayarı';
  assert jsonb_array_length(o -> 'haftalik') = 12, '12 haftalık seri';
  assert (o -> 'en_cok_alinan' -> 0 ->> 'id') = '88888888-8888-4888-8888-000000000001', 'en çok alınan gezi ilk sırada';
  assert (o -> 'en_cok_alinan' -> 0 ->> 'alindi')::int = 2, 'alındı sayısı';
  assert (o #>> '{bugun,kesfet}')::int = 3 and (o #>> '{bugun,mekan_paneli}')::int = 1 and (o #>> '{bugun,yorum}')::int = 0, 'günün özeti çağrı sayıları';
end $$;
update public.yonetim_ayarlari set deger = '30000' where anahtar = 'google_aylik_butce';
do $$ begin assert (public.yonetim_ozet(7) #>> '{google,butce}')::int = 30000, 'admin bütçeyi değiştirir'; end $$;
reset role;

-- ---------------------------------------------------------------- #111: şehir editörü, mekan bağlama, kullanıcı yönetimi
reset role;
\set Z '''aaaaaaaa-1111-0000-0000-000000000011'''
\set K '''aaaaaaaa-1111-0000-0000-000000000012'''
insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  (:Z, 'zeynep@ornek.com', now(), now() - interval '2 days'),
  (:K, 'kaan@ornek.com', now(), null);
insert into public.profiles (id, name, username) values (:Z, 'Zeynep', 'zeynep'), (:K, 'Kaan', 'kaan');
-- Z'nin iki seyahati: biri K ile ortak (K'ye devredilir), biri yalnız (silinir); Z, K'nin seyahatinde üye.
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date) values
  ('dddddddd-1111-4111-8111-000000000001', :Z, 'ChIJ-roma', 'Roma', 41.9, 12.5, 'Europe/Rome', '2026-12-01', '2026-12-02'),
  ('dddddddd-1111-4111-8111-000000000002', :Z, 'ChIJ-oslo', 'Oslo', 59.9, 10.7, 'Europe/Oslo', '2026-12-01', '2026-12-01'),
  ('dddddddd-1111-4111-8111-000000000003', :K, 'ChIJ-lyon', 'Lyon', 45.7, 4.8, 'Europe/Paris', '2026-12-01', '2026-12-01');
insert into public.members (trip_id, user_id, display_name) values
  ('dddddddd-1111-4111-8111-000000000001', :K, 'Kaan'),
  ('dddddddd-1111-4111-8111-000000000003', :Z, 'Zeynep');

-- Kullanıcı listesi ve hesap silme yalnız admin.
set role authenticated;
select pg_temp.as_email(:B, 'b@ornek.com');
select pg_temp.hata_bekle($$select * from public.yonetim_kullanicilar()$$, '42501');
select pg_temp.hata_bekle($$select public.yonetim_hesap_sil('aaaaaaaa-1111-0000-0000-000000000011')$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_mekanlari_yaz('rehber', gen_random_uuid(), '[]')$$, '42501');
set role anon;
select pg_temp.hata_bekle($$select * from public.yonetim_kullanicilar()$$, '42501');
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$
declare z record;
begin
  select * into z from public.yonetim_kullanicilar('zeyn');
  assert z.ad = 'Zeynep' and z.eposta = 'zeynep@ornek.com' and z.seyahat_sayisi = 3 and not z.admin and z.son_gorulme is not null, 'arama: ad, e-posta, seyahat sayısı, son görülme';
  assert (select count(*) from public.yonetim_kullanicilar('ornek.com')) >= 3, 'e-postayla arama';
  assert (select admin from public.yonetim_kullanicilar('ozcinar') where id = 'eceeceec-0000-0000-0000-000000000005'), 'admin işareti';
  assert not exists (select 1 from public.yonetim_kullanicilar() where id = '99999999-0000-0000-0000-000000000003'), 'anonim hesap listede yok';
end $$;
-- Admin kendini ve başka admini silemez; son admin kaldırılamaz.
select pg_temp.hata_bekle($$select public.yonetim_hesap_sil('eceeceec-0000-0000-0000-000000000005')$$, '42501');
insert into public.admin_kullanicilar (email) values ('kaan@ornek.com');
select pg_temp.hata_bekle($$select public.yonetim_hesap_sil('aaaaaaaa-1111-0000-0000-000000000012')$$, '42501');
delete from public.admin_kullanicilar where email = 'kaan@ornek.com';
select pg_temp.hata_bekle($$delete from public.admin_kullanicilar$$, '23514');

-- KK4 hesap silme kaskadı: ortak seyahat K'ye devredilir, yalnız seyahat silinir, üyelikler temizlenir.
select public.yonetim_hesap_sil(:Z);
reset role;
do $$
begin
  assert not exists (select 1 from auth.users where id = 'aaaaaaaa-1111-0000-0000-000000000011'), 'auth kaydı silindi';
  assert not exists (select 1 from public.profiles where id = 'aaaaaaaa-1111-0000-0000-000000000011'), 'profil cascade';
  assert not exists (select 1 from public.members where user_id = 'aaaaaaaa-1111-0000-0000-000000000011'), 'tüm üyelikler temizlendi';
  assert (select owner_id from public.trips where id = 'dddddddd-1111-4111-8111-000000000001') = 'aaaaaaaa-1111-0000-0000-000000000012', 'ortak seyahat K''ye devredildi';
  assert (select role from public.members where trip_id = 'dddddddd-1111-4111-8111-000000000001' and user_id = 'aaaaaaaa-1111-0000-0000-000000000012') = 'owner', 'K sahip rolünde';
  assert not exists (select 1 from public.trips where id = 'dddddddd-1111-4111-8111-000000000002'), 'tek kişilik seyahat silindi';
  assert (select count(*) from public.members where trip_id = 'dddddddd-1111-4111-8111-000000000003') = 1, 'K''nin seyahatinden Z çıktı';
  assert exists (select 1 from public.changes where trip_id = 'dddddddd-1111-4111-8111-000000000001' and field = 'ownership_transferred'), 'devir akışa yazıldı';
end $$;

-- KK4 şehir rehberi sorgusu: admin yayınsız şehrin rehberini düzenler; uygulama yalnız yayınlı şehri okur; sıra tek deyimde.
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
update public.sehir_rehberi set sira = case sira when 1 then 2 when 2 then 1 else sira end where sehir_id = '11111111-1111-4111-8111-000000000001';
select pg_temp.hata_bekle($$update public.sehir_rehberi set sira = 1 where sehir_id = '11111111-1111-4111-8111-000000000001' and bolum = 'ipucu'$$, '23505');
insert into public.sehir_rehberi (sehir_id, bolum, baslik, sira) values ('11111111-1111-4111-8111-000000000099', 'ulasim', 'Gizli ulaşım', 2);
update public.sehirler set genis_kapak_url = 'sehirler/x.webp' where slug = 'eskisehir';
-- Mekan bağlama: rehber bölümüne kart + satır; bilinmeyen place_id taslak yer olarak açılır, bilinen tekrar açılmaz.
do $$
declare
  r uuid := (select id from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001' and bolum = 'yemek');
  acilan integer;
begin
  acilan := public.icerik_mekanlari_yaz('rehber', r, '[
    {"place_id": "ChIJ-hayri-usta-0001", "bicim": "kart", "ad": "Hayri Usta Çibörek", "kategori": "restaurant", "lat": 39.76, "lng": 30.52},
    {"place_id": "ChIJ-met-helva-00002", "bicim": "satir", "ad": "Met Helvacısı", "kategori": "store", "lat": 39.77, "lng": 30.51},
    {"place_id": "ChIJ-hayri-usta-0001", "bicim": "satir", "ad": "Hayri Usta", "lat": 39.76, "lng": 30.52}
  ]');
  assert acilan = 2, 'iki yeni taslak yer';
  assert (select count(*) from public.icerik_mekanlari where sahip_id = r) = 3, 'üç bağlantı (sıra korunur)';
  assert (select bicim from public.icerik_mekanlari where sahip_id = r and sira = 1) = 'kart', 'ilk bağlantı kart';
  assert (select ad from public.yerler where place_id = 'ChIJ-hayri-usta-0001') = 'Hayri Usta Çibörek', 'ad editörün metni';
  assert not (select yayin from public.yerler where place_id = 'ChIJ-met-helva-00002'), 'açılan yer taslak';
  assert (select sehir_id from public.yerler where place_id = 'ChIJ-met-helva-00002') = '11111111-1111-4111-8111-000000000001', 'yer rehberin şehrinde';
  acilan := public.icerik_mekanlari_yaz('rehber', r, '[{"place_id": "ChIJ-met-helva-00002", "bicim": "kart", "ad": "Met", "lat": 39.77, "lng": 30.51}]');
  assert acilan = 0, 'var olan yer yeniden açılmaz';
  assert (select count(*) from public.icerik_mekanlari where sahip_id = r) = 1, 'liste tümüyle değişir';
end $$;
select pg_temp.hata_bekle($$select public.icerik_mekanlari_yaz('rehber', gen_random_uuid(), '[]')$$, '23503');
-- Şehir fotoğrafı satırı: yol şehrin klasöründe olmalı.
insert into public.icerik_fotolari (yol, sahip_tur, sahip_id, altyazi, kaynak, genislik, yukseklik)
  values ('sehirler/11111111-1111-4111-8111-000000000001/a.webp', 'sehir', '11111111-1111-4111-8111-000000000001', 'Odunpazarı', 'kendi', 2400, 1600);
select pg_temp.hata_bekle($$insert into public.icerik_fotolari (yol, sahip_tur, sahip_id) values ('yerler/11111111-1111-4111-8111-000000000001/b.webp', 'sehir', '11111111-1111-4111-8111-000000000001')$$, '23514');
set role anon;
do $$
begin
  assert (select count(*) from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000099') = 0, 'yayınsız şehrin rehberi uygulamada yok';
  assert (select string_agg(bolum, ',' order by sira) from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001') = 'yemek,ulasim,mahalle,ipucu', 'uygulama yeni sırayla okur';
  assert (select genis_kapak_url from public.sehirler where slug = 'eskisehir') = 'sehirler/x.webp', 'geniş kapak okunur';
  assert (select count(*) from public.icerik_mekanlari) = 1, 'mekan bağlantıları herkese açık';
  assert not exists (select 1 from public.yerler where place_id = 'ChIJ-met-helva-00002'), 'taslak yer uygulamada yok';
  -- #172 KK7: yayınlı içerikte geçen taslak yer ve yayınlı yer adıyla okunur; artık hiçbir yazıda geçmeyen taslak yer okunmaz.
  assert (select string_agg(place_id || '=' || ad || '/' || coalesce(kategori, '-'), ',' order by place_id collate "C")
          from public.icerik_mekan_bilgileri(array['ChIJ-met-helva-00002', 'ChIJ-hayri-usta-0001', 'ChIJabcdefgh12345', 'ChIJ-yok-0000000001']))
    = 'ChIJ-met-helva-00002=Met Helvacısı/store,ChIJabcdefgh12345=Editör Yeri/park', 'içerik mekan bilgileri: rehberdeki taslak yer + yayınlı yer';
end $$;
select pg_temp.hata_bekle($$insert into public.icerik_mekanlari (sahip_tur, sahip_id, place_id, bicim, sira) values ('rehber', gen_random_uuid(), 'ChIJ-xxxxxxxxxx', 'kart', 1)$$, '42501');
reset role;

-- #137 Davetle katılma: özet anon'a açık; katılım oturum ister; token geçersizse P0002; zaten üye yeniden yazılmaz;
-- web'den katılan ilk uygulama açılışında karşılanır, damga bir kez yazılır. Kendi seyahatiyle (önceki bölümlerden bağımsız).
reset role;
\set DV '''aaaaaaaa-2222-0000-0000-000000000022'''
\set WG '''aaaaaaaa-2222-0000-0000-000000000021'''
insert into auth.users (id, is_anonymous) values (:DV, false);
insert into auth.users (id, is_anonymous, raw_user_meta_data) values (:WG, false, '{"full_name": "Web Gezgini"}');
insert into public.profiles (id, name, username, photo_url) values (:DV, 'Davetçi', 'davetci', 'https://ornek/davetci.jpg');
set role authenticated;
select pg_temp.as_user(:DV);
insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date, name)
values (:DV, 'ChIJ-izmir', 'İzmir', 38.42, 27.14, 'Europe/Istanbul', '2027-05-01', '2027-05-04', 'İzmir Gezisi');
reset role;
select set_config('test.davet_token', (select invite_token from public.trips where city_place_id = 'ChIJ-izmir'), false);
set role anon;
select pg_temp.as_user(null);
do $$
declare o jsonb := public.davet_ozeti(current_setting('test.davet_token'));
begin
  assert (o ->> 'city_label') = 'İzmir' and (o ->> 'name') = 'İzmir Gezisi', 'anon özeti okur: ' || coalesce(o::text, 'null');
  assert jsonb_array_length(o -> 'gunler') = 4 and (o ->> 'day_count') = '4', 'gün listesi 4';
  assert (o ->> 'inviter_name') = 'Davetçi', 'davet eden sahip';
  assert (o ->> 'inviter_photo') = 'https://ornek/davetci.jpg', 'davet edenin fotoğrafı';
  assert (o ->> 'uye') = 'false', 'anon üye değil';
  assert public.davet_ozeti('yokyokyo') is null, 'bilinmeyen token null';
end $$;
select pg_temp.hata_bekle($$select public.davetle_katil(current_setting('test.davet_token'), 'web')$$, '42501');
set role authenticated;
select pg_temp.as_user(:WG);
select pg_temp.hata_bekle($$select public.davetle_katil('yokyokyo', 'web')$$, 'P0002');
select pg_temp.hata_bekle($$select public.davetle_katil(current_setting('test.davet_token'), 'sms')$$, '22023');
do $$
declare k jsonb; o jsonb;
begin
  k := public.davetle_katil(current_setting('test.davet_token'), 'web');
  assert (k ->> 'zaten_uye') = 'false', 'ilk katılım';
  assert (k ->> 'inviter_name') = 'Davetçi' and (k ->> 'day_count') = '4', 'katılım özeti';
  assert (select display_name from public.members where user_id = auth.uid()) = 'Web Gezgini', 'profil yoksa sağlayıcı adı';
  assert (select joined_via from public.members where user_id = auth.uid()) = 'web', 'kanal web';
  assert (select landed_at from public.members where user_id = auth.uid()) is null, 'web katılımı henüz karşılanmadı';
  k := public.davetle_katil(current_setting('test.davet_token'), 'app');
  assert (k ->> 'zaten_uye') = 'true', 'ikinci çağrı zaten üye';
  assert (select count(*) from public.members where user_id = auth.uid()) = 1, 'üyelik bir kez yazılır';
  assert (select count(*) from public.trips) = 1, 'katılan seyahati görür';
  o := public.davet_ozeti(current_setting('test.davet_token'));
  assert (o ->> 'uye') = 'true' and (o ->> 'member_count') = '2', 'özet üyeyi bilir';
  assert (public.davet_karsilama() ->> 'city_label') = 'İzmir', 'uygulama ilk açılışta karşılar';
  perform public.davet_karsilandi((public.davet_karsilama() ->> 'trip_id')::uuid);
  assert public.davet_karsilama() is null, 'damga sonrası karşılama yok';
  assert (select landed_at from public.members where user_id = auth.uid()) is not null, 'landed_at yazıldı';
  insert into public.olaylar (tur, hedef_id, meta) values ('davet_katildi', (k ->> 'trip_id')::uuid, '{"kanal": "web"}');
  -- KK5: profil adı değişince arkadaşların gördüğü ad (üyelik) da değişir.
  insert into public.profiles (id, name, username) values (auth.uid(), 'Webci', 'webci');
  assert (select display_name from public.members where user_id = auth.uid()) = 'Webci', 'profil oluşunca üyelik adı';
  update public.profiles set name = 'Web Gezgini Ece' where id = auth.uid();
  assert (select display_name from public.members where user_id = auth.uid()) = 'Web Gezgini Ece', 'profil adı üyeliğe yazılır';
  -- Üye kendisi ayrılır (RLS: role = member).
  delete from public.members where user_id = auth.uid();
  assert (select count(*) from public.trips) = 0, 'ayrılan seyahati görmez';
end $$;
-- KK8: link yenilenince eski token geçersiz — özet null, katılım P0002.
select pg_temp.as_user(:DV);
select set_config('test.eski_token', current_setting('test.davet_token'), false);
select public.rotate_invite_token((select id from public.trips where city_place_id = 'ChIJ-izmir'));
select pg_temp.as_user(:WG);
do $$ begin assert public.davet_ozeti(current_setting('test.eski_token')) is null, 'eski token özeti yok'; end $$;
select pg_temp.hata_bekle($$select public.davetle_katil(current_setting('test.eski_token'), 'app')$$, 'P0002');
-- Oturumsuz (anon rolü) yalnız özeti okur.
set role anon;
select pg_temp.hata_bekle($$select public.davet_karsilama()$$, '42501');
select pg_temp.hata_bekle($$select public.davet_karsilandi(gen_random_uuid())$$, '42501');
set role authenticated;
select pg_temp.as_user(:WG);
select pg_temp.hata_bekle($$insert into public.olaylar (tur) values ('davet_bilinmeyen')$$, '23514');
-- #139 sihirbaz olayları.
insert into public.olaylar (tur, meta) values ('sihirbaz_bitti', null), ('plan_kuruldu', '{"mekan": 5, "gun": 2, "sure_sn": 140}');
reset role;

-- #138 Otomatik profil: ad/foto sağlayıcıdan, kullanıcı adı addan (alınmışsa sayı), Apple gizli ad → Gezgin; misafir alamaz; bir kez.
reset role;
\set P1 '''aaaaaaaa-3333-0000-0000-000000000031'''
\set P2 '''aaaaaaaa-3333-0000-0000-000000000032'''
\set P3 '''aaaaaaaa-3333-0000-0000-000000000033'''
\set P4 '''aaaaaaaa-3333-0000-0000-000000000034'''
insert into auth.users (id, is_anonymous, raw_user_meta_data) values
  (:P1, false, '{"full_name": "Zehra Özçınar", "picture": "https://ornek/z.jpg"}'),
  (:P2, false, '{"name": "Zehra  Özçınar"}'),
  (:P3, false, null),
  (:P4, true, null);
do $$
begin
  assert public.kullanici_adi_taban('İlkay Çağrı Şen') = 'ilkay.cagri.sen', 'Türkçe sadeleşir';
  assert public.kullanici_adi_taban('Al') = 'gezgin', 'kısa ad → gezgin';
  assert public.kullanici_adi_taban('!!') = 'gezgin', 'harfsiz → gezgin';
  assert length(public.kullanici_adi_taban('Çok Uzun Bir Ad Soyad Daha Uzun')) <= 20, 'en çok 20';
end $$;
set role authenticated;
select pg_temp.as_user(:P1);
do $$
declare p public.profiles;
begin
  p := public.profil_hazirla();
  assert p.name = 'Zehra Özçınar' and p.username = 'zehra.ozcinar', 'ad ve kullanıcı adı: ' || p.username;
  assert p.photo_url = 'https://ornek/z.jpg' and p.map_visibility = 'friends', 'foto ve varsayılan gizlilik';
  assert p.onboarding_done_at is not null, 'karşılama damgası';
  assert (public.profil_hazirla()).username = 'zehra.ozcinar', 'ikinci çağrı aynı profili döndürür';
end $$;
select pg_temp.as_user(:P2);
do $$ begin assert (public.profil_hazirla()).username ~ '^zehra\.ozcinar[0-9]{4}$', 'alınmış → rastgele 4 haneli ek'; end $$;
select pg_temp.as_user(:P3);
do $$
declare p public.profiles := public.profil_hazirla();
begin
  assert p.name = 'Gezgin' and p.username = 'gezgin', 'ad yok → Gezgin: ' || p.username;
  -- Apple adı sonradan gelir: kendiliğinden oluşan Gezgin profili ad ve kullanıcı adıyla düzelir.
  p := public.profil_hazirla('Ayşe Kaya');
  assert p.name = 'Ayşe Kaya' and p.username = 'ayse.kaya', 'Apple adı profili düzeltir: ' || p.username;
  p := public.profil_hazirla('Başka Ad');
  assert p.name = 'Ayşe Kaya', 'gerçek adı olan profil değişmez';
end $$;
-- Tavan yok: "gezgin" ve sayılı ekleri dolu olsa da yeni profil oluşur.
reset role;
insert into auth.users (id, is_anonymous) select ('aaaaaaaa-3333-0000-0000-' || lpad(g::text, 12, '0'))::uuid, false from generate_series(100, 140) g;
insert into public.profiles (id, name, username) select ('aaaaaaaa-3333-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Gezgin', case when g = 100 then 'gezgin' else 'gezgin' || g end from generate_series(100, 139) g;
set role authenticated;
select pg_temp.as_user('aaaaaaaa-3333-0000-0000-000000000140');
do $$
declare p public.profiles := public.profil_hazirla();
begin
  assert p.username ~ '^gezgin[0-9]{4}$', 'dolu tabanda rastgele ek: ' || p.username;
end $$;
select pg_temp.as_user(:P4, true);
select pg_temp.hata_bekle($$select public.profil_hazirla()$$, '42501');
reset role;


-- #140 Program: kalış süresi 15'in katı olmak zorunda değil; biten seyahatin varışları ve "vardı" kayıtları temizlenir
-- (yalnız üye; gelecek seyahat dokunulmaz). Kendi seyahatleriyle.
\set VT '''aaaaaaaa-2222-0000-0000-000000000031'''
\set YB '''aaaaaaaa-2222-0000-0000-000000000032'''
insert into auth.users (id, is_anonymous) values (:VT, false), (:YB, false);
set role authenticated;
select pg_temp.as_user(:VT);
do $$
declare bitti uuid; gelecek uuid; g uuid; p uuid;
begin
  insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date, name)
  values (auth.uid(), 'ChIJ-varis-1', 'Bursa', 40.18, 29.06, 'Europe/Istanbul', current_date - 10, current_date - 8, 'Biten') returning id into bitti;
  insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date, name)
  values (auth.uid(), 'ChIJ-varis-2', 'Bursa', 40.18, 29.06, 'Europe/Istanbul', current_date + 5, current_date + 7, 'Gelecek') returning id into gelecek;
  select id into g from public.days where trip_id = bitti and index = 1;
  insert into public.places (trip_id, place_id, lat, lng, added_by) values (bitti, 'ChIJ-varis-yer1', 40.18, 29.06, auth.uid()) returning id into p;
  insert into public.stops (trip_id, day_id, place_ref, order_key, minutes, arrived_at, arrived_by) values (bitti, g, p, 'a0', 85, now() - interval '9 days', auth.uid());
  select id into g from public.days where trip_id = gelecek and index = 1;
  insert into public.places (trip_id, place_id, lat, lng, added_by) values (gelecek, 'ChIJ-varis-yer2', 40.18, 29.06, auth.uid()) returning id into p;
  insert into public.stops (trip_id, day_id, place_ref, order_key, minutes, arrived_at, arrived_by) values (gelecek, g, p, 'a0', 45, now(), auth.uid());
  perform set_config('test.varis_bitti', bitti::text, false);
  perform set_config('test.varis_gelecek', gelecek::text, false);
  assert (select minutes from public.stops where trip_id = bitti) = 85, 'kalış 85 dk yazılır (15 katı değil)';
end $$;
select pg_temp.hata_bekle($$update public.stops set minutes = 10 where trip_id = current_setting('test.varis_bitti')::uuid$$, '23514');
select pg_temp.as_user(:YB);
select pg_temp.hata_bekle($$select public.gecmis_varislari_temizle(current_setting('test.varis_bitti')::uuid)$$, '42501');
select pg_temp.as_user(:VT);
do $$
begin
  assert public.gecmis_varislari_temizle(current_setting('test.varis_bitti')::uuid) = 1, 'biten seyahatte bir varış silinir';
  assert (select arrived_at from public.stops where trip_id = current_setting('test.varis_bitti')::uuid) is null, 'varış anı silindi';
  assert (select arrived_by from public.stops where trip_id = current_setting('test.varis_bitti')::uuid) is null, 'varan silindi';
  assert not exists (select 1 from public.changes where trip_id = current_setting('test.varis_bitti')::uuid and field in ('arrived_at', 'arrived_by')), '"vardı" kayıtları silindi';
  assert public.gecmis_varislari_temizle(current_setting('test.varis_gelecek')::uuid) = 0, 'gelecek seyahat dokunulmaz';
  assert (select arrived_at from public.stops where trip_id = current_setting('test.varis_gelecek')::uuid) is not null, 'gelecek varış durur';
end $$;
-- Parametresiz çağrı yalnız zamanlayıcıya (oturumsuz): oturumlu kullanıcı tüm seyahatleri taratamaz.
select pg_temp.hata_bekle($$select public.gecmis_varislari_temizle()$$, '42501');
-- trips.tz yalnız geçerli IANA adı; geçersiz değer yazılamaz.
select pg_temp.hata_bekle($$update public.trips set tz = 'Mars/Olympus' where id = current_setting('test.varis_gelecek')::uuid$$, '22023');
reset role;
select pg_temp.as_user(null);
do $$ begin assert public.gecmis_varislari_temizle() >= 0, 'oturumsuz (cron) çağrı çalışır'; end $$;


-- #141 oylar (tekil, yalnız üye, yalnız kendi adına) ve değişiklik geri alma (taşıma, mekan silme + bağlı durak, ekleme).
\set OA '''aaaaaaaa-2222-0000-0000-000000000041'''
\set OB '''aaaaaaaa-2222-0000-0000-000000000042'''
\set OC '''aaaaaaaa-2222-0000-0000-000000000043'''
insert into auth.users (id, is_anonymous) values (:OA, false), (:OB, false), (:OC, false);
insert into public.profiles (id, name, username) values (:OB, 'Oycu', 'oycu');
set role authenticated;
select pg_temp.as_user(:OA);
do $$
declare s uuid; g1 uuid; g2 uuid; p uuid; st uuid;
begin
  insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date, name)
  values (auth.uid(), 'ChIJ-oy', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul', '2027-06-01', '2027-06-03', 'Oy Gezisi') returning id into s;
  select id into g1 from public.days where trip_id = s and index = 1;
  select id into g2 from public.days where trip_id = s and index = 2;
  insert into public.places (trip_id, place_id, lat, lng, added_by) values (s, 'ChIJ-oy-yer1', 39.77, 30.52, auth.uid()) returning id into p;
  insert into public.stops (trip_id, day_id, place_ref, order_key, minutes) values (s, g1, p, 'a0', 60) returning id into st;
  perform set_config('test.oy_s', s::text, false);
  perform set_config('test.oy_g1', g1::text, false);
  perform set_config('test.oy_g2', g2::text, false);
  perform set_config('test.oy_p', p::text, false);
  perform set_config('test.oy_st', st::text, false);
end $$;
reset role;
select set_config('test.oy_token', (select invite_token from public.trips where id = current_setting('test.oy_s')::uuid), false);
set role authenticated;
select pg_temp.as_user(:OB);
select public.davetle_katil(current_setting('test.oy_token'), 'app');
insert into public.oylar (seyahat_id, mekan) values (current_setting('test.oy_s')::uuid, current_setting('test.oy_p')::uuid);
select pg_temp.hata_bekle($$insert into public.oylar (seyahat_id, mekan) values (current_setting('test.oy_s')::uuid, current_setting('test.oy_p')::uuid)$$, '23505');
select pg_temp.hata_bekle($$insert into public.oylar (seyahat_id, mekan, kullanici) values (current_setting('test.oy_s')::uuid, current_setting('test.oy_p')::uuid, 'aaaaaaaa-2222-0000-0000-000000000041')$$, '42501');
-- Taşıma: gün + sıra birlikte eski haline.
update public.stops set day_id = current_setting('test.oy_g2')::uuid, order_key = 'b0' where id = current_setting('test.oy_st')::uuid;
do $$
declare cid bigint;
begin
  select id into cid from public.changes where entity = 'stops' and entity_id = current_setting('test.oy_st') and field = 'day_id' order by id desc limit 1;
  assert cid is not null, 'taşıma kaydı var';
  perform set_config('test.oy_cid', cid::text, false);
  perform public.degisikligi_geri_al(cid);
  assert (select day_id from public.stops where id = current_setting('test.oy_st')::uuid) = current_setting('test.oy_g1')::uuid, 'gün geri döndü';
  assert (select order_key from public.stops where id = current_setting('test.oy_st')::uuid) = 'a0', 'sıra geri döndü';
end $$;
-- Mekan silme (durağı ve oyu da gider) → geri al: mekan ve durak geri gelir (oy gelmez).
delete from public.places where id = current_setting('test.oy_p')::uuid;
do $$
declare cid bigint;
begin
  assert (select count(*) from public.oylar where seyahat_id = current_setting('test.oy_s')::uuid) = 0, 'oy mekanla gitti';
  select id into cid from public.changes where entity = 'places' and entity_id = current_setting('test.oy_p') and new is null order by id desc limit 1;
  perform public.degisikligi_geri_al(cid);
  assert exists (select 1 from public.places where id = current_setting('test.oy_p')::uuid), 'mekan geri geldi';
  assert (select day_id from public.stops where id = current_setting('test.oy_st')::uuid) = current_setting('test.oy_g1')::uuid, 'durağı da geri geldi';
end $$;
-- Ekleme → geri al = sil.
insert into public.places (trip_id, place_id, lat, lng, added_by) values (current_setting('test.oy_s')::uuid, 'ChIJ-oy-yer2', 39.78, 30.51, auth.uid());
do $$
declare cid bigint;
begin
  select id into cid from public.changes where entity = 'places' and old is null and new ->> 'place_id' = 'ChIJ-oy-yer2' order by id desc limit 1;
  perform public.degisikligi_geri_al(cid);
  assert not exists (select 1 from public.places where place_id = 'ChIJ-oy-yer2'), 'eklenen silindi';
end $$;
select pg_temp.hata_bekle($$select public.degisikligi_geri_al(-1)$$, 'P0002');
-- Beyaz liste: varış alanı geri alınmaz.
update public.stops set arrived_at = now() where id = current_setting('test.oy_st')::uuid;
select set_config('test.oy_varis_cid', (select id from public.changes where entity = 'stops' and entity_id = current_setting('test.oy_st') and field = 'arrived_at' order by id desc limit 1)::text, false);
select pg_temp.hata_bekle($$select public.degisikligi_geri_al(current_setting('test.oy_varis_cid')::bigint)$$, '22023');
-- Not kuralı (PRD 3.8 KK3): ekleyen / sahip olmayan üye notu geri alarak da değiştiremez.
select pg_temp.as_user(:OA);
update public.places set note = 'Sabah erken git' where id = current_setting('test.oy_p')::uuid;
select pg_temp.as_user(:OB);
select set_config('test.oy_not_cid', (select id from public.changes where entity = 'places' and entity_id = current_setting('test.oy_p') and field = 'note' order by id desc limit 1)::text, false);
select pg_temp.hata_bekle($$select public.degisikligi_geri_al(current_setting('test.oy_not_cid')::bigint)$$, '42501');
-- Eski kayıtta olmayan NOT NULL sütun (auto_completed) geri yüklemede tablo varsayılanını alır.
delete from public.places where id = current_setting('test.oy_p')::uuid;
reset role;
update public.changes set old = old - 'auto_completed'
where entity = 'stops' and entity_id = current_setting('test.oy_st') and new is null
  and id = (select max(id) from public.changes where entity = 'stops' and entity_id = current_setting('test.oy_st') and new is null);
set role authenticated;
select pg_temp.as_user(:OB);
do $$
declare cid bigint;
begin
  select id into cid from public.changes where entity = 'places' and entity_id = current_setting('test.oy_p') and new is null order by id desc limit 1;
  perform public.degisikligi_geri_al(cid);
  assert (select auto_completed from public.stops where id = current_setting('test.oy_st')::uuid) = false, 'eksik sütun varsayılanla';
end $$;
select pg_temp.as_user(:OC);
select pg_temp.hata_bekle($$select public.degisikligi_geri_al(current_setting('test.oy_cid')::bigint)$$, '42501');
do $$
begin
  assert (select count(*) from public.oylar) = 0, 'üye olmayan oyları görmez';
end $$;
select pg_temp.hata_bekle($$insert into public.oylar (seyahat_id, mekan) values (current_setting('test.oy_s')::uuid, current_setting('test.oy_p')::uuid)$$, '42501');
reset role;


-- #142 KK3: yorum kotası — sınır panel ayarından, kullanım api_sayac'tan; yalnız yönetici okur, service_role işlevi doğrudan.
reset role;
select public.api_sayac_artir('places-reviews', 5, 4);
do $$
declare k jsonb := public.yorum_kotasi();
begin
  assert (k ->> 'kullanilan')::int = 4, 'bugünkü Google yorum isteği: ' || k::text;
  assert (k ->> 'sinir')::int = 300, 'varsayılan sınır 300';
end $$;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert (public.yonetim_yorum_kotasi() ->> 'kullanilan')::int = 4, 'yönetici kotayı okur'; end $$;
select pg_temp.as_email(:B, 'b@ornek.com');
select pg_temp.hata_bekle($$select public.yonetim_yorum_kotasi()$$, '42501');
select pg_temp.hata_bekle($$select public.yorum_kotasi()$$, '42501');
reset role;

-- ---------------------------------------------------------------- #143: gezi alınma sayısı
reset role;
insert into public.olaylar (user_id, tur, hedef_id, meta) values
  ('eeeeeeee-0000-0000-0000-000000000004', 'gezi_alindi', '33333333-3333-4333-8333-000000000001', '{"secenek": "tum"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'gezi_alindi', '33333333-3333-4333-8333-000000000001', '{"secenek": "gunler"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'gezi_alindi', '33333333-3333-4333-8333-000000000001', '{"secenek": "gunler"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'gezi_goruntulendi', '33333333-3333-4333-8333-000000000001', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'gezi_alindi', (select id from public.geziler where slug = 'taslak-gezi'), null);
set role authenticated;
select pg_temp.as_user(:G);
do $$
begin
  assert public.gezi_alinma_sayisi('33333333-3333-4333-8333-000000000001') = 2, 'alınma sayısı kişi başına bir (aynı kişinin iki alımı bir; olaylar kapalı kalır)';
  assert (select count(*) from public.olaylar where tur = 'gezi_alindi') = 0, 'G olay satırlarını görmez';
  assert public.gezi_alinma_sayisi((select gen_random_uuid())) = 0, 'olmayan gezi 0';
end $$;
reset role;
do $$
begin
  assert (select public.gezi_alinma_sayisi(id) from public.geziler where slug = 'taslak-gezi') = 0, 'yayında olmayan gezi 0';
end $$;
set role anon;
do $$ begin assert public.gezi_alinma_sayisi('33333333-3333-4333-8333-000000000001') >= 2, 'anon da okur (paylaşılan gezi linki)'; end $$;
reset role;

-- ---------------------------------------------------------------- #144: seyahat durumları, profil sayıları, Tekrar kur
set role authenticated;
select pg_temp.as_user(:X);
create temp table onceki_144 as select public.profil_sayilari() as sayilar;
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date) values
  ('14400000-0000-4000-8000-000000000001', :X, 'ChIJ-esk', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul', '2026-03-10', '2026-03-12'),
  ('14400000-0000-4000-8000-000000000002', :X, 'ChIJ-esk', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul', '2099-01-01', '2099-01-02'),
  ('14400000-0000-4000-8000-000000000003', :X, 'ChIJ-bur', 'Bursa', 40.18, 29.06, 'Europe/Istanbul', null, null);
insert into public.places (id, trip_id, place_id, lat, lng, default_minutes, added_by) values
  ('14400000-0000-4000-8000-0000000000a1', '14400000-0000-4000-8000-000000000001', 'p1', 39.77, 30.52, 60, :X),
  ('14400000-0000-4000-8000-0000000000a2', '14400000-0000-4000-8000-000000000001', 'p2', 39.77, 30.52, 45, :X),
  ('14400000-0000-4000-8000-0000000000a3', '14400000-0000-4000-8000-000000000001', 'p3', 39.77, 30.52, 50, :X),
  ('14400000-0000-4000-8000-0000000000a4', '14400000-0000-4000-8000-000000000001', 'p4', 39.77, 30.52, 45, :X),
  ('14400000-0000-4000-8000-0000000000a7', '14400000-0000-4000-8000-000000000001', 'p7', 39.77, 30.52, 45, :X),
  ('14400000-0000-4000-8000-0000000000b1', '14400000-0000-4000-8000-000000000002', 'p1', 39.77, 30.52, 45, :X),
  ('14400000-0000-4000-8000-0000000000b5', '14400000-0000-4000-8000-000000000002', 'p5', 39.77, 30.52, 45, :X),
  ('14400000-0000-4000-8000-0000000000c6', '14400000-0000-4000-8000-000000000003', 'p6', 40.18, 29.06, 45, :X);
update public.days set start_time = '10:30', order_manual = true where trip_id = '14400000-0000-4000-8000-000000000001' and index = 1;
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes, skipped)
select '14400000-0000-4000-8000-000000000001', d.id, v.ref::uuid, v.k, v.dk, v.atla
from (values (1, '14400000-0000-4000-8000-0000000000a1', 'a', 60, false), (1, '14400000-0000-4000-8000-0000000000a2', 'b', 45, true),
             (2, '14400000-0000-4000-8000-0000000000a3', 'a', 50, false), (3, '14400000-0000-4000-8000-0000000000a7', 'a', 45, false)) v(gun, ref, k, dk, atla)
join public.days d on d.trip_id = '14400000-0000-4000-8000-000000000001' and d.index = v.gun;
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
select '14400000-0000-4000-8000-000000000002', d.id, '14400000-0000-4000-8000-0000000000b1', 'a', 45 from public.days d where d.trip_id = '14400000-0000-4000-8000-000000000002' and d.index = 1;
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
select '14400000-0000-4000-8000-000000000003', d.id, '14400000-0000-4000-8000-0000000000c6', 'a', 45 from public.days d where d.trip_id = '14400000-0000-4000-8000-000000000003';
do $$
declare r record; o jsonb; j jsonb;
begin
  select * into r from public.seyahat_durumlari() where trip_id = '14400000-0000-4000-8000-000000000001';
  assert (r.gun, r.planli_gun, r.atanmamis, r.gezilen) = (3, 3, 1, 3), format('bitmiş seyahat durumu: %s', r);
  select * into r from public.seyahat_durumlari() where trip_id = '14400000-0000-4000-8000-000000000002';
  assert (r.gun, r.planli_gun, r.atanmamis, r.gezilen) = (2, 1, 1, 0), format('yaklaşan: gezilen sayılmaz: %s', r);
  select * into r from public.seyahat_durumlari() where trip_id = '14400000-0000-4000-8000-000000000003';
  assert (r.gun, r.planli_gun, r.atanmamis, r.gezilen) = (1, 1, 0, 0), format('tarihsiz sayılmaz: %s', r);
  select sayilar into o from onceki_144;
  j := public.profil_sayilari();
  assert (j->>'seyahat')::int = (o->>'seyahat')::int + 3, 'profil: üç yeni seyahat';
  -- p1, p3, p7 (p2 atlandı; p5 atanmamış ve seyahat yaklaşan; p6 tarihsiz); şehir yalnız Eskişehir.
  assert (j->>'gezilen')::int = (o->>'gezilen')::int + 3, 'profil: mekan gezildi kuralı';
  assert (j->>'sehir')::int = (o->>'sehir')::int + 1, 'profil: şehir aynı mantıkla';
end $$;
-- Tekrar kur: yeni tarihli (2 günlük) seyahate aynı plan.
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date) values
  ('14400000-0000-4000-8000-000000000004', :X, 'ChIJ-esk', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul', '2099-06-01', '2099-06-02');
do $$
begin
  assert public.seyahati_kopyala('14400000-0000-4000-8000-000000000001', '14400000-0000-4000-8000-000000000004') = 3, 'gün 1–2 durakları kopyalanır (3. günün karşılığı yok)';
  assert (select count(*) from public.places where trip_id = '14400000-0000-4000-8000-000000000004') = 5, 'tüm mekanlar listeye';
  assert (select count(*) from public.stops where trip_id = '14400000-0000-4000-8000-000000000004' and skipped) = 0, 'atlama kopyalanmaz';
  assert (select minutes from public.stops s join public.places p on p.id = s.place_ref where p.trip_id = '14400000-0000-4000-8000-000000000004' and p.place_id = 'p3') = 50, 'süre korunur';
  assert (select google_fetched_at from public.places where trip_id = '14400000-0000-4000-8000-000000000004' and place_id = 'p1')
       = (select google_fetched_at from public.places where trip_id = '14400000-0000-4000-8000-000000000001' and place_id = 'p1'), 'tazelik damgası korunur';
  assert not exists (select 1 from public.stops s join public.places p on p.id = s.place_ref where p.trip_id = '14400000-0000-4000-8000-000000000004' and p.place_id in ('p4', 'p7')), 'atanmamış ve karşılıksız gün listede kalır';
  assert (select start_time = '10:30' and order_manual from public.days where trip_id = '14400000-0000-4000-8000-000000000004' and index = 1), 'gün ayarı kopyalanır';
  assert public.seyahati_kopyala('14400000-0000-4000-8000-000000000001', '14400000-0000-4000-8000-000000000004') = 0, 'ikinci kez: hiçbir şey çoğalmaz';
end $$;
select pg_temp.hata_bekle($$select public.seyahati_kopyala(gen_random_uuid(), '14400000-0000-4000-8000-000000000004')$$, '42501');
select pg_temp.as_user(:B);
do $$
begin
  assert not exists (select 1 from public.seyahat_durumlari() where trip_id::text like '14400000-%'), 'başkasının seyahati görünmez';
end $$;
select pg_temp.hata_bekle($$select public.seyahati_kopyala('14400000-0000-4000-8000-000000000001', '14400000-0000-4000-8000-000000000004')$$, '42501');
reset role;


-- #157 Genel bakış (BO-0): olay yoksa "veri bekleniyor" (olay_var false); ilk plan medyanı (kişi başı ilk plan), davet oranı,
-- kurulan plan, alınan gezi (kişi başı), bu hafta, Google kalemleri, içerik sağlığı. Ölçülen olaylar baştan temizlenir.
reset role;
delete from public.olaylar where tur in ('plan_kuruldu', 'davet_paylasildi', 'davet_katildi', 'gezi_alindi', 'sihirbaz_bitti');
delete from public.api_sayac where gun = (now() at time zone 'Europe/Istanbul')::date;
\set U1 '''15700000-0000-4000-8000-000000000001'''
\set U2 '''15700000-0000-4000-8000-000000000002'''
\set U3 '''15700000-0000-4000-8000-000000000003'''
\set U4 '''15700000-0000-4000-8000-000000000004'''
\set U5 '''15700000-0000-4000-8000-000000000005'''
insert into auth.users (id, is_anonymous) values (:U1, false), (:U2, false), (:U3, false), (:U4, false), (:U5, false);
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$
declare o jsonb := public.yonetim_genel(7);
begin
  assert not (o #>> '{ilk_plan,olay_var}')::boolean and not (o #>> '{plan,olay_var}')::boolean, 'plan olayı yok → veri bekleniyor';
  assert not (o #>> '{davet,olay_var}')::boolean and not (o #>> '{gezi,olay_var}')::boolean, 'davet / gezi olayı yok';
  assert not (o #>> '{davet,katilim_olay_var}')::boolean, 'katılım olayı yok';
  assert not (o ->> 'hafta_olay_var')::boolean, 'grafik verisi yok';
  assert o #> '{ilk_plan,medyan_sn}' = 'null'::jsonb, 'medyan yok (sıfır değil)';
end $$;
reset role;
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values
  ('15700000-0000-4000-8000-0000000000a1', :U1, 'ChIJ-esk', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul'),
  ('15700000-0000-4000-8000-0000000000a2', :U1, 'ChIJ-esk', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul');
insert into public.olaylar (user_id, tur, hedef_id, meta, created_at) values
  (:U1, 'plan_kuruldu', '15700000-0000-4000-8000-0000000000a1', '{"sure_sn": 100}', now() - interval '2 days'),
  (:U1, 'plan_kuruldu', '15700000-0000-4000-8000-0000000000a2', '{"sure_sn": 900}', now() - interval '1 hour'),
  (:U2, 'plan_kuruldu', null, '{"sure_sn": 200}', now() - interval '3 days'),
  (:U3, 'plan_kuruldu', null, '{"sure_sn": 50}', now() - interval '20 days'),
  -- meta istemciden: bozuk ve aşırı değer özeti düşürmez, medyana girmez.
  (:U4, 'plan_kuruldu', null, '{"sure_sn": "x"}', now() - interval '2 hours'),
  (:U5, 'plan_kuruldu', null, '{"sure_sn": 99999}', now() - interval '1 day 1 minute'),
  (:U5, 'plan_kuruldu', null, '{"sure_sn": 30}', now() - interval '2 hours'),
  (:U1, 'davet_paylasildi', '15700000-0000-4000-8000-0000000000a1', null, now() - interval '1 day'),
  (:U2, 'davet_katildi', '15700000-0000-4000-8000-0000000000a1', '{"kanal": "app"}', now() - interval '20 hours'),
  (:U1, 'gezi_alindi', (select id from public.geziler order by baslik limit 1), null, now() - interval '1 day'),
  (:U1, 'gezi_alindi', (select id from public.geziler order by baslik limit 1), null, now() - interval '1 day'),
  (:U2, 'gezi_alindi', (select id from public.geziler order by baslik limit 1), null, now() - interval '1 day'),
  (:U1, 'gezi_alindi', (select id from public.geziler order by baslik offset 1 limit 1), null, now() - interval '1 day');
insert into public.api_sayac (fonksiyon, cagri, google) values ('places-full', 12, 10), ('places-light', 5, 2), ('places-photo', 4, 4), ('route-matrix', 2, 2), ('places-reviews', 3, 3), ('sentry-ozet', 9, 0);
create temp table beklenen_157 as select
  (select count(*) from public.trips where created_at > now() - interval '7 days') as kurulan,
  (select count(*) from public.olaylar where tur = 'plan_kuruldu' and created_at >= (date_trunc('week', now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul') as hafta_plan,
  (select baslik from public.geziler order by baslik limit 1) as en_cok,
  (select count(*) from public.olaylar where tur = 'plan_kuruldu'
     and created_at > ((now() at time zone 'Europe/Istanbul')::date::timestamp at time zone 'Europe/Istanbul') - interval '1 day'
     and created_at <= now() - interval '1 day') as dun_ayni_saat,
  (select count(*) filter (where not coalesce((to_jsonb(r) ->> 'gizli')::boolean, false)) from public.sehir_rehberi r join public.sehirler s on s.id = r.sehir_id where s.slug = 'eskisehir') as esk_bolum;
grant select on beklenen_157 to authenticated;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$
declare
  o jsonb := public.yonetim_genel(7);
  b beklenen_157;
  esk jsonb;
begin
  select * into b from beklenen_157;
  assert (o #>> '{ilk_plan,olay_var}')::boolean, 'plan olayı var';
  assert (o #>> '{ilk_plan,n}')::int = 2 and (o #>> '{ilk_plan,medyan_sn}')::numeric = 150, format('ilk plan medyanı (kişi başı ilk plan, 7 gün): %s', o -> 'ilk_plan');
  assert (o #>> '{plan,sayi}')::int = 6 and (o #>> '{plan,onceki}')::int = 0, format('kurulan plan: %s', o -> 'plan');
  assert (public.yonetim_genel(1) #>> '{plan,onceki}')::int = b.dun_ayni_saat, 'Bugün: dünün aynı saatine kadar kıyaslanır';
  assert (o #>> '{davet,katilim_olay_var}')::boolean, 'katılım olayı var';
  assert (o #>> '{davet,kurulan}')::int = b.kurulan and (o #>> '{davet,paylasilan}')::int = 1 and (o #>> '{davet,katilan}')::int = 1, format('davet: %s', o -> 'davet');
  assert (o #>> '{gezi,sayi}')::int = 3, 'alınan gezi kişi başı (aynı kişi iki kez = 1)';
  assert o #>> '{gezi,en_cok}' = b.en_cok, 'en çok alınan';
  assert jsonb_array_length(o -> 'en_cok_alinan') = 2 and (o #>> '{en_cok_alinan,0,sayi}')::int = 2, 'en çok alınanlar sıralı';
  assert jsonb_array_length(o -> 'hafta') = 7, 'hafta 7 gün';
  assert (select sum((g ->> 'plan')::int) from jsonb_array_elements(o -> 'hafta') g) = b.hafta_plan, 'hafta: bu haftanın planları';
  assert (o #>> '{google,mekan}')::int = 12 and (o #>> '{google,foto}')::int = 4 and (o #>> '{google,rota}')::int = 2 and (o #>> '{google,yorum}')::int = 3, format('Google kalemleri: %s', o -> 'google');
  assert (o #>> '{google,butce}')::numeric = 10 and (o #>> '{google,fiyat,foto}')::numeric = 7 and (o #>> '{google,yorum_sinir}')::int = 300, 'bütçe, fiyat, yorum sınırı';
  select e into esk from jsonb_array_elements(o -> 'icerik') e where e ->> 'ad' = 'Eskişehir';
  assert esk is not null and (esk ->> 'bolum')::int = b.esk_bolum and esk ? 'genis_kapak' and esk ? 'bos_bolum' and esk ? 'gezi', format('içerik sağlığı: %s', esk);
  assert not exists (select 1 from jsonb_array_elements(o -> 'icerik') e where e ->> 'ad' = 'Gizli'), 'yalnız yayındaki şehirler';
  assert (public.yonetim_genel(30) #>> '{ilk_plan,n}')::int = 3 and (public.yonetim_genel(30) #>> '{plan,sayi}')::int = 7, '30 gün';
end $$;
select pg_temp.hata_bekle($$select public.yonetim_genel(14)$$, '22023');
select pg_temp.as_user(:B);
select pg_temp.hata_bekle($$select public.yonetim_genel(7)$$, '42501');
set role anon;
select pg_temp.hata_bekle($$select public.yonetim_genel(7)$$, '42501');
reset role;


-- #156 Rehber editörü: serbest bölüm, gizli, taslak + Yayınla, Geçmiş (son 20). Eskişehir'in 4 bölümüyle (yukarıdan).
reset role;
create temp table rehber_156 as
  select (select id from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001' and bolum = 'yemek') as yemek,
         (select id from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001' and bolum = 'ulasim') as ulasim,
         '15600000-0000-4000-8000-000000000001'::uuid as aksam;
grant select on rehber_156 to authenticated, anon;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$
declare
  r rehber_156;
  v_bolumler jsonb;
  v_zaman timestamptz;
  v_eski timestamptz;
  v_bursa timestamptz;
  v_bos timestamptz;
begin
  select * into r from rehber_156;
  -- Ulaşım silinir; Ne yenir yeniden adlandırılır; serbest adlı yeni bölüm gizli eklenir. Mahalleler / İpuçları kalır.
  v_bolumler := jsonb_build_array(
    jsonb_build_object('id', r.yemek, 'baslik', 'Ne yenir', 'ozet', 'Çibörek, met helvası', 'gizli', false, 'bolum', 'yemek',
      'govde', E'Tatlı için [Met Helvacısı](mekan:ChIJ-met-helva-00002) ve [şuradaki dükkân](mekan:ChIJ-yeni-dukkan-0004) uğrayın.\n\n::mekan[ChIJ-cam-sanat-0003]\n\n> Kutu kutu alın.'),
    jsonb_build_object('id', (select id from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001' and bolum = 'mahalle'), 'baslik', 'Mahalleler', 'gizli', false, 'bolum', 'mahalle', 'govde', 'Odunpazarı.'),
    jsonb_build_object('id', r.aksam, 'baslik', 'Akşam ne yapılır', 'gizli', true, 'govde', ''),
    jsonb_build_object('id', (select id from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001' and bolum = 'ipucu'), 'baslik', 'İpuçları', 'gizli', false, 'bolum', 'ipucu', 'govde', '')
  );
  -- İlk kayıt: taslak yok, `p_onceki` null. Başka bir ilk kayıt (eski sekme, taslağı görmeden) 40001.
  v_zaman := public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', v_bolumler,
    '{"ChIJ-cam-sanat-0003": {"ad": "Cam Sanatları Evi", "kategori": "museum", "lat": 39.76, "lng": 30.52},
      "ChIJ-yeni-dukkan-0004": {"ad": "Yeni Dükkân (Google)", "kategori": "store", "lat": 39.77, "lng": 30.51}}');
  assert v_zaman is not null, 'taslak kaydedildi';
  assert (select count(*) from public.sehir_rehberi_surum where sehir_id = '11111111-1111-4111-8111-000000000001') = 0, 'ilk kayıtta sürüm yok (önceki hâl yok)';
  begin
    perform public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', '[]');
    raise exception 'ikinci ilk kayıt 40001 vermeliydi';
  exception when serialization_failure then null;
  end;
  -- Eşzamanlı kayıt: eski damgayla yazan sekme yeni taslağın üstüne yazamaz.
  v_eski := v_zaman;
  v_zaman := public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', v_bolumler, '{}', 'kayit', v_zaman);
  assert v_zaman > v_eski, 'her kayıt damgayı ilerletir';
  begin
    perform public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', '[]', '{}', 'kayit', v_eski);
    raise exception 'eski damgalı kayıt 40001 vermeliydi';
  exception when serialization_failure then null;
  end;
  assert (select jsonb_array_length(bolumler) from public.sehir_rehberi_taslak where sehir_id = '11111111-1111-4111-8111-000000000001') = 4, 'eski sekme taslağı boşaltamadı';
  -- Sürüm güncellemeden ÖNCEKİ hâli tutar; 2 dk içinde ikinci sürüm yok.
  assert (select count(*) from public.sehir_rehberi_surum where sehir_id = '11111111-1111-4111-8111-000000000001') = 1, 'ikinci kayıtta sürüm';
  v_zaman := public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', v_bolumler - 3, '{}', 'kayit', v_zaman);
  assert (select count(*) from public.sehir_rehberi_surum where sehir_id = '11111111-1111-4111-8111-000000000001') = 1, '2 dk içinde yeni sürüm yok';
  v_zaman := public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', v_bolumler, '{}', 'silme', v_zaman);
  assert (select jsonb_array_length(bolumler) from public.sehir_rehberi_surum where sehir_id = '11111111-1111-4111-8111-000000000001' and neden = 'silme') = 3,
    'silme sürümü silmeden önceki hâl';
  assert (select bilinen ? 'ChIJ-cam-sanat-0003' from public.sehir_rehberi_taslak where sehir_id = '11111111-1111-4111-8111-000000000001'), 'bilinen mekanlar birleşir';
  -- Taslak canlıyı değiştirmez.
  assert (select baslik from public.sehir_rehberi where id = r.ulasim) is not null, 'yayından önce Ulaşım canlıda';
  -- Eski damgayla yayın (editör taslağın değiştiğini görmemiş) 40001; canlı değişmez.
  begin
    perform public.rehber_yayinla('11111111-1111-4111-8111-000000000001', v_eski);
    raise exception 'eski taslağın yayını 40001 vermeliydi';
  exception when serialization_failure then null;
  end;
  begin
    perform public.rehber_yayinla('11111111-1111-4111-8111-000000000001', null);
    raise exception 'damgasız yayın 40001 vermeliydi';
  exception when serialization_failure then null;
  end;
  assert exists (select 1 from public.sehir_rehberi where id = r.ulasim), 'reddedilen yayın canlıya dokunmaz';
  assert public.rehber_yayinla('11111111-1111-4111-8111-000000000001', v_zaman) = 2, 'yayın: bilinmeyen kart ve satır mekanı taslak yer açar';
  assert (select count(*) from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001') = 4, 'canlı = taslak (4 bölüm; admin gizliyi de görür)';
  assert not exists (select 1 from public.sehir_rehberi where id = r.ulasim), 'taslakta olmayan bölüm silinir';
  assert (select string_agg(baslik, ',' order by sira) from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001') = 'Ne yenir,Mahalleler,Akşam ne yapılır,İpuçları', 'sıra taslaktan';
  assert (select bolum is null and gizli and yazi_md = '# Akşam ne yapılır' from public.sehir_rehberi where id = r.aksam), 'serbest bölüm: türsüz, gizli, yalnız başlık';
  assert (select yazi_md like E'# Ne yenir\n\nTatlı için%' from public.sehir_rehberi where id = r.yemek), 'yazı: # başlık + gövde';
  assert (select string_agg(place_id || ':' || bicim, ',' order by sira) from public.icerik_mekanlari where sahip_id = r.yemek)
    = 'ChIJ-met-helva-00002:satir,ChIJ-yeni-dukkan-0004:satir,ChIJ-cam-sanat-0003:kart', 'mekanlar yazı sırasıyla';
  assert (select ad from public.yerler where place_id = 'ChIJ-cam-sanat-0003') = 'Cam Sanatları Evi', 'kart mekanının adı bilinen listesinden';
  assert (select ad from public.yerler where place_id = 'ChIJ-yeni-dukkan-0004') = 'Yeni Dükkân (Google)', 'satır içi mekanın adı önce bilinen (Google) ad, bağlantı metni değil';
  assert (select yayinlandi_at >= updated_at from public.sehir_rehberi_taslak where sehir_id = '11111111-1111-4111-8111-000000000001'), 'taslak yayınlandı damgası';
  assert (select count(*) from public.sehir_rehberi_surum where sehir_id = '11111111-1111-4111-8111-000000000001' and neden = 'yayin') = 1, 'yayın sürümü';
  -- Başka şehrin bölüm kimliğiyle yayın reddedilir (Taslak Şehir'in taslağında Eskişehir'in Ne yenir'i).
  v_bursa := public.rehber_taslak_kaydet('22222222-2222-4222-8222-000000000002',
    jsonb_build_array(jsonb_build_object('id', r.yemek, 'baslik', 'Kaçak', 'gizli', false, 'govde', '')));
  begin
    perform public.rehber_yayinla('22222222-2222-4222-8222-000000000002', v_bursa);
    raise exception 'başka şehrin bölümü 42501 vermeliydi';
  exception when insufficient_privilege then null;
  end;
  assert (select sehir_id = '11111111-1111-4111-8111-000000000001' and baslik = 'Ne yenir' from public.sehir_rehberi where id = r.yemek), 'Eskişehir bölümü değişmedi';
  -- Boş taslak (bütün bölümler silinmiş) yayınlanabilir: canlı boşalır. Eski damgalı olmadıkça kasıtlıdır.
  v_bos := public.rehber_taslak_kaydet('22222222-2222-4222-8222-000000000002', '[]', '{}', 'silme', v_bursa);
  assert public.rehber_yayinla('22222222-2222-4222-8222-000000000002', v_bos) = 0, 'boş taslak yayını';
  assert not exists (select 1 from public.sehir_rehberi where sehir_id = '22222222-2222-4222-8222-000000000002'), 'boş taslak: canlı bölüm yok';
  -- Geçmiş en çok 20 sürüm tutar.
  for i in 1..25 loop
    v_zaman := public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', v_bolumler, '{}', 'silme', v_zaman);
  end loop;
  assert (select count(*) from public.sehir_rehberi_surum where sehir_id = '11111111-1111-4111-8111-000000000001') = 20, 'son 20 sürüm';
end $$;
select pg_temp.hata_bekle($$select public.rehber_yayinla('11111111-1111-4111-8111-000000000099', now())$$, 'P0002');
set role anon;
do $$
begin
  assert (select count(*) from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001') = 3, 'gizli bölüm uygulamada yok';
  assert not exists (select 1 from public.sehir_rehberi where id = (select aksam from rehber_156)), 'gizli bölüm okunmaz';
  assert (select count(*) from public.sehir_rehberi_taslak) = 0, 'taslak herkese kapalı';
end $$;
select pg_temp.hata_bekle($$select public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', '[]')$$, '42501');
set role authenticated;
select pg_temp.as_user(:B);
do $$
begin
  assert (select count(*) from public.sehir_rehberi where sehir_id = '11111111-1111-4111-8111-000000000001') = 3, 'gizli bölüm sıradan kullanıcıya da yok';
  assert (select count(*) from public.sehir_rehberi_taslak) = 0, 'taslak admin olmayana görünmez';
  assert (select count(*) from public.sehir_rehberi_surum) = 0, 'geçmiş admin olmayana görünmez';
end $$;
select pg_temp.hata_bekle($$select public.rehber_taslak_kaydet('11111111-1111-4111-8111-000000000001', '[]')$$, '42501');
select pg_temp.hata_bekle($$select public.rehber_yayinla('11111111-1111-4111-8111-000000000001', now())$$, '42501');
reset role;

-- ---------------------------------------------------------------- İçerik hattı (docs/07): taslak yükle / sil, şehirler, kontrol, bütçe
-- Yalnız postgres (Yönetim API) çalıştırır; yayin=false zorlanır; yayındaki geziye dokunulmaz; slug çakışması reddedilir;
-- p_yeniden ve sil yalnız taslakta; hata olursa hiçbir şey yazılmaz.
create function pg_temp.icerik_ornek(p_slug text, p_sehir jsonb default '{"slug": "eskisehir"}') returns jsonb
language sql as $$
  select jsonb_build_object(
    'sehir', p_sehir,
    'gezi', jsonb_build_object('slug', p_slug, 'baslik', 'Eskişehir''de bir hafta sonu', 'ozet', 'Yürüyerek, rahat tempoda',
      'yazar_ad', 'Tripmate ekibi',
      'yazi_md', E'Giriş paragrafı, [Kurşunlu](mekan:ChIJ-kursunlu-01) ile başlar.\n\n## 1. gün · Odunpazarı\n\nMetin.\n::mekan[ChIJ-modern-muze-1]\n\n## 2. gün · Porsuk\n\n[Kent Park](mekan:ChIJ-kent-park-01) akşamüstü.'),
    'gunler', jsonb_build_array(
      jsonb_build_object('baslik', 'Odunpazarı', 'duraklar', jsonb_build_array(
        jsonb_build_object('place_id', 'ChIJ-kursunlu-01', 'ad', 'Kurşunlu Külliyesi', 'kategori', 'mosque', 'sure_dk', 30, 'lat', 39.7627, 'lng', 30.5261),
        jsonb_build_object('place_id', 'ChIJ-modern-muze-1', 'ad', 'Odunpazarı Modern Müze', 'kategori', 'museum', 'sure_dk', 75, 'lat', 39.7646, 'lng', 30.5236))),
      jsonb_build_object('baslik', 'Porsuk', 'duraklar', jsonb_build_array(
        jsonb_build_object('place_id', 'ChIJ-kent-park-01', 'ad', 'Kent Park', 'kategori', 'park', 'sure_dk', 45, 'lat', 39.7757, 'lng', 30.5004),
        jsonb_build_object('place_id', 'ChIJ-adalar-0001', 'ad', 'Adalar', 'kategori', null, 'sure_dk', 45, 'lat', 39.7772, 'lng', 30.5185)))));
$$;
grant execute on function pg_temp.icerik_ornek(text, jsonb) to anon, authenticated, service_role;

-- Yetki: anon, authenticated (admin dahil) ve service_role çalıştıramaz.
set role anon;
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-anon'))$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_sil('eskisehir-iki-gun')$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_sehirler()$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_gezi_kontrol('eskisehir-iki-gun')$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_google_butcesi(1)$$, '42501');
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-admin'))$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-admin'), true)$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_sil('eskisehir-iki-gun')$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_google_butcesi(1)$$, '42501');
select pg_temp.hata_bekle($$select public.yonetim_genel_temel(7)$$, '42501');
select pg_temp.as_user(:B);
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-b'))$$, '42501');
set role service_role;
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-servis'))$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_sil('eskisehir-iki-gun')$$, '42501');
reset role;
do $$ begin assert not exists (select 1 from public.geziler where slug like 'hat-%'), 'yetkisiz çağrı hiçbir şey yazmaz'; end $$;

-- Yükle (postgres): taslak, günler, duraklar, yazıdaki mekanlar.
do $$
declare
  r jsonb := public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-eskisehir'));
  g record;
begin
  select * into g from public.geziler where slug = 'hat-eskisehir';
  assert not g.yayin and g.yayin_at is null, 'yüklenen gezi taslak';
  assert g.sehir_id = '11111111-1111-4111-8111-000000000001' and g.yazar_ad = 'Tripmate ekibi', 'şehir slug''la bulunur';
  assert (r ->> 'gezi_id')::uuid = g.id and (r ->> 'gun_sayisi')::int = 2 and (r ->> 'mekan_sayisi')::int = 4 and r ->> 'slug' = 'hat-eskisehir', format('dönüş: %s', r);
  assert r ? 'updated_at' and (r ->> 'yazidaki_mekan')::int = 3 and not (r ->> 'yeni_sehir')::boolean, format('dönüş: %s', r);
  assert (select array_agg(d.sure_dk order by gg.sira, d.sira) from public.gezi_duraklari d join public.gezi_gunleri gg on gg.id = d.gezi_gun_id where gg.gezi_id = g.id) = '{30,75,45,45}', 'sıra ve süreler';
  assert (select baslik from public.gezi_gunleri where gezi_id = g.id and sira = 2) = 'Porsuk', 'gün başlığı';
  assert (select array_agg(m.place_id || ':' || m.bicim order by m.sira) from public.icerik_mekanlari m where m.sahip_tur = 'gezi' and m.sahip_id = g.id)
    = '{ChIJ-kursunlu-01:satir,ChIJ-modern-muze-1:kart,ChIJ-kent-park-01:satir}', 'yazıdaki mekanlar yazı sırasıyla';
  assert not exists (select 1 from public.yerler where place_id = 'ChIJ-adalar-0001'), 'taslak yer satırı açılmaz';
  assert (public.icerik_gezi_kontrol('hat-eskisehir') ->> 'durum') = 'taslak' and (public.icerik_gezi_kontrol('hat-eskisehir') ->> 'place_id_eksik')::int = 0, 'kontrol';
  assert (select count(*) from jsonb_array_elements(public.icerik_sehirler()) s, jsonb_array_elements(s -> 'geziler') z
    where s ->> 'slug' = 'eskisehir' and z ->> 'slug' = 'hat-eskisehir' and z ->> 'durum' = 'taslak') = 1, 'şehirler listesi taslağı gösterir';
end $$;

-- Slug çakışması, yayın girdisi ve tablo kısıtları reddedilir; hata olursa hiçbir şey yazılmaz.
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-eskisehir'))$$, '23505');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('eskisehir-iki-gun'))$$, '23505');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-yayin'), '{gezi,yayin}', 'true'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-yayin'), '{gezi,yayin_at}', '"2026-11-01T00:00:00Z"'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('Hat-Buyuk'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-sure'), '{gunler,1,duraklar,0,sure_dk}', '10'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-sure'), '{gunler,1,duraklar,0,sure_dk}', '45.5'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-bos'), '{gunler,1,duraklar}', '[]'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-pid'), '{gunler,0,duraklar,0,place_id}', '"kısa"'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-konum') #- '{gunler,1,duraklar,1,lat}')$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-ad'), '{gunler,0,duraklar,0,ad}', to_jsonb(repeat('a', 121))))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-gun'), '{gunler}', (select jsonb_agg(pg_temp.icerik_ornek('x') #> '{gunler,0}') from generate_series(1, 31))))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-sehir', '{"slug": "yok-boyle-sehir"}'))$$, 'P0002');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-sehir', '{"yeni": {"ad": "Eskişehir", "slug": "eskisehir", "lat": 39.77, "lng": 30.52}}'))$$, '23505');
do $$ begin assert not exists (select 1 from public.geziler where slug in ('hat-yayin', 'hat-sure', 'hat-bos', 'hat-pid', 'hat-konum', 'hat-ad', 'hat-gun', 'hat-sehir')), 'reddedilen yükleme iz bırakmaz'; end $$;

-- Kuru çalıştırma (hat: işlem hata ile biter, hiçbir şey kalmaz).
do $$
begin
  begin
    perform public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-kuru'));
    raise exception 'KURU_TAMAM' using errcode = 'P0001';
  exception when sqlstate 'P0001' then null;
  end;
  assert not exists (select 1 from public.geziler where slug = 'hat-kuru'), 'kuru çalıştırma yazmaz';
end $$;

-- Yeni şehir yalnız `yeni` ile ve taslak açılır.
do $$
declare r jsonb := public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-bursa', '{"yeni": {"ad": "Bursa", "slug": "bursa-hat", "lat": 40.19, "lng": 29.06}}'));
begin
  assert (r ->> 'yeni_sehir')::boolean and not (select yayin from public.sehirler where slug = 'bursa-hat'), 'yeni şehir taslak';
  assert (select s.slug from public.geziler g join public.sehirler s on s.id = g.sehir_id where g.slug = 'hat-bursa') = 'bursa-hat', 'gezi yeni şehre bağlı';
end $$;

-- p_yeniden: taslağı yeniden yazar (kimlik, kapak ve sıra kalır; yayın tarihi sıfırlanır).
update public.geziler set kapak_url = 'https://ornek/kapak.webp', sira = 7, yayin_at = now() + interval '3 days' where slug = 'hat-eskisehir';
do $$
declare
  v_id uuid := (select id from public.geziler where slug = 'hat-eskisehir');
  r jsonb := public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-eskisehir'), '{gunler}', (pg_temp.icerik_ornek('x') -> 'gunler') - 1), true);
  g record;
begin
  select * into g from public.geziler where slug = 'hat-eskisehir';
  assert g.id = v_id and (r ->> 'yeniden')::boolean and (r ->> 'gun_sayisi')::int = 1 and (r ->> 'mekan_sayisi')::int = 2, format('yeniden: %s', r);
  assert not g.yayin and g.yayin_at is null and g.kapak_url = 'https://ornek/kapak.webp' and g.sira = 7, 'taslak kalır, kapak ve sıra korunur';
  assert (select count(*) from public.gezi_gunleri where gezi_id = v_id) = 1, 'eski günler silindi';
end $$;

-- Yayındaki gezi: ne yeniden yazılır ne silinir (planlı yayın da yayindir).
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('eskisehir-iki-gun'), true)$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_sil('eskisehir-iki-gun')$$, '42501');
update public.geziler set yayin = true, yayin_at = now() + interval '1 day' where slug = 'hat-bursa';
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-bursa', '{"slug": "bursa-hat"}'), true)$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_sil('hat-bursa')$$, '42501');
do $$
begin
  assert (select gun_sayisi from public.geziler where slug = 'eskisehir-iki-gun') = 2 and (select yayin from public.geziler where slug = 'eskisehir-iki-gun'), 'yayındaki gezi değişmedi';
  assert (select mekan_sayisi from public.geziler where slug = 'hat-bursa') = 4, 'planlı gezi değişmedi';
end $$;

-- Sil: yalnız taslak; fotoğraflı taslak silinmez; yoksa P0002.
insert into public.icerik_fotolari (yol, sahip_tur, sahip_id) select 'geziler/' || id || '/a.webp', 'gezi', id from public.geziler where slug = 'hat-eskisehir';
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_sil('hat-eskisehir')$$, '42501');
delete from public.icerik_fotolari where sahip_tur = 'gezi' and yol like '%/a.webp';
do $$
declare v_id uuid := (select id from public.geziler where slug = 'hat-eskisehir');
begin
  assert (public.icerik_gezi_taslak_sil('hat-eskisehir') ->> 'gezi_id')::uuid = v_id, 'taslak silindi';
  assert not exists (select 1 from public.geziler where id = v_id) and not exists (select 1 from public.gezi_gunleri where gezi_id = v_id), 'günler cascade';
  assert not exists (select 1 from public.icerik_mekanlari where sahip_tur = 'gezi' and sahip_id = v_id), 'yazıdaki mekanlar silindi';
end $$;
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_sil('hat-eskisehir')$$, 'P0002');
delete from public.geziler where slug = 'hat-bursa';
delete from public.sehirler where slug = 'bursa-hat';

-- Bütçe (icerik-google) ve Genel bakış: içerik istekleri Mekan kalemine, karışık birim fiyatla.
delete from public.api_sayac where gun = (now() at time zone 'Europe/Istanbul')::date;
-- icerik-kimlik (Text Search IDs Only, ücretsiz): sayılır ama maliyet kalemine girmez.
insert into public.api_sayac (fonksiyon, cagri, google) values ('places-full', 20, 20), ('icerik-google', 3, 100), ('icerik-kimlik', 0, 500);
set role service_role;
do $$
begin
  -- icerik fiyatı 20 $/1000 (20261102): 20 × 17 + 100 × 20 = 2,34 $.
  assert (public.icerik_google_butcesi(0) ->> 'harcanan')::numeric = 2.34, format('harcanan: %s', public.icerik_google_butcesi(0));
  assert (public.icerik_google_butcesi(300) ->> 'yeterli')::boolean, '2,34 + 6 ≤ 10';
  assert not (public.icerik_google_butcesi(400) ->> 'yeterli')::boolean, '2,34 + 8 > 10';
end $$;
reset role;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$
declare o jsonb := public.yonetim_genel(1);
begin
  assert (o #>> '{google,mekan}')::int = 120, format('mekan + içerik: %s', o -> 'google');
  assert (o #>> '{google,fiyat,mekan}')::numeric = 19.5, format('karışık fiyat (20×17 + 100×20) / 120: %s', o -> 'google');
  assert (o #>> '{google,fiyat,foto}')::numeric = 7, 'diğer fiyatlar aynı';
end $$;
reset role;
delete from public.api_sayac where gun = (now() at time zone 'Europe/Istanbul')::date;

-- İçerik hattı 2: mekan rehberleri. Yer satırı yoksa taslak açılır; taslak ve rehberi boşsa yazılır; yayındaki ya da
-- rehberi dolu satıra dokunulmaz (rehber_atlanan).
insert into public.yerler (sehir_id, place_id, ad, kategori, lat, lng, yayin, rehber_md) values
  ('11111111-1111-4111-8111-000000000001', 'ChIJ-yayin-yer-1', 'Yayındaki yer', 'museum', 39.76, 30.52, true, 'Canlı rehber.'),
  ('11111111-1111-4111-8111-000000000001', 'ChIJ-taslak-yer1', 'Taslak yer', 'museum', 39.76, 30.52, false, null),
  ('11111111-1111-4111-8111-000000000001', 'ChIJ-dolu-yer-01', 'Dolu taslak', 'park', 39.76, 30.52, false, 'Ece''nin rehberi.');
create function pg_temp.rehberli(p_slug text) returns jsonb
language sql as $$
  select jsonb_set(pg_temp.icerik_ornek(p_slug), '{gunler,0,duraklar}', jsonb_build_array(
    jsonb_build_object('place_id', 'ChIJ-yeni-yer-001', 'ad', 'Yeni yer', 'kategori', 'museum', 'sure_dk', 60, 'lat', 39.7646, 'lng', 30.5236, 'rehber_md', E'Yeni rehber.\n\n> İpucu.'),
    jsonb_build_object('place_id', 'ChIJ-yayin-yer-1', 'ad', 'Yayındaki yer', 'kategori', 'museum', 'sure_dk', 60, 'lat', 39.76, 'lng', 30.52, 'rehber_md', 'Benim rehberim.'),
    jsonb_build_object('place_id', 'ChIJ-taslak-yer1', 'ad', 'Taslak yer', 'kategori', 'museum', 'sure_dk', 60, 'lat', 39.76, 'lng', 30.52, 'rehber_md', 'Taslağa rehber.'),
    jsonb_build_object('place_id', 'ChIJ-dolu-yer-01', 'ad', 'Dolu taslak', 'kategori', 'park', 'sure_dk', 45, 'lat', 39.76, 'lng', 30.52, 'rehber_md', 'Üzerine yazma.'),
    jsonb_build_object('place_id', 'ChIJ-rehbersiz-01', 'ad', 'Rehbersiz', 'kategori', 'cafe', 'sure_dk', 30, 'lat', 39.76, 'lng', 30.52)));
$$;
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.rehberli('hat-rehber-uzun'), '{gunler,0,duraklar,0,rehber_md}', to_jsonb(repeat('a', 8001))))$$, '22023');
do $$
declare r jsonb := public.icerik_gezi_taslak_yukle(pg_temp.rehberli('hat-rehber'));
declare k jsonb;
begin
  assert (r ->> 'yer_acilan')::int = 1 and (r ->> 'rehber_yazilan')::int = 2, format('rehber: %s', r);
  assert r -> 'rehber_atlanan' @> '["ChIJ-yayin-yer-1", "ChIJ-dolu-yer-01"]' and jsonb_array_length(r -> 'rehber_atlanan') = 2, format('atlanan: %s', r);
  assert (select not yayin and rehber_md like 'Yeni rehber.%' and kategori = 'museum' and sehir_id = '11111111-1111-4111-8111-000000000001'
    from public.yerler where place_id = 'ChIJ-yeni-yer-001'), 'yeni yer taslak açıldı';
  assert (select rehber_md from public.yerler where place_id = 'ChIJ-yayin-yer-1') = 'Canlı rehber.', 'yayındaki yerin rehberine dokunulmaz';
  assert (select rehber_md from public.yerler where place_id = 'ChIJ-taslak-yer1') = 'Taslağa rehber.', 'boş taslağa yazılır';
  assert (select rehber_md from public.yerler where place_id = 'ChIJ-dolu-yer-01') = 'Ece''nin rehberi.', 'dolu taslağa dokunulmaz';
  assert not exists (select 1 from public.yerler where place_id = 'ChIJ-rehbersiz-01'), 'rehbersiz durak için yer açılmaz';
  k := public.icerik_gezi_kontrol('hat-rehber');
  -- yer_yok: rehbersiz durak + 2. günün iki durağı.
  assert (k ->> 'yer_yok')::int = 3 and (k ->> 'rehber_dolu')::int = 4 and (k ->> 'rehber_yayinda')::int = 1, format('kontrol: %s', k);
end $$;
select public.icerik_gezi_taslak_sil('hat-rehber');
delete from public.yerler where place_id in ('ChIJ-yeni-yer-001', 'ChIJ-yayin-yer-1', 'ChIJ-taslak-yer1', 'ChIJ-dolu-yer-01');

-- #174 KK8 Seyahat silme: yalnız sahip siler (trips_delete = is_owner). Üye ve dışarıdan birinin silmesi RLS ile süzülür
-- (hata yok, 0 satır); sahip silince bağlı satırlar (günler, mekanlar, duraklar, üyeler, değişiklikler, oylar, puanlar) kalmaz.
reset role;
\set SS '''aaaaaaaa-1740-0000-0000-000000000001'''
\set SU '''aaaaaaaa-1740-0000-0000-000000000002'''
\set SN '''aaaaaaaa-1740-0000-0000-000000000003'''
insert into auth.users (id, is_anonymous) values (:SS, false), (:SU, false), (:SN, false);
insert into public.profiles (id, name, username) values (:SS, 'Sahip', 'sahip174'), (:SU, 'Uye', 'uye174'), (:SN, 'Disari', 'disari174');
set role authenticated;
select pg_temp.as_user(:SS);
insert into public.trips (owner_id, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date)
  values (:SS, 'ChIJ-silinecek', 'Silinecek', 'TR', 39.77, 30.52, 'Europe/Istanbul', '2026-11-02', '2026-11-03');
reset role;
select id as sil_trip, invite_token as sil_token from public.trips where owner_id = :SS \gset
select set_config('test.sil_trip', :'sil_trip', false);
select set_config('test.sil_token', :'sil_token', false);
set role authenticated;
select pg_temp.as_user(:SU);
select public.join_trip(:'sil_token', 'Uye');
select pg_temp.as_user(:SS);
insert into public.places (trip_id, place_id, primary_type, lat, lng, default_minutes, added_by)
  values (:'sil_trip', 'ChIJ-silinecek-yer1', 'museum', 39.77, 30.52, 60, :SS);
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
  select d.trip_id, d.id, p.id, 'a0', 60 from public.days d join public.places p on p.trip_id = d.trip_id
  where d.trip_id = :'sil_trip' and d.index = 1;
select pg_temp.as_user(:SU);
insert into public.oylar (seyahat_id, mekan) select trip_id, id from public.places where trip_id = :'sil_trip';
insert into public.stop_ratings (trip_id, place_ref, stars) select trip_id, id, 5 from public.places where trip_id = :'sil_trip';
do $$
declare n integer;
begin
  delete from public.trips where id = current_setting('test.sil_trip')::uuid;
  get diagnostics n = row_count;
  assert n = 0, 'üye seyahati silemez';
  assert exists (select 1 from public.trips where id = current_setting('test.sil_trip')::uuid), 'üye için seyahat yerinde';
end $$;
select pg_temp.as_user(:SN);
do $$
declare n integer;
begin
  delete from public.trips where id = current_setting('test.sil_trip')::uuid;
  get diagnostics n = row_count;
  assert n = 0, 'dışarıdan biri seyahati silemez';
end $$;
reset role;
do $$
declare t uuid := current_setting('test.sil_trip')::uuid;
begin
  assert exists (select 1 from public.trips where id = t), 'yetkisiz silmelerden sonra seyahat duruyor';
  assert (select count(*) from public.members where trip_id = t) = 2, 'sahip + üye';
  assert exists (select 1 from public.days where trip_id = t) and exists (select 1 from public.stops where trip_id = t)
    and exists (select 1 from public.changes where trip_id = t) and exists (select 1 from public.oylar where seyahat_id = t)
    and exists (select 1 from public.stop_ratings where trip_id = t), 'bağlı satırlar silmeden önce var';
end $$;
set role authenticated;
select pg_temp.as_user(:SS);
do $$
declare n integer;
begin
  delete from public.trips where id = current_setting('test.sil_trip')::uuid;
  get diagnostics n = row_count;
  assert n = 1, 'sahip seyahati siler';
end $$;
reset role;
do $$
declare t uuid := current_setting('test.sil_trip')::uuid;
begin
  assert not exists (select 1 from public.trips where id = t), 'seyahat silindi';
  assert not exists (select 1 from public.days where trip_id = t), 'günler kalmaz';
  assert not exists (select 1 from public.places where trip_id = t), 'mekanlar kalmaz';
  assert not exists (select 1 from public.stops where trip_id = t), 'duraklar kalmaz';
  assert not exists (select 1 from public.members where trip_id = t), 'üyelikler kalmaz';
  assert not exists (select 1 from public.changes where trip_id = t), 'değişiklikler kalmaz';
  assert not exists (select 1 from public.oylar where seyahat_id = t), 'oylar kalmaz';
  assert not exists (select 1 from public.stop_ratings where trip_id = t), 'puanlar kalmaz';
  assert not exists (select 1 from public.stays where trip_id = t), 'konaklamalar kalmaz';
  assert exists (select 1 from auth.users where id = 'aaaaaaaa-1740-0000-0000-000000000002'), 'üyenin hesabı durur';
end $$;
-- KK6: silinmiş seyahatin davet linki özet döndürmez (uygulama "Bu seyahat artık yok" gösterir), katılım P0002.
set role anon;
do $$ begin assert public.davet_ozeti(current_setting('test.sil_token', true)) is null, 'silinmiş seyahatin daveti özetsiz'; end $$;
reset role;

\echo 'rls_test: TÜM TESTLER GEÇTİ'
