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
-- #229 KK2: kova listelenemez — misafir ve başka kullanıcı A'nın dosyasını görmez; A kendi klasörünü görür (upsert/remove).
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'avatars') = 0, '#229: misafir avatars listeleyemez'; end $$;
select pg_temp.as_user(:B);
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'avatars') = 0, '#229: başka kullanıcı avatars listeleyemez'; end $$;
select pg_temp.as_user(:A);
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'avatars') = 1, '#229: kullanıcı kendi avatarını görür'; end $$;
set role anon;
select pg_temp.as_user(null);
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'avatars') = 0, '#229 KK2: anon avatars listeleyemez'; end $$;
reset role;
do $$
begin
  assert (select metadata from storage.objects where name like 'aaaaaaaa%') = '{"v": 2}', 'misafir başkasının avatarını değiştiremez';
  assert (select public from storage.buckets where id = 'avatars'), '#229 KK2: kova public kalır (genel adresle okuma)';
end $$;

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

-- #406 KK2 · KK3: banner ve raf bölümleri. Yazma yalnız admin (mevcut kural); içerik biçimi CHECK ile denetlenir.
set role authenticated;
select pg_temp.as_email(:B, 'b@ornek.com');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 20, '{}')$$, '42501');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('raf', 'x', 21, '{"raf_turu": "amac", "amac": "lezzet"}')$$, '42501');
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values
  ('banner', 'Kapadokya''da balon sabahı', 20, '{"ust_yazi": "Bu kış", "kapak_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/K.jpg", "kapak_atif": {"yazar": "Tripmate", "lisans": "CC BY 4.0"}, "hedef": {"tur": "raf", "id": "66666666-6666-4666-8666-000000000001"}}'),
  ('raf', 'Lezzet için', 21, '{"raf_turu": "amac", "amac": "lezzet"}'),
  ('raf', 'Hafta sonu kaçamakları', 22, '{"raf_turu": "elle", "gezi_idler": ["33333333-3333-4333-8333-000000000001"]}'),
  ('raf', 'Bursa', 23, '{"raf_turu": "sehir", "sehir_id": "77777777-7777-4777-8777-000000000001"}'),
  -- BO'da yeni açılan boş banner (hedefsiz) taslakta durabilir.
  ('banner', 'Taslak banner', 24, '{}');
-- Biçim hataları: bilinmeyen alan, http görsel, görselsiz atıf, bozuk hedef, bilinmeyen amaç/raf türü, bozuk kimlik listesi.
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"baska": 1}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "http://ornek.com/k.jpg"}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
-- #428 inceleme 4–6: atıfsız görsel; izinli olmayan görsel adresi (Google Places fotoğrafı, başka site); bilinmeyen hedef
-- anahtarı; nesne olmayan içerik (23514, 22023 değil).
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/K.jpg"}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://places.googleapis.com/v1/places/x/photos/y/media?maxWidthPx=800", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://lh3.googleusercontent.com/p/abc", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://ornek.com/k.jpg", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://upload.wikimedia.org.ornek.com/k.jpg", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"hedef": {"tur": "gezi", "id": "66666666-6666-4666-8666-000000000001", "baska": 1}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '[]')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('raf', 'x', 30, '"amac"')$$, '23514');
-- #428 2. inceleme 3: yol hilesi (`..`, kodlanmış `%2e`/`%2E`/`%2f`/`%5c`, ters bölü) reddedilir.
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/../avatars/u1/a.jpg", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/%2E%2e/avatars/u1/a.jpg", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/x%2Favatars%5Ca.jpg", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://upload.wikimedia.org/x\\y.jpg", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
-- #428 3. inceleme (isteğe bağlı): çift kodlanmış `%252e` de reddedilir.
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/%252e%252e/avatars/u1/a.jpg", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
-- #406 2/2 KK-ek1: izin listesi. Sekme ve satır sonuyla yol hilesi (`.<TAB>.`, `.<LF>.`), boşluk ve `?`/`#`/`@` reddedilir.
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, jsonb_build_object('kapak_url', 'https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/.' || chr(9) || './avatars/u1/a.jpg', 'kapak_atif', '{"yazar": "Tripmate"}'::jsonb))$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, jsonb_build_object('kapak_url', 'https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/.' || chr(10) || './avatars/u1/a.jpg', 'kapak_atif', '{"yazar": "Tripmate"}'::jsonb))$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/a b.jpg", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"kapak_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/a.jpg?x=1", "kapak_atif": {"yazar": "Tripmate"}}')$$, '23514');
do $$
begin
  assert public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa_Ulu_Cami.jpg'), '#406 KK-ek1: düz Commons adresi geçer';
  assert public.banner_gorsel_adresi_gecerli('https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/banner/kis-2026.jpg'), '#406 KK-ek1: kova adresi geçer';
end $$;
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, jsonb_build_object('kapak_url', 'https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/.' || chr(13) || './avatars/u1/a.jpg', 'kapak_atif', '{"yazar": "Tripmate"}'::jsonb))$$, '23514');
do $$
begin
  -- #438 inceleme 1 ve 7: parantez ve virgül geçer; `'`, unicode nokta, kodlanmış kontrol karakteri ve yerel viki reddedilir.
  assert public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/ab/Ulu_Cami_(Bursa),_2019.jpg'), '#438: parantez ve virgül geçer';
  assert public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/ab/G%C3%B6l.jpg'), '#438: %XX geçer';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/ab/Ece''s.jpg'), '#438: tek tırnak reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/' || chr(65294) || chr(65294) || '/avatars/a.jpg'), '#438: unicode nokta reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/ab/x' || chr(13) || '.jpg'), '#438: CR reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/%09/x.jpg'), '#438: %09 reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/%00/x.jpg'), '#438: %00 reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/%1f/x.jpg'), '#438: %1f reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/%7F/x.jpg'), '#438: %7F reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/commons/a/%2/x.jpg'), '#438: yarım %X reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/wikipedia/en/a/ab/Poster.jpg'), '#438: yerel viki (adil kullanım) reddedilir';
  assert not public.banner_gorsel_adresi_gecerli('https://upload.wikimedia.org/a.jpg'), '#438: commons öneki şart';
end $$;
-- Kendi Storage alanımızdaki görsel (atıflı) kabul edilir.
insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values
  ('banner', 'Storage görselli', 25, '{"kapak_url": "https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/banner/k.webp", "kapak_atif": {"yazar": "Tripmate"}}');
delete from public.ana_sayfa_bolumleri where sira = 25;
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"hedef": {"tur": "yer", "id": "66666666-6666-4666-8666-000000000001"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"hedef": {"tur": "gezi", "id": "bozuk"}}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('banner', 'x', 30, '{"ust_yazi": "   "}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('raf', 'x', 30, '{}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('raf', 'x', 30, '{"raf_turu": "amac", "amac": "alisveris"}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('raf', 'x', 30, '{"raf_turu": "rastgele"}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('raf', 'x', 30, '{"raf_turu": "elle", "gezi_idler": [1, 2]}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.ana_sayfa_bolumleri (tur, baslik, sira, icerik) values ('raf', 'x', 30, '{"raf_turu": "sehir", "sehir_id": "Bursa"}')$$, '23514');
select pg_temp.hata_bekle($$update public.ana_sayfa_bolumleri set icerik = '{"raf_turu": "amac", "amac": 5}' where baslik = 'Lezzet için'$$, '23514');
-- Yayınlanmadan uygulama yeni bölümleri görmez; yayından sonra anon banner ve rafları içerikleriyle okur.
set role anon;
do $$ begin assert not exists (select 1 from public.ana_sayfa_gorunen where tur in ('banner', 'raf')), '#406: yayın öncesi banner/raf görünmez'; end $$;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert public.ana_sayfa_yayinla() is not null, '#406: admin yayınlar'; end $$;
set role anon;
do $$
begin
  assert (select string_agg(baslik, ',' order by sira) from public.ana_sayfa_gorunen where tur in ('banner', 'raf'))
    = 'Kapadokya''da balon sabahı,Lezzet için,Hafta sonu kaçamakları,Bursa,Taslak banner', '#406: banner ve raflar sırayla görünür';
  assert (select icerik -> 'hedef' ->> 'tur' from public.ana_sayfa_gorunen where tur = 'banner' and sira = 20) = 'raf', '#406: banner hedefi okunur';
  assert (select icerik ->> 'amac' from public.ana_sayfa_gorunen where tur = 'raf' and sira = 21) = 'lezzet', '#406: amaç rafı okunur';
end $$;
-- Sonraki testler eski düzeni beklemesin: #406 bölümleri temizlenir, yayın yenilenir.
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
delete from public.ana_sayfa_bolumleri where sira between 20 and 24;
select public.ana_sayfa_yayinla();
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
-- #361 KK8 ana sayfa v5 olayları; bilinmeyen tür yine reddedilir.
insert into public.olaylar (tur, hedef_id, meta) values ('ana_kart_acildi', null, '{"amac": "hepsi"}'), ('ana_ara', null, '{"sonuc": "gezi"}'), ('planlamaya_devam', null, null);
select pg_temp.hata_bekle($$insert into public.olaylar (tur) values ('ana_bilinmeyen')$$, '23514');
-- #396 KK7 Plan hazır davet olayı (kendi adına, seyahat kimliğiyle).
insert into public.olaylar (tur, hedef_id) values ('plan_hazir_davet', '88888888-8888-4888-8888-000000000001');
-- #405 KK6 alt menü sekme olayı (meta: sekme).
insert into public.olaylar (tur, meta) values ('sekme_acildi', '{"sekme": "seyahatlerim"}');
-- #406 KK6 raflı ana sayfa olayları (kendi adına).
insert into public.olaylar (tur, hedef_id, meta) values ('banner_acildi', '66666666-6666-4666-8666-000000000001', '{"hedef": "raf"}'), ('raf_kart_acildi', '33333333-3333-4333-8333-000000000001', '{"raf": "66666666-6666-4666-8666-000000000001", "raf_turu": "elle"}'),
  ('raf_kart_acildi', '33333333-3333-4333-8333-000000000001', '{"raf": "amac:lezzet", "raf_turu": "amac"}');
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
-- #160 KK2: geçersiz `tz`'li bir satır (doğrulama tetikleyicisinden önce yazılmış olabilir) temizliği düşürmez.
alter table public.trips disable trigger trips_tz_dogrula;
insert into public.trips (owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date, name)
values (:VT, 'ChIJ-varis-3', 'Bursa', 40.18, 29.06, 'Mars/Olympus', current_date - 10, current_date - 8, 'Bozuk dilim');
alter table public.trips enable trigger trips_tz_dogrula;
do $$ begin assert public.gecmis_varislari_temizle() >= 0, 'geçersiz tz satırı varken temizlik hata vermeden çalışır'; end $$;
delete from public.trips where city_place_id = 'ChIJ-varis-3';
do $$ begin
  assert (select prosecdef from pg_proc where oid = 'public.gecmis_varislari_temizle(uuid)'::regprocedure), 'temizlik security definer kalır';
  assert not has_function_privilege('anon', 'public.gecmis_varislari_temizle(uuid)', 'execute'), 'anon temizliği çağıramaz';
end $$;


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
reset role; -- #263: kimlik istemciden seçilemez; sabit kimlikli kurulum superuser ile
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date) values
  ('14400000-0000-4000-8000-000000000001', :X, 'ChIJ-esk', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul', '2026-03-10', '2026-03-12'),
  ('14400000-0000-4000-8000-000000000002', :X, 'ChIJ-esk', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul', '2099-01-01', '2099-01-02'),
  ('14400000-0000-4000-8000-000000000003', :X, 'ChIJ-bur', 'Bursa', 40.18, 29.06, 'Europe/Istanbul', null, null);
set role authenticated;
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
reset role; -- #263: kimlik istemciden seçilemez; sabit kimlikli kurulum superuser ile
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date) values
  ('14400000-0000-4000-8000-000000000004', :X, 'ChIJ-esk', 'Eskişehir', 39.77, 30.52, 'Europe/Istanbul', '2099-06-01', '2099-06-02');
set role authenticated;
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

-- #205 KK2: osm_id'li durak ve yeni yer satırı `osm` kaynağıyla yazılır (damga yok); osm_id'siz durak google_30g + damga.
do $$
declare
  v jsonb := jsonb_set(jsonb_set(pg_temp.icerik_ornek('hat-osm'), '{gunler,0,duraklar,0}',
    '{"place_id": "ChIJ-osm-deneme-1", "ad": "OSM durağı", "kategori": "museum", "sure_dk": 45, "lat": 39.7628, "lng": 30.5262, "osm_id": "way/123456", "rehber_md": "Rehber."}'),
    '{gunler,0,duraklar,1,osm_id}', 'null');
  g uuid;
begin
  perform public.icerik_gezi_taslak_yukle(v);
  g := (select id from public.geziler where slug = 'hat-osm');
  assert (select konum_kaynagi = 'osm' and osm_id = 'way/123456' and google_fetched_at is null
    from public.gezi_duraklari d join public.gezi_gunleri gg on gg.id = d.gezi_gun_id where gg.gezi_id = g and gg.sira = 1 and d.sira = 1), 'KK2: osm durağı';
  assert (select konum_kaynagi = 'google_30g' and osm_id is null and google_fetched_at is not null
    from public.gezi_duraklari d join public.gezi_gunleri gg on gg.id = d.gezi_gun_id where gg.gezi_id = g and gg.sira = 1 and d.sira = 2), 'KK2: osm_id null → google_30g';
  assert (select konum_kaynagi = 'osm' and osm_id = 'way/123456' and google_fetched_at is null and not yayin
    from public.yerler where place_id = 'ChIJ-osm-deneme-1'), 'KK2: yeni yer satırı osm';
  assert (select (public.konum_kaynagi_kontrol() -> 'gezi_duraklari' ->> 'osm')::int) >= 1, 'KK6: kontrol osm sayar';
end $$;
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-osm-bozuk'), '{gunler,0,duraklar,0,osm_id}', '"node/abc"'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.icerik_ornek('hat-osm-bozuk'), '{gunler,0,duraklar,0,osm_id}', '123'))$$, '22023');
do $$ begin assert not exists (select 1 from public.geziler where slug = 'hat-osm-bozuk'), 'KK2: bozuk osm_id iz bırakmaz'; end $$;

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

-- #300 KK4: veri migration'ı (20261128000000) place_id'siz Eskişehir tohum yerlerini adla etiketledi; taze kurulumda
-- yükleme satırı yok, gezi tohumu (eskisehir-iki-gun) listede değil. Aşağıdaki KK1 testleri boş amaçtan başlar.
do $$
begin
  assert (select amaclar from public.yerler where ad = 'Porsuk Çayı Adalar' and place_id is null) = '{yavas,gece}', '#300 KK4: Porsuk Adalar';
  assert (select amaclar from public.yerler where ad = 'Odunpazarı Evleri' and place_id is null) = '{kultur_tarih,yavas}', '#300 KK4: Odunpazarı Evleri';
  assert (select amaclar from public.yerler where ad = 'Sazova Parkı') = '{}', '#300 KK4: listede olmayan yer boş kalır';
  assert (select amaclar from public.geziler where slug = 'eskisehir-iki-gun') = '{}', '#300 KK4: listede olmayan gezi boş kalır';
end $$;
update public.yerler set amaclar = '{}' where amaclar <> '{}';

-- #300 KK1–KK2: amaç etiketleri. Değerler yalnız sabit 6'lıdan, tekrarsız (check); okuma kuralı aynı (yayındaki satır);
-- yükleme gezi.amaclar'ı geziye, durak amaclar'ını yer satırına yazar (yalnız taslak ve amacı boş satır).
select pg_temp.hata_bekle($$update public.geziler set amaclar = '{plaj}' where slug = 'eskisehir-iki-gun'$$, '23514');
select pg_temp.hata_bekle($$update public.geziler set amaclar = '{lezzet,lezzet}' where slug = 'eskisehir-iki-gun'$$, '23514');
select pg_temp.hata_bekle($$update public.yerler set amaclar = '{Lezzet}' where ad = 'Taslak Yer'$$, '23514');
update public.geziler set amaclar = '{kultur_tarih,yavas}' where slug = 'eskisehir-iki-gun';
update public.yerler set amaclar = '{cocuklu}' where ad = 'Odunpazarı Evleri';
update public.yerler set amaclar = '{gece}' where ad = 'Taslak Yer';
set role anon;
do $$
begin
  assert (select amaclar from public.geziler where slug = 'eskisehir-iki-gun') = '{kultur_tarih,yavas}', '#300 KK1: yayındaki gezinin amaçları herkese açık';
  assert (select count(*) from public.geziler where amaclar @> '{yavas}') = 1, '#300 KK1: amaçla süzülür';
  assert (select count(*) from public.yerler where amaclar @> '{cocuklu}') = 1, '#300 KK1: yayındaki yerin amacı okunur';
  assert not exists (select 1 from public.yerler where amaclar @> '{gece}'), '#300 KK1: taslak yerin amacı görünmez (mevcut kural)';
end $$;
reset role;
update public.geziler set amaclar = '{}' where slug = 'eskisehir-iki-gun';
update public.yerler set amaclar = '{}' where ad in ('Odunpazarı Evleri', 'Taslak Yer');

insert into public.yerler (sehir_id, place_id, ad, kategori, lat, lng, yayin, amaclar) values
  ('11111111-1111-4111-8111-000000000001', 'ChIJ-amac-yayin-1', 'Yayındaki yer', 'museum', 39.76, 30.52, true, '{}'),
  ('11111111-1111-4111-8111-000000000001', 'ChIJ-amac-bos-001', 'Amaçsız taslak', 'cafe', 39.76, 30.52, false, '{}'),
  ('11111111-1111-4111-8111-000000000001', 'ChIJ-amac-dolu-01', 'Amaçlı taslak', 'park', 39.76, 30.52, false, '{doga}');
create function pg_temp.amacli(p_slug text) returns jsonb
language sql as $$
  select jsonb_set(jsonb_set(pg_temp.icerik_ornek(p_slug), '{gezi,amaclar}', '["lezzet", "kultur_tarih"]'), '{gunler,0,duraklar}', jsonb_build_array(
    jsonb_build_object('place_id', 'ChIJ-amac-yeni-01', 'ad', 'Yeni yer', 'kategori', 'restaurant', 'sure_dk', 60, 'lat', 39.76, 'lng', 30.52, 'rehber_md', 'Rehber.', 'amaclar', jsonb_build_array('lezzet')),
    jsonb_build_object('place_id', 'ChIJ-amac-yayin-1', 'ad', 'Yayındaki yer', 'kategori', 'museum', 'sure_dk', 60, 'lat', 39.76, 'lng', 30.52, 'amaclar', jsonb_build_array('kultur_tarih')),
    jsonb_build_object('place_id', 'ChIJ-amac-bos-001', 'ad', 'Amaçsız taslak', 'kategori', 'cafe', 'sure_dk', 30, 'lat', 39.76, 'lng', 30.52, 'amaclar', jsonb_build_array('yavas', 'lezzet')),
    jsonb_build_object('place_id', 'ChIJ-amac-dolu-01', 'ad', 'Amaçlı taslak', 'kategori', 'park', 'sure_dk', 45, 'lat', 39.76, 'lng', 30.52, 'amaclar', jsonb_build_array('gece')),
    jsonb_build_object('place_id', 'ChIJ-amac-yok-001', 'ad', 'Yer satırı yok', 'kategori', 'park', 'sure_dk', 45, 'lat', 39.76, 'lng', 30.52, 'amaclar', jsonb_build_array('doga')),
    jsonb_build_object('place_id', 'ChIJ-amacsiz-0001', 'ad', 'Amaç verilmedi', 'kategori', 'park', 'sure_dk', 45, 'lat', 39.76, 'lng', 30.52, 'amaclar', null)));
$$;
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.amacli('hat-amac-bozuk'), '{gezi,amaclar}', '["plaj"]'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.amacli('hat-amac-bozuk'), '{gezi,amaclar}', '["doga", "doga"]'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.amacli('hat-amac-bozuk'), '{gezi,amaclar}', '"lezzet"'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.amacli('hat-amac-bozuk'), '{gunler,0,duraklar,0,amaclar}', '["gece", 1]'))$$, '22023');
select pg_temp.hata_bekle($$select public.icerik_gezi_taslak_yukle(jsonb_set(pg_temp.amacli('hat-amac-bozuk'), '{gunler,0,duraklar,2,amaclar}', '["cocuk"]'))$$, '22023');
do $$ begin assert not exists (select 1 from public.geziler where slug = 'hat-amac-bozuk') and not exists (select 1 from public.yerler where place_id = 'ChIJ-amac-yeni-01'), '#300 KK2: bozuk amaç iz bırakmaz'; end $$;
do $$
declare r jsonb := public.icerik_gezi_taslak_yukle(pg_temp.amacli('hat-amac'));
begin
  assert (select amaclar from public.geziler where slug = 'hat-amac') = '{lezzet,kultur_tarih}' and r -> 'amaclar' = '["lezzet", "kultur_tarih"]', format('#300 KK2 gezi: %s', r);
  assert (select amaclar from public.yerler where place_id = 'ChIJ-amac-yeni-01') = '{lezzet}', '#300 KK2: yeni yer satırı amaçla açılır';
  assert (select amaclar from public.yerler where place_id = 'ChIJ-amac-bos-001') = '{yavas,lezzet}', '#300 KK2: amaçsız taslağa yazılır';
  assert (select amaclar from public.yerler where place_id = 'ChIJ-amac-yayin-1') = '{}', '#300 KK2: yayındaki yere dokunulmaz';
  assert (select amaclar from public.yerler where place_id = 'ChIJ-amac-dolu-01') = '{doga}', '#300 KK2: amacı dolu taslağa dokunulmaz';
  assert not exists (select 1 from public.yerler where place_id in ('ChIJ-amac-yok-001', 'ChIJ-amacsiz-0001')), '#300 KK2: amaç yüzünden yer satırı açılmaz';
  assert (r ->> 'amac_yazilan')::int = 2 and r -> 'amac_atlanan' @> '["ChIJ-amac-yayin-1", "ChIJ-amac-dolu-01", "ChIJ-amac-yok-001"]'
    and jsonb_array_length(r -> 'amac_atlanan') = 3, format('#300 KK2 sayılar: %s', r);
  -- Yeniden yükleme: plan dosyası kaynaktır; amaçsız yüklenirse gezinin amaçları boşalır.
  r := public.icerik_gezi_taslak_yukle(pg_temp.icerik_ornek('hat-amac'), true);
  assert (select amaclar from public.geziler where slug = 'hat-amac') = '{}' and r -> 'amaclar' = '[]', format('#300 KK2 yeniden: %s', r);
end $$;
select public.icerik_gezi_taslak_sil('hat-amac');
delete from public.yerler where place_id like 'ChIJ-amac-%';

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

-- #181 KK4 Tarihleri değiştir: üye çağırır, günler kayar; uzayınca sona gün eklenir (son günün oteliyle), kısalınca sondaki
-- günler ve durakları kalkar (mekan listede kalır). Dışarıdan biri çağıramaz; ters aralık reddedilir.
reset role;
\set TS '''aaaaaaaa-1810-0000-0000-000000000001'''
\set TU '''aaaaaaaa-1810-0000-0000-000000000002'''
\set TN '''aaaaaaaa-1810-0000-0000-000000000003'''
insert into auth.users (id, is_anonymous) values (:TS, false), (:TU, false), (:TN, false);
insert into public.profiles (id, name, username) values (:TS, 'Sahip', 'sahip181'), (:TU, 'Uye', 'uye181'), (:TN, 'Disari', 'disari181');
set role authenticated;
select pg_temp.as_user(:TS);
insert into public.trips (owner_id, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date)
  values (:TS, 'ChIJ-tarih181', 'Tarihli', 'TR', 39.77, 30.52, 'Europe/Istanbul', '2026-11-10', '2026-11-12');
reset role;
select id as tarih_trip, invite_token as tarih_token from public.trips where owner_id = :TS \gset
select set_config('test.tarih_trip', :'tarih_trip', false);
set role authenticated;
select pg_temp.as_user(:TU);
select public.join_trip(:'tarih_token', 'Uye');
select pg_temp.as_user(:TS);
insert into public.stays (trip_id, place_id, lat, lng, label, created_by) values (:'tarih_trip', 'ChIJ-otel181', 39.77, 30.52, 'Otel', :TS);
update public.days set start_stay_id = (select id from public.stays where trip_id = :'tarih_trip'), end_stay_id = (select id from public.stays where trip_id = :'tarih_trip')
  where trip_id = :'tarih_trip' and index = 3;
insert into public.places (trip_id, place_id, primary_type, lat, lng, added_by) values (:'tarih_trip', 'ChIJ-son-gun-181', 'museum', 39.77, 30.52, :TS);
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
  select d.trip_id, d.id, p.id, 'a0', 45 from public.days d join public.places p on p.trip_id = d.trip_id
  where d.trip_id = :'tarih_trip' and d.index = 3;
-- Dışarıdan biri ve ters aralık.
select pg_temp.as_user(:TN);
select pg_temp.hata_bekle(format('select public.seyahat_tarihlerini_degistir(%L, %L, %L)', current_setting('test.tarih_trip'), '2026-11-11', '2026-11-13'), '42501');
select pg_temp.as_user(:TU);
select pg_temp.hata_bekle(format('select public.seyahat_tarihlerini_degistir(%L, %L, %L)', current_setting('test.tarih_trip'), '2026-11-13', '2026-11-11'), '22023');
-- Üye uzatır ve kaydırır: 3 gün → 5 gün, bir gün ileri.
do $$
declare t uuid := current_setting('test.tarih_trip')::uuid;
begin
  assert public.seyahat_tarihlerini_degistir(t, '2026-11-11', '2026-11-15') = 5, 'yeni gün sayısı';
  assert (select start_date from public.trips where id = t) = '2026-11-11' and (select end_date from public.trips where id = t) = '2026-11-15', 'seyahat tarihleri';
  assert (select count(*) from public.days where trip_id = t) = 5, '5 gün';
  assert not exists (select 1 from public.days where trip_id = t and date <> '2026-11-11'::date + (index - 1)), 'günler sırayla tarihlendi';
  assert (select count(*) from public.days d join public.stays s on s.id = d.start_stay_id and s.id = d.end_stay_id where d.trip_id = t and d.index in (4, 5)) = 2,
    'yeni günler son günün oteliyle';
  assert (select count(*) from public.stops where trip_id = t) = 1, 'durak yerinde';
end $$;
-- Kısaltır: 5 gün → 2 gün; 3. gündeki durak kalkar, mekan listede kalır.
do $$
declare t uuid := current_setting('test.tarih_trip')::uuid;
begin
  assert public.seyahat_tarihlerini_degistir(t, '2026-11-11', '2026-11-12') = 2, 'kısalan gün sayısı';
  assert (select count(*) from public.days where trip_id = t) = 2, '2 gün';
  assert not exists (select 1 from public.stops where trip_id = t), 'silinen günün durağı kalktı';
  assert exists (select 1 from public.places where trip_id = t and place_id = 'ChIJ-son-gun-181'), 'mekan listede kalır';
end $$;
reset role;

-- #183 Harcamalar: üye okur/ekler; ekleyen ya da sahip düzenler/siler; paylar toplamı = harcama (₺) ve yalnız harcama_kaydet'le
-- yazılır; doğrudan güncelleme akışa düşer; ödeşmeyi iki taraf işaretler/siler (ayrılan üyeyle de; açık borcu aşmadan); IBAN
-- yalnız borçlu karşı tarafa görünür; fiş kovası yalnız üyelere (silme: yükleyen ya da sahip); Geri al (ekleme · silme · düzenleme).
reset role;
\set HS '''aaaaaaaa-1830-0000-0000-000000000001'''
\set HU '''aaaaaaaa-1830-0000-0000-000000000002'''
\set HV '''aaaaaaaa-1830-0000-0000-000000000003'''
\set HN '''aaaaaaaa-1830-0000-0000-000000000004'''
insert into auth.users (id, is_anonymous) values (:HS, false), (:HU, false), (:HV, false), (:HN, false);
insert into public.profiles (id, name, username) values (:HS, 'Ece', 'ece183'), (:HU, 'Ayse', 'ayse183'), (:HV, 'Mert', 'mert183'), (:HN, 'Disari', 'disari183');
set role authenticated;
select pg_temp.as_user(:HS);
insert into public.trips (owner_id, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date)
  values (:HS, 'ChIJ-harcama183', 'Harcamali', 'TR', 39.77, 30.52, 'Europe/Istanbul', '2026-11-20', '2026-11-22');
reset role;
select id as h_trip, invite_token as h_token from public.trips where owner_id = :HS \gset
select set_config('test.h_trip', :'h_trip', false);
set role authenticated;
select pg_temp.as_user(:HU);
select public.join_trip(:'h_token', 'Ayşe');
select pg_temp.as_user(:HV);
select public.join_trip(:'h_token', 'Mert');
select pg_temp.as_user(:HS);
insert into public.places (trip_id, place_id, primary_type, lat, lng, added_by) values (:'h_trip', 'ChIJ-cibörek-183', 'restaurant', 39.77, 30.52, :HS);
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
  select d.trip_id, d.id, p.id, 'a0', 60 from public.days d join public.places p on p.trip_id = d.trip_id
  where d.trip_id = :'h_trip' and d.index = 1;
reset role;
select id as h_stop from public.stops where trip_id = :'h_trip' \gset
select set_config('test.h_stop', :'h_stop', false);
select set_config('test.diger_stop', (select id::text from public.stops where trip_id <> :'h_trip' limit 1), false);
do $$ begin assert current_setting('test.diger_stop') <> '', 'başka seyahatte durak var'; end $$;
set role authenticated;

-- Ayşe 100 ₺'yi üçe böler (yuvarlama farkı ödeyene) ve durağa bağlar.
select pg_temp.as_user(:HU);
select public.harcama_kaydet(:'h_trip', null, '  Çibörek öğle yemeği ', 10000, 'TRY', 10000, 'yemek', :HU, :'h_stop', null,
  jsonb_build_array(jsonb_build_object('user_id', :HU, 'pay_kurus', 3334), jsonb_build_object('user_id', :HS, 'pay_kurus', 3333),
                    jsonb_build_object('user_id', :HV, 'pay_kurus', 3333))) as h1 \gset
select set_config('test.h1', :'h1', false);
do $$
declare h uuid := current_setting('test.h1')::uuid;
begin
  assert (select aciklama from public.harcamalar where id = h) = 'Çibörek öğle yemeği', 'açıklama kırpılır';
  assert (select olusturan from public.harcamalar where id = h) = auth.uid(), 'oluşturan çağıran';
  assert (select sum(pay_kurus) from public.harcama_paylari where harcama_id = h) = 10000, 'paylar toplamı';
  assert exists (select 1 from public.changes where entity = 'harcamalar' and entity_id = h::text and old is null), 'ekleme akışa düştü';
end $$;
-- Toplam tutmayan paylar, üye olmayan ödeyen / pay sahibi, başka seyahatin durağı, boş bölüşüm reddedilir.
select pg_temp.hata_bekle(format('select public.harcama_kaydet(%L, null, %L, 10000, %L, 10000, %L, %L, null, null, %L)',
  current_setting('test.h_trip'), 'x', 'TRY', 'yemek', 'aaaaaaaa-1830-0000-0000-000000000002',
  '[{"user_id": "aaaaaaaa-1830-0000-0000-000000000002", "pay_kurus": 9000}]'), '23514');
select pg_temp.hata_bekle(format('select public.harcama_kaydet(%L, null, %L, 10000, %L, 10000, %L, %L, null, null, %L)',
  current_setting('test.h_trip'), 'x', 'TRY', 'yemek', 'aaaaaaaa-1830-0000-0000-000000000004',
  '[{"user_id": "aaaaaaaa-1830-0000-0000-000000000002", "pay_kurus": 10000}]'), '22023');
select pg_temp.hata_bekle(format('select public.harcama_kaydet(%L, null, %L, 10000, %L, 10000, %L, %L, null, null, %L)',
  current_setting('test.h_trip'), 'x', 'TRY', 'yemek', 'aaaaaaaa-1830-0000-0000-000000000002',
  '[{"user_id": "aaaaaaaa-1830-0000-0000-000000000004", "pay_kurus": 10000}]'), '22023');
select pg_temp.hata_bekle(format('select public.harcama_kaydet(%L, null, %L, 10000, %L, 10000, %L, %L, %L, null, %L)',
  current_setting('test.h_trip'), 'x', 'TRY', 'yemek', 'aaaaaaaa-1830-0000-0000-000000000002',
  current_setting('test.diger_stop'),
  '[{"user_id": "aaaaaaaa-1830-0000-0000-000000000002", "pay_kurus": 10000}]'), '22023');
select pg_temp.hata_bekle(format('select public.harcama_kaydet(%L, null, %L, 10000, %L, 10000, %L, %L, null, null, %L)',
  current_setting('test.h_trip'), 'x', 'TRY', 'yemek', 'aaaaaaaa-1830-0000-0000-000000000002', '[]'), '22023');
-- TRY'de ₺ karşılığı tutara eşit olmalı; dövizde kurla çevrilmiş tutar.
select pg_temp.hata_bekle(format('select public.harcama_kaydet(%L, null, %L, 10000, %L, 12000, %L, %L, null, null, %L)',
  current_setting('test.h_trip'), 'x', 'TRY', 'yemek', 'aaaaaaaa-1830-0000-0000-000000000002',
  '[{"user_id": "aaaaaaaa-1830-0000-0000-000000000002", "pay_kurus": 12000}]'), '23514');
select public.harcama_kaydet(:'h_trip', null, 'Müze', 2000, 'EUR', 72000, 'bilet', :HU, null, null,
  jsonb_build_array(jsonb_build_object('user_id', :HU, 'pay_kurus', 36000), jsonb_build_object('user_id', :HV, 'pay_kurus', 36000))) as h2 \gset
select set_config('test.h2', :'h2', false);

-- Dışarıdan biri göremez ve yazamaz.
select pg_temp.as_user(:HN);
do $$
begin
  assert (select count(*) from public.harcamalar where trip_id = current_setting('test.h_trip')::uuid) = 0, 'üye olmayan harcamayı göremez';
  assert (select count(*) from public.harcama_paylari where trip_id = current_setting('test.h_trip')::uuid) = 0, 'üye olmayan payı göremez';
end $$;
select pg_temp.hata_bekle(format('select public.harcama_kaydet(%L, null, %L, 10000, %L, 10000, %L, %L, null, null, %L)',
  current_setting('test.h_trip'), 'x', 'TRY', 'yemek', 'aaaaaaaa-1830-0000-0000-000000000004',
  '[{"user_id": "aaaaaaaa-1830-0000-0000-000000000004", "pay_kurus": 10000}]'), '42501');
select pg_temp.hata_bekle(format('insert into public.harcamalar (trip_id, tutar_kurus, tl_kurus, odeyen_id) values (%L, 100, 100, %L)',
  current_setting('test.h_trip'), 'aaaaaaaa-1830-0000-0000-000000000004'), '42501');

-- Mert (üye, ekleyen değil, sahip değil) Ayşe'nin harcamasını silemez, düzenleyemez, payına dokunamaz.
select pg_temp.as_user(:HV);
delete from public.harcamalar where id = :'h1';
select pg_temp.hata_bekle(format('update public.harcama_paylari set pay_kurus = 0 where harcama_id = %L', current_setting('test.h1')), '42501');
do $$
declare h uuid := current_setting('test.h1')::uuid;
begin
  assert exists (select 1 from public.harcamalar where id = h), 'üye başkasının harcamasını silemez';
  assert (select pay_kurus from public.harcama_paylari where harcama_id = h and user_id = auth.uid()) = 3333, 'üye başkasının payını değiştiremez';
end $$;
select pg_temp.hata_bekle(format('select public.harcama_kaydet(%L, %L, %L, 10000, %L, 10000, %L, %L, null, null, %L)',
  current_setting('test.h_trip'), current_setting('test.h1'), 'x', 'TRY', 'yemek', 'aaaaaaaa-1830-0000-0000-000000000003',
  '[{"user_id": "aaaaaaaa-1830-0000-0000-000000000003", "pay_kurus": 10000}]'), '42501');
select pg_temp.hata_bekle(format('delete from public.harcama_paylari where harcama_id = %L; insert into public.harcama_paylari (harcama_id, trip_id, user_id, pay_kurus) values (%L, %L, %L, 0)',
  current_setting('test.h1'), current_setting('test.h1'), current_setting('test.h_trip'), 'aaaaaaaa-1830-0000-0000-000000000001'), '42501');
-- Geri al da aynı kural: Mert, Ayşe'nin eklemesini geri alamaz.
select pg_temp.hata_bekle(format('select public.degisikligi_geri_al(%s)',
  (select id from public.changes where entity = 'harcamalar' and entity_id = current_setting('test.h1') and old is null)), '42501');

-- Ekleyen bile payları doğrudan yazamaz (toplamı koruyarak kişiler arasında kaydırma da yok): yalnız harcama_kaydet.
select pg_temp.as_user(:HU);
select pg_temp.hata_bekle(format('update public.harcama_paylari set pay_kurus = pay_kurus where harcama_id = %L', current_setting('test.h1')), '42501');
select pg_temp.hata_bekle(format('delete from public.harcama_paylari where harcama_id = %L', current_setting('test.h1')), '42501');
-- Doğrudan güncelleme (PATCH) akışa düşer: updated_at ilerler, değişen alan kaydedilir; fiş başka klasörden olamaz.
update public.harcamalar set kategori = 'bilet' where id = :'h1';
do $$
declare h uuid := current_setting('test.h1')::uuid;
begin
  assert exists (select 1 from public.changes where entity = 'harcamalar' and entity_id = h::text and field = 'kategori' and new = '"bilet"'), 'doğrudan güncelleme akışa düştü';
end $$;
select pg_temp.hata_bekle(format('update public.harcamalar set fis_yolu = %L where id = %L', 'baska/fis.jpg', current_setting('test.h1')), '23514');

-- Sahip düzenler: 120 ₺, Mert hariç ikiye; değişmeyen pay yeniden yazılmaz, Mert'in payı silinir.
select pg_temp.as_user(:HS);
select public.harcama_kaydet(:'h_trip', :'h1', 'Çibörek', 12000, 'TRY', 12000, 'yemek', :HU, :'h_stop', null,
  jsonb_build_array(jsonb_build_object('user_id', :HU, 'pay_kurus', 6000), jsonb_build_object('user_id', :HS, 'pay_kurus', 6000),
                    jsonb_build_object('user_id', :HV, 'pay_kurus', 0)));
do $$
declare h uuid := current_setting('test.h1')::uuid;
begin
  assert (select tl_kurus from public.harcamalar where id = h) = 12000, 'sahip düzenledi';
  assert (select count(*) from public.harcama_paylari where harcama_id = h) = 2, 'sıfır pay yazılmaz, eski pay silinir';
  assert (select olusturan from public.harcamalar where id = h) = 'aaaaaaaa-1830-0000-0000-000000000002', 'oluşturan değişmez';
end $$;
-- Sahip düzenlemesini geri alır: tutar, açıklama ve üç pay eski haline döner.
select public.degisikligi_geri_al((select max(id) from public.changes where entity = 'harcamalar' and entity_id = current_setting('test.h1') and field = 'tl_kurus'));
do $$
declare h uuid := current_setting('test.h1')::uuid;
begin
  assert (select tl_kurus from public.harcamalar where id = h) = 10000, 'tutar geri döndü';
  assert (select aciklama from public.harcamalar where id = h) = 'Çibörek öğle yemeği', 'açıklama geri döndü';
  assert (select count(*) from public.harcama_paylari where harcama_id = h) = 3, 'üç pay geri döndü';
  assert (select pay_kurus from public.harcama_paylari where harcama_id = h and user_id = 'aaaaaaaa-1830-0000-0000-000000000002') = 3334, 'yuvarlama payı geri döndü';
end $$;

-- Ekleyen siler; silme geri alınınca harcama payları ile geri gelir; ekleme geri alınınca harcama kalkar.
select pg_temp.as_user(:HU);
delete from public.harcamalar where id = :'h1';
do $$ begin assert not exists (select 1 from public.harcamalar where id = current_setting('test.h1')::uuid), 'ekleyen siler'; end $$;
select public.degisikligi_geri_al((select max(id) from public.changes where entity = 'harcamalar' and entity_id = current_setting('test.h1') and new is null and field is null));
do $$
declare h uuid := current_setting('test.h1')::uuid;
begin
  assert (select stop_id from public.harcamalar where id = h) = current_setting('test.h_stop')::uuid, 'silme geri alındı (durak bağıyla)';
  assert (select sum(pay_kurus) from public.harcama_paylari where harcama_id = h) = 10000, 'paylar geri geldi';
end $$;
select public.degisikligi_geri_al((select id from public.changes where entity = 'harcamalar' and entity_id = current_setting('test.h2') and old is null));
do $$ begin assert not exists (select 1 from public.harcamalar where id = current_setting('test.h2')::uuid), 'ekleme geri alındı'; end $$;
-- Durak silinince bağ boşalır, harcama kalır; bu boşalma akışa düşmez.
select pg_temp.as_user(:HS);
delete from public.stops where id = :'h_stop';
do $$
declare h uuid := current_setting('test.h1')::uuid;
begin
  assert (select stop_id from public.harcamalar where id = h) is null, 'durak silinince bağ boşaldı';
  assert not exists (select 1 from public.changes where entity = 'harcamalar' and entity_id = h::text and field = 'stop_id'), 'FK boşalması akışa düşmez';
end $$;

-- Ödeşme: iki taraftan biri işaretler/siler; üçüncü kişi işaretleyemez/silemez; kendine ödeşme, dışarıdan taraf ve açık borcu
-- aşan tutar yok.
select pg_temp.as_user(:HV);
select pg_temp.hata_bekle(format('insert into public.odesmeler (trip_id, kimden, kime, tl_kurus) values (%L, %L, %L, 1)',
  current_setting('test.h_trip'), 'aaaaaaaa-1830-0000-0000-000000000003', 'aaaaaaaa-1830-0000-0000-000000000003'), '23514');
select pg_temp.hata_bekle(format('insert into public.odesmeler (trip_id, kimden, kime, tl_kurus) values (%L, %L, %L, 1)',
  current_setting('test.h_trip'), 'aaaaaaaa-1830-0000-0000-000000000003', 'aaaaaaaa-1830-0000-0000-000000000004'), '22023');
select pg_temp.hata_bekle(format('insert into public.odesmeler (trip_id, kimden, kime, tl_kurus) values (%L, %L, %L, 3334)',
  current_setting('test.h_trip'), 'aaaaaaaa-1830-0000-0000-000000000003', 'aaaaaaaa-1830-0000-0000-000000000002'), '22023');
insert into public.odesmeler (trip_id, kimden, kime, tl_kurus) values (:'h_trip', :HV, :HU, 3333);
select pg_temp.as_user(:HS);
select pg_temp.hata_bekle(format('insert into public.odesmeler (trip_id, kimden, kime, tl_kurus) values (%L, %L, %L, 1)',
  current_setting('test.h_trip'), 'aaaaaaaa-1830-0000-0000-000000000003', 'aaaaaaaa-1830-0000-0000-000000000002'), '42501');
delete from public.odesmeler where trip_id = :'h_trip';
select pg_temp.hata_bekle(format('select public.degisikligi_geri_al(%s)',
  (select id from public.changes where entity = 'odesmeler' and trip_id = current_setting('test.h_trip')::uuid and old is null)), '42501');
select pg_temp.hata_bekle($$update public.odesmeler set tl_kurus = 1$$, '42501');
do $$ begin assert (select count(*) from public.odesmeler where trip_id = current_setting('test.h_trip')::uuid) = 1, 'üçüncü kişi silemez'; end $$;
select pg_temp.as_user(:HU);
delete from public.odesmeler where trip_id = :'h_trip';
do $$ begin assert not exists (select 1 from public.odesmeler where trip_id = current_setting('test.h_trip')::uuid), 'alan kişi siler'; end $$;
select public.degisikligi_geri_al((select id from public.changes where entity = 'odesmeler' and trip_id = current_setting('test.h_trip')::uuid and new is null));
do $$ begin assert (select tl_kurus from public.odesmeler where trip_id = current_setting('test.h_trip')::uuid) = 3333, 'ödeşme silmesi geri alındı'; end $$;

-- IBAN: sahibi yazar; yalnız ona borcu olan seyahat arkadaşı görür (Ece −33,33; Mert ödeşti, 0); dışarıdan biri göremez,
-- değiştiremez; biçim denetlenir.
insert into public.odeme_bilgileri (iban) values ('TR330006100519786457841326');
select pg_temp.hata_bekle($$insert into public.odeme_bilgileri (iban) values ('TR33 0006') on conflict (user_id) do update set iban = excluded.iban$$, '23514');
select pg_temp.as_user(:HS);
do $$ begin assert (select iban from public.odeme_bilgileri where user_id = 'aaaaaaaa-1830-0000-0000-000000000002') = 'TR330006100519786457841326', 'borçlu karşı taraf IBAN görür'; end $$;
select pg_temp.as_user(:HV);
do $$ begin assert not exists (select 1 from public.odeme_bilgileri where user_id = 'aaaaaaaa-1830-0000-0000-000000000002'), 'borcu olmayan arkadaş IBAN göremez'; end $$;
select pg_temp.as_user(:HN);
update public.odeme_bilgileri set iban = 'TR000000000000000000000000';
do $$ begin assert not exists (select 1 from public.odeme_bilgileri where user_id = 'aaaaaaaa-1830-0000-0000-000000000002'), 'dışarıdan biri IBAN göremez'; end $$;
select pg_temp.hata_bekle($$insert into public.odeme_bilgileri (user_id, iban) values ('aaaaaaaa-1830-0000-0000-000000000002', 'TR000000000000000000000000')$$, '42501');

-- Fiş kovası: üye yükler ve görür; dışarıdan biri göremez, yükleyemez; klasörü seyahat olmayan yol reddedilir; silme yalnız
-- yükleyen ya da seyahatin sahibi.
select pg_temp.as_user(:HU);
select format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'fisler', current_setting('test.h_trip') || '/fis1.jpg', 'aaaaaaaa-1830-0000-0000-000000000002') as fis_ekle \gset
:fis_ekle;
select pg_temp.hata_bekle($$insert into storage.objects (bucket_id, name) values ('fisler', 'baska/fis.jpg')$$, '42501');
select pg_temp.hata_bekle($$insert into storage.objects (bucket_id, name) values ('fisler', 'fis.jpg')$$, '42501');
select pg_temp.as_user(:HV);
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'fisler') = 1, 'üye fişi görür'; end $$;
select pg_temp.as_user(:HN);
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'fisler') = 0, 'dışarıdan biri fişi göremez'; end $$;
select pg_temp.hata_bekle(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fisler', current_setting('test.h_trip') || '/fis2.jpg'), '42501');
select pg_temp.as_user(:HV);
delete from storage.objects where bucket_id = 'fisler';
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'fisler') = 1, 'yüklemeyen üye fişi silemez'; end $$;
select pg_temp.as_user(:HU);
delete from storage.objects where bucket_id = 'fisler';
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'fisler') = 0, 'yükleyen fişi siler'; end $$;

-- Ayrılan üyeyle kalan borç kapanır: Mert 30 ₺ borçluyken seyahatten ayrılır, Ayşe "Ödendi işaretle"; fazlası reddedilir.
select pg_temp.as_user(:HU);
select public.harcama_kaydet(:'h_trip', null, 'Taksi', 6000, 'TRY', 6000, 'ulasim', :HU, null, null,
  jsonb_build_array(jsonb_build_object('user_id', :HU, 'pay_kurus', 3000), jsonb_build_object('user_id', :HV, 'pay_kurus', 3000)));
select pg_temp.as_user(:HV);
delete from public.members where trip_id = :'h_trip' and user_id = auth.uid();
select pg_temp.as_user(:HU);
insert into public.odesmeler (trip_id, kimden, kime, tl_kurus) values (:'h_trip', :HV, :HU, 3000);
select pg_temp.hata_bekle(format('insert into public.odesmeler (trip_id, kimden, kime, tl_kurus) values (%L, %L, %L, 1)',
  current_setting('test.h_trip'), 'aaaaaaaa-1830-0000-0000-000000000003', 'aaaaaaaa-1830-0000-0000-000000000002'), '22023');
do $$ begin assert public.seyahat_net(current_setting('test.h_trip')::uuid, 'aaaaaaaa-1830-0000-0000-000000000003') = 0, 'ayrılan üyenin borcu kapandı'; end $$;

-- #247: seyahat_net / seyahat_hesabinda yalnız üyeye. Üye olmayan kayıtlı kullanıcı ve misafir (anonim) seyahat kimliğini bilse de
-- bakiye (null) ya da "hesapta" (false) alamaz; üye doğru değeri alır (tablolardan doğrudan hesaplanan değerle aynı).
reset role;
\set HM '''aaaaaaaa-1830-0000-0000-000000000005'''
insert into auth.users (id, is_anonymous) values (:HM, true);
select (coalesce((select sum(tl_kurus) from public.harcamalar where trip_id = :'h_trip' and odeyen_id = :HU), 0)
      - coalesce((select sum(pay_kurus) from public.harcama_paylari where trip_id = :'h_trip' and user_id = :HU), 0)
      + coalesce((select sum(tl_kurus) from public.odesmeler where trip_id = :'h_trip' and kimden = :HU), 0)
      - coalesce((select sum(tl_kurus) from public.odesmeler where trip_id = :'h_trip' and kime = :HU), 0))::text as hu_net \gset
select set_config('test.hu_net', :'hu_net', false);
do $$ begin assert current_setting('test.hu_net')::bigint <> 0, 'ön koşul: Ayşe''nin bakiyesi sıfır değil'; end $$;
set role authenticated;
select pg_temp.as_user(:HN);
do $$
declare t uuid := current_setting('test.h_trip')::uuid;
begin
  assert not public.is_member(t), 'ön koşul: HN üye değil';
  assert public.seyahat_net(t, 'aaaaaaaa-1830-0000-0000-000000000002') is null, '#247: üye olmayan kayıtlı kullanıcı bakiye alamaz';
  assert not public.seyahat_hesabinda(t, 'aaaaaaaa-1830-0000-0000-000000000002'), '#247: üye olmayan kayıtlı kullanıcı true alamaz';
end $$;
select pg_temp.as_user(:HM, true);
do $$
declare t uuid := current_setting('test.h_trip')::uuid;
begin
  assert public.is_anonymous() and not public.is_member(t), 'ön koşul: HM üye olmayan misafir';
  assert public.seyahat_net(t, 'aaaaaaaa-1830-0000-0000-000000000002') is null, '#247: misafir bakiye alamaz';
  assert not public.seyahat_hesabinda(t, 'aaaaaaaa-1830-0000-0000-000000000002'), '#247: misafir true alamaz';
end $$;
select pg_temp.as_user(:HU);
do $$
declare t uuid := current_setting('test.h_trip')::uuid;
begin
  assert public.seyahat_net(t, 'aaaaaaaa-1830-0000-0000-000000000002') = current_setting('test.hu_net')::bigint, '#247: üye doğru bakiyeyi alır';
  assert public.seyahat_hesabinda(t, 'aaaaaaaa-1830-0000-0000-000000000002'), '#247: üye hesapta olanı görür';
  assert public.seyahat_hesabinda(t, 'aaaaaaaa-1830-0000-0000-000000000003'), '#247: ayrılan üye hâlâ hesapta';
  assert not public.seyahat_hesabinda(t, 'aaaaaaaa-1830-0000-0000-000000000004'), '#247: hesapta olmayan false';
end $$;

-- Seyahat silinince harcama, pay ve ödeşmeler gider (ertelenmiş toplam denetimi engel olmaz).
select pg_temp.as_user(:HS);
delete from public.trips where id = :'h_trip';
reset role;
do $$
begin
  assert not exists (select 1 from public.harcamalar where trip_id = current_setting('test.h_trip')::uuid), 'harcamalar gitti';
  assert not exists (select 1 from public.harcama_paylari where trip_id = current_setting('test.h_trip')::uuid), 'paylar gitti';
  assert not exists (select 1 from public.odesmeler where trip_id = current_setting('test.h_trip')::uuid), 'ödeşmeler gitti';
end $$;

-- #184 Sohbet: yalnız üyeler okur/yazar; kişi yalnız kendi mesajını (yumuşak) siler, içerik temizlenir; oylama 2–4 seçenek, oy
-- tekil ve değiştirilebilir, kapanınca oy yok, başka oylamanın seçeneği reddedilir; okunmamış sayısı; fotoğraf kovası.
-- Saatler sunucunun (created_at / silindi_at / son_okunan_at istemciden yazılamaz); oylama ve okuma yalnız RPC'yle yazılır.
reset role;
\set SS '''aaaaaaaa-1840-0000-0000-000000000001'''
\set SU '''aaaaaaaa-1840-0000-0000-000000000002'''
\set SN '''aaaaaaaa-1840-0000-0000-000000000003'''
insert into auth.users (id, is_anonymous) values (:SS, false), (:SU, false), (:SN, false);
insert into public.profiles (id, name, username) values (:SS, 'Ece', 'ece184'), (:SU, 'Ayse', 'ayse184'), (:SN, 'Disari', 'disari184');
set role authenticated;
select pg_temp.as_user(:SS);
insert into public.trips (owner_id, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date)
  values (:SS, 'ChIJ-sohbet184', 'Sohbetli', 'TR', 39.77, 30.52, 'Europe/Istanbul', '2026-11-25', '2026-11-26');
reset role;
select id as s_trip, invite_token as s_token from public.trips where owner_id = :SS \gset
select set_config('test.s_trip', :'s_trip', false);
set role authenticated;
select pg_temp.as_user(:SU);
select public.join_trip(:'s_token', 'Ayşe');

-- Ece yazar; Ayşe okur ve okunmamış 1 görür; okuyunca 0. İstemcinin yazdığı ileri tarih ve silindi_at yok sayılır (yoksa
-- 2100 tarihli mesaj rozeti kalıcı 1 yapardı).
select pg_temp.as_user(:SS);
insert into public.mesajlar (trip_id, tur, metin, created_at, silindi_at) values (:'s_trip', 'metin', 'Cuma akşamı Odunpazarı''nda kalalım', '2100-01-01', now());
do $$
declare m public.mesajlar;
begin
  select * into m from public.mesajlar where trip_id = current_setting('test.s_trip')::uuid;
  assert m.created_at <= now() and m.silindi_at is null and m.metin <> '', 'mesaj saati sunucunun, silinmiş doğmaz';
end $$;
select pg_temp.hata_bekle(format('insert into public.mesajlar (trip_id, tur, metin) values (%L, %L, %L)', current_setting('test.s_trip'), 'metin', '   '), '23514');
select pg_temp.hata_bekle(format('insert into public.mesajlar (trip_id, tur) values (%L, %L)', current_setting('test.s_trip'), 'mekan'), '23514');
select pg_temp.hata_bekle(format('insert into public.mesajlar (trip_id, user_id, tur, metin) values (%L, null, %L, %L)', current_setting('test.s_trip'), 'metin', 'sistem gibi'), '42501');
select pg_temp.as_user(:SU);
do $$
declare t uuid := current_setting('test.s_trip')::uuid;
begin
  assert (select count(*) from public.mesajlar where trip_id = t) = 1, 'üye mesajı okur';
  assert public.sohbet_okunmamis(t) = 1, 'okunmamış 1';
  perform public.sohbet_okundu(t);
  assert public.sohbet_okunmamis(t) = 0, 'okuyunca 0';
  assert (select son_okunan_at from public.mesaj_okuma where trip_id = t and user_id = auth.uid()) <= now(), 'okuma anı sunucu saati';
end $$;
-- Okuma anı doğrudan yazılamaz (sahte "okundu" yok); yalnız sohbet_okundu.
select pg_temp.hata_bekle(format('insert into public.mesaj_okuma (trip_id, son_okunan_at) values (%L, %L)', current_setting('test.s_trip'), '2100-01-01'), '42501');
select pg_temp.hata_bekle(format('update public.mesaj_okuma set son_okunan_at = %L where trip_id = %L', '2100-01-01', current_setting('test.s_trip')), '42501');
select pg_temp.hata_bekle(format('delete from public.mesaj_okuma where trip_id = %L', current_setting('test.s_trip')), '42501');
-- Ayşe, Ece'nin mesajını silemez ve içeriğini değiştiremez.
update public.mesajlar set silindi_at = now() where trip_id = :'s_trip';
select pg_temp.hata_bekle(format('update public.mesajlar set metin = %L where trip_id = %L', 'değişti', current_setting('test.s_trip')), '42501');
do $$ begin assert (select silindi_at from public.mesajlar where trip_id = current_setting('test.s_trip')::uuid) is null, 'başkasının mesajı silinmez'; end $$;

-- Dışarıdan biri okuyamaz, yazamaz, okunmamışı sıfır.
select pg_temp.as_user(:SN);
do $$
begin
  assert (select count(*) from public.mesajlar where trip_id = current_setting('test.s_trip')::uuid) = 0, 'üye olmayan okuyamaz';
  assert public.sohbet_okunmamis(current_setting('test.s_trip')::uuid) = 0, 'üye olmayana sayı yok';
end $$;
select pg_temp.hata_bekle(format('insert into public.mesajlar (trip_id, tur, metin) values (%L, %L, %L)', current_setting('test.s_trip'), 'metin', 'selam'), '42501');
select pg_temp.hata_bekle(format('select public.oylama_olustur(%L, %L, %L, null)', current_setting('test.s_trip'), 'Ne yiyelim?', '[{"metin":"Çibörek"},{"metin":"Balık"}]'), '42501');
select pg_temp.hata_bekle(format('select public.sohbet_okundu(%L)', current_setting('test.s_trip')), '42501');

-- Ece kendi mesajını siler: içerik temizlenir, silme anı sunucunun, geri alınamaz.
select pg_temp.as_user(:SS);
update public.mesajlar set silindi_at = '2000-01-01' where trip_id = :'s_trip';
do $$
declare m public.mesajlar;
begin
  select * into m from public.mesajlar where trip_id = current_setting('test.s_trip')::uuid;
  assert m.silindi_at is not null and m.metin = '', 'yumuşak silme içeriği temizler';
  assert m.silindi_at > now() - interval '1 minute', 'silme anı sunucu saati';
end $$;
select pg_temp.hata_bekle(format('update public.mesajlar set silindi_at = null where trip_id = %L', current_setting('test.s_trip')), '42501');

-- place_id Google biçiminde; fotoğraf yolu bu seyahatin klasöründe.
select pg_temp.hata_bekle(format('insert into public.mesajlar (trip_id, tur, place_id) values (%L, %L, %L)', current_setting('test.s_trip'), 'mekan', 'ChIJ-cibörek'), '23514');
select pg_temp.hata_bekle(format('insert into public.mesajlar (trip_id, tur, place_id) values (%L, %L, %L)', current_setting('test.s_trip'), 'mekan', 'kisa'), '23514');
insert into public.mesajlar (trip_id, tur, place_id) values (:'s_trip', 'mekan', 'ChIJ-ciborek-hb1');
select pg_temp.hata_bekle(format('insert into public.mesajlar (trip_id, tur, foto_yolu) values (%L, %L, %L)', current_setting('test.s_trip'), 'foto', 'baska/foto.jpg'), '23514');

-- Oylama: 2–4 seçenek, kapanış ileride; mesaj da yazılır. Tablolara doğrudan yazım yok (seçeneksiz oylama, sonradan seçenek).
select pg_temp.hata_bekle(format('select public.oylama_olustur(%L, %L, %L, null)', current_setting('test.s_trip'), 'Tek?', '[{"metin":"Yalnız"}]'), '22023');
select pg_temp.hata_bekle(format('select public.oylama_olustur(%L, %L, %L, now() - interval ''1 hour'')', current_setting('test.s_trip'), 'Geçmiş?', '[{"metin":"A"},{"metin":"B"}]'), '22023');
select pg_temp.hata_bekle(format('select public.oylama_olustur(%L, %L, %L, null)', current_setting('test.s_trip'), 'Biçim?', '[{"metin":"A","place_id":"ChIJ-cibörek"},{"metin":"B"}]'), '23514');
select pg_temp.hata_bekle(format('insert into public.oylamalar (trip_id, soru) values (%L, %L)', current_setting('test.s_trip'), 'Seçeneksiz?'), '42501');
-- #248 KK2/KK4: mekan seçeneğinde metin boş olabilir (Google adı yazılmaz, ekranda canlı gelir); mekansız seçenekte boş metin reddedilir.
select pg_temp.hata_bekle(format('select public.oylama_olustur(%L, %L, %L, null)', current_setting('test.s_trip'), 'Boş?', '[{"metin":""},{"metin":"B"}]'), '23514');
select public.oylama_olustur(:'s_trip', 'Nereye?', '[{"metin":"","place_id":"ChIJ-ciborek-hb1"},{"metin":"Balık"}]'::jsonb, null) as s_bos_mesaj \gset
select set_config('test.s_bos_mesaj', :'s_bos_mesaj', false);
do $$
begin
  assert (select s.metin from public.oylama_secenekleri s join public.mesajlar m on m.oylama_id = s.oylama_id
          where m.id = current_setting('test.s_bos_mesaj')::uuid and s.sira = 1) is not distinct from '', 'mekan seçeneği boş metinle kabul';
end $$;
select public.oylama_olustur(:'s_trip', 'Çibörek mi, balık mı?', '[{"metin":"Çibörek · Hacı Baba","place_id":"ChIJ-ciborek-hb1"},{"metin":"Balık"}]'::jsonb, now() + interval '1 day', 'Cumartesi akşamı için:') as s_mesaj \gset
reset role;
select oylama_id as s_oylama from public.mesajlar where id = :'s_mesaj' \gset
select id as s_ciborek from public.oylama_secenekleri where oylama_id = :'s_oylama' and sira = 1 \gset
select id as s_balik from public.oylama_secenekleri where oylama_id = :'s_oylama' and sira = 2 \gset
select set_config('test.s_oylama', :'s_oylama', false), set_config('test.s_balik', :'s_balik', false);
set role authenticated;
select pg_temp.as_user(:SS);
do $$
begin
  assert (select count(*) from public.oylama_secenekleri where oylama_id = current_setting('test.s_oylama')::uuid) = 2, 'iki seçenek';
  assert (select olusturan from public.oylamalar where id = current_setting('test.s_oylama')::uuid) = auth.uid(), 'oylamayı açan';
  assert (select user_id from public.mesajlar where oylama_id = current_setting('test.s_oylama')::uuid) = auth.uid(), 'oylama mesajı açanın';
end $$;
select pg_temp.hata_bekle(format('insert into public.oylama_secenekleri (oylama_id, sira, metin) values (%L, 3, %L)', current_setting('test.s_oylama'), 'Sonradan'), '42501');

-- Oy tekil: ikinci oy aynı satırı günceller (oy değişir), çift satır olmaz; başkası adına oy yok.
insert into public.oylama_oylari (oylama_id, trip_id, secenek_id) values (:'s_oylama', :'s_trip', :'s_ciborek');
select pg_temp.hata_bekle(format('insert into public.oylama_oylari (oylama_id, trip_id, secenek_id) values (%L, %L, %L)',
  current_setting('test.s_oylama'), current_setting('test.s_trip'), current_setting('test.s_balik')), '23505');
-- Uygulamadaki gibi PostgREST upsert'i (tüm sütunlar SET'te).
insert into public.oylama_oylari (oylama_id, trip_id, secenek_id, user_id) values (:'s_oylama', :'s_trip', :'s_balik', :SS)
  on conflict (oylama_id, user_id) do update set oylama_id = excluded.oylama_id, trip_id = excluded.trip_id, secenek_id = excluded.secenek_id, user_id = excluded.user_id;
do $$
begin
  assert (select count(*) from public.oylama_oylari where oylama_id = current_setting('test.s_oylama')::uuid) = 1, 'kişi başına tek oy';
  assert (select secenek_id from public.oylama_oylari where oylama_id = current_setting('test.s_oylama')::uuid) = current_setting('test.s_balik')::uuid, 'oy değişti';
end $$;
select pg_temp.hata_bekle(format('insert into public.oylama_oylari (oylama_id, trip_id, secenek_id, user_id) values (%L, %L, %L, %L)',
  current_setting('test.s_oylama'), current_setting('test.s_trip'), current_setting('test.s_balik'), 'aaaaaaaa-1840-0000-0000-000000000002'), '42501');
select pg_temp.hata_bekle(format('delete from public.oylama_oylari where oylama_id = %L', current_setting('test.s_oylama')), '42501');
-- Başka oylamanın seçeneği reddedilir.
select public.oylama_olustur(:'s_trip', 'Kapanmış', '[{"metin":"A"},{"metin":"B"}]'::jsonb, now() + interval '1 hour') as s_mesaj2 \gset
reset role;
select oylama_id as s_oylama2 from public.mesajlar where id = :'s_mesaj2' \gset
select set_config('test.s_oylama2', :'s_oylama2', false);
set role authenticated;
select pg_temp.as_user(:SU);
select pg_temp.hata_bekle(format('insert into public.oylama_oylari (oylama_id, trip_id, secenek_id) values (%L, %L, %L)',
  current_setting('test.s_oylama2'), current_setting('test.s_trip'), current_setting('test.s_balik')), '23503');
-- Kapanışı geçmişe çek (oylama düzenlenemez; test için yönetici): kapanmış oylamaya oy yok.
reset role;
update public.oylamalar set kapanis_at = now() - interval '1 minute' where id = :'s_oylama2';
set role authenticated;
select pg_temp.as_user(:SU);
select pg_temp.hata_bekle(format('insert into public.oylama_oylari (oylama_id, trip_id, secenek_id) values (%L, %L, (select id from public.oylama_secenekleri where oylama_id = %L limit 1))',
  current_setting('test.s_oylama2'), current_setting('test.s_trip'), current_setting('test.s_oylama2')), '22023');
select pg_temp.hata_bekle(format('update public.oylamalar set soru = %L', 'değişti'), '42501');
-- Dışarıdan biri oy veremez, oyları göremez.
select pg_temp.as_user(:SN);
select pg_temp.hata_bekle(format('insert into public.oylama_oylari (oylama_id, trip_id, secenek_id) values (%L, %L, %L)',
  current_setting('test.s_oylama'), current_setting('test.s_trip'), current_setting('test.s_balik')), '22023');
do $$ begin assert (select count(*) from public.oylama_oylari where trip_id = current_setting('test.s_trip')::uuid) = 0, 'üye olmayan oyları göremez'; end $$;

-- Fotoğraf kovası: üye yükler; dışarıdan biri göremez, yükleyemez; mesaj silinince dosyayı yükleyen (ya da sahip) siler.
select pg_temp.as_user(:SU);
select format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'sohbet', current_setting('test.s_trip') || '/foto1.jpg', 'aaaaaaaa-1840-0000-0000-000000000002') as sohbet_foto \gset
:sohbet_foto;
select pg_temp.as_user(:SN);
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'sohbet') = 0, 'dışarıdan biri sohbet fotoğrafını göremez'; end $$;
select pg_temp.hata_bekle(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'sohbet', current_setting('test.s_trip') || '/foto2.jpg'), '42501');
select pg_temp.as_user(:SU);
delete from storage.objects where bucket_id = 'sohbet';
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'sohbet') = 0, 'yükleyen sohbet fotoğrafını siler'; end $$;
reset role;

-- #189 Keşfet kalitesi: eşikler ayarda (varsayılanlar migration'la); gizleme listesini yalnız admin okur / yazar; süzgeç ayarlarını
-- yalnız service_role okur (places-nearby).
do $$
begin
  assert (select (deger #>> '{turistik,yorum}')::int from public.yonetim_ayarlari where anahtar = 'kesfet_esikleri') = 50, 'Turistik en az 50 yorum';
  assert (select (deger #>> '{yemek,puan}')::numeric from public.yonetim_ayarlari where anahtar = 'kesfet_esikleri') = 3.8, 'Yemek en az 3,8';
  assert (select (deger #>> '{park,yorum}')::int from public.yonetim_ayarlari where anahtar = 'kesfet_esikleri') = 20, 'Park en az 20 yorum';
  assert (select (deger #>> '{sehir_yaricap_m}')::int from public.yonetim_ayarlari where anahtar = 'kesfet_esikleri') = 8000, '#189 Ek 2: şehir listesi 8 km';
end $$;
set role authenticated;
select pg_temp.as_email(:B, 'b@ornek.com');
select pg_temp.hata_bekle($$insert into public.kesfet_gizli (place_id, neden) values ('ChIJ-kuafor-duzce', 'kuaför')$$, '42501');
do $$ begin assert (select count(*) from public.kesfet_gizli) = 0, 'admin olmayan gizleme listesini görmez'; end $$;
select pg_temp.hata_bekle($$select public.kesfet_suzgec_ayarlari()$$, '42501');
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
insert into public.kesfet_gizli (place_id, neden) values ('ChIJ-kuafor-duzce', 'kuaför, Müze tipiyle');
select pg_temp.hata_bekle($$insert into public.kesfet_gizli (place_id) values ('kisa')$$, '23514');
do $$
begin
  assert (select ekleyen from public.kesfet_gizli where place_id = 'ChIJ-kuafor-duzce') = auth.uid(), 'ekleyen admin';
end $$;
select pg_temp.hata_bekle($$select public.kesfet_suzgec_ayarlari()$$, '42501');
set role anon;
select pg_temp.hata_bekle($$select count(*) from public.kesfet_gizli$$, '42501');
set role service_role;
do $$
declare a jsonb := public.kesfet_suzgec_ayarlari();
begin
  assert (a #>> '{esikler,turistik,puan}')::numeric = 3.8, 'service_role eşikleri okur';
  assert a -> 'gizli' = '["ChIJ-kuafor-duzce"]'::jsonb, 'service_role gizli listeyi okur';
end $$;
reset role;

-- #192 Önerilen gezi rotası önbelleği: yayınlı gezide herkes okur, yayınlanmamışta yalnız admin; yazma yalnız service_role; durak
-- değişince o günün bacakları silinir (süre değişikliği silmez); "Seyahatime al" bacakları fetched_at korunarak walk_cache'e
-- kopyalar (≤ 30 gün, üye, yayınlı gezi); günlük temizlik 31 günü aşanları siler.
reset role;
\set RU '''aaaaaaaa-1920-0000-0000-000000000001'''
\set RN '''aaaaaaaa-1920-0000-0000-000000000002'''
insert into auth.users (id, is_anonymous) values (:RU, false), (:RN, false);
insert into public.profiles (id, name, username) values (:RU, 'Rota', 'rota192'), (:RN, 'Disari', 'disari192');
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('19201920-0000-4000-8000-000000000001', 'Rotalı', 'rotali-192', 39.77, 30.52, true);
insert into public.geziler (id, sehir_id, baslik, slug, yayin) values
  ('19201920-0000-4000-8000-000000000010', '19201920-0000-4000-8000-000000000001', 'Yayınlı rota', 'yayinli-rota-192', true),
  ('19201920-0000-4000-8000-000000000020', '19201920-0000-4000-8000-000000000001', 'Taslak rota', 'taslak-rota-192', false);
insert into public.gezi_gunleri (id, gezi_id, sira) values
  ('19201920-0000-4000-8000-000000000011', '19201920-0000-4000-8000-000000000010', 1),
  ('19201920-0000-4000-8000-000000000021', '19201920-0000-4000-8000-000000000020', 1);
insert into public.gezi_duraklari (id, gezi_gun_id, sira, ad, lat, lng) values
  ('19201920-0000-4000-8000-0000000000a1', '19201920-0000-4000-8000-000000000011', 1, 'A', 39.770, 30.520),
  ('19201920-0000-4000-8000-0000000000a2', '19201920-0000-4000-8000-000000000011', 2, 'B', 39.772, 30.523),
  ('19201920-0000-4000-8000-0000000000a3', '19201920-0000-4000-8000-000000000011', 3, 'C', 39.775, 30.526),
  ('19201920-0000-4000-8000-0000000000b1', '19201920-0000-4000-8000-000000000021', 1, 'T1', 39.770, 30.520),
  ('19201920-0000-4000-8000-0000000000b2', '19201920-0000-4000-8000-000000000021', 2, 'T2', 39.772, 30.523);
create function pg_temp.rota_doldur() returns void language sql as $$
  insert into public.gezi_rota_onbellek (gezi_gun_id, kimden_durak_id, kime_durak_id, mod, polyline, saniye, metre, fetched_at) values
    ('19201920-0000-4000-8000-000000000011', '19201920-0000-4000-8000-0000000000a1', '19201920-0000-4000-8000-0000000000a2', 'WALK', 'abc', 300, 400, now() - interval '2 days'),
    ('19201920-0000-4000-8000-000000000011', '19201920-0000-4000-8000-0000000000a2', '19201920-0000-4000-8000-0000000000a3', 'WALK', 'def', 360, 450, now() - interval '40 days'),
    ('19201920-0000-4000-8000-000000000021', '19201920-0000-4000-8000-0000000000b1', '19201920-0000-4000-8000-0000000000b2', 'WALK', 'ghi', 300, 400, now())
  on conflict do nothing;
$$;
set role service_role;
select pg_temp.rota_doldur();
set role anon;
do $$
begin
  assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000011') = 2, 'anon yayınlı gezinin rotasını okur';
  assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000021') = 0, 'anon taslak gezinin rotasını göremez';
end $$;
set role authenticated;
select pg_temp.as_user(:RN);
do $$ begin assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000021') = 0, 'admin olmayan taslağı göremez'; end $$;
select pg_temp.hata_bekle($$insert into public.gezi_rota_onbellek (gezi_gun_id, kimden_durak_id, kime_durak_id, mod, polyline, saniye, metre) values ('19201920-0000-4000-8000-000000000011', '19201920-0000-4000-8000-0000000000a1', '19201920-0000-4000-8000-0000000000a3', 'WALK', 'x', 1, 1)$$, '42501');
select pg_temp.hata_bekle($$delete from public.gezi_rota_onbellek$$, '42501');
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000021') = 1, 'admin taslağın rotasını görür (BO önizleme)'; end $$;
reset role;

-- KK7: süre değişikliği silmez; sıra, yeni durak, silinen durak o günün bacaklarını siler (öbür güne dokunmaz).
update public.gezi_duraklari set sure_dk = 60, ad = 'A2' where id = '19201920-0000-4000-8000-0000000000a1';
do $$ begin assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000011') = 2, 'süre / ad değişikliği bacakları silmez'; end $$;
update public.gezi_duraklari set sira = 9 where id = '19201920-0000-4000-8000-0000000000a3';
do $$
begin
  assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000011') = 0, 'sıra değişince günün bacakları silinir';
  assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000021') = 1, 'öbür gün etkilenmez';
end $$;
update public.gezi_duraklari set sira = 3 where id = '19201920-0000-4000-8000-0000000000a3';
select pg_temp.rota_doldur();
insert into public.gezi_duraklari (id, gezi_gun_id, sira, ad, lat, lng) values ('19201920-0000-4000-8000-0000000000a4', '19201920-0000-4000-8000-000000000011', 4, 'D', 39.778, 30.53);
do $$ begin assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000011') = 0, 'yeni durak günün bacaklarını siler'; end $$;
select pg_temp.rota_doldur();
delete from public.gezi_duraklari where id = '19201920-0000-4000-8000-0000000000a4';
do $$ begin assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000011') = 0, 'silinen durak günün bacaklarını siler'; end $$;
select pg_temp.rota_doldur();

-- KK5: Seyahatime al — üye kopyalar; 30 günü geçen bacak ve taslak gezinin bacağı kopyalanmaz; fetched_at korunur; walk_cache'teki
-- daha taze satır ezilmez; seyahatin listesinde olmayan place_id kabul edilmez; üye olmayan kopyalayamaz.
set role authenticated;
select pg_temp.as_user(:RU);
reset role; -- #263: kimlik istemciden seçilemez; sabit kimlikli kurulum superuser ile
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values ('19201920-0000-4000-8000-0000000000f1', :RU, 'ChIJ-rotali-192', 'Rotalı', 39.77, 30.52, 'Europe/Istanbul');
set role authenticated;
-- Listede A, C, T1, T2 var; B yok (önce).
insert into public.places (trip_id, place_id, lat, lng, added_by)
select '19201920-0000-4000-8000-0000000000f1', p, 39.77, 30.52, :RU from unnest(array['ChIJ-durak-Axxx', 'ChIJ-durak-Cxxx', 'ChIJ-durak-T1xx', 'ChIJ-durak-T2xx']) p;
do $$
begin
  -- A>B'nin B'si seyahatin listesinde değil → kopyalanmaz (üye yabancı bir kimlikle walk_cache'e bacak yazamaz).
  assert public.gezi_rotasini_seyahate_kopyala('19201920-0000-4000-8000-0000000000f1',
    '[{"durak_id":"19201920-0000-4000-8000-0000000000a1","place_id":"ChIJ-durak-Axxx"},{"durak_id":"19201920-0000-4000-8000-0000000000a2","place_id":"ChIJ-durak-Bxxx"}]') = 0,
    'listede olmayan place_id kopyalanmaz';
  assert not exists (select 1 from public.walk_cache where trip_id = '19201920-0000-4000-8000-0000000000f1' and to_key = 'ChIJ-durak-Bxxx'), 'yabancı bacak yazılmadı';
end $$;
insert into public.places (trip_id, place_id, lat, lng, added_by) values ('19201920-0000-4000-8000-0000000000f1', 'ChIJ-durak-Bxxx', 39.77, 30.52, :RU);
reset role;
insert into public.walk_cache (trip_id, from_key, to_key, seconds, meters, polyline, mode, fetched_at) values
  ('19201920-0000-4000-8000-0000000000f1', 'ChIJ-durak-T1xx', 'ChIJ-durak-T2xx', 999, 999, 'taze', 'WALK', now() + interval '1 hour');
set role authenticated;
select pg_temp.as_user(:RU);
do $$
declare
  eslesme jsonb := '[{"durak_id":"19201920-0000-4000-8000-0000000000a1","place_id":"ChIJ-durak-Axxx"},{"durak_id":"19201920-0000-4000-8000-0000000000a2","place_id":"ChIJ-durak-Bxxx"},{"durak_id":"19201920-0000-4000-8000-0000000000a3","place_id":"ChIJ-durak-Cxxx"},{"durak_id":"19201920-0000-4000-8000-0000000000b1","place_id":"ChIJ-durak-T1xx"},{"durak_id":"19201920-0000-4000-8000-0000000000b2","place_id":"ChIJ-durak-T2xx"},{"durak_id":"x","place_id":"kisa"}]';
  n integer;
begin
  n := public.gezi_rotasini_seyahate_kopyala('19201920-0000-4000-8000-0000000000f1', eslesme);
  assert n = 1, 'yalnız taze ve yayınlı bacak kopyalanır: ' || n;
  assert (select seconds from public.walk_cache where trip_id = '19201920-0000-4000-8000-0000000000f1' and from_key = 'ChIJ-durak-Axxx' and to_key = 'ChIJ-durak-Bxxx') = 300, 'bacak walk_cache''te';
  assert (select fetched_at from public.walk_cache where from_key = 'ChIJ-durak-Axxx' and to_key = 'ChIJ-durak-Bxxx') < now() - interval '1 day', 'fetched_at korunur';
  assert not exists (select 1 from public.walk_cache where from_key = 'ChIJ-durak-Bxxx'), '30 günü geçen bacak kopyalanmaz';
  assert (select seconds from public.walk_cache where from_key = 'ChIJ-durak-T1xx') = 999, 'taslak gezinin bacağı kopyalanmaz, var olan satır ezilmez';
end $$;
select pg_temp.as_user(:RN);
select pg_temp.hata_bekle($$select public.gezi_rotasini_seyahate_kopyala('19201920-0000-4000-8000-0000000000f1', '[]'::jsonb)$$, '42501');
select pg_temp.hata_bekle($$select public.rota_onbellegi_temizle()$$, '42501');

-- KK6: günlük temizlik (oturumsuz, cron) 31 günü aşan satırları siler: rota önbelleği ve walk_cache.
reset role;
update public.walk_cache set fetched_at = now() - interval '32 days' where trip_id = '19201920-0000-4000-8000-0000000000f1' and from_key = 'ChIJ-durak-T1xx';
select public.rota_onbellegi_temizle();
do $$
begin
  assert not exists (select 1 from public.gezi_rota_onbellek where kimden_durak_id = '19201920-0000-4000-8000-0000000000a2'), '40 günlük rota satırı silindi';
  assert exists (select 1 from public.gezi_rota_onbellek where kimden_durak_id = '19201920-0000-4000-8000-0000000000a1'), '2 günlük satır kalır';
  assert not exists (select 1 from public.walk_cache where from_key = 'ChIJ-durak-T1xx'), '32 günlük walk_cache satırı silindi';
  assert exists (select 1 from public.walk_cache where from_key = 'ChIJ-durak-Axxx'), 'kopyalanan (2 günlük) walk_cache satırı kalır';
end $$;
-- Gezi silinince rota satırları da gider (cascade).
delete from public.geziler where id = '19201920-0000-4000-8000-000000000010';
do $$ begin assert not exists (select 1 from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000011'), 'cascade'; end $$;

-- #193 KK3 · KK12: "Seyahatime al" → Yeni seyahat — seyahat, günler, mekanlar ve plan tek işlemde; bir adım hata verirse hiçbiri
-- yazılmaz. Tarihsiz seyahat ("Tarih sonra") istenen sayıda tarihsiz günle; durak yoksa mekanlar atanmamış (KK10).
reset role;
\set YS '''aaaaaaaa-1930-0000-0000-000000000001'''
\set YA '''aaaaaaaa-1930-0000-0000-000000000002'''
insert into auth.users (id, is_anonymous) values (:YS, false), (:YA, true);
insert into public.profiles (id, name, username) values (:YS, 'Yeni', 'yeni193');
set role authenticated;
select pg_temp.as_user(:YS);
do $$
declare
  v uuid;
  sehir constant jsonb := '{"name": "Eskişehir''de üç gün", "city_place_id": "ChIJ_eskisehir_193", "city_label": "Eskişehir", "country_code": "TR", "lat": 39.77, "lng": 30.52, "tz": "Europe/Istanbul"}';
  mekanlar constant jsonb := '[{"place_id": "ChIJ_a_193", "primary_type": "museum", "lat": 39.77, "lng": 30.52, "dk": 90}, {"place_id": "ChIJ_b_193", "primary_type": "park", "lat": 39.78, "lng": 30.53, "dk": 45}, {"place_id": "ChIJ_c_193", "primary_type": "restaurant", "lat": 39.79, "lng": 30.54, "dk": 60}]';
begin
  -- Tarihli, 3 gün: 1. güne iki durak, 3. güne bir durak (sırayla).
  v := public.geziden_seyahat_ac(sehir || '{"start_date": "2026-10-16", "end_date": "2026-10-18"}', 3, mekanlar,
    '[{"gun": 1, "place_id": "ChIJ_a_193", "order_key": "i", "dk": 90}, {"gun": 1, "place_id": "ChIJ_b_193", "order_key": "r", "dk": 45}, {"gun": 3, "place_id": "ChIJ_c_193", "order_key": "i", "dk": 60}]');
  assert (select name from public.trips where id = v) = 'Eskişehir''de üç gün', 'ad = gezi başlığı';
  assert (select owner_id from public.trips where id = v) = auth.uid(), 'sahip çağıran';
  assert exists (select 1 from public.members where trip_id = v and user_id = auth.uid() and role = 'owner'), 'sahip üye';
  assert (select count(*) from public.days where trip_id = v) = 3, 'tarihli: 3 gün';
  assert (select date from public.days where trip_id = v and index = 3) = '2026-10-18', '3. gün tarihi';
  assert (select count(*) from public.places where trip_id = v and added_by = auth.uid()) = 3, '3 mekan, ekleyen çağıran';
  assert (select array_agg(p.place_id order by s.order_key) from public.stops s join public.days d on d.id = s.day_id join public.places p on p.id = s.place_ref where s.trip_id = v and d.index = 1) = array['ChIJ_a_193', 'ChIJ_b_193'], '1. gün iki durak, sırayla';
  assert (select s.minutes from public.stops s join public.days d on d.id = s.day_id where s.trip_id = v and d.index = 3) = 60, '3. gün durağı ve süresi';

  -- Tarihsiz ("Tarih sonra"), 3 gün, durak yok: mekanlar atanmamış.
  v := public.geziden_seyahat_ac(sehir, 3, mekanlar, '[]');
  assert (select start_date is null and end_date is null from public.trips where id = v), 'tarihsiz seyahat';
  assert (select count(*) from public.days where trip_id = v and date is null) = 3, 'tarihsiz: 3 tarihsiz gün';
  assert (select array_agg(index order by index) from public.days where trip_id = v) = array[1, 2, 3], 'gün sırası 1..3';
  assert (select count(*) from public.places where trip_id = v) = 3 and not exists (select 1 from public.stops where trip_id = v), 'mekanlar atanmamış';
  perform set_config('test.ys_sayi', (select count(*) from public.trips where owner_id = auth.uid())::text, false);
end $$;

-- Tek işlem: durak yazımı düşerse (sıra anahtarı yok) seyahat de, mekanlar da yazılmaz.
select pg_temp.hata_bekle($$select public.geziden_seyahat_ac('{"name": "Yarım", "city_place_id": "ChIJ_y", "city_label": "Y", "lat": 1, "lng": 1, "tz": "Europe/Istanbul"}', 2, '[{"place_id": "ChIJ_a_193", "lat": 1, "lng": 1}]', '[{"gun": 1, "place_id": "ChIJ_a_193"}]')$$, '23502');
select pg_temp.hata_bekle($$select public.geziden_seyahat_ac('{"name": "Yarım", "city_place_id": "ChIJ_y", "city_label": "Y", "lat": 1, "lng": 1, "tz": "Europe/Istanbul"}', 2, '[]', '[{"gun": 3, "place_id": "ChIJ_a_193", "order_key": "i"}]')$$, '22023');
select pg_temp.hata_bekle($$select public.geziden_seyahat_ac('{"name": "Yarım", "city_place_id": "ChIJ_y", "city_label": "Y", "lat": 1, "lng": 1, "tz": "Europe/Istanbul", "start_date": "2026-10-16", "end_date": "2026-10-17"}', 3, '[]', '[]')$$, '22023');
select pg_temp.hata_bekle($$select public.geziden_seyahat_ac('{"name": "Yarım", "city_place_id": "ChIJ_y", "city_label": "Y", "lat": 1, "lng": 1, "tz": "Europe/Istanbul"}', 31, '[]', '[]')$$, '22023');
do $$
begin
  assert (select count(*) from public.trips where owner_id = auth.uid())::text = current_setting('test.ys_sayi'), 'hata sonrası yarım seyahat yok';
  assert not exists (select 1 from public.trips where name = 'Yarım'), 'yarım seyahat yok';
end $$;
-- Misafir seyahat açamaz (trips_insert); anon çağıramaz.
select pg_temp.as_user(:YA, true);
select pg_temp.hata_bekle($$select public.geziden_seyahat_ac('{"name": "Misafir", "city_place_id": "ChIJ_y", "city_label": "Y", "lat": 1, "lng": 1, "tz": "Europe/Istanbul"}', 1, '[]', '[]')$$, '42501');
reset role;
set role anon;
select pg_temp.hata_bekle($$select public.geziden_seyahat_ac('{}', 1, '[]', '[]')$$, '42501');
reset role;

-- #197: şehrin Google kimliği, saat dilimi ve ülke kodu — tanınmayan saat dilimi yazılmaz (boş kalır); hattın yazımı yalnız boş alanları doldurur
-- (dolu alan ezilmez); istemci yazamaz; yayınlı şehrin kimliği herkese okunur; `icerik_sehirler` kimlik durumunu verir.
reset role;
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('19701970-0000-4000-8000-000000000001', 'Kimlikli', 'kimlikli-197', 39.77, 30.52, true);
update public.sehirler set tz = 'Avrupa/Eskisehir' where slug = 'kimlikli-197';
do $$ begin assert (select tz from public.sehirler where slug = 'kimlikli-197') is null, 'tanınmayan saat dilimi yazılmaz'; end $$;
select pg_temp.hata_bekle($$update public.sehirler set place_id = 'kisa' where slug = 'kimlikli-197'$$, '23514');
select pg_temp.hata_bekle($$update public.sehirler set ulke_kodu = 'tr' where slug = 'kimlikli-197'$$, '23514');
do $$
begin
  assert not (select (x ->> 'kimlik')::boolean from jsonb_array_elements(public.icerik_sehirler()) x where x ->> 'slug' = 'kimlikli-197'), 'kimlik eksik görünür';
  assert public.icerik_sehir_kimligi_yaz('kimlikli-197', 'ChIJ_kimlikli_197', 'Europe/Istanbul', 'TR'), 'boş alanlar dolar';
  assert (select place_id = 'ChIJ_kimlikli_197' and tz = 'Europe/Istanbul' and ulke_kodu = 'TR' from public.sehirler where slug = 'kimlikli-197'), 'kimlik yazıldı';
  -- Bir kez: dolu alan ezilmez, yazılacak bir şey yoksa false.
  assert not public.icerik_sehir_kimligi_yaz('kimlikli-197', 'ChIJ_baska_kimlik', 'Europe/Berlin', 'DE'), 'dolu şehir yeniden yazılmaz';
  assert (select place_id from public.sehirler where slug = 'kimlikli-197') = 'ChIJ_kimlikli_197', 'kimlik korunur';
  assert (select (x ->> 'kimlik')::boolean from jsonb_array_elements(public.icerik_sehirler()) x where x ->> 'slug' = 'kimlikli-197'), 'kimlik var görünür';
  assert (select (x ->> 'lat')::float from jsonb_array_elements(public.icerik_sehirler()) x where x ->> 'slug' = 'kimlikli-197') = 39.77, 'liste konumu verir';
end $$;
set role anon;
do $$ begin assert (select tz from public.sehirler where slug = 'kimlikli-197') = 'Europe/Istanbul', 'anon yayınlı şehrin saat dilimini okur'; end $$;
reset role;
set role authenticated;
select pg_temp.as_user(:YS);
select pg_temp.hata_bekle($$select public.icerik_sehir_kimligi_yaz('kimlikli-197', 'ChIJ_x_123456', 'UTC', 'TR')$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_sehirler()$$, '42501');
do $$ begin
  update public.sehirler set tz = 'UTC' where slug = 'kimlikli-197';
  assert (select tz from public.sehirler where slug = 'kimlikli-197') = 'Europe/Istanbul', 'admin olmayan şehri değiştiremez (RLS)';
end $$;
reset role;

-- #199: PostgREST gömme belirsizliği bekçisi. Bir tablo iki tabloya yabancı anahtarlıysa ve anahtar sütunları birincil anahtarın
-- parçasıysa PostgREST onu çoktan-çoğa bağlantı tablosu sayar; o iki tablo arasında doğrudan anahtar da varsa `a(b(…))` gömmesi
-- belirsiz kalır (PGRST201) ve sorgu düşer — #192'nin gezi_rota_onbellek'i gezi_gunleri ↔ gezi_duraklari gömmesini (önerilen gezi
-- ekranı, BO gezi editörü, gezi-rota) böyle düşürmüştü. API'ye açık şemada (public) böyle bir çift olmamalı.
do $$
declare
  ciftler text;
begin
  with fk as (
    select c.conrelid as jt, c.confrelid as hedef, c.conkey, c.conname
    from pg_catalog.pg_constraint c
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  ), pk as (
    select conrelid, conkey from pg_catalog.pg_constraint where contype = 'p' and connamespace = 'public'::regnamespace
  ), baglanti as (
    select distinct a.jt, a.hedef as t1, b.hedef as t2
    from fk a
    join fk b on a.jt = b.jt and a.conname <> b.conname and a.hedef <> b.hedef
    join pk on pk.conrelid = a.jt
    where a.conkey <@ pk.conkey and b.conkey <@ pk.conkey
  )
  select string_agg(format('%s: %s ↔ %s', j.jt::regclass, j.t1::regclass, j.t2::regclass), '; ') into ciftler
  from baglanti j
  join pg_catalog.pg_class c1 on c1.oid = j.t1 and c1.relnamespace = 'public'::regnamespace
  join pg_catalog.pg_class c2 on c2.oid = j.t2 and c2.relnamespace = 'public'::regnamespace
  where exists (select 1 from fk d where (d.jt = j.t1 and d.hedef = j.t2) or (d.jt = j.t2 and d.hedef = j.t1));
  assert ciftler is null, format('PostgREST gömmesi belirsiz (PGRST201): %s', ciftler);
end $$;
-- Gün anahtarı kalksa da temizlik tam: gün silinince durakları, durak anahtarları da bacakları siler.
delete from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000021';
insert into public.gezi_rota_onbellek (gezi_gun_id, kimden_durak_id, kime_durak_id, mod, polyline, saniye, metre) values
  ('19201920-0000-4000-8000-000000000021', '19201920-0000-4000-8000-0000000000b1', '19201920-0000-4000-8000-0000000000b2', 'WALK', 'ghi', 300, 400);
do $$
begin
  assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000021') = 1, 'taslak günün bacağı var';
  delete from public.gezi_gunleri where id = '19201920-0000-4000-8000-000000000021';
  assert (select count(*) from public.gezi_rota_onbellek where gezi_gun_id = '19201920-0000-4000-8000-000000000021') = 0, 'gün silinince bacakları da silinir';
end $$;

-- #200 KK5: "Günlere dağıt" tek işlemde yazılır ve değişiklik geçmişinde TEK kayıttır (akış grupsuz satırları okur); "Geri al"
-- eklenen durakları siler, kısalan süreleri ve uzayan gün bitişlerini eski haline getirir; geri alma da tek kayıttır. Mekanın
-- varsayılan süresi değişmez; 22:00'yi geçen bitiş reddedilir; başka seyahatin günü / mekanı yazılmaz; üye olmayan çağıramaz.
reset role;
\set DU '''aaaaaaaa-2000-0000-0000-000000000001'''
\set DN '''aaaaaaaa-2000-0000-0000-000000000002'''
insert into auth.users (id, is_anonymous) values (:DU, false), (:DN, false);
insert into public.profiles (id, name, username) values (:DU, 'Dagit', 'dagit200'), (:DN, 'Yabanci', 'yabanci200');
set role authenticated;
select pg_temp.as_user(:DU);
reset role; -- #263: kimlik istemciden seçilemez; sabit kimlikli kurulum superuser ile
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz, start_date, end_date)
  values ('20002000-0000-4000-8000-0000000000f1', :DU, 'ChIJ-dagit-200', 'Dağıt', 39.77, 30.52, 'Europe/Istanbul', '2026-11-02', '2026-11-03');
set role authenticated;
insert into public.places (id, trip_id, place_id, lat, lng, default_minutes, added_by) values
  ('20002000-0000-4000-8000-0000000000a1', '20002000-0000-4000-8000-0000000000f1', 'ChIJ-dagit-A-200', 39.77, 30.52, 90, :DU),
  ('20002000-0000-4000-8000-0000000000a2', '20002000-0000-4000-8000-0000000000f1', 'ChIJ-dagit-B-200', 39.77, 30.52, 60, :DU),
  ('20002000-0000-4000-8000-0000000000a3', '20002000-0000-4000-8000-0000000000f1', 'ChIJ-dagit-C-200', 39.77, 30.52, 60, :DU);
insert into public.stops (id, trip_id, day_id, place_ref, order_key, minutes)
select '20002000-0000-4000-8000-0000000000d1', '20002000-0000-4000-8000-0000000000f1', d.id, '20002000-0000-4000-8000-0000000000a1', 'a0', 90
from public.days d where d.trip_id = '20002000-0000-4000-8000-0000000000f1' and d.index = 1;
create temp table dagit_kayit (k bigint);
grant all on dagit_kayit to authenticated;
insert into dagit_kayit
select public.gunlere_dagit('20002000-0000-4000-8000-0000000000f1',
  (select jsonb_agg(x) from (
     select jsonb_build_object('day_id', d.id, 'place_ref', '20002000-0000-4000-8000-0000000000a2', 'order_key', 'a1', 'minutes', 45) x
     from public.days d where d.trip_id = '20002000-0000-4000-8000-0000000000f1' and d.index = 1
     union all
     select jsonb_build_object('day_id', d.id, 'place_ref', '20002000-0000-4000-8000-0000000000a3', 'order_key', 'a0', 'minutes', 60)
     from public.days d where d.trip_id = '20002000-0000-4000-8000-0000000000f1' and d.index = 2
     -- Başka seyahatin mekanı yazılmaz.
     union all
     (select jsonb_build_object('day_id', d.id, 'place_ref', p.id, 'order_key', 'a9', 'minutes', 60)
      from public.days d, public.places p where d.trip_id = '20002000-0000-4000-8000-0000000000f1' and d.index = 2
        and p.trip_id <> '20002000-0000-4000-8000-0000000000f1' limit 1)
   ) y),
  '[{"id": "20002000-0000-4000-8000-0000000000d1", "minutes": 68}]',
  (select jsonb_agg(jsonb_build_object('id', d.id, 'end_time', '21:15')) from public.days d where d.trip_id = '20002000-0000-4000-8000-0000000000f1' and d.index = 2));
do $$
declare
  k bigint := (select k from dagit_kayit);
  t uuid := '20002000-0000-4000-8000-0000000000f1';
begin
  assert (select count(*) from public.stops where trip_id = t) = 3, 'iki yeni durak (başka seyahatin mekanı yok)';
  assert (select minutes from public.stops where id = '20002000-0000-4000-8000-0000000000d1') = 68, 'mevcut durak kısaldı';
  assert (select default_minutes from public.places where id = '20002000-0000-4000-8000-0000000000a1') = 90, 'mekanın varsayılan süresi aynı';
  assert (select end_time from public.days where trip_id = t and index = 2) = time '21:15', 'gün uzadı';
  assert (select end_time from public.days where trip_id = t and index = 1) is null, 'öbür gün aynı';
  assert (select new from public.changes where id = k) = '{"mekan": 2, "kisalt": true, "uzat": true}'::jsonb, 'tek kayıt özeti';
  assert (select count(*) from public.changes where trip_id = t and grup = k) = 4, 'iki ekleme + süre + bitiş kayda bağlı';
  assert (select count(*) from public.changes where trip_id = t and grup is null and at = (select at from public.changes where id = k)) = 1, 'akışta tek satır';
end $$;
-- Doğrulama: 22:00'yi geçen bitiş; üye olmayan.
select pg_temp.hata_bekle($$select public.gunlere_dagit('20002000-0000-4000-8000-0000000000f1', '[]', '[]', '[{"id": "20002000-0000-4000-8000-000000000000", "end_time": "22:30"}]')$$, '22023');
select pg_temp.as_user(:DN);
select pg_temp.hata_bekle($$select public.gunlere_dagit('20002000-0000-4000-8000-0000000000f1', '[]', '[]', '[]')$$, '42501');
select pg_temp.hata_bekle($$select public.degisikligi_geri_al((select k from dagit_kayit))$$, '42501');
-- Geri al: tek seferde hepsi.
select pg_temp.as_user(:DU);
select public.degisikligi_geri_al((select k from dagit_kayit));
do $$
declare
  t uuid := '20002000-0000-4000-8000-0000000000f1';
  g bigint;
begin
  assert (select count(*) from public.stops where trip_id = t) = 1, 'eklenen duraklar silindi';
  assert (select minutes from public.stops where id = '20002000-0000-4000-8000-0000000000d1') = 90, 'süre eski haline döndü';
  assert (select end_time from public.days where trip_id = t and index = 2) is null, 'bitiş eski haline döndü';
  select id into g from public.changes where trip_id = t and entity = 'dagit_geri';
  assert g is not null, 'geri alma tek kayıt';
  assert (select count(*) from public.changes where trip_id = t and grup = g) = 4, 'geri almanın satırları kayda bağlı';
end $$;
select pg_temp.hata_bekle($$select public.degisikligi_geri_al((select id from public.changes where entity = 'dagit_geri' and trip_id = '20002000-0000-4000-8000-0000000000f1'))$$, '22023');
reset role;

-- #205 ── Konumun kaynağı: varsayılan google_30g + damga; konum değişince damga yenilenir; osm'de osm_id zorunlu;
-- kaynak google_30g'den çıkınca damga silinir; kontrol yalnız admin dışı rollere kapalı ve yalnız sayı verir.
reset role;
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('20500000-0000-4000-8000-000000000001', 'Konum Şehri', 'konum-sehri', 40, 30, false);
do $$
declare
  s uuid := '20500000-0000-4000-8000-000000000001';
  k jsonb;
begin
  assert (select konum_kaynagi = 'google_30g' and google_fetched_at is not null from public.sehirler where id = s), 'varsayılan google_30g + damga';
  update public.sehirler set google_fetched_at = now() - interval '40 days' where id = s;
  k := public.konum_kaynagi_kontrol();
  assert (k -> 'sehirler' ->> 'suresi_gecen')::int >= 1, 'süresi geçen sayılır';
  assert (select array_agg(x order by x) from jsonb_object_keys(k -> 'sehirler') x) = array['elle', 'google_30g', 'osm', 'suresi_gecen', 'toplam'], 'yalnız sayılar';
  update public.sehirler set lat = 40.1 where id = s;
  assert (select google_fetched_at > now() - interval '1 minute' from public.sehirler where id = s), 'yeni Google konumu = yeni damga';
  begin
    update public.sehirler set konum_kaynagi = 'osm' where id = s;
    raise exception 'osm_id olmadan osm kabul edildi';
  exception when check_violation then null;
  end;
  update public.sehirler set konum_kaynagi = 'osm', osm_id = 'node/123', lat = 40.2 where id = s;
  assert (select google_fetched_at is null and osm_id = 'node/123' from public.sehirler where id = s), 'osm: damga silinir';
  begin
    update public.sehirler set osm_id = 'node/abc' where id = s;
    raise exception 'geçersiz osm_id kabul edildi';
  exception when check_violation then null;
  end;
  update public.sehirler set konum_kaynagi = 'elle', lat = 40.3 where id = s;
  assert (select konum_kaynagi = 'elle' and google_fetched_at is null from public.sehirler where id = s), 'elle';
  update public.sehirler set konum_kaynagi = 'google_30g' where id = s;
  assert (select google_fetched_at is not null from public.sehirler where id = s), 'google_30g''ye dönünce damga';
  delete from public.sehirler where id = s;
end $$;
-- #205 (inceleme 1–2): tetikleyici INSERT'te de çalışır; yerler ve gezi_duraklari da aynı kuralla.
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('20500000-0000-4000-8000-000000000011', 'Konum Şehri 2', 'konum-sehri-2', 40, 30, false);
insert into public.geziler (id, sehir_id, baslik, slug) values ('20500000-0000-4000-8000-000000000012', '20500000-0000-4000-8000-000000000011', 'Konum gezisi', 'konum-gezisi');
insert into public.gezi_gunleri (id, gezi_id, sira) values ('20500000-0000-4000-8000-000000000013', '20500000-0000-4000-8000-000000000012', 1);
do $$
declare
  s uuid := '20500000-0000-4000-8000-000000000011';
  gun uuid := '20500000-0000-4000-8000-000000000013';
  y uuid;
  d uuid;
begin
  -- sehirler: osm/elle ile eklenen satır damga taşımaz; google_30g'de açık null verilse de damga alır.
  insert into public.sehirler (id, ad, slug, lat, lng, konum_kaynagi, osm_id) values ('20500000-0000-4000-8000-000000000014', 'OSM Şehri', 'osm-sehri', 40, 30, 'osm', 'relation/6');
  assert (select google_fetched_at is null from public.sehirler where id = '20500000-0000-4000-8000-000000000014'), 'sehirler insert osm: damga yok';
  insert into public.sehirler (id, ad, slug, lat, lng, konum_kaynagi) values ('20500000-0000-4000-8000-000000000015', 'Elle Şehri', 'elle-sehri', 40, 30, 'elle');
  assert (select google_fetched_at is null from public.sehirler where id = '20500000-0000-4000-8000-000000000015'), 'sehirler insert elle: damga yok';
  insert into public.sehirler (id, ad, slug, lat, lng, google_fetched_at) values ('20500000-0000-4000-8000-000000000016', 'Google Şehri', 'google-sehri', 40, 30, null);
  assert (select konum_kaynagi = 'google_30g' and google_fetched_at is not null from public.sehirler where id = '20500000-0000-4000-8000-000000000016'), 'sehirler insert google null: damga';

  -- yerler
  insert into public.yerler (sehir_id, ad, lat, lng) values (s, 'Google Yeri', 40, 30) returning id into y;
  assert (select konum_kaynagi = 'google_30g' and google_fetched_at is not null from public.yerler where id = y), 'yerler varsayılan google_30g + damga';
  update public.yerler set google_fetched_at = now() - interval '40 days' where id = y;
  update public.yerler set lng = 30.1 where id = y;
  assert (select google_fetched_at > now() - interval '1 minute' from public.yerler where id = y), 'yerler yeni konum = yeni damga';
  insert into public.yerler (sehir_id, ad, lat, lng, konum_kaynagi, osm_id) values (s, 'OSM Yeri', 40, 30, 'osm', 'way/45') returning id into y;
  assert (select google_fetched_at is null from public.yerler where id = y), 'yerler insert osm: damga yok';
  insert into public.yerler (sehir_id, ad, lat, lng, konum_kaynagi) values (s, 'Elle Yeri', 40, 30, 'elle') returning id into y;
  assert (select google_fetched_at is null from public.yerler where id = y), 'yerler insert elle: damga yok';
  begin
    insert into public.yerler (sehir_id, ad, lat, lng, konum_kaynagi) values (s, 'Kimliksiz OSM', 40, 30, 'osm');
    raise exception 'yerler: osm_id olmadan osm kabul edildi';
  exception when check_violation then null;
  end;

  -- gezi_duraklari
  insert into public.gezi_duraklari (gezi_gun_id, sira, ad, lat, lng) values (gun, 1, 'Google Durağı', 40, 30) returning id into d;
  assert (select konum_kaynagi = 'google_30g' and google_fetched_at is not null from public.gezi_duraklari where id = d), 'gezi_duraklari varsayılan google_30g + damga';
  update public.gezi_duraklari set google_fetched_at = now() - interval '40 days' where id = d;
  update public.gezi_duraklari set lat = 40.1 where id = d;
  assert (select google_fetched_at > now() - interval '1 minute' from public.gezi_duraklari where id = d), 'gezi_duraklari yeni konum = yeni damga';
  insert into public.gezi_duraklari (gezi_gun_id, sira, ad, lat, lng, konum_kaynagi, osm_id) values (gun, 2, 'OSM Durağı', 40, 30, 'osm', 'node/7') returning id into d;
  assert (select google_fetched_at is null from public.gezi_duraklari where id = d), 'gezi_duraklari insert osm: damga yok';
  insert into public.gezi_duraklari (gezi_gun_id, sira, ad, lat, lng, konum_kaynagi) values (gun, 3, 'Elle Durağı', 40, 30, 'elle') returning id into d;
  assert (select google_fetched_at is null from public.gezi_duraklari where id = d), 'gezi_duraklari insert elle: damga yok';

  delete from public.sehirler where id in (s, '20500000-0000-4000-8000-000000000014', '20500000-0000-4000-8000-000000000015', '20500000-0000-4000-8000-000000000016');
end $$;
set role authenticated;
select pg_temp.as_user(:A);
select pg_temp.hata_bekle($$select public.konum_kaynagi_kontrol()$$, '42501');
reset role;
-- #205 PR 2a: kontrol anon ve service_role'e de kapalı.
set role anon;
select pg_temp.hata_bekle($$select public.konum_kaynagi_kontrol()$$, '42501');
reset role;
set role service_role;
do $$
begin
  perform public.konum_kaynagi_kontrol();
  raise exception 'service_role kontrolü çağırabildi';
exception when insufficient_privilege then null;
end $$;
reset role;

-- #205 KK9: osm/elle satırda koordinat kaynaksız değişirse google_30g + damga; kaynak yazılırsa (aynı değerle de) korunur.
-- KK10: damga gelecekte olamaz.
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('20500000-0000-4000-8000-000000000021', 'Koruma Şehri', 'koruma-sehri', 40, 30, false);
insert into public.geziler (id, sehir_id, baslik, slug) values ('20500000-0000-4000-8000-000000000022', '20500000-0000-4000-8000-000000000021', 'Koruma gezisi', 'koruma-gezisi');
insert into public.gezi_gunleri (id, gezi_id, sira) values ('20500000-0000-4000-8000-000000000023', '20500000-0000-4000-8000-000000000022', 1);
do $$
declare
  s uuid := '20500000-0000-4000-8000-000000000021';
  gun uuid := '20500000-0000-4000-8000-000000000023';
  y uuid;
  d uuid;
begin
  -- sehirler: osm satıra yalnız yeni lat → google_30g, osm_id silinir, damga taze.
  update public.sehirler set konum_kaynagi = 'osm', osm_id = 'relation/9' where id = s;
  update public.sehirler set lat = 40.5 where id = s;
  assert (select konum_kaynagi = 'google_30g' and osm_id is null and google_fetched_at > now() - interval '1 minute' from public.sehirler where id = s),
    'KK9 sehirler: osm satıra yalnız lat → google_30g + damga';
  -- osm_id ile birlikte yazılan yeni koordinat osm kalır.
  update public.sehirler set konum_kaynagi = 'osm', osm_id = 'relation/9' where id = s;
  update public.sehirler set lat = 40.6, osm_id = 'relation/9' where id = s;
  assert (select konum_kaynagi = 'osm' and osm_id = 'relation/9' and google_fetched_at is null and lat = 40.6 from public.sehirler where id = s),
    'KK9 sehirler: osm_id aynı değerle yazılınca osm kalır';
  -- işaret bir sonraki UPDATE'e taşınmaz.
  update public.sehirler set lng = 30.6 where id = s;
  assert (select konum_kaynagi = 'google_30g' from public.sehirler where id = s), 'KK9: işaret satırdan satıra / komuttan komuta taşınmaz';
  -- koordinatsız güncelleme (ad) kaynağa dokunmaz.
  update public.sehirler set konum_kaynagi = 'elle' where id = s;
  update public.sehirler set ad = 'Koruma Şehri 2' where id = s;
  assert (select konum_kaynagi = 'elle' from public.sehirler where id = s), 'KK9: koordinat değişmeyince elle kalır';

  -- yerler: elle satırı haritada yeniden işaretlemek (konum_kaynagi = 'elle' aynı değerle) elle kalır; kaynaksız → google_30g.
  insert into public.yerler (sehir_id, ad, lat, lng, konum_kaynagi) values (s, 'Elle Yeri K', 40, 30, 'elle') returning id into y;
  update public.yerler set lat = 40.01, lng = 30.01, konum_kaynagi = 'elle' where id = y;
  assert (select konum_kaynagi = 'elle' and google_fetched_at is null from public.yerler where id = y), 'KK9 yerler: elle yeniden işaretleme';
  update public.yerler set lat = 40.02 where id = y;
  assert (select konum_kaynagi = 'google_30g' and google_fetched_at is not null from public.yerler where id = y), 'KK9 yerler: kaynaksız koordinat → google_30g';

  -- gezi_duraklari: osm durak, çok satırlı UPDATE'te her satır kendi başına.
  insert into public.gezi_duraklari (gezi_gun_id, sira, ad, lat, lng, konum_kaynagi, osm_id) values (gun, 1, 'OSM K1', 40, 30, 'osm', 'node/1') returning id into d;
  insert into public.gezi_duraklari (gezi_gun_id, sira, ad, lat, lng, konum_kaynagi, osm_id) values (gun, 2, 'OSM K2', 40, 30, 'osm', 'node/2');
  update public.gezi_duraklari set lat = 41 where gezi_gun_id = gun;
  assert (select count(*) from public.gezi_duraklari where gezi_gun_id = gun and konum_kaynagi = 'google_30g' and google_fetched_at is not null and osm_id is null) = 2,
    'KK9 gezi_duraklari: iki osm satır da google_30g';

  -- KK10: gelecek tarihli damga reddedilir (üç tablo); 1 güne kadar saat farkı kabul.
  begin
    update public.sehirler set konum_kaynagi = 'google_30g', google_fetched_at = now() + interval '10 years' where id = s;
    raise exception 'KK10 sehirler: gelecek damga kabul edildi';
  exception when check_violation then null;
  end;
  begin
    update public.yerler set google_fetched_at = now() + interval '10 years' where id = y;
    raise exception 'KK10 yerler: gelecek damga kabul edildi';
  exception when check_violation then null;
  end;
  begin
    insert into public.gezi_duraklari (gezi_gun_id, sira, ad, lat, lng, google_fetched_at) values (gun, 3, 'Gelecek', 40, 30, now() + interval '10 years');
    raise exception 'KK10 gezi_duraklari: gelecek damga kabul edildi';
  exception when check_violation then null;
  end;
  update public.yerler set google_fetched_at = now() + interval '1 hour' where id = y;
  assert (select google_fetched_at > now() from public.yerler where id = y), 'KK10: 1 saatlik saat farkı kabul';

  delete from public.sehirler where id = s;
end $$;

-- #205 KK7: "Seyahatime al" damgayı taşır; damga yoksa now(), gelecekteyse now()'a iner.
set role authenticated;
select pg_temp.as_user(:YS);
do $$
declare
  v uuid;
begin
  v := public.geziden_seyahat_ac(
    '{"name": "Damga", "city_place_id": "ChIJ_damga_205", "city_label": "Damga", "lat": 40, "lng": 30, "tz": "Europe/Istanbul"}', 1,
    jsonb_build_array(
      jsonb_build_object('place_id', 'ChIJ_damga_eski', 'lat', 40, 'lng', 30, 'google_fetched_at', now() - interval '20 days'),
      jsonb_build_object('place_id', 'ChIJ_damga_yok', 'lat', 40, 'lng', 30),
      jsonb_build_object('place_id', 'ChIJ_damga_null', 'lat', 40, 'lng', 30, 'google_fetched_at', null),
      jsonb_build_object('place_id', 'ChIJ_damga_gelecek', 'lat', 40, 'lng', 30, 'google_fetched_at', now() + interval '10 years')),
    '[]');
  assert (select google_fetched_at between now() - interval '20 days 1 minute' and now() - interval '19 days' from public.places where trip_id = v and place_id = 'ChIJ_damga_eski'),
    'KK7: durağın damgası taşınır';
  assert (select count(*) from public.places where trip_id = v and place_id in ('ChIJ_damga_yok', 'ChIJ_damga_null', 'ChIJ_damga_gelecek')
    and google_fetched_at between now() - interval '1 minute' and now()) = 3, 'KK7: damgasız / null / gelecek → now()';
  delete from public.trips where id = v;
end $$;
reset role;

-- ---------------------------------------------------------------- #226: Places günlük sınırı (kullanıcı özeti × gün × kategori)
-- KK2: atomik artış, sınırda durur; KK3: yalnız service_role çalıştırır, anon ve authenticated (yönetici dahil) tabloya erişemez.
reset role;
set role service_role;
do $$
declare
  o constant text := repeat('a', 64);
  i integer;
begin
  for i in 1..3 loop
    assert public.places_sinir_artir(o, 'nearby', 3), 'KK2: sınırın altında izin';
  end loop;
  assert not public.places_sinir_artir(o, 'nearby', 3), 'KK2: sınır dolunca ret';
  assert not public.places_sinir_artir(o, 'nearby', 3), 'KK2: retten sonra da ret';
  assert (select adet from public.places_gunluk_sayac where ozet = o and kategori = 'nearby') = 3, 'KK2: ret sayacı artırmaz';
  assert public.places_sinir_artir(o, 'details', 3), 'KK2: kategoriler ayrı sayılır';
  assert public.places_sinir_artir(repeat('b', 64), 'nearby', 3), 'KK2: kullanıcılar ayrı sayılır';
  assert not public.places_sinir_artir(repeat('c', 64), 'nearby', 0), 'KK2: sıfır sınır her zaman ret';
  assert (select count(*) from public.places_gunluk_sayac where ozet = repeat('c', 64)) = 0, 'KK2: sıfır sınır satır yazmaz';
  -- places-light: bir çağrı önbellekte olmayan kimlik sayısı kadar sayılır; sınırı aşacak toplu istek bütünüyle reddedilir.
  assert public.places_sinir_artir(repeat('f', 64), 'details', 30, 25), 'KK2: 25 kimlik sığar';
  assert not public.places_sinir_artir(repeat('f', 64), 'details', 30, 6), 'KK2: 25 + 6 > 30 ret';
  assert public.places_sinir_artir(repeat('f', 64), 'details', 30, 5), 'KK2: 25 + 5 = 30 sığar';
  assert (select adet from public.places_gunluk_sayac where ozet = repeat('f', 64)) = 30, 'KK2: toplu artış';
  assert not public.places_sinir_artir(repeat('g', 64), 'details', 3, 4), 'KK2: ilk istek sınırdan büyükse ret';
  assert public.places_sinir_artir(o, 'metin', 3), 'KK2: Text Search yedeği kendi kategorisinde';
  -- Misafir toplam tavanı: iki farklı misafir özeti kendi sınırları içinde kalsa da toplamı aşamaz.
  assert public.places_sinir_artir(repeat('1', 64), 'nearby', 15, 1, 4), 'toplam: 1. misafir 1';
  assert public.places_sinir_artir(repeat('1', 64), 'nearby', 15, 2, 4), 'toplam: 1. misafir 2 (3/4)';
  assert public.places_sinir_artir(repeat('2', 64), 'nearby', 15, 1, 4), 'toplam: 2. misafir 1 (4/4)';
  assert not public.places_sinir_artir(repeat('2', 64), 'nearby', 15, 1, 4), 'toplam: tavan dolu, 2. misafir ret';
  assert not public.places_sinir_artir(repeat('3', 64), 'nearby', 15, 1, 4), 'toplam: tavan dolu, yeni misafir ret';
  assert (select adet from public.places_gunluk_sayac where ozet = 'misafir-toplam' and kategori = 'nearby') = 4, 'toplam: ret toplamı artırmaz';
  assert (select adet from public.places_gunluk_sayac where ozet = repeat('2', 64) and kategori = 'nearby') = 1, 'toplam: ret kullanıcıyı artırmaz';
  assert (select count(*) from public.places_gunluk_sayac where ozet = repeat('3', 64)) = 0, 'toplam: ret satır yazmaz';
  assert public.places_sinir_artir(repeat('3', 64), 'nearby', 15, 1), 'toplam: kayıtlı kullanıcı (tavansız) etkilenmez';
  -- Kullanıcı sınırı dolarsa toplamdan alınan pay geri verilir.
  assert public.places_sinir_artir(repeat('4', 64), 'photo', 2, 2, 10), 'toplam: 4. misafir 2/2';
  assert not public.places_sinir_artir(repeat('4', 64), 'photo', 2, 1, 10), 'toplam: kullanıcı sınırı ret';
  assert (select adet from public.places_gunluk_sayac where ozet = 'misafir-toplam' and kategori = 'photo') = 2, 'toplam: kullanıcı reddi toplamı geri alır';
end $$;
select pg_temp.hata_bekle($$select public.places_sinir_artir('misafir-toplam', 'details', 300)$$, '22023');
select pg_temp.hata_bekle($$select public.places_sinir_artir(repeat('h', 64), 'details', 300, 626)$$, '22023');
select pg_temp.hata_bekle($$select public.places_sinir_artir(repeat('h', 64), 'details', 300, 0)$$, '22023');
select pg_temp.hata_bekle($$select public.places_sinir_artir('kimlik-acik', 'nearby', 3)$$, '23514');
select pg_temp.hata_bekle($$select public.places_sinir_artir(repeat('d', 64), 'routes', 3)$$, '23514');
-- #246 KK2/KK4: Routes `rota` kategorisi; eleman sayılır (matris 25 × 25 = 625'e kadar tek çağrıda), misafir toplam tavanı.
do $$
begin
  assert public.places_sinir_artir(repeat('7', 64), 'rota', 2000, 625), 'rota: 625 elemanlı matris tek çağrıda sayılır';
  assert public.places_sinir_artir(repeat('7', 64), 'rota', 2000, 121), 'rota: normal gün (11 × 11)';
  assert (select adet from public.places_gunluk_sayac where ozet = repeat('7', 64) and kategori = 'rota') = 746, 'rota: eleman toplanır';
  assert public.places_sinir_artir(repeat('7', 64), 'rota', 2000, 625), 'rota: 1371';
  assert public.places_sinir_artir(repeat('7', 64), 'rota', 2000, 625), 'rota: 1996';
  assert not public.places_sinir_artir(repeat('7', 64), 'rota', 2000, 5), 'rota: kullanıcı 2000 sınırı aşılmaz';
  assert public.places_sinir_artir(repeat('7', 64), 'rota', 2000, 4), 'rota: 2000 tam sığar';
  assert (select adet from public.places_gunluk_sayac where ozet = repeat('7', 64) and kategori = 'rota') = 2000, 'rota: ret sayacı artırmaz';
  assert (select count(*) from public.places_gunluk_sayac where ozet = repeat('7', 64) and kategori <> 'rota') = 0, 'rota: Places kovaları etkilenmez';
  -- Misafir: kendi sınırı 625 (#253: 25 noktalı ilk matris tek çağrıda sığar); bütün misafirlerin toplamı 3000.
  assert not public.places_sinir_artir(repeat('8', 64), 'rota', 500, 625, 3000), 'rota: tek çağrı (625) sınırdan (500) büyükse ret; p_adet en çok 625 olduğu için daha küçük bir sınırla denenir';
  assert (select count(*) from public.places_gunluk_sayac where ozet = 'misafir-toplam' and kategori = 'rota') = 0, 'rota: ilk ret toplamı açmaz';
  assert public.places_sinir_artir(repeat('8', 64), 'rota', 625, 625, 3000), 'rota: misafir 625 tek çağrıda geçer';
  assert not public.places_sinir_artir(repeat('8', 64), 'rota', 625, 1, 3000), 'rota: misafirin 626. elemanı ret';
  assert (select adet from public.places_gunluk_sayac where ozet = repeat('8', 64) and kategori = 'rota') = 625, 'rota: misafir 625 kalır';
  for i in 1..4 loop
    assert public.places_sinir_artir(lpad(to_hex(i), 64, '9'), 'rota', 625, 500, 3000), format('rota: %s. misafir 500', i);
  end loop;
  assert public.places_sinir_artir(lpad(to_hex(5), 64, '9'), 'rota', 625, 375, 3000), 'rota: toplam 3000 tam sığar';
  assert (select adet from public.places_gunluk_sayac where ozet = 'misafir-toplam' and kategori = 'rota') = 3000, 'rota: misafir toplamı 3000';
  assert not public.places_sinir_artir(repeat('a', 63) || 'b', 'rota', 625, 1, 3000), 'rota: tavan dolu, yeni misafir ret';
  assert not public.places_sinir_artir(lpad(to_hex(1), 64, '9'), 'rota', 625, 1, 3000), 'rota: dolu misafir ret';
  assert (select adet from public.places_gunluk_sayac where ozet = 'misafir-toplam' and kategori = 'rota') = 3000, 'rota: ret toplamı artırmaz';
  assert public.places_sinir_artir(repeat('7', 63) || '0', 'rota', 2000, 625), 'rota: kayıtlı kullanıcı misafir tavanından etkilenmez';
end $$;
reset role;
-- Temizlik (oturumsuz, cron): 7 günden eski satırlar silinir, bugünküler kalır.
do $$
begin
  insert into public.places_gunluk_sayac (ozet, gun, kategori, adet)
    values (repeat('5', 64), (now() at time zone 'Europe/Istanbul')::date - 8, 'details', 1),
           (repeat('5', 64), (now() at time zone 'Europe/Istanbul')::date - 7, 'details', 1);
  perform public.places_sayac_temizle();
  assert (select count(*) from public.places_gunluk_sayac where ozet = repeat('5', 64)) = 1, 'temizlik: yalnız 7 günden eski silinir';
  assert (select count(*) from public.places_gunluk_sayac where ozet = 'misafir-toplam') = 3, 'temizlik: bugünkü satırlar kalır (nearby, photo, rota)';
end $$;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert public.is_admin(), 'ön koşul: E yönetici'; end $$;
select pg_temp.hata_bekle($$select count(*) from public.places_gunluk_sayac$$, '42501');
select pg_temp.hata_bekle($$select public.places_sinir_artir(repeat('e', 64), 'details', 300)$$, '42501');
select pg_temp.hata_bekle($$select public.places_sayac_temizle()$$, '42501');
select pg_temp.as_user(:B);
select pg_temp.hata_bekle($$select count(*) from public.places_gunluk_sayac$$, '42501');
select pg_temp.hata_bekle($$insert into public.places_gunluk_sayac (ozet, kategori, adet) values (repeat('e', 64), 'details', 0)$$, '42501');
select pg_temp.hata_bekle($$update public.places_gunluk_sayac set adet = 0$$, '42501');
select pg_temp.hata_bekle($$delete from public.places_gunluk_sayac$$, '42501');
select pg_temp.hata_bekle($$select public.places_sinir_artir(repeat('e', 64), 'details', 300)$$, '42501');
select pg_temp.as_user(:G, true);
select pg_temp.hata_bekle($$select public.places_sinir_artir(repeat('e', 64), 'details', 300)$$, '42501');
reset role;
set role anon;
select pg_temp.hata_bekle($$select count(*) from public.places_gunluk_sayac$$, '42501');
select pg_temp.hata_bekle($$select public.places_sinir_artir(repeat('e', 64), 'details', 300)$$, '42501');
reset role;
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.places_gunluk_sayac'::regclass), 'KK3: RLS açık';
  assert (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.places_sinir_artir(text, text, integer, integer, integer)'::regprocedure),
    'KK3: security definer, search_path boş';
end $$;
delete from public.places_gunluk_sayac;

-- #205 KK3: icerik_konum_osm_esle — yalnız google_30g satır, yalnız 150 m içi; osm + osm_id yazılır, damga boşalır.
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('20500000-0000-4000-8000-000000000031', 'Eşleme Şehri', 'esleme-sehri', 40, 30, false);
insert into public.yerler (id, sehir_id, ad, lat, lng) values
  ('20500000-0000-4000-8000-000000000032', '20500000-0000-4000-8000-000000000031', 'Yakın Yer', 40, 30),
  ('20500000-0000-4000-8000-000000000033', '20500000-0000-4000-8000-000000000031', 'Uzak Yer', 40, 30);
insert into public.yerler (id, sehir_id, ad, lat, lng, konum_kaynagi) values
  ('20500000-0000-4000-8000-000000000034', '20500000-0000-4000-8000-000000000031', 'Elle Yer', 40, 30, 'elle');
insert into public.geziler (id, sehir_id, baslik, slug) values ('20500000-0000-4000-8000-000000000035', '20500000-0000-4000-8000-000000000031', 'Eşleme gezisi', 'esleme-gezisi');
insert into public.gezi_gunleri (id, gezi_id, sira) values ('20500000-0000-4000-8000-000000000036', '20500000-0000-4000-8000-000000000035', 1);
insert into public.gezi_duraklari (id, gezi_gun_id, sira, ad, lat, lng) values ('20500000-0000-4000-8000-000000000037', '20500000-0000-4000-8000-000000000036', 1, 'Durak', 40, 30);
do $$
declare
  r jsonb;
begin
  r := public.icerik_konum_osm_esle(jsonb_build_array(
    jsonb_build_object('tablo', 'sehirler', 'id', '20500000-0000-4000-8000-000000000031', 'osm_id', 'node/1', 'lat', 40.0005, 'lng', 30),
    jsonb_build_object('tablo', 'yerler', 'id', '20500000-0000-4000-8000-000000000032', 'osm_id', 'way/2', 'lat', 40.001, 'lng', 30),
    jsonb_build_object('tablo', 'yerler', 'id', '20500000-0000-4000-8000-000000000033', 'osm_id', 'way/3', 'lat', 40.002, 'lng', 30),
    jsonb_build_object('tablo', 'yerler', 'id', '20500000-0000-4000-8000-000000000034', 'osm_id', 'way/4', 'lat', 40, 'lng', 30),
    jsonb_build_object('tablo', 'yerler', 'id', '20500000-0000-4000-8000-0000000000ff', 'osm_id', 'way/5', 'lat', 40, 'lng', 30),
    jsonb_build_object('tablo', 'gezi_duraklari', 'id', '20500000-0000-4000-8000-000000000037', 'osm_id', 'relation/6', 'lat', 40, 'lng', 30.001)));
  assert r = '{"yazilan": {"sehirler": 1, "yerler": 1, "gezi_duraklari": 1}, "atlanan": {"sehirler": 0, "yerler": 3, "gezi_duraklari": 0}}'::jsonb,
    format('KK3: sayılar beklenen gibi değil: %s', r);
  assert (select konum_kaynagi = 'osm' and osm_id = 'way/2' and google_fetched_at is null and lat = 40.001
            from public.yerler where id = '20500000-0000-4000-8000-000000000032'), 'KK3: 111 m içi eşleşme osm olarak yazılır, damga boşalır';
  assert (select konum_kaynagi = 'google_30g' and osm_id is null and lat = 40
            from public.yerler where id = '20500000-0000-4000-8000-000000000033'), 'KK3: 150 m dışı eşleşme yazılmaz';
  assert (select konum_kaynagi = 'elle' and osm_id is null from public.yerler where id = '20500000-0000-4000-8000-000000000034'),
    'KK3: elle satıra dokunulmaz';
  assert (select konum_kaynagi = 'osm' and osm_id = 'node/1' from public.sehirler where id = '20500000-0000-4000-8000-000000000031'), 'KK3: şehir';
  assert (select konum_kaynagi = 'osm' and osm_id = 'relation/6' from public.gezi_duraklari where id = '20500000-0000-4000-8000-000000000037'), 'KK3: durak';
  -- İkinci çalıştırma: artık google_30g değil, atlanır (tekrar çalıştırmak güvenli).
  r := public.icerik_konum_osm_esle(jsonb_build_array(
    jsonb_build_object('tablo', 'yerler', 'id', '20500000-0000-4000-8000-000000000032', 'osm_id', 'way/9', 'lat', 40, 'lng', 30)));
  assert (r -> 'atlanan' ->> 'yerler')::int = 1 and (select osm_id = 'way/2' from public.yerler where id = '20500000-0000-4000-8000-000000000032'),
    'KK3: osm satırın üzerine yazılmaz';
  -- Bozuk girdi reddedilir.
  begin
    perform public.icerik_konum_osm_esle('[{"tablo": "places", "id": "20500000-0000-4000-8000-000000000032", "osm_id": "way/1", "lat": 40, "lng": 30}]');
    raise exception 'KK3: places tablosu kabul edildi';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.icerik_konum_osm_esle('[{"tablo": "yerler", "id": "20500000-0000-4000-8000-000000000033", "osm_id": "way/1;drop", "lat": 40, "lng": 30}]');
    raise exception 'KK3: bozuk osm_id kabul edildi';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.icerik_konum_osm_esle('{}');
    raise exception 'KK3: dizi olmayan girdi kabul edildi';
  exception when invalid_parameter_value then null;
  end;
end $$;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
select pg_temp.hata_bekle($$select public.icerik_konum_osm_esle('[]')$$, '42501');
reset role;
set role anon;
select pg_temp.hata_bekle($$select public.icerik_konum_osm_esle('[]')$$, '42501');
reset role;
set role service_role;
do $$
begin
  perform public.icerik_konum_osm_esle('[]');
  raise exception 'service_role eşleştirmeyi çağırabildi';
exception when insufficient_privilege then null;
end $$;
reset role;
delete from public.sehirler where id = '20500000-0000-4000-8000-000000000031';

-- #229 KK1: profil yalnız sahibine ve ortak seyahati olana görünür; seyahatten çıkınca görünmez.
insert into auth.users (id) values ('22900000-0000-4000-8000-000000000001'), ('22900000-0000-4000-8000-000000000002'), ('22900000-0000-4000-8000-000000000003');
insert into public.profiles (id, name, username) values
  ('22900000-0000-4000-8000-000000000001', 'Profil Bir', 'profil_bir'),
  ('22900000-0000-4000-8000-000000000002', 'Profil İki', 'profil_iki'),
  ('22900000-0000-4000-8000-000000000003', 'Profil Üç', 'profil_uc');
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz)
  values ('22900000-0000-4000-8000-000000000010', '22900000-0000-4000-8000-000000000001', 'p229', 'Profil şehri', 40, 30, 'Europe/Istanbul');
insert into public.members (trip_id, user_id, display_name) values ('22900000-0000-4000-8000-000000000010', '22900000-0000-4000-8000-000000000002', 'Profil İki');
set role authenticated;
select pg_temp.as_user('22900000-0000-4000-8000-000000000001');
do $$
begin
  assert (select count(*) from public.profiles where id::text like '22900000-%') = 2, '#229: sahip kendini ve ortak üyeyi görür';
  assert not exists (select 1 from public.profiles where id = '22900000-0000-4000-8000-000000000003'), '#229: yabancıyı göremez';
end $$;
select pg_temp.as_user('22900000-0000-4000-8000-000000000003');
do $$
begin
  assert (select count(*) from public.profiles where id::text like '22900000-%') = 1, '#229: yabancı yalnız kendini görür';
  assert (select count(*) from public.profiles) = 1, '#229: rehber kapalı (toplu çekim yalnız kendi satırı)';
end $$;
select pg_temp.as_user(:G, true);
do $$ begin assert not exists (select 1 from public.profiles where id::text like '22900000-%'), '#229: misafir başkasının profilini göremez'; end $$;
reset role;
delete from public.members where trip_id = '22900000-0000-4000-8000-000000000010' and user_id = '22900000-0000-4000-8000-000000000002';
set role authenticated;
select pg_temp.as_user('22900000-0000-4000-8000-000000000002');
do $$
begin
  assert not exists (select 1 from public.profiles where id = '22900000-0000-4000-8000-000000000001'), '#229: seyahatten çıkınca göremez';
  assert exists (select 1 from public.profiles where id = '22900000-0000-4000-8000-000000000002'), '#229: kendini görür';
end $$;
reset role;
set role anon;
select pg_temp.hata_bekle($$select public.ortak_seyahat_var('22900000-0000-4000-8000-000000000001')$$, '42501');
reset role;
do $$
begin
  assert (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.ortak_seyahat_var(uuid)'::regprocedure),
    '#229: yardımcı security definer, search_path boş';
end $$;
delete from public.trips where id = '22900000-0000-4000-8000-000000000010';
delete from auth.users where id::text like '22900000-%';

-- #234 KK1/KK2/KK3: seyahat silinince sohbet ve fisler klasörleri kuyruğa girer; kuyruk yalnız service_role'e açık.
insert into auth.users (id) values ('23400000-0000-4000-8000-000000000001');
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values
  ('23400000-0000-4000-8000-000000000010', '23400000-0000-4000-8000-000000000001', 'p234', 'Kova şehri', 40, 30, 'Europe/Istanbul'),
  ('23400000-0000-4000-8000-000000000011', '23400000-0000-4000-8000-000000000001', 'p234', 'Kova şehri', 40, 30, 'Europe/Istanbul');
insert into storage.objects (bucket_id, name) values
  ('sohbet', '23400000-0000-4000-8000-000000000010/m1.jpg'),
  ('fisler', '23400000-0000-4000-8000-000000000010/f1.jpg'),
  ('fisler', '23400000-0000-4000-8000-000000000011/f2.jpg');
delete from public.trips where id = '23400000-0000-4000-8000-000000000010';
do $$
begin
  assert (select count(*) from public.silinecek_klasorler where trip_id = '23400000-0000-4000-8000-000000000010') = 2,
    '#234 KK2: silinen seyahat için iki satır';
  assert (select array_agg(kova order by kova) from public.silinecek_klasorler where trip_id = '23400000-0000-4000-8000-000000000010')
    = array['fisler', 'sohbet'], '#234 KK2: sohbet ve fisler';
  assert not exists (select 1 from public.silinecek_klasorler where trip_id = '23400000-0000-4000-8000-000000000011'),
    '#234 KK2: silinmeyen seyahat kuyruğa girmez';
  assert (select relrowsecurity from pg_class where oid = 'public.silinecek_klasorler'::regclass), '#234 KK1: RLS açık';
  assert not exists (select 1 from pg_policies where tablename = 'silinecek_klasorler'), '#234 KK1: politika yok';
  assert (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.trips_klasor_kuyrugu()'::regprocedure),
    '#234 KK2: tetikleyici security definer, search_path boş';
end $$;
-- Hâlâ var olan seyahatin elle eklenmiş satırı listeye girmez (atlanır).
insert into public.silinecek_klasorler (kova, trip_id) values ('fisler', '23400000-0000-4000-8000-000000000011');
set role service_role;
do $$
declare
  r record;
  n int := 0;
begin
  for r in select * from public.kova_temizle_listesi(50) where trip_id::text like '23400000-%' loop
    n := n + 1;
    assert r.trip_id = '23400000-0000-4000-8000-000000000010', '#234 KK3: var olan seyahat atlanır';
    assert r.dosyalar = array['23400000-0000-4000-8000-000000000010/' || case r.kova when 'sohbet' then 'm1.jpg' else 'f1.jpg' end],
      '#234 KK3: yalnız o kova ve klasörün dosyaları';
  end loop;
  assert n = 2, '#234 KK3: iki klasör listelenir';
  assert (select count(*) from public.kova_temizle_listesi(0)) = 0, '#234 KK3: p_adet 0 boş döner';
  -- Dosya duruyorken kapanmaz (yarıda kalan tur sonraki turda devam eder).
  assert public.kova_temizle_bitir('sohbet', '23400000-0000-4000-8000-000000000010') is null, '#234 KK4: dosya varken kapanmaz';
  assert public.kova_temizle_bitir('fisler', '23400000-0000-4000-8000-000000000011') is null, '#234 KK3: var olan seyahat kapanmaz';
end $$;
reset role;
delete from storage.objects where name = '23400000-0000-4000-8000-000000000010/m1.jpg';
set role service_role;
do $$
begin
  assert public.kova_temizle_bitir('sohbet', '23400000-0000-4000-8000-000000000010'), '#234 KK3: boşalan klasör kapanır';
  assert not exists (select 1 from public.kova_temizle_listesi(50) where kova = 'sohbet' and trip_id = '23400000-0000-4000-8000-000000000010'),
    '#234 KK3: kapanan klasör yeniden listelenmez';
end $$;
reset role;
set role authenticated;
select pg_temp.as_user('23400000-0000-4000-8000-000000000001');
select pg_temp.hata_bekle($$select count(*) from public.silinecek_klasorler$$, '42501');
select pg_temp.hata_bekle($$insert into public.silinecek_klasorler (kova, trip_id) values ('sohbet', gen_random_uuid())$$, '42501');
select pg_temp.hata_bekle($$update public.silinecek_klasorler set silindi = now()$$, '42501');
select pg_temp.hata_bekle($$delete from public.silinecek_klasorler$$, '42501');
select pg_temp.hata_bekle($$select * from public.kova_temizle_listesi(50)$$, '42501');
select pg_temp.hata_bekle($$select public.kova_temizle_bitir('sohbet', '23400000-0000-4000-8000-000000000010')$$, '42501');
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
select pg_temp.hata_bekle($$select count(*) from public.silinecek_klasorler$$, '42501');
select pg_temp.hata_bekle($$select * from public.kova_temizle_listesi(50)$$, '42501');
reset role;
set role anon;
select pg_temp.hata_bekle($$select count(*) from public.silinecek_klasorler$$, '42501');
select pg_temp.hata_bekle($$insert into public.silinecek_klasorler (kova, trip_id) values ('sohbet', gen_random_uuid())$$, '42501');
select pg_temp.hata_bekle($$select * from public.kova_temizle_listesi(50)$$, '42501');
select pg_temp.hata_bekle($$select public.kova_temizle_bitir('sohbet', '23400000-0000-4000-8000-000000000010')$$, '42501');
reset role;
delete from public.trips where id = '23400000-0000-4000-8000-000000000011';
delete from storage.objects where name like '23400000-%';
delete from public.silinecek_klasorler where trip_id::text like '23400000-%';
delete from auth.users where id = '23400000-0000-4000-8000-000000000001';

-- #263 KK4a: authenticated kimlik veremez; verdiği değer kullanılmaz, sunucu üretir.
insert into auth.users (id) values ('26300000-0000-4000-8000-000000000001');
set role authenticated;
select pg_temp.as_user('26300000-0000-4000-8000-000000000001');
create temp table if not exists t263 (id uuid);
grant all on t263 to authenticated, service_role;
with y as (
  insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz)
  values ('26300000-0000-4000-8000-000000000010', auth.uid(), 'p263', 'Kimlik şehri', 40, 30, 'Europe/Istanbul')
  returning id)
insert into t263 select id from y;
do $$
begin
  assert (select count(*) from t263) = 1, '#263 KK1: seyahat oluşur';
  assert (select id from t263) <> '26300000-0000-4000-8000-000000000010', '#263 KK1: istemcinin verdiği kimlik kullanılmaz';
  assert not exists (select 1 from public.trips where id = '26300000-0000-4000-8000-000000000010'), '#263 KK1: verilen kimlikle satır yok';
  assert public.is_owner((select id from t263)), '#263 KK1: sahip üyeliği tetikleyiciyle gelir';
end $$;
reset role;
-- #263 KK4b: kuyruktaki kimlikle ekleme reddedilir (service_role ve sahip rolü dahil).
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values
  ('26300000-0000-4000-8000-000000000020', '26300000-0000-4000-8000-000000000001', 'p263', 'Kimlik şehri', 40, 30, 'Europe/Istanbul');
delete from public.trips where id = '26300000-0000-4000-8000-000000000020';
select pg_temp.hata_bekle($$insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values
  ('26300000-0000-4000-8000-000000000020', '26300000-0000-4000-8000-000000000001', 'p263', 'x', 40, 30, 'Europe/Istanbul')$$, '23505');
set role service_role;
select pg_temp.hata_bekle($$insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values
  ('26300000-0000-4000-8000-000000000020', '26300000-0000-4000-8000-000000000001', 'p263', 'x', 40, 30, 'Europe/Istanbul')$$, '23505');
reset role;
-- #263 KK4c: kapanmış kuyruk satırı aynı seyahat yeniden silinince açılır.
update public.silinecek_klasorler set silindi = now(), eklendi = now() - interval '3 days'
 where trip_id = '26300000-0000-4000-8000-000000000020';
-- Kimliğin yeniden doğması artık mümkün değil; tetikleyiciyi doğrudan sınamak için denetimi bu blokta atlıyoruz.
alter table public.trips disable trigger trips_b_kuyruk_denetimi;
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values
  ('26300000-0000-4000-8000-000000000020', '26300000-0000-4000-8000-000000000001', 'p263', 'x', 40, 30, 'Europe/Istanbul');
alter table public.trips enable trigger trips_b_kuyruk_denetimi;
delete from public.trips where id = '26300000-0000-4000-8000-000000000020';
do $$
begin
  assert (select count(*) from public.silinecek_klasorler
           where trip_id = '26300000-0000-4000-8000-000000000020' and silindi is null and eklendi > now() - interval '1 minute') = 2,
    '#263 KK3: kapanmış satır yeniden açılır';
  assert (select tgenabled from pg_trigger where tgname = 'trips_b_kuyruk_denetimi') = 'O', '#263 KK2: denetim yeniden açık';
end $$;
delete from public.trips where owner_id = '26300000-0000-4000-8000-000000000001';
delete from public.silinecek_klasorler where trip_id::text like '26300000-%' or trip_id in (select id from t263);
delete from auth.users where id = '26300000-0000-4000-8000-000000000001';

-- #266 KK1/KK3: seyahat kimliği hiçbir rol için değiştirilemez (authenticated sahip, service_role, tablo sahibi).
insert into auth.users (id) values ('26600000-0000-4000-8000-000000000001');
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values
  ('26600000-0000-4000-8000-000000000010', '26600000-0000-4000-8000-000000000001', 'p266', 'Kimlik şehri', 40, 30, 'Europe/Istanbul');
set role authenticated;
select pg_temp.as_user('26600000-0000-4000-8000-000000000001');
select pg_temp.hata_bekle($$update public.trips set id = gen_random_uuid() where id = '26600000-0000-4000-8000-000000000010'$$, '42501');
reset role;
set role service_role;
select pg_temp.hata_bekle($$update public.trips set id = gen_random_uuid() where id = '26600000-0000-4000-8000-000000000010'$$, '42501');
reset role;
select pg_temp.hata_bekle($$update public.trips set id = gen_random_uuid() where id = '26600000-0000-4000-8000-000000000010'$$, '42501');
do $$
begin
  assert exists (select 1 from public.trips where id = '26600000-0000-4000-8000-000000000010'), '#266 KK1: kimlik aynı kaldı';
end $$;
-- Kimlik dışındaki güncelleme service_role için çalışmaya devam eder.
set role service_role;
update public.trips set city_label = 'Kimlik şehri 2' where id = '26600000-0000-4000-8000-000000000010';
reset role;
do $$
begin
  assert (select city_label from public.trips where id = '26600000-0000-4000-8000-000000000010') = 'Kimlik şehri 2',
    '#266 KK1: diğer alanlar güncellenir';
end $$;

-- #266 KK2/KK3: silme kuyruğunda satır silinemez; service_role da silemez. Kapatma (update) çalışır.
delete from public.trips where id = '26600000-0000-4000-8000-000000000010';
set role service_role;
select pg_temp.hata_bekle($$delete from public.silinecek_klasorler where trip_id = '26600000-0000-4000-8000-000000000010'$$, '42501');
select public.kova_temizle_bitir('sohbet', '26600000-0000-4000-8000-000000000010');
reset role;
do $$
begin
  assert (select count(*) from public.silinecek_klasorler where trip_id = '26600000-0000-4000-8000-000000000010') = 2,
    '#266 KK2: kuyruk satırları duruyor';
  assert not has_table_privilege('service_role', 'public.silinecek_klasorler', 'delete'), '#266 KK2: service_role delete yetkisi yok';
  assert has_table_privilege('service_role', 'public.silinecek_klasorler', 'update'), '#266 KK2: service_role kapatabilir';
end $$;
delete from public.silinecek_klasorler where trip_id::text like '26600000-%';
delete from auth.users where id = '26600000-0000-4000-8000-000000000001';

-- #234 KK6: tetikleyiciden önce silinmiş seyahatlerin klasörleri kuru çalıştırmayla kuyruğa onay bekleyerek girer; silme onaydan sonra.
insert into auth.users (id) values ('23460000-0000-4000-8000-000000000001');
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz) values
  ('23460000-0000-4000-8000-000000000010', '23460000-0000-4000-8000-000000000001', 'p2346', 'Yetim şehri', 40, 30, 'Europe/Istanbul'),
  ('23460000-0000-4000-8000-000000000040', '23460000-0000-4000-8000-000000000001', 'p2346', 'Yetim şehri', 40, 30, 'Europe/Istanbul');
insert into storage.objects (bucket_id, name, metadata) values
  ('sohbet', '23460000-0000-4000-8000-000000000010/var.jpg', '{"size": 100}'),
  ('sohbet', '23460000-0000-4000-8000-000000000020/m1.jpg', '{"size": 1048576}'),
  ('fisler', '23460000-0000-4000-8000-000000000020/f1.jpg', '{"size": 524288}'),
  ('sohbet', 'uuid-degil/x.jpg', '{"size": 10}'),
  ('avatars', '23460000-0000-4000-8000-000000000050/a.jpg', '{"size": 10}'),
  ('fisler', '23460000-0000-4000-8000-000000000030/f.jpg', '{"size": 10}');
-- C (…30) tetikleyiciyle zaten kuyrukta (onay beklemez).
insert into public.silinecek_klasorler (kova, trip_id) values ('fisler', '23460000-0000-4000-8000-000000000030');
do $$
begin
  assert not exists (select 1 from public.silinecek_klasorler where onay_bekliyor), '#234 KK6: başlangıçta onay bekleyen yok';
end $$;
set role service_role;
do $$
declare
  r record;
begin
  select * into r from public.yetim_klasorleri_kuyruga_al();
  assert r.klasor = 2 and r.dosya = 2, '#234 KK6: yalnız seyahati olmayan, kuyrukta olmayan iki klasör (sohbet + fisler)';
  assert r.mb = 1.5, '#234 KK6: toplam MB';
  assert (select count(*) from public.silinecek_klasorler where trip_id::text like '23460000-%' and yetim) = 2,
    '#234 KK6: kuru çalıştırmanın satırları yetim işaretli';
  -- Yeniden çalıştırmak aynı sayıyı verir, yeni satır yazmaz.
  select * into r from public.yetim_klasorleri_kuyruga_al();
  assert r.klasor = 2 and r.dosya = 2, '#234 KK6: kuru çalıştırma tekrarlanabilir';
  assert (select count(*) from public.silinecek_klasorler where trip_id::text like '23460000-%') = 3, '#234 KK6: tekrar yeni satır yazmaz';
  -- Onay bekleyen satırı temizleyici listelemez; var olan seyahatin ve avatars kovasının klasörü kuyrukta değil.
  assert not exists (select 1 from public.kova_temizle_listesi(50) where trip_id = '23460000-0000-4000-8000-000000000020'),
    '#234 KK6: onay bekleyen silinmez';
  assert exists (select 1 from public.kova_temizle_listesi(50) where trip_id = '23460000-0000-4000-8000-000000000030'),
    '#234 KK6: normal kuyruk çalışmaya devam eder';
end $$;
reset role;
do $$
begin
  assert not exists (select 1 from public.silinecek_klasorler where trip_id in
    ('23460000-0000-4000-8000-000000000010', '23460000-0000-4000-8000-000000000050')), '#234 KK6: var olan seyahat ve avatars kuyruğa girmez';
  assert (select count(*) from storage.objects where name like '23460000-%' or name = 'uuid-degil/x.jpg') = 6, '#234 KK6: kuru çalıştırma dosya silmez';
  assert (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.yetim_klasorleri_kuyruga_al()'::regprocedure)
     and (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.yetim_klasorleri_onayla(bigint)'::regprocedure),
    '#234 KK6: fonksiyonlar security definer, search_path boş';
  -- Herkese açık loga yalnız üç sayı gider.
  assert pg_get_function_result('public.yetim_klasorleri_kuyruga_al()'::regprocedure) = 'TABLE(klasor bigint, dosya bigint, mb numeric)',
    '#234 KK6: kuru çalıştırma yalnız klasör, dosya, MB döndürür';
end $$;
set role authenticated;
select pg_temp.as_user('23460000-0000-4000-8000-000000000001');
select pg_temp.hata_bekle($$select * from public.yetim_klasorleri_kuyruga_al()$$, '42501');
select pg_temp.hata_bekle($$select public.yetim_klasorleri_onayla(2)$$, '42501');
select pg_temp.hata_bekle($$update public.silinecek_klasorler set onay_bekliyor = false$$, '42501');
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
select pg_temp.hata_bekle($$select * from public.yetim_klasorleri_kuyruga_al()$$, '42501');
select pg_temp.hata_bekle($$select public.yetim_klasorleri_onayla(2)$$, '42501');
reset role;
set role anon;
select pg_temp.hata_bekle($$select * from public.yetim_klasorleri_kuyruga_al()$$, '42501');
select pg_temp.hata_bekle($$select public.yetim_klasorleri_onayla(2)$$, '42501');
reset role;
-- Ürün 2'yi gördükten sonra kuru çalıştırma yeniden koşar ve görülmemiş bir klasör ekler: 2'lik onay reddedilir, hiçbir satır açılmaz.
insert into storage.objects (bucket_id, name, metadata) values ('sohbet', '23460000-0000-4000-8000-000000000060/y.jpg', '{"size": 10}');
set role service_role;
do $$
declare
  r record;
  v_red boolean := false;
begin
  select * into r from public.yetim_klasorleri_kuyruga_al();
  assert r.klasor = 3, '#234 KK6: yeni yetim klasör sayıya girer';
  begin
    perform public.yetim_klasorleri_onayla(2);
  exception when sqlstate 'P0001' then
    v_red := true;
  end;
  assert v_red, '#234 KK6: sayı tutmayan onay reddedilir';
  assert (select count(*) from public.silinecek_klasorler where trip_id::text like '23460000-%' and onay_bekliyor) = 3,
    '#234 KK6: reddedilen onay hiçbir satırı açmaz';
  assert not exists (select 1 from public.kova_temizle_listesi(50) where trip_id::text like '23460000-%' and trip_id <> '23460000-0000-4000-8000-000000000030'),
    '#234 KK6: reddedilen onaydan sonra temizleyici yetim listelemez';
  v_red := false;
  begin
    perform public.yetim_klasorleri_onayla(null);
  exception when sqlstate 'P0001' then
    v_red := true;
  end;
  assert v_red, '#234 KK6: sayısız onay reddedilir';
  assert public.yetim_klasorleri_onayla(3) = 3, '#234 KK6: gördüğü sayıyla onay üç satırı açar';
  assert (select count(*) from public.kova_temizle_listesi(50) where trip_id = '23460000-0000-4000-8000-000000000020') = 2,
    '#234 KK6: onaydan sonra temizleyici listeler';
  assert public.yetim_klasorleri_onayla(0) = 0, '#234 KK6: onay tekrarlanabilir';
end $$;
reset role;
-- Yetim satırlar normal silmelerin önüne geçmez: kuru çalıştırmadan sonra gelen normal satır yine önce listelenir.
insert into public.silinecek_klasorler (kova, trip_id, eklendi) values ('sohbet', '23460000-0000-4000-8000-000000000070', now() + interval '1 hour');
set role service_role;
do $$
declare
  v_normal bigint;
  v_yetim bigint;
begin
  select min(n) filter (where l.trip_id = '23460000-0000-4000-8000-000000000070'),
         min(n) filter (where l.trip_id in ('23460000-0000-4000-8000-000000000020', '23460000-0000-4000-8000-000000000060'))
    into v_normal, v_yetim
    from public.kova_temizle_listesi(50) with ordinality as l(kova, trip_id, dosyalar, n);
  assert v_normal is not null and v_yetim is not null and v_normal < v_yetim, '#234 KK6: normal satır yetimden önce gelir';
  assert (select trip_id from public.kova_temizle_listesi(1)) <> '23460000-0000-4000-8000-000000000020'
     and (select trip_id from public.kova_temizle_listesi(1)) <> '23460000-0000-4000-8000-000000000060',
    '#234 KK6: tek kişilik turda yetim gelmez';
end $$;
reset role;
-- Onay bekleyen bir satırın seyahati normal yoldan silinirse satır onay beklemez.
insert into public.silinecek_klasorler (kova, trip_id, onay_bekliyor, yetim) values ('sohbet', '23460000-0000-4000-8000-000000000040', true, true);
delete from public.trips where id = '23460000-0000-4000-8000-000000000040';
do $$
begin
  assert not exists (select 1 from public.silinecek_klasorler where trip_id = '23460000-0000-4000-8000-000000000040' and (onay_bekliyor or yetim)),
    '#234 KK6: tetikleyici onay ve yetim işaretini kaldırır';
end $$;
delete from public.trips where id = '23460000-0000-4000-8000-000000000010';
delete from storage.objects where name like '23460000-%' or name = 'uuid-degil/x.jpg';
delete from public.silinecek_klasorler where trip_id::text like '23460000-%';
delete from auth.users where id = '23460000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------- #262: Google koordinatı 30 günü geçmeden yenilenir
-- Kaynaklar places, trips (şehir + eski otel alanı) ve stays; yenileme yaşı 25 gün; aynı place_id tek istek; son deneme
-- damgası; 404 ve 30 gün boşaltması (satır silinmez); ayrı aylık sayaç; akışa düşmez; yalnız service_role.
insert into auth.users (id, is_anonymous) values ('26200000-0000-4000-8000-000000000001', false);
insert into public.trips (id, owner_id, city_place_id, city_label, lat, lng, tz, google_fetched_at) values
  ('26200000-0000-4000-8000-000000000010', '26200000-0000-4000-8000-000000000001', 'ChIJ_262_sehir', 'Yenileme şehri', 40, 30, 'Europe/Istanbul', now() - interval '27 days'),
  ('26200000-0000-4000-8000-000000000020', '26200000-0000-4000-8000-000000000001', 'ChIJ_262_sehir2', 'Yenileme şehri', 40, 30, 'Europe/Istanbul', now());
update public.trips set hotel_place_id = 'ChIJ_262_eski', hotel_lat = 40.1, hotel_lng = 30.1, hotel_fetched_at = now() - interval '35 days'
  where id = '26200000-0000-4000-8000-000000000020';
insert into public.places (trip_id, place_id, lat, lng, google_fetched_at, note) values
  ('26200000-0000-4000-8000-000000000010', 'ChIJ_262_eski', 40.1, 30.1, now() - interval '40 days', 'kullanıcı notu'),
  ('26200000-0000-4000-8000-000000000020', 'ChIJ_262_eski', 40.1, 30.1, now() - interval '31 days', null),
  ('26200000-0000-4000-8000-000000000010', 'ChIJ_262_esik', 40.2, 30.2, now() - interval '26 days', null),
  ('26200000-0000-4000-8000-000000000010', 'ChIJ_262_taze', 40.3, 30.3, now() - interval '24 days', null),
  ('26200000-0000-4000-8000-000000000020', 'ChIJ_262_yok', 40.4, 30.4, now() - interval '28 days', 'silinmez'),
  ('26200000-0000-4000-8000-000000000020', 'ChIJ_262_suresi', 40.5, 30.5, now() - interval '33 days', 'kalır');
insert into public.stays (trip_id, place_id, lat, lng, label, google_fetched_at) values
  ('26200000-0000-4000-8000-000000000010', 'ChIJ_262_otel', 40.6, 30.6, 'Otelim', now() - interval '29 days'),
  ('26200000-0000-4000-8000-000000000010', null, 40.7, 30.7, 'Pinim', now() - interval '90 days'),
  ('26200000-0000-4000-8000-000000000020', 'ChIJ_262_eski', 40.1, 30.1, 'Aynı yer', now() - interval '32 days');
delete from public.changes where trip_id::text like '26200000-%';
set role service_role;
do $$
declare
  v text[];
  b record;
begin
  -- Dört kaynak tek listede; place_id tekil; en eski damga önce; place_id'siz otel (kullanıcı pini) kapsam dışı.
  select array_agg(place_id) into v from public.places_yenilenecekler(500) where place_id like 'ChIJ_262_%';
  assert v = array['ChIJ_262_eski', 'ChIJ_262_suresi', 'ChIJ_262_otel', 'ChIJ_262_yok', 'ChIJ_262_sehir', 'ChIJ_262_esik'],
    '#262: 25 günü geçen place_id''ler (places, trips, stays), en eski önce, tekil: ' || v::text;
  -- Son deneme: aynı gün ikinci kez verilmez.
  assert not exists (select 1 from public.places_yenilenecekler(500) where place_id like 'ChIJ_262_%'), '#262: o gün denenen atlanır';
  assert (select count(*) from public.places_yenileme_deneme where place_id like 'ChIJ_262_%') = 6, '#262: son deneme damgası';
  -- Dün denenmiş place_id hiç denenmemişin arkasına geçer (kalıcı hatalı satır kuyruğu kilitlemez).
  update public.places_yenileme_deneme set son_deneme = now() - interval '1 day' where place_id in ('ChIJ_262_eski', 'ChIJ_262_suresi');
  delete from public.places_yenileme_deneme where place_id = 'ChIJ_262_esik';
  select array_agg(place_id) into v from public.places_yenilenecekler(2) where place_id like 'ChIJ_262_%';
  assert v = array['ChIJ_262_esik', 'ChIJ_262_eski'], '#262: denenmemiş önce, sonra en eski: ' || v::text;
  assert (select count(*) from public.places_yenilenecekler(0)) = 0, '#262: p_adet 0 boş döner';

  -- Yazma: aynı place_id'nin places (2), trips oteli (1) ve stays (1) satırları birlikte.
  assert public.places_koordinat_yenile('ChIJ_262_eski', 40.15, 30.15) = 4, '#262: aynı place_id''nin dört satırı birlikte yazılır';
  assert (select count(*) from public.places where place_id = 'ChIJ_262_eski' and lat = 40.15 and lng = 30.15
    and google_fetched_at > now() - interval '1 minute') = 2, '#262 places: koordinat ve damga yenilenir';
  assert (select hotel_lat = 40.15 and hotel_fetched_at > now() - interval '1 minute' from public.trips
    where id = '26200000-0000-4000-8000-000000000020'), '#262 trips oteli: koordinat ve damga yenilenir';
  assert (select lat = 40.15 and google_fetched_at > now() - interval '1 minute' from public.stays where place_id = 'ChIJ_262_eski'),
    '#262 stays: koordinat ve damga yenilenir';
  assert public.places_koordinat_yenile('ChIJ_262_sehir', 40.05, 30.05) = 1, '#262 trips şehri yazılır';
  assert (select lat = 40.05 and google_fetched_at > now() - interval '1 minute' from public.trips
    where id = '26200000-0000-4000-8000-000000000010'), '#262 trips şehri: koordinat ve damga yenilenir';
  assert public.places_koordinat_yenile('ChIJ_262_otel', 40.65, 30.65) = 1, '#262 stays oteli yazılır';
  assert public.places_koordinat_yenile('ChIJ_262_eski', 41, 31) = 0, '#262: taze satıra ikinci kez yazılmaz';
  assert public.places_koordinat_yenile('ChIJ_262_taze', 41, 31) = 0, '#262: yenileme yaşına gelmemiş satıra yazılmaz';
  delete from public.places_yenileme_deneme where place_id like 'ChIJ_262_%';
  assert not exists (select 1 from public.places_yenilenecekler(500) where place_id in ('ChIJ_262_eski', 'ChIJ_262_sehir', 'ChIJ_262_otel')),
    '#262: yenilenen listeden çıkar';
  delete from public.places_yenileme_deneme where place_id like 'ChIJ_262_%';

  -- 404: o place_id'nin koordinatı hemen boşalır; satır, place_id ve not kalır; listeden çıkar.
  select * into b from public.places_koordinat_bosalt('ChIJ_262_yok');
  assert b.yer = 1 and b.seyahat = 0 and b.otel = 0 and b.konaklama = 0, '#262 404: yalnız o place_id boşalır';
  assert (select lat is null and lng is null and note = 'silinmez' from public.places where place_id = 'ChIJ_262_yok'),
    '#262 404: satır silinmez, koordinat boş, not kalır';
  assert not exists (select 1 from public.places_yenilenecekler(500) where place_id = 'ChIJ_262_yok'), '#262 404: listeden çıkar';
  delete from public.places_yenileme_deneme where place_id like 'ChIJ_262_%';

  -- 30. gün: süresi geçen her koordinat boşalır (places, trips şehri ve oteli, stays); taze ve place_id'siz otel kalır.
  -- #318 inceleme 4: kesilen tur 32 gün eşiğiyle çağırır; 32 günü geçen boşalır, 30–32 gün arası sonraki başarılı tura kalır.
  update public.trips set google_fetched_at = now() - interval '31 days' where id = '26200000-0000-4000-8000-000000000010';
  select * into b from public.places_koordinat_bosalt(null, 32);
  assert b.yer = 1 and b.seyahat = 0, '#262 32 gün eşiği: 33 günlük places boşalır, 31 günlük trips şehri kalır';
  assert (select lat is null and note = 'kalır' from public.places where place_id = 'ChIJ_262_suresi'), '#262 32 gün: 33 günlük koordinat boşalır';
  assert (select lat is not null from public.trips where id = '26200000-0000-4000-8000-000000000010'), '#262 32 gün: 31 günlük koordinat kalır';

  update public.trips set hotel_fetched_at = now() - interval '31 days' where id = '26200000-0000-4000-8000-000000000020';
  update public.stays set google_fetched_at = now() - interval '31 days' where place_id = 'ChIJ_262_otel';
  select * into b from public.places_koordinat_bosalt();
  assert b.yer = 0 and b.seyahat >= 1 and b.otel >= 1 and b.konaklama >= 1, '#262 30 gün: trips şehri ve oteli, stays boşalır (places yukarıda 32 günde boşaldı)';
  assert (select lat is null and note = 'kalır' from public.places where place_id = 'ChIJ_262_suresi'), '#262 30 gün: places boşalır, not kalır';
  assert (select lat is null and lng is null and city_place_id = 'ChIJ_262_sehir' and city_label = 'Yenileme şehri' from public.trips
    where id = '26200000-0000-4000-8000-000000000010'), '#262 30 gün: trips şehri boşalır, place_id ve ad kalır';
  assert (select hotel_lat is null and hotel_lng is null and hotel_place_id = 'ChIJ_262_eski' from public.trips
    where id = '26200000-0000-4000-8000-000000000020'), '#262 30 gün: trips oteli boşalır';
  assert (select lat is null and label = 'Otelim' from public.stays where place_id = 'ChIJ_262_otel'), '#262 30 gün: stays boşalır, ad kalır';
  assert (select lat = 40.7 from public.stays where label = 'Pinim'), '#262: place_id''siz otel (kullanıcı pini) boşalmaz';
  assert (select count(*) from public.places where place_id in ('ChIJ_262_eski', 'ChIJ_262_esik', 'ChIJ_262_taze') and lat is not null) = 4,
    '#262 30 gün: taze koordinat kalır';
  assert (select count(*) from public.places where trip_id::text like '26200000-%') = 6, '#262: hiçbir satır silinmez';
  assert not exists (select 1 from public.places_yenilenecekler(500) where place_id in ('ChIJ_262_suresi', 'ChIJ_262_sehir')),
    '#262: boş koordinat yeniden istenmez';
  assert public.places_koordinat_yenile('ChIJ_262_suresi', 40, 30) = 0, '#262: boşaltılan koordinata yazılmaz';
  assert not exists (select 1 from public.changes where trip_id::text like '26200000-%'), '#262: yenileme ve boşaltma akışa düşmez';

  -- Aylık sayaç: sınıra kadar artar, aşacak istek bütünüyle reddedilir; günlük Places sayacına yazılmaz.
  delete from public.places_yenileme_sayac;
  assert public.places_yenileme_artir(300, 500), '#262 sayaç: 300/500';
  assert public.places_yenileme_artir(200, 500), '#262 sayaç: 500/500 sığar';
  assert not public.places_yenileme_artir(1, 500), '#262 sayaç: sınır dolunca ret';
  assert (select adet from public.places_yenileme_sayac) = 500, '#262 sayaç: ret artırmaz';
  assert not public.places_yenileme_artir(10, 5), '#262 sayaç: sınırdan büyük ilk istek ret';
  assert public.places_yenileme_durdu(), '#262: ilk durma bildirilir';
  assert not public.places_yenileme_durdu(), '#262: aynı ay ikinci durma bildirilmez';
  assert (select relrowsecurity from pg_class where oid = 'public.places_yenileme_sayac'::regclass), '#262: sayaç RLS açık';
  assert (select relrowsecurity from pg_class where oid = 'public.places_yenileme_deneme'::regclass), '#262: deneme RLS açık';
  assert not exists (select 1 from pg_policies where tablename in ('places_yenileme_sayac', 'places_yenileme_deneme')), '#262: politika yok';
  delete from public.places_yenileme_sayac;
  delete from public.places_yenileme_deneme where place_id like 'ChIJ_262_%';
end $$;
select pg_temp.hata_bekle($$select * from public.places_yenilenecekler(501)$$, '22023');
select pg_temp.hata_bekle($$select public.places_yenileme_artir(0, 8000)$$, '22023');
select pg_temp.hata_bekle($$select public.places_koordinat_yenile('ChIJ_262_esik', 91, 30)$$, '22023');
select pg_temp.hata_bekle($$select public.places_koordinat_yenile('', 40, 30)$$, '22023');
select pg_temp.hata_bekle($$select * from public.places_koordinat_bosalt('')$$, '22023');
select pg_temp.hata_bekle($$select * from public.places_koordinat_bosalt(null, 29)$$, '22023');
select pg_temp.hata_bekle($$select * from public.places_koordinat_bosalt(null, 61)$$, '22023');
reset role;
-- Koordinatın yarısı boşalamaz.
select pg_temp.hata_bekle($$update public.places set lat = null where place_id = 'ChIJ_262_taze'$$, '23514');
select pg_temp.hata_bekle($$update public.trips set lng = null where id = '26200000-0000-4000-8000-000000000020'$$, '23514');
select pg_temp.hata_bekle($$update public.stays set lat = null where label = 'Pinim'$$, '23514');
-- Kullanıcının kendi koordinat değişikliği akışa yine düşer (işaret yalnız sistem yenilemesinde).
update public.places set lat = 40.25 where place_id = 'ChIJ_262_esik';
do $$
begin
  assert exists (select 1 from public.changes where trip_id::text like '26200000-%' and entity = 'places' and field = 'lat'),
    '#262: normal koordinat değişikliği akışa düşer';
end $$;
set role authenticated;
select pg_temp.as_user('26200000-0000-4000-8000-000000000001');
select pg_temp.hata_bekle($$select count(*) from public.places_yenileme_sayac$$, '42501');
select pg_temp.hata_bekle($$select count(*) from public.places_yenileme_deneme$$, '42501');
select pg_temp.hata_bekle($$select count(*) from public.google_koordinatlari$$, '42501');
select pg_temp.hata_bekle($$select * from public.places_yenilenecekler(10)$$, '42501');
select pg_temp.hata_bekle($$select public.places_yenileme_artir(1, 8000)$$, '42501');
select pg_temp.hata_bekle($$select public.places_yenileme_durdu()$$, '42501');
select pg_temp.hata_bekle($$select public.places_koordinat_yenile('ChIJ_262_esik', 40, 30)$$, '42501');
select pg_temp.hata_bekle($$select * from public.places_koordinat_bosalt()$$, '42501');
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
select pg_temp.hata_bekle($$select count(*) from public.places_yenileme_sayac$$, '42501');
select pg_temp.hata_bekle($$select public.places_koordinat_yenile('ChIJ_262_esik', 40, 30)$$, '42501');
select pg_temp.hata_bekle($$select * from public.places_koordinat_bosalt('ChIJ_262_esik')$$, '42501');
reset role;
set role anon;
select pg_temp.hata_bekle($$select count(*) from public.places_yenileme_sayac$$, '42501');
select pg_temp.hata_bekle($$select count(*) from public.places_yenileme_deneme$$, '42501');
select pg_temp.hata_bekle($$select * from public.places_yenilenecekler(10)$$, '42501');
select pg_temp.hata_bekle($$select public.places_yenileme_artir(1, 8000)$$, '42501');
select pg_temp.hata_bekle($$select public.places_koordinat_yenile('ChIJ_262_esik', 40, 30)$$, '42501');
select pg_temp.hata_bekle($$select * from public.places_koordinat_bosalt()$$, '42501');
reset role;
-- ---------------------------------------------------------------- #516: gece koordinat temizliği (kapıdan bağımsız)
-- Her kaynakta bir 31 günlük (boşalır) ve bir 29 günlük (kalır) koordinat; #262'nin satırları yeniden kullanılır.
update public.places set lat = 40.3, lng = 30.3, google_fetched_at = now() - interval '31 days' where place_id = 'ChIJ_262_suresi';
update public.places set lat = 40.4, lng = 30.4, google_fetched_at = now() - interval '29 days' where place_id = 'ChIJ_262_yok';
update public.trips set lat = 40.0, lng = 30.0, google_fetched_at = now() - interval '31 days' where id = '26200000-0000-4000-8000-000000000010';
update public.trips set lat = 40.2, lng = 30.2, google_fetched_at = now() - interval '29 days',
  hotel_lat = 40.1, hotel_lng = 30.1, hotel_fetched_at = now() - interval '31 days' where id = '26200000-0000-4000-8000-000000000020';
update public.stays set lat = 40.6, lng = 30.6, google_fetched_at = now() - interval '31 days' where place_id = 'ChIJ_262_otel';
update public.stays set lat = 40.15, lng = 30.15, google_fetched_at = now() - interval '29 days' where place_id = 'ChIJ_262_eski';
set role service_role;
do $$
declare k public.gece_temizligi_kayit;
begin
  k := public.gece_temizligi();
  assert k.yer >= 1 and k.seyahat >= 1 and k.otel >= 1 and k.konaklama >= 1, '#516 KK1: dört kaynakta da boşaltır: ' || row_to_json(k)::text;
  assert (select lat is null and lng is null and note = 'kalır' from public.places where place_id = 'ChIJ_262_suresi'), '#516 KK4: 31 günlük places boşalır, not kalır';
  assert (select lat = 40.4 from public.places where place_id = 'ChIJ_262_yok'), '#516 KK4: 29 günlük places kalır';
  assert (select lat is null and city_place_id = 'ChIJ_262_sehir' from public.trips where id = '26200000-0000-4000-8000-000000000010'), '#516 KK4: 31 günlük trips şehri boşalır';
  assert (select lat = 40.2 and hotel_lat is null and hotel_place_id = 'ChIJ_262_eski' from public.trips where id = '26200000-0000-4000-8000-000000000020'),
    '#516 KK4: 29 günlük trips şehri kalır, 31 günlük oteli boşalır';
  assert (select lat is null and label = 'Otelim' from public.stays where place_id = 'ChIJ_262_otel'), '#516 KK4: 31 günlük stays boşalır';
  assert (select lat = 40.15 from public.stays where place_id = 'ChIJ_262_eski'), '#516 KK4: 29 günlük stays kalır';
  assert (select lat = 40.7 from public.stays where label = 'Pinim'), '#516: place_id''siz otel (kullanıcı pini) boşalmaz';
  -- KK5: çalışma kaydı yalnız sayı tutar; ikinci çalışmada boşaltılacak bir şey kalmaz.
  assert (select count(*) from public.gece_temizligi_kayit where id = k.id and yer = k.yer and seyahat = k.seyahat) = 1, '#516 KK5: kayıt yazılır';
  k := public.gece_temizligi();
  assert k.yer = 0 and k.seyahat = 0 and k.otel = 0 and k.konaklama = 0, '#516: ikinci çalışma boş: ' || row_to_json(k)::text;
  assert not exists (select 1 from public.changes where trip_id::text like '26200000-%' and field in ('lat', 'lng', 'hotel_lat', 'hotel_lng')
    and at > now() - interval '1 minute' and new = 'null'::jsonb), '#516: boşaltma akışa düşmez';
end $$;
reset role;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
select pg_temp.hata_bekle($$select public.gece_temizligi()$$, '42501');
select pg_temp.hata_bekle($$select count(*) from public.gece_temizligi_kayit$$, '42501');
reset role;
set role anon;
select pg_temp.hata_bekle($$select public.gece_temizligi()$$, '42501');
select pg_temp.hata_bekle($$select count(*) from public.gece_temizligi_kayit$$, '42501');
reset role;
-- ---------------------------------------------------------------- #345 KK1: kapak atfı (geziler, sehirler, yerler)
-- Okuma ve yazma satırın mevcut kuralıyla aynı: yayındaki satırın atfı herkese görünür, taslağınki görünmez; yalnız admin yazar.
-- Biçim denetimi: yalnız yazar / lisans / kaynak_url, yazar zorunlu, kaynak https.
insert into public.sehirler (id, ad, slug, lat, lng, yayin, kapak_url, kapak_atif) values
  ('34500000-0000-4000-8000-000000000001', 'Atıf Açık', 'atif-acik', 39.7, 30.5, true, 'sehirler/a.webp',
    '{"yazar": "Ayşe Y.", "lisans": "CC BY-SA 4.0", "kaynak_url": "https://commons.wikimedia.org/wiki/File:A.jpg"}'),
  ('34500000-0000-4000-8000-000000000002', 'Atıf Taslak', 'atif-taslak', 39.7, 30.5, false, 'sehirler/b.webp', '{"yazar": "Tripmate"}');
insert into public.yerler (id, sehir_id, ad, lat, lng, yayin, kapak_url, kapak_atif) values
  ('34500000-0000-4000-8000-000000000011', '34500000-0000-4000-8000-000000000001', 'Yayındaki yer', 39.7, 30.5, true, 'yerler/a.webp',
    '{"yazar": "Ali K.", "lisans": "CC0", "kaynak_url": null}'),
  ('34500000-0000-4000-8000-000000000012', '34500000-0000-4000-8000-000000000001', 'Taslak yer', 39.7, 30.5, false, 'yerler/b.webp',
    '{"yazar": "Tripmate"}');
insert into public.geziler (id, sehir_id, baslik, slug, yayin, kapak_url, kapak_atif) values
  ('34500000-0000-4000-8000-000000000021', '34500000-0000-4000-8000-000000000001', 'Yayındaki gezi', 'atif-gezi-acik', true, 'geziler/a.webp',
    '{"yazar": "Veli D.", "lisans": "CC BY 2.0", "kaynak_url": "https://commons.wikimedia.org/wiki/File:B.jpg"}'),
  ('34500000-0000-4000-8000-000000000022', '34500000-0000-4000-8000-000000000001', 'Taslak gezi', 'atif-gezi-taslak', false, null, null);
-- Biçim dışı atıf reddedilir (tablo sahibi için de).
select pg_temp.hata_bekle($$update public.yerler set kapak_atif = '{"lisans": "CC0"}' where id = '34500000-0000-4000-8000-000000000011'$$, '23514');
select pg_temp.hata_bekle($$update public.yerler set kapak_atif = '{"yazar": "  "}' where id = '34500000-0000-4000-8000-000000000011'$$, '23514');
select pg_temp.hata_bekle($$update public.geziler set kapak_atif = '{"yazar": "X", "foto": "y"}' where id = '34500000-0000-4000-8000-000000000021'$$, '23514');
select pg_temp.hata_bekle($$update public.sehirler set kapak_atif = '{"yazar": "X", "kaynak_url": "http://ornek"}' where slug = 'atif-acik'$$, '23514');
select pg_temp.hata_bekle($$update public.sehirler set kapak_atif = '"Tripmate"' where slug = 'atif-acik'$$, '23514');
set role anon;
do $$
begin
  assert (select kapak_atif ->> 'yazar' from public.sehirler where slug = 'atif-acik') = 'Ayşe Y.', '#345: yayındaki şehrin atfı okunur';
  assert (select kapak_atif ->> 'lisans' from public.yerler where id = '34500000-0000-4000-8000-000000000011') = 'CC0', '#345: yayındaki yerin atfı okunur';
  assert (select kapak_atif ->> 'kaynak_url' from public.geziler where slug = 'atif-gezi-acik') like 'https://commons.%', '#345: yayındaki gezinin atfı okunur';
  assert not exists (select 1 from public.sehirler where slug = 'atif-taslak'), '#345: taslak şehrin atfı görünmez';
  assert not exists (select 1 from public.yerler where id = '34500000-0000-4000-8000-000000000012'), '#345: taslak yerin atfı görünmez';
  assert not exists (select 1 from public.geziler where slug = 'atif-gezi-taslak'), '#345: taslak gezi görünmez';
end $$;
update public.yerler set kapak_atif = '{"yazar": "Saldırgan"}' where id = '34500000-0000-4000-8000-000000000011';
reset role;
set role authenticated;
select pg_temp.as_user('26200000-0000-4000-8000-000000000001');
update public.geziler set kapak_atif = '{"yazar": "Saldırgan"}' where slug = 'atif-gezi-acik';
update public.sehirler set kapak_atif = null where slug = 'atif-acik';
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
update public.yerler set kapak_url = 'yerler/c.webp', kapak_atif = '{"yazar": "Tripmate"}' where id = '34500000-0000-4000-8000-000000000012';
update public.geziler set kapak_atif = null where slug = 'atif-gezi-taslak';
reset role;
do $$
begin
  assert (select kapak_atif ->> 'yazar' from public.yerler where id = '34500000-0000-4000-8000-000000000011') = 'Ali K.', '#345: anon atıf yazamaz';
  assert (select kapak_atif ->> 'yazar' from public.geziler where slug = 'atif-gezi-acik') = 'Veli D.', '#345: sıradan hesap atıf yazamaz';
  assert (select kapak_atif is not null from public.sehirler where slug = 'atif-acik'), '#345: sıradan hesap atfı silemez';
  assert (select kapak_url = 'yerler/c.webp' and kapak_atif = '{"yazar": "Tripmate"}' from public.yerler where id = '34500000-0000-4000-8000-000000000012'),
    '#345: admin kapağı değiştirir, atıf Tripmate olur';
end $$;
-- #345 KK2: içerik hattı Commons kapağını yazar. Boş kapak yazılır; dolu kapak yalnız taslak satırda ve Commons'tan
-- geldiyse değişir (Ece'nin kapağı ve yayındaki kapak ezilmez); yer gezinin şehrinden; uygulama rolleri çağıramaz.
insert into public.yerler (id, sehir_id, ad, lat, lng, yayin, place_id, kapak_url, kapak_atif) values
  ('34500000-0000-4000-8000-000000000013', '34500000-0000-4000-8000-000000000001', 'Kapaksız taslak', 39.7, 30.5, false, 'ChIJ_345_bos', null, null),
  ('34500000-0000-4000-8000-000000000014', '34500000-0000-4000-8000-000000000002', 'Başka şehir', 39.7, 30.5, false, 'ChIJ_345_bos', null, null),
  ('34500000-0000-4000-8000-000000000015', '34500000-0000-4000-8000-000000000001', 'Commons taslak', 39.7, 30.5, false, 'ChIJ_345_commons', 'https://eski',
    '{"yazar": "Eski", "lisans": "CC0", "kaynak_url": "https://commons.wikimedia.org/wiki/File:Eski.jpg"}');
update public.yerler set place_id = 'ChIJ_345_tripmate' where id = '34500000-0000-4000-8000-000000000012';
update public.yerler set place_id = 'ChIJ_345_yayinda' where id = '34500000-0000-4000-8000-000000000011';
do $$
declare
  a constant jsonb := '{"yazar": "Commons Yazarı", "lisans": "CC BY-SA 4.0", "kaynak_url": "https://commons.wikimedia.org/wiki/File:Yeni.jpg"}';
  r jsonb;
begin
  r := public.icerik_kapak_yaz(jsonb_build_object(
    'sehir_slug', 'atif-acik', 'gezi_slug', 'atif-gezi-taslak',
    'gezi', jsonb_build_object('kapak_url', 'https://yeni/g', 'kapak_atif', a),
    'sehir', jsonb_build_object('kapak_url', 'https://yeni/s', 'kapak_atif', a),
    'yerler', jsonb_build_array(
      jsonb_build_object('place_id', 'ChIJ_345_bos', 'kapak_url', 'https://yeni/1', 'kapak_atif', a),
      jsonb_build_object('place_id', 'ChIJ_345_commons', 'kapak_url', 'https://yeni/2', 'kapak_atif', a),
      jsonb_build_object('place_id', 'ChIJ_345_tripmate', 'kapak_url', 'https://yeni/3', 'kapak_atif', a),
      jsonb_build_object('place_id', 'ChIJ_345_yayinda', 'kapak_url', 'https://yeni/4', 'kapak_atif', a))));
  assert (r ->> 'yazilan')::int = 3, '#345 KK2: gezi + 2 yer yazılır, sonuç ' || r::text;
  assert jsonb_array_length(r -> 'atlanan') = 3, '#345 KK2: yayındaki şehir, Tripmate ve yayındaki yer atlanır';
  assert (select kapak_url = 'https://yeni/g' and kapak_atif = a from public.geziler where slug = 'atif-gezi-taslak'), '#345 KK2: boş gezi kapağı yazılır';
  assert (select kapak_url = 'sehirler/a.webp' from public.sehirler where slug = 'atif-acik'), '#345 KK2: yayındaki şehrin kapağı ezilmez';
  assert (select kapak_url = 'https://yeni/1' from public.yerler where id = '34500000-0000-4000-8000-000000000013'), '#345 KK2: boş yer kapağı yazılır';
  assert (select kapak_url is null from public.yerler where id = '34500000-0000-4000-8000-000000000014'), '#345 KK2: başka şehirdeki aynı place_id yazılmaz';
  assert (select kapak_url = 'https://yeni/2' from public.yerler where id = '34500000-0000-4000-8000-000000000015'), '#345 KK2: taslaktaki Commons kapağı yenilenir';
  assert (select kapak_url = 'yerler/c.webp' from public.yerler where id = '34500000-0000-4000-8000-000000000012'), '#345 KK2: Ece''nin (Tripmate) kapağı ezilmez';
  assert (select kapak_url = 'yerler/a.webp' from public.yerler where id = '34500000-0000-4000-8000-000000000011'), '#345 KK2: yayındaki yerin kapağı ezilmez';
end $$;
select pg_temp.hata_bekle($$select public.icerik_kapak_yaz('{"sehir_slug": "yok-boyle"}')$$, '22023');
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
select pg_temp.hata_bekle($$select public.icerik_kapak_yaz('{"sehir_slug": "atif-acik"}')$$, '42501');
reset role;
set role anon;
select pg_temp.hata_bekle($$select public.icerik_kapak_yaz('{"sehir_slug": "atif-acik"}')$$, '42501');
reset role;
delete from public.sehirler where id::text like '34500000-%';

delete from public.trips where id::text like '26200000-%';
delete from public.changes where trip_id::text like '26200000-%';
delete from auth.users where id = '26200000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------- #314: gezi yayınlanınca durak yerleri de yayına girer
-- Y1, Y2 durakta ve taslak; Y3 durakta ama elle yayından kaldırılmış; Y4 durakta değil (taslak kalır).
-- Y5: Y1'le aynı place_id ama başka (yayındaki) şehirde; gezi açılınca taslak kalmalı.
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values
  ('31400000-0000-4000-8000-000000000020', 'Öteki Şehir', 'oteki-sehir-314', 40, 30, true);
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
insert into public.yerler (id, sehir_id, place_id, ad, lat, lng, yayin) values
  ('31400000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000001', 'ChIJ_314_yer_bir', 'Y1', 39.7, 30.5, false),
  ('31400000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-000000000001', 'ChIJ_314_yer_iki', 'Y2', 39.7, 30.5, false),
  ('31400000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-000000000001', 'ChIJ_314_yer_uc', 'Y3', 39.7, 30.5, true),
  ('31400000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-000000000001', 'ChIJ_314_yer_dort', 'Y4', 39.7, 30.5, false),
  ('31400000-0000-4000-8000-000000000005', '31400000-0000-4000-8000-000000000020', 'ChIJ_314_yer_bir', 'Y5', 40, 30, false);
update public.yerler set yayin = false where id = '31400000-0000-4000-8000-000000000003';
insert into public.geziler (id, sehir_id, baslik, slug) values
  ('31400000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-000000000001', 'Gezi 314', 'gezi-314');
insert into public.gezi_gunleri (id, gezi_id, sira) values ('31400000-0000-4000-8000-000000000011', '31400000-0000-4000-8000-000000000010', 1);
insert into public.gezi_duraklari (gezi_gun_id, sira, place_id, ad, lat, lng) values
  ('31400000-0000-4000-8000-000000000011', 1, 'ChIJ_314_yer_bir', 'Y1', 39.7, 30.5),
  ('31400000-0000-4000-8000-000000000011', 2, 'ChIJ_314_yer_iki', 'Y2', 39.7, 30.5),
  ('31400000-0000-4000-8000-000000000011', 3, 'ChIJ_314_yer_bir', 'Y1 tekrar', 39.7, 30.5),
  ('31400000-0000-4000-8000-000000000011', 4, 'ChIJ_314_yer_uc', 'Y3', 39.7, 30.5),
  ('31400000-0000-4000-8000-000000000011', 5, null, 'Yersiz durak', 39.7, 30.5);
do $$
begin
  assert (select yayindan_kaldirildi from public.yerler where id = '31400000-0000-4000-8000-000000000003'), '#314 KK2: yayından alınan yer işaretlenir';
  assert not (select yayindan_kaldirildi from public.yerler where id = '31400000-0000-4000-8000-000000000001'), '#314 KK2: taslak doğan yer işaretsiz';
  assert public.gezi_yayina_girecek_yer_sayisi('31400000-0000-4000-8000-000000000010') = 2, '#314 KK3: sayaç Y1 ve Y2 (tekrar sayılmaz, kaldırılan ve yersiz durak yok)';
end $$;
-- Yayından önce: sıradan hesap taslak yerleri görmez, sayaç 0 döner.
select pg_temp.as_email(:B, 'b@ornek.com');
do $$
begin
  assert (select count(*) from public.yerler where id::text like '31400000-%') = 0, '#314 KK5: yayın öncesi taslak yer görünmez';
  assert public.gezi_yayina_girecek_yer_sayisi('31400000-0000-4000-8000-000000000010') = 0, '#314: admin olmayan sayaçta taslak göremez';
end $$;
-- Admin olmayan geziyi yayınlayamaz (RLS), yerler değişmez.
update public.geziler set yayin = true where id = '31400000-0000-4000-8000-000000000010';
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert (select count(*) from public.yerler where id::text like '31400000-%' and yayin) = 0, '#314: admin olmayan yayınlayamaz'; end $$;
update public.geziler set yayin = true where id = '31400000-0000-4000-8000-000000000010';
select pg_temp.as_email(:B, 'b@ornek.com');
do $$
begin
  assert (select count(*) from public.yerler where id in ('31400000-0000-4000-8000-000000000001', '31400000-0000-4000-8000-000000000002')) = 2,
    '#314 KK1/KK5: gezi yayınlanınca durak yerleri görünür';
  assert (select count(*) from public.yerler where id = '31400000-0000-4000-8000-000000000003') = 0, '#314 KK2/KK5: elle kaldırılan yer gizli kalır';
  assert (select count(*) from public.yerler where id = '31400000-0000-4000-8000-000000000004') = 0, '#314: durakta olmayan taslak yer gizli kalır';
  assert (select count(*) from public.yerler where id = '31400000-0000-4000-8000-000000000005') = 0, '#314: başka şehirdeki aynı place_id gizli kalır';
end $$;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert not (select yayin from public.yerler where id = '31400000-0000-4000-8000-000000000005'), '#314: başka şehirdeki aynı place_id taslak kalır'; end $$;
-- KK4: gezi yayından kalkınca yerler yayında kalır; yeniden yayında elle kaldırılan yine açılmaz.
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
update public.geziler set yayin = false where id = '31400000-0000-4000-8000-000000000010';
do $$ begin assert (select count(*) from public.yerler where id::text like '31400000-%' and yayin) = 2, '#314 KK4: gezi kalkınca yerler yayında kalır'; end $$;
update public.yerler set yayin = false where id = '31400000-0000-4000-8000-000000000002';
update public.geziler set yayin = true where id = '31400000-0000-4000-8000-000000000010';
do $$
begin
  assert not (select yayin from public.yerler where id = '31400000-0000-4000-8000-000000000002'), '#314 KK2: sonradan elle kaldırılan da geri alınmaz';
  assert not (select yayin from public.yerler where id = '31400000-0000-4000-8000-000000000003'), '#314 KK2: kaldırılan yer ikinci yayında da kapalı';
end $$;
-- Elle yeniden yayına alınan yerin işareti kalkar.
update public.yerler set yayin = true where id = '31400000-0000-4000-8000-000000000003';
do $$ begin assert not (select yayindan_kaldirildi from public.yerler where id = '31400000-0000-4000-8000-000000000003'), '#314 KK2: yeniden yayında işaret kalkar'; end $$;
reset role;
set role anon;
select pg_temp.hata_bekle($$select public.gezi_yayini_yerleri_ac()$$, '42501');
reset role;
delete from public.geziler where id = '31400000-0000-4000-8000-000000000010';
delete from public.yerler where id::text like '31400000-%';
delete from public.sehirler where id = '31400000-0000-4000-8000-000000000020';

-- ---------------------------------------------------------------- #401 KK2–KK4: il önerileri
-- Yayındaki listenin görünür satırlarını herkes okur; taslak liste ve gizli satır yalnız admin'e görünür; yalnız admin yazar.
-- Yükleme yalnız içerik hattının (postgres); yayındaki listeye yazmaz. Sıralama tek çağrıda 1..n olur.
select public.icerik_il_taslak_yukle('{"il": "Deneme", "slug": "il-deneme", "oneriler": [
  {"sira": 1, "ad": "Göl", "kategori": "doga", "amaclar": ["doga"], "ilce": "Merkez", "merkeze_km": 9, "neden": "Kısa yürüyüş", "osm": "node/1", "lat": 40.6, "lng": 31.6},
  {"sira": 2, "ad": "Çarşı", "kategori": "carsi", "amaclar": [], "neden": "Esnaf sokakları", "place_id": "ChIJ_401_b"},
  {"sira": 3, "ad": "Müze", "kategori": "muze", "amaclar": ["kultur_tarih"], "neden": "Yağmurlu gün"}]}'::jsonb);
do $$
begin
  assert (select degistiren = 'rehber' and not yayinda from public.il_listeleri where il_slug = 'il-deneme'), '#401 KK3: yükleme taslak, Rehber yazdı';
  assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme') = 3, '#401 KK3: 3 yer yüklendi';
end $$;
-- Biçim dışı satır reddedilir: bilinmeyen kategori, 90 karakteri aşan neden, geçersiz amaç, yinelenen sıra.
select pg_temp.hata_bekle($$insert into public.il_oneriler (il_slug, sira, ad, kategori) values ('il-deneme', 9, 'X', 'gece')$$, '23514');
select pg_temp.hata_bekle($$insert into public.il_oneriler (il_slug, sira, ad, kategori, neden) values ('il-deneme', 9, 'X', 'doga', repeat('a', 91))$$, '23514');
select pg_temp.hata_bekle($$insert into public.il_oneriler (il_slug, sira, ad, kategori, amaclar) values ('il-deneme', 9, 'X', 'doga', '{deniz}')$$, '23514');
select pg_temp.hata_bekle($$insert into public.il_oneriler (il_slug, sira, ad, kategori) values ('il-deneme', 1, 'X', 'doga')$$, '23505');
-- Taslak liste: anon ve sıradan hesap görmez, yazamaz.
set role anon;
do $$
begin
  assert not exists (select 1 from public.il_listeleri where il_slug = 'il-deneme'), '#401 KK2: taslak liste anon''a görünmez';
  assert not exists (select 1 from public.il_oneriler where il_slug = 'il-deneme'), '#401 KK2: taslak satır anon''a görünmez';
end $$;
select pg_temp.hata_bekle($$select public.il_oneri_sirala('il-deneme', '{}')$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_il_taslak_yukle('{}'::jsonb)$$, '42501');
reset role;
set role authenticated;
select pg_temp.as_user(:A);
update public.il_listeleri set yayinda = true where il_slug = 'il-deneme';
reset role;
do $$ begin assert (select not yayinda from public.il_listeleri where il_slug = 'il-deneme'), '#401 KK2: sıradan hesap listeyi yayınlayamaz, yayinda hâlâ false'; end $$;
set role authenticated;
select pg_temp.as_user(:A);
update public.il_oneriler set ad = 'Saldırgan' where il_slug = 'il-deneme';
delete from public.il_oneriler where il_slug = 'il-deneme';
delete from public.il_listeleri where il_slug = 'il-deneme';
reset role;
do $$
begin
  assert exists (select 1 from public.il_listeleri where il_slug = 'il-deneme'), '#401 KK2: sıradan hesap listeyi silemez';
  assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme') = 3, '#401 KK2: sıradan hesap satır silemez';
end $$;
set role authenticated;
select pg_temp.as_user(:A);
select pg_temp.hata_bekle($$insert into public.il_oneriler (il_slug, sira, ad, kategori) values ('il-deneme', 4, 'X', 'doga')$$, '42501');
select pg_temp.hata_bekle($$select public.il_oneri_sirala('il-deneme', '{}')$$, '42501');
select pg_temp.hata_bekle($$select public.icerik_il_taslak_yukle('{}'::jsonb)$$, '42501');
do $$ begin assert not exists (select 1 from public.il_oneriler where il_slug = 'il-deneme'), '#401 KK2: taslak satır sıradan hesaba görünmez'; end $$;
-- Admin: okur, gizler, ekler, sıralar, yayınlar; her değişiklik "son değişiklik"i BO'ya çevirir.
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme' and ad <> 'Saldırgan') = 3, '#401 KK2: sıradan hesap yazamadı, admin taslağı okur'; end $$;
update public.il_oneriler set gorunur = false where il_slug = 'il-deneme' and sira = 3;
insert into public.il_oneriler (il_slug, sira, ad, kategori, place_id, primary_type) values ('il-deneme', 4, 'Yeni yer', 'manzara', 'ChIJ_401_d', 'park');
select public.il_oneri_sirala('il-deneme', array(select id from public.il_oneriler where il_slug = 'il-deneme' order by sira desc));
select pg_temp.hata_bekle($$select public.il_oneri_sirala('il-deneme', array(select id from public.il_oneriler where il_slug = 'il-deneme' and sira > 1))$$, '22023');
update public.il_listeleri set yayinda = true, yayinlandi_at = now() where il_slug = 'il-deneme';
do $$
begin
  assert (select sira from public.il_oneriler where ad = 'Yeni yer' and il_slug = 'il-deneme') = 1, '#401 KK4: sürüklenen sıra 1..n yazıldı';
  assert (select array_agg(sira order by sira) from public.il_oneriler where il_slug = 'il-deneme') = '{1,2,3,4}', '#401 KK4: sıra ardışık';
  assert (select degistiren = 'yonetim' from public.il_listeleri where il_slug = 'il-deneme'), '#401 KK4: son değişiklik BO';
  assert (select yayinda from public.il_listeleri where il_slug = 'il-deneme'), '#401 KK4: admin yayınladı';
  assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme') = 4, '#401 KK4: admin yayındaki listenin bütün satırlarını okur';
  assert exists (select 1 from public.il_oneriler where il_slug = 'il-deneme' and not gorunur), '#401 KK4: admin yayındaki listede gizli satırı okur';
end $$;
reset role;
-- Yayındaki liste sıradan hesaba görünür: yazma politikası burada ölçülür (taslakta satır zaten görünmez).
set role authenticated;
select pg_temp.as_user(:A);
do $$ begin assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme') = 3, '#401 KK2: sıradan hesap yayındaki görünür satırları görür'; end $$;
update public.il_oneriler set gorunur = false, ad = 'x' where il_slug = 'il-deneme';
delete from public.il_oneriler where il_slug = 'il-deneme';
update public.il_listeleri set yayinda = false where il_slug = 'il-deneme';
delete from public.il_listeleri where il_slug = 'il-deneme';
reset role;
do $$
begin
  assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme') = 4, '#401 KK2: sıradan hesap yayındaki satırı silemez';
  assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme' and gorunur) = 3, '#401 KK2: sıradan hesap yayındaki satırı gizleyemez';
  assert not exists (select 1 from public.il_oneriler where il_slug = 'il-deneme' and ad = 'x'), '#401 KK2: sıradan hesap yayındaki satırın adını değiştiremez';
  assert (select yayinda from public.il_listeleri where il_slug = 'il-deneme'), '#401 KK2: sıradan hesap yayındaki listeyi geri çekemez';
end $$;
-- Yayında: herkes görünür satırları okur, gizli satır görünmez; yükleme yayındaki listeye yazmaz.
set role anon;
do $$
begin
  assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme') = 3, '#401 KK2: yayındaki listenin görünür satırları okunur';
  assert not exists (select 1 from public.il_oneriler where il_slug = 'il-deneme' and ad = 'Müze'), '#401 KK4: gizli yer görünmez';
end $$;
reset role;
select pg_temp.hata_bekle($$select public.icerik_il_taslak_yukle('{"il": "Deneme", "slug": "il-deneme", "oneriler": []}'::jsonb)$$, '55000');
do $$ begin assert (select count(*) from public.il_oneriler where il_slug = 'il-deneme') = 4, '#401 KK3: yayındaki listeye dokunulmaz'; end $$;
delete from public.il_listeleri where il_slug = 'il-deneme';

-- #432 1/3: gezi paylaşımı (KK3 link + RLS, KK5 girişsiz özet, KK6 kaynak_paylasim, KK8 ölçüm).
\set PA '''43200000-0000-4000-8000-0000000000a1'''
\set PB '''43200000-0000-4000-8000-0000000000b2'''
\set PX '''43200000-0000-4000-8000-0000000000e4'''
\set PM '''43200000-0000-4000-8000-0000000000f5'''
reset role;
insert into auth.users (id, is_anonymous) values (:PA, false), (:PB, false), (:PX, false), (:PM, true);
insert into public.profiles (id, name, username) values (:PA, 'Ece', 'ece432');
insert into public.trips (id, owner_id, name, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date) values
  ('43200000-0000-4000-8000-000000000001', :PA, 'Paylaşılan Roma', 'ChIJ-roma-432', 'Roma', 'IT', 41.9, 12.49, 'Europe/Rome', '2026-10-12', '2026-10-13');
insert into public.members (trip_id, user_id, display_name) values ('43200000-0000-4000-8000-000000000001', :PB, 'Berk');
update public.days set start_time = '10:00' where trip_id = '43200000-0000-4000-8000-000000000001' and index = 2;
insert into public.places (id, trip_id, place_id, primary_type, lat, lng, note, added_by) values
  ('43200000-0000-4000-8000-000000000011', '43200000-0000-4000-8000-000000000001', 'ChIJ-kolezyum-432', 'tourist_attraction', 41.89, 12.49, 'gizli not', :PA),
  ('43200000-0000-4000-8000-000000000012', '43200000-0000-4000-8000-000000000001', 'ChIJ-muze-432', 'museum', 41.90, 12.45, null, :PA),
  ('43200000-0000-4000-8000-000000000013', '43200000-0000-4000-8000-000000000001', 'ChIJ-havuz-432', 'park', 41.91, 12.48, null, :PA);
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes)
select '43200000-0000-4000-8000-000000000001', d.id, x.p::uuid, x.k, 60
from (values ('43200000-0000-4000-8000-000000000011', 1, 'b'), ('43200000-0000-4000-8000-000000000012', 1, 'a'), ('43200000-0000-4000-8000-000000000013', 2, 'a')) x(p, g, k)
join public.days d on d.trip_id = '43200000-0000-4000-8000-000000000001' and d.index = x.g;
insert into public.sehirler (id, ad, slug, lat, lng, yayin) values ('43200000-0000-4000-8000-000000000020', 'Roma 432', 'roma-432', 41.9, 12.49, true);
insert into public.yerler (sehir_id, place_id, ad, lat, lng, yayin) values
  ('43200000-0000-4000-8000-000000000020', 'ChIJ-kolezyum-432', 'Kolezyum', 41.89, 12.49, true),
  ('43200000-0000-4000-8000-000000000020', 'ChIJ-havuz-432', 'Yayında olmayan ad', 41.91, 12.48, false);

set role authenticated;
-- KK3: dışarıdan biri (X) başkasının seyahati için link oluşturamaz; kendi adına olmayan link de yok.
select pg_temp.as_user(:PX);
select pg_temp.hata_bekle($$insert into public.gezi_paylasim (trip_id) values ('43200000-0000-4000-8000-000000000001')$$, '42501');
-- A link oluşturur; token 24 karakter base64url, kişi adları varsayılan kapalı.
select pg_temp.as_user(:PA);
insert into public.gezi_paylasim (trip_id) values ('43200000-0000-4000-8000-000000000001');
do $$
declare g public.gezi_paylasim;
begin
  select * into g from public.gezi_paylasim where trip_id = '43200000-0000-4000-8000-000000000001';
  assert g.token ~ '^[A-Za-z0-9_-]{24}$', '#432 KK3: token 24 karakter base64url: ' || g.token;
  assert not g.kisi_adlari_acik, '#432 KK2: kişi adları varsayılan kapalı';
  assert g.acik and g.olusturan = auth.uid(), '#432 KK3: açık, oluşturan A';
end $$;
-- Aynı kişi aynı seyahatte ikinci açık link açamaz (tek link).
select pg_temp.hata_bekle($$insert into public.gezi_paylasim (trip_id) values ('43200000-0000-4000-8000-000000000001')$$, '23505');
-- #517 KK1/KK5: link oluşunca seyahatin diğer üyesi (B) `changes`'ta satırı görür; başka seyahatin üyesi (X) görmez; token yok.
select pg_temp.as_user(:PB);
do $$
declare c public.changes;
begin
  select * into c from public.changes where trip_id = '43200000-0000-4000-8000-000000000001' and entity = 'gezi_paylasim';
  assert c.id is not null, '#517 KK1: B paylaşım kaydını görür';
  assert c.field = 'acik' and c.old is null and c.new = 'true'::jsonb, '#517 KK1: kayıtta yalnız acik: ' || row_to_json(c)::text;
  assert c.user_id = '43200000-0000-4000-8000-0000000000a1', '#517 KK1: kaydı A yazdı';
end $$;
select pg_temp.hata_bekle($$select public.degisikligi_geri_al((select id from public.changes where entity = 'gezi_paylasim' limit 1))$$, '22023');
-- #530 inceleme 2: B'nin kendi linki yok ama seyahatte link açıldığını bilir (Sıradaki adım "Gezini paylaş" düşer).
do $$ begin assert public.paylasim_yapildi('43200000-0000-4000-8000-000000000001'), '#530-2: üye, başkasının linkini bilir'; end $$;
select pg_temp.as_user(:PX);
do $$ begin assert not exists (select 1 from public.changes where entity = 'gezi_paylasim'), '#517 KK5: başka seyahatin üyesi kaydı görmez'; end $$;
do $$ begin assert not public.paylasim_yapildi('43200000-0000-4000-8000-000000000001'), '#530-2: üye olmayan öğrenemez'; end $$;
select pg_temp.as_user(:PA);
-- Token, oluşturan ve sayaçlar istemciden yazılamaz.
select pg_temp.hata_bekle($$insert into public.gezi_paylasim (trip_id, token) values ('43200000-0000-4000-8000-000000000001', 'aaaaaaaaaaaaaaaaaaaaaaaa')$$, '42501');
select pg_temp.hata_bekle($$update public.gezi_paylasim set token = 'aaaaaaaaaaaaaaaaaaaaaaaa'$$, '42501');
select pg_temp.hata_bekle($$update public.gezi_paylasim set acilma_sayisi = 999$$, '42501');
select pg_temp.hata_bekle($$delete from public.gezi_paylasim$$, '42501');
-- B (üye) A'nın linkini görmez ve kapatamaz; kendi linkini açabilir.
select pg_temp.as_user(:PB);
do $$ begin assert (select count(*) from public.gezi_paylasim) = 0, '#432 KK3: B, A''nın linkini görmez'; end $$;
update public.gezi_paylasim set acik = false;
reset role;
do $$ begin assert (select bool_and(acik) from public.gezi_paylasim where trip_id = '43200000-0000-4000-8000-000000000001'), '#432 KK3: B, A''nın linkini kapatamaz'; end $$;
-- kaynak_paylasim istemciden yazılamaz.
set role authenticated;
select pg_temp.as_user(:PA);
select pg_temp.hata_bekle($$update public.trips set kaynak_paylasim = (select id from public.gezi_paylasim limit 1) where id = '43200000-0000-4000-8000-000000000001'$$, '42501');
reset role;

-- KK5: girişsiz özet. Notlar, davet token'ı, kişi adları (kapalıyken) dönmez; durak adı yalnız yayındaki içeriğimizden.
reset role;
select set_config('test.paylasim_token', (select token from public.gezi_paylasim where trip_id = '43200000-0000-4000-8000-000000000001'), false);
set role anon;
select pg_temp.as_user(null);
select pg_temp.hata_bekle($$select * from public.gezi_paylasim$$, '42501');
reset role;
set role anon;
do $$
declare
  o jsonb := public.paylasim_ozeti(current_setting('test.paylasim_token'));
  m text := o::text;
begin
  assert not (o ->> 'kapali')::boolean, '#432 KK5: açık link';
  assert o ->> 'ad' = 'Paylaşılan Roma' and (o ->> 'gun_sayisi')::int = 2 and (o ->> 'durak_sayisi')::int = 3, '#432 KK2: ad, gün, durak: ' || m;
  assert (o ->> 'kisi_sayisi')::int = 2, '#432 KK2: N kişi gezdi';
  assert not (o ? 'kisi_adlari'), '#510: kişi adları alanı hiç dönmez';
  -- 2/3b (Ürün kararı, 21 Kasım): yalnız paylaşanın (A, Ece) adı döner, diğer üyenin (B, Berk) adı dönmez.
  assert o ->> 'paylasan' = 'Ece', '#432 2/3b: paylaşanın adı döner: ' || m;
  assert position('Berk' in m) = 0, '#510: diğer üyenin adı dönmez';
  assert (o ->> 'id')::uuid is not null, '#432 2/3b: olay hedefi (paylaşım kimliği) döner';
  assert o #>> '{gunler,0,duraklar,0,dakika}' is not null, '#432 2/3b: durak süresi döner: ' || m;
  assert position('gizli not' in m) = 0, '#432 KK2: not dönmez';
  assert position('invite' in m) = 0, '#432: davet token anahtarı yok';
  assert position('ChIJ' in m) = 0, '#432: place_id dönmez';
  assert o #>> '{gunler,0,duraklar,0,tur}' = 'museum' and o #>> '{gunler,0,duraklar,0,ad}' is null, '#432 KK5: sıra order_key ile; içeriğimizde yoksa ad null: ' || m;
  assert o #>> '{gunler,0,duraklar,1,ad}' = 'Kolezyum', '#432 KK5: yayındaki yer adı';
  assert o #>> '{gunler,1,duraklar,0,ad}' is null, '#432 KK5: yayında olmayan içeriğin adı dönmez';
  assert public.paylasim_ozeti('bilinmeyen-token-xxxxxxxx') is null and public.paylasim_ozeti('kisa') is null, '#432: bilinmeyen token null';
end $$;
reset role;
do $$ begin assert (select acilma_sayisi from public.gezi_paylasim where token = current_setting('test.paylasim_token')) = 1, '#432 KK8: girişsiz açılış sayacı +1'; end $$;
-- #517 KK-ek1: linkte paylaşanın yalnız ilk adı; KK3: kip (başlamış/bitmiş "gezdi", başlamamış ya da tarihsiz "gidiyor").
update public.members set display_name = 'Ece Soyadıgizli' where trip_id = '43200000-0000-4000-8000-000000000001' and user_id = :PA;
set role anon;
do $$
declare o jsonb := public.paylasim_ozeti(current_setting('test.paylasim_token'));
begin
  assert o ->> 'paylasan' = 'Ece' and position('Soyadıgizli' in o::text) = 0, '#517 KK-ek1: yalnız ilk ad: ' || o::text;
  assert o ->> 'kisi_kip' = 'gezdi', '#517 KK3: geçmiş seyahat gezdi';
  assert position('2026-10' in o::text) = 0, '#517 KK3: tarih dönmez';
end $$;
reset role;
-- #530 inceleme 1: sekme, bölünmez boşluk (U+00A0) ve baştaki boşlukta da yalnız ilk ad.
update public.members set display_name = E'Ece\tSoyadıgizli' where trip_id = '43200000-0000-4000-8000-000000000001' and user_id = :PA;
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'paylasan' = 'Ece', '#530-1: sekmede bölünür'; end $$;
reset role;
update public.members set display_name = E'\u00a0Ece\u00a0Soyadıgizli' where trip_id = '43200000-0000-4000-8000-000000000001' and user_id = :PA;
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'paylasan' = 'Ece', '#530-1: bölünmez boşlukta bölünür: ' || (public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'paylasan'); end $$;
reset role;
-- #530 3. inceleme 3: istemcideki JS \s ile aynı küme — dar bölünmez boşluk (U+202F), ince boşluk (U+2009), ideografik (U+3000).
update public.members set display_name = E'Ece\u202fSoyadıgizli' where trip_id = '43200000-0000-4000-8000-000000000001' and user_id = :PA;
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'paylasan' = 'Ece', '#530-3.3: U+202F''de bölünür: ' || (public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'paylasan'); end $$;
reset role;
update public.members set display_name = E'\u3000Ece\u2009Soyadıgizli' where trip_id = '43200000-0000-4000-8000-000000000001' and user_id = :PA;
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'paylasan' = 'Ece', '#530-3.3: U+3000 / U+2009''da bölünür'; end $$;
-- #530 3. inceleme 3: anonim rol paylaşım bilgisini soramaz.
select pg_temp.hata_bekle($$select public.paylasim_yapildi('43200000-0000-4000-8000-000000000001')$$, '42501');
reset role;
update public.trips set start_date = current_date - 1, end_date = current_date + 1 where id = '43200000-0000-4000-8000-000000000001';
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'kisi_kip' = 'geziyor', '#530-3: süren seyahat geziyor'; end $$;
reset role;
update public.trips set start_date = current_date + 10, end_date = current_date + 11 where id = '43200000-0000-4000-8000-000000000001';
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'kisi_kip' = 'gidiyor', '#517 KK3: başlamamış seyahat gidiyor'; end $$;
reset role;
update public.trips set start_date = null, end_date = null where id = '43200000-0000-4000-8000-000000000001';
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'kisi_kip' = 'gidiyor', '#517 KK3: tarihsiz seyahat gidiyor'; end $$;
reset role;
update public.trips set start_date = '2026-10-12', end_date = '2026-10-13' where id = '43200000-0000-4000-8000-000000000001';
update public.members set display_name = 'Ece' where trip_id = '43200000-0000-4000-8000-000000000001' and user_id = :PA;
-- #517 KK-ek2: sayaç token başına günde en çok 500 artar; ertesi gün yeniden sayar.
update public.gezi_paylasim set acilma_gunu = current_date, acilma_gun_sayisi = 499, acilma_sayisi = 10 where token = current_setting('test.paylasim_token');
set role anon;
select public.paylasim_ozeti(current_setting('test.paylasim_token'));
-- #530 inceleme 6: tavandaki (501.) açılış da özeti döndürür; `acilma_gunu` henüz değişmedi.
do $$ begin assert (public.paylasim_ozeti(current_setting('test.paylasim_token')) ->> 'kapali')::boolean is false, '#517 KK-ek2: tavanda da özet döner'; end $$;
reset role;
do $$ begin assert (select acilma_sayisi = 11 and acilma_gun_sayisi = 500 and acilma_gunu = current_date from public.gezi_paylasim where token = current_setting('test.paylasim_token')), '#517 KK-ek2: 500. açılıştan sonra sayaç durur'; end $$;
update public.gezi_paylasim set acilma_gunu = current_date - 1 where token = current_setting('test.paylasim_token');
set role anon;
select public.paylasim_ozeti(current_setting('test.paylasim_token'));
reset role;
do $$ begin assert (select acilma_sayisi = 12 and acilma_gun_sayisi = 1 from public.gezi_paylasim where token = current_setting('test.paylasim_token')), '#517 KK-ek2: ertesi gün yeniden sayar'; end $$;
-- #510: anahtar kalktı. Oluşturan kolonu güncelleyemez; kolon açık olsa bile (eski satır ya da eski uygulamanın insert'ü) adlar dönmez.
set role authenticated;
select pg_temp.as_user(:PA);
select pg_temp.hata_bekle($$update public.gezi_paylasim set kisi_adlari_acik = true$$, '42501');
reset role;
update public.gezi_paylasim set kisi_adlari_acik = true where token = current_setting('test.paylasim_token');
set role anon;
do $$
declare m text := public.paylasim_ozeti(current_setting('test.paylasim_token'))::text;
begin
  assert position('kisi_adlari' in m) = 0 and position('Berk' in m) = 0, '#510: kolon açıkken de kişi adları dönmez: ' || m;
end $$;
reset role;
update public.gezi_paylasim set kisi_adlari_acik = false where token = current_setting('test.paylasim_token');
-- #515 2. inceleme 3: seyahatin harcaması ve paylaşanın IBAN'ı girişsiz özette dönmez.
with h as (
  insert into public.harcamalar (trip_id, aciklama, tutar_kurus, tl_kurus, odeyen_id)
    values ('43200000-0000-4000-8000-000000000001', 'gizli harcama 515', 51515, 51515, :PA) returning id, trip_id
)
insert into public.harcama_paylari (harcama_id, trip_id, user_id, pay_kurus) select id, trip_id, :PA, 51515 from h;
insert into public.odeme_bilgileri (user_id, iban) values (:PA, 'TR515151515151515151515151');
set role anon;
do $$
declare
  o jsonb := public.paylasim_ozeti(current_setting('test.paylasim_token'));
  m text := o::text;
begin
  -- #517 KK-ek3: önce özetin açık döndüğü doğrulanır (kapalı özet boş olduğu için aşağıdakiler kendiliğinden geçerdi).
  assert o ->> 'kapali' = 'false', '#515: özet açık: ' || m;
  -- Tutar uuid'lerde geçebilecek bir rakam dizisiyle değil, alan adlarıyla aranır (uuid'de 't', 'r', 'k' harfi olmaz).
  assert position('gizli harcama' in m) = 0 and position('tutar' in m) = 0 and position('kurus' in m) = 0, '#515: harcama dönmez: ' || m;
  assert position('TR5151' in m) = 0 and position('iban' in lower(m)) = 0, '#515: IBAN dönmez: ' || m;
end $$;
reset role;
-- #515 2. inceleme 2: `ad` yalnız seyahatin kendi adı; adsız seyahatte null (istemci "Roma gezisi" yazar).
update public.trips set name = null where id = '43200000-0000-4000-8000-000000000001';
set role anon;
do $$
declare o jsonb := public.paylasim_ozeti(current_setting('test.paylasim_token'));
begin
  assert o -> 'ad' = 'null'::jsonb and o ->> 'sehir' = 'Roma', '#515: adsız seyahatte ad null, şehir döner: ' || o::text;
end $$;
reset role;
update public.trips set name = 'Paylaşılan Roma' where id = '43200000-0000-4000-8000-000000000001';

-- Harita izni: günde 200 yükleme.
reset role;
update public.gezi_paylasim set harita_gunu = current_date, harita_sayisi = 199 where token = current_setting('test.paylasim_token');
set role anon;
do $$
begin
  assert public.paylasim_harita_izni(current_setting('test.paylasim_token')), '#432: 200. harita yüklemesi izinli';
  assert not public.paylasim_harita_izni(current_setting('test.paylasim_token')), '#432: 201. harita yüklemesi izinsiz';
end $$;
reset role;
update public.gezi_paylasim set harita_gunu = current_date - 1 where token = current_setting('test.paylasim_token');
set role anon;
do $$ begin assert public.paylasim_harita_izni(current_setting('test.paylasim_token')), '#432: ertesi gün sayaç sıfırlanır'; end $$;
-- Girişsiz "Seyahatime al" yok.
select pg_temp.hata_bekle($$select public.paylasimdan_al(current_setting('test.paylasim_token'))$$, '42501');
reset role;

-- KK6: X "Seyahatime al" yapar: tarihsiz yeni seyahat, aynı gün ve duraklar, not yok, kaynak_paylasim dolu, olay yazılır.
set role authenticated;
select pg_temp.as_user(:PX);
select set_config('test.alinan', public.paylasimdan_al(current_setting('test.paylasim_token'))::text, false);
do $$
declare v uuid := current_setting('test.alinan')::uuid;
begin
  assert (select owner_id from public.trips where id = v) = auth.uid(), '#432 KK5: yeni seyahatin sahibi X';
  assert (select kaynak_paylasim from public.trips where id = v) is not null, '#432 KK6: kaynak_paylasim dolu';
  assert (select start_date from public.trips where id = v) is null, '#432: tarihsiz';
  assert (select count(*) from public.days where trip_id = v) = 2, '#432: 2 gün';
  assert (select start_time from public.days where trip_id = v and index = 2) = '10:00', '#432: gün saati taşınır';
  assert (select count(*) from public.stops where trip_id = v) = 3, '#432: 3 durak';
  assert (select count(*) from public.places where trip_id = v and note is not null) = 0, '#432 KK2: not taşınmaz';
  assert (select count(*) from public.members where trip_id = v) = 1, '#432: üyeler taşınmaz';
  assert not public.is_member('43200000-0000-4000-8000-000000000001'), '#432: X kaynak seyahate üye olmaz';
  assert (select count(*) from public.olaylar where tur = 'paylasimdan_alindi' and user_id = auth.uid()) = 1, '#432 KK8: paylasimdan_alindi';
end $$;
insert into public.olaylar (tur) values ('paylasim_acildi');
reset role;
do $$ begin assert (select kaynak_paylasim from public.trips where id = current_setting('test.alinan')::uuid) = (select id from public.gezi_paylasim where token = current_setting('test.paylasim_token')), '#432 KK6: kaynak_paylasim doğru paylaşım'; end $$;

-- PRD §7: 30 günü geçen Google koordinatı girişsiz özette dönmez, Seyahatime al'da kopyalanmaz (place_id ve damga kalır).
reset role;
update public.places set google_fetched_at = now() - interval '31 days' where id = '43200000-0000-4000-8000-000000000011';
-- #515 inceleme 5: 29 günlük koordinat sınırın içinde, döner.
update public.places set google_fetched_at = now() - interval '29 days' where id = '43200000-0000-4000-8000-000000000012';
set role anon;
do $$
declare o jsonb := public.paylasim_ozeti(current_setting('test.paylasim_token'));
begin
  assert o #>> '{gunler,0,duraklar,1,ad}' = 'Kolezyum', 'ön koşul: eski damgalı durak Kolezyum';
  assert o #> '{gunler,0,duraklar,1,lat}' = 'null'::jsonb and o #> '{gunler,0,duraklar,1,lng}' = 'null'::jsonb, '#435: 31 günlük koordinat null: ' || o::text;
  assert (o #>> '{gunler,0,duraklar,0,lat}')::numeric = 41.90 and (o #>> '{gunler,0,duraklar,0,lng}')::numeric = 12.45, '#515: 29 günlük koordinat döner: ' || o::text;
end $$;
reset role;
set role authenticated;
select pg_temp.as_user(:PX);
select set_config('test.alinan2', public.paylasimdan_al(current_setting('test.paylasim_token'))::text, false);
reset role;
do $$
declare
  v uuid := current_setting('test.alinan2')::uuid;
  e public.places;
  t public.places;
begin
  select * into e from public.places where trip_id = v and place_id = 'ChIJ-kolezyum-432';
  select * into t from public.places where trip_id = v and place_id = 'ChIJ-muze-432';
  assert e.lat is null and e.lng is null, '#435: eski koordinat boş kopyalanır';
  assert e.google_fetched_at = (select google_fetched_at from public.places where id = '43200000-0000-4000-8000-000000000011'), '#435: google_fetched_at korunur';
  assert t.lat = 41.90 and t.lng = 12.45, '#435: taze koordinat kopyalanır';
end $$;
delete from public.trips where id = current_setting('test.alinan2')::uuid;

-- #435: 30 günü geçen şehir koordinatı da kopyalanmaz (place_id ve damga kalır).
update public.trips set google_fetched_at = now() - interval '90 days' where id = '43200000-0000-4000-8000-000000000001';
set role authenticated;
select pg_temp.as_user(:PX);
select set_config('test.alinan3', public.paylasimdan_al(current_setting('test.paylasim_token'))::text, false);
reset role;
do $$
declare
  y public.trips;
  k public.trips;
begin
  select * into y from public.trips where id = current_setting('test.alinan3')::uuid;
  select * into k from public.trips where id = '43200000-0000-4000-8000-000000000001';
  assert k.lat is not null, 'ön koşul: kaynakta şehir koordinatı var';
  assert y.lat is null and y.lng is null, '#435: 90 günlük şehir koordinatı null kopyalanır';
  assert y.city_place_id is not distinct from k.city_place_id and y.google_fetched_at = k.google_fetched_at, '#435: şehir place_id ve damga korunur';
end $$;
delete from public.trips where id = current_setting('test.alinan3')::uuid;
update public.trips set google_fetched_at = now() where id = '43200000-0000-4000-8000-000000000001';

-- #435: misafir (anonim) Seyahatime al ile seyahat kuramaz.
set role authenticated;
select pg_temp.as_user(:PM, true);
select pg_temp.hata_bekle($$select public.paylasimdan_al(current_setting('test.paylasim_token'))$$, '42501');
reset role;

-- #435: misafir (anonim) üye link açamaz.
insert into public.members (trip_id, user_id, display_name) values ('43200000-0000-4000-8000-000000000001', :PM, 'Misafir');
set role authenticated;
select pg_temp.as_user(:PM, true);
do $$ begin assert public.is_member('43200000-0000-4000-8000-000000000001') and public.is_anonymous(), 'ön koşul: PM misafir üye'; end $$;
select pg_temp.hata_bekle($$insert into public.gezi_paylasim (trip_id) values ('43200000-0000-4000-8000-000000000001')$$, '42501');
reset role;
delete from public.members where trip_id = '43200000-0000-4000-8000-000000000001' and user_id = :PM;

-- KK3: kapatılan link "kapalı" döner, yeniden açılamaz, Seyahatime al yapılamaz; oluşturan seyahatten çıkınca da kapalı sayılır.
set role authenticated;
select pg_temp.as_user(:PA);
update public.gezi_paylasim set acik = false;
-- #517 KK1/KK5: kapanınca da B satırı görür (eski true, yeni false); X görmez; satırda token yok.
select pg_temp.as_user(:PB);
do $$ begin assert exists (select 1 from public.changes where trip_id = '43200000-0000-4000-8000-000000000001' and entity = 'gezi_paylasim'
  and field = 'acik' and old = 'true'::jsonb and new = 'false'::jsonb and user_id = '43200000-0000-4000-8000-0000000000a1'), '#517 KK1: B kapatma kaydını görür'; end $$;
-- #530 3. inceleme 4: kapatılan link "Gezini paylaş" adımını geri getirmez (hiç paylaşıldı = evet).
do $$ begin assert public.paylasim_yapildi('43200000-0000-4000-8000-000000000001'), '#530-3.4: kapatılsa da paylaşıldı sayılır'; end $$;
select pg_temp.as_user(:PX);
do $$ begin assert not exists (select 1 from public.changes where entity = 'gezi_paylasim'), '#517 KK5: X kapatma kaydını görmez'; end $$;
reset role;
do $$ begin assert not exists (select 1 from public.changes c where c.entity = 'gezi_paylasim'
  and position(current_setting('test.paylasim_token') in row_to_json(c)::text) > 0), '#517 KK1: kayıtta token yok'; end $$;
set role authenticated;
select pg_temp.as_user(:PA);
do $$ begin assert (select kapatildi_at from public.gezi_paylasim where token = current_setting('test.paylasim_token')) is not null, '#432 KK3: kapatma damgası'; end $$;
select pg_temp.hata_bekle($$update public.gezi_paylasim set acik = true$$, '42501');
reset role;
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token')) = '{"kapali": true}'::jsonb, '#432 KK3: kapalı link'; end $$;
do $$ begin assert not public.paylasim_harita_izni(current_setting('test.paylasim_token')), '#432: kapalı linkte harita yok'; end $$;
reset role;
set role authenticated;
select pg_temp.as_user(:PX);
select pg_temp.hata_bekle($$select public.paylasimdan_al(current_setting('test.paylasim_token'))$$, 'P0002');
select pg_temp.as_user(:PB);
insert into public.gezi_paylasim (trip_id) values ('43200000-0000-4000-8000-000000000001');
reset role;
select set_config('test.paylasim_token_b', (select token from public.gezi_paylasim where olusturan = :PB and acik), false);
delete from public.members where trip_id = '43200000-0000-4000-8000-000000000001' and user_id = :PB;
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token_b')) = '{"kapali": true}'::jsonb, '#432: oluşturan çıkınca link kapalı sayılır'; end $$;
reset role;
do $$ begin assert (select not acik and kapatildi_at is not null from public.gezi_paylasim where token = current_setting('test.paylasim_token_b')), '#435: oluşturan çıkınca link kapanır'; end $$;
-- Yeniden üye olsa da eski link canlanmaz.
insert into public.members (trip_id, user_id, display_name) values ('43200000-0000-4000-8000-000000000001', :PB, 'Berk');
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token_b')) = '{"kapali": true}'::jsonb, '#435: yeniden üyelikte eski link kapalı kalır'; end $$;
reset role;
-- #530 3. inceleme 1: sahip olmayan üye (Q) hesabını silince açık linki kapanır ve "kapandı" kaydı düşer.
\set PQ '''43200000-0000-4000-8000-0000000000c3'''
insert into auth.users (id, is_anonymous) values (:PQ, false);
insert into public.members (trip_id, user_id, display_name) values ('43200000-0000-4000-8000-000000000001', :PQ, 'Kerem');
set role authenticated;
select pg_temp.as_user(:PQ);
insert into public.gezi_paylasim (trip_id) values ('43200000-0000-4000-8000-000000000001');
reset role;
select set_config('test.paylasim_token_q', (select token from public.gezi_paylasim where olusturan = :PQ and acik), false);
delete from auth.users where id = :PQ;
do $$
declare g public.gezi_paylasim;
begin
  select * into g from public.gezi_paylasim where token = current_setting('test.paylasim_token_q');
  assert g.olusturan is null and not g.acik and g.kapatildi_at is not null, '#530-3.1: hesap silinince link kapanır: ' || row_to_json(g)::text;
  assert exists (select 1 from public.changes where entity = 'gezi_paylasim' and entity_id = g.id::text
    and old = 'true'::jsonb and new = 'false'::jsonb and user_id is null), '#530-3.1: kapandı kaydı düşer';
end $$;
set role anon;
do $$ begin assert public.paylasim_ozeti(current_setting('test.paylasim_token_q')) = '{"kapali": true}'::jsonb, '#530-3.1: silinen hesabın linki kapalı'; end $$;
reset role;

-- #530 inceleme 6: açık linki olan seyahat silinir; hata yok, `changes`'ta paylaşım satırı kalmaz (cascade bekçisi).
set role authenticated;
select pg_temp.as_user(:PB);
insert into public.gezi_paylasim (trip_id) values ('43200000-0000-4000-8000-000000000001');
reset role;
do $$ begin assert exists (select 1 from public.gezi_paylasim where trip_id = '43200000-0000-4000-8000-000000000001' and acik), 'ön koşul: açık link var'; end $$;
delete from public.trips where id = current_setting('test.alinan')::uuid or id = '43200000-0000-4000-8000-000000000001';
do $$ begin assert not exists (select 1 from public.changes where entity = 'gezi_paylasim' and trip_id = '43200000-0000-4000-8000-000000000001'), '#530-6: silinen seyahatte paylaşım kaydı kalmaz'; end $$;
delete from public.olaylar where tur in ('paylasimdan_alindi', 'paylasim_acildi');
delete from public.sehirler where id = '43200000-0000-4000-8000-000000000020';
delete from auth.users where id in (:PA, :PB, :PX, :PM);
do $$ begin assert (select count(*) from public.gezi_paylasim) = 0, '#432: seyahat silinince linkler de silinir'; end $$;

-- #407 Arkadaşlar sekmesi: kişiler (birlikte gezdiklerin), açık paylaşımların akışı, ♥ (KK1, KK2, KK3, KK3b) + #533 incelemesi.
-- A: Bursa (A, B, D, misafir G) ve tek başına Antalya, Eskişehir. C: İzmir. B, Bursa'nın üyesi: Bursa linki B'nin akışına girmez
-- (kendi seyahati), Antalya linki girer. Eskişehir linki bu sürümden önce açılmış sayılır (akista = false), akışa girmez.
\set FA '''40700000-0000-4000-8000-0000000000a1'''
\set FB '''40700000-0000-4000-8000-0000000000b2'''
\set FC '''40700000-0000-4000-8000-0000000000c3'''
\set FD '''40700000-0000-4000-8000-0000000000d4'''
\set FG '''40700000-0000-4000-8000-0000000000e5'''
reset role;
insert into auth.users (id, is_anonymous) values (:FA, false), (:FB, false), (:FC, false), (:FD, false), (:FG, true);
insert into public.profiles (id, name, username, photo_url) values
  (:FA, 'Ayşe Yılmaz', 'ayse407', 'https://lh3.googleusercontent.com/a/ayse407'), (:FC, 'Can', 'can407', null);
insert into public.trips (id, owner_id, name, city_place_id, city_label, country_code, lat, lng, tz) values
  ('40700000-0000-4000-8000-000000000001', :FA, null, 'ChIJ-bursa-407', 'Bursa', 'TR', 40.18, 29.06, 'Europe/Istanbul'),
  ('40700000-0000-4000-8000-000000000002', :FC, null, 'ChIJ-izmir-407', 'İzmir', 'TR', 38.42, 27.14, 'Europe/Istanbul'),
  ('40700000-0000-4000-8000-000000000003', :FA, null, 'ChIJ-antalya-407', 'Antalya', 'TR', 36.88, 30.70, 'Europe/Istanbul'),
  ('40700000-0000-4000-8000-000000000004', :FA, null, 'ChIJ-eskisehir-407', 'Eskişehir', 'TR', 39.77, 30.52, 'Europe/Istanbul');
update public.members set display_name = 'Ayşe' || chr(160) || 'Yılmaz' where user_id = :FA;
insert into public.members (trip_id, user_id, display_name, guest) values
  ('40700000-0000-4000-8000-000000000001', :FB, 'Berk', false), ('40700000-0000-4000-8000-000000000001', :FD, 'Deniz Kaya', false),
  ('40700000-0000-4000-8000-000000000001', :FG, 'Misafir', true);
set role authenticated;
select pg_temp.as_user(:FA);
insert into public.gezi_paylasim (trip_id) values
  ('40700000-0000-4000-8000-000000000001'), ('40700000-0000-4000-8000-000000000003'), ('40700000-0000-4000-8000-000000000004');
select pg_temp.as_user(:FC);
insert into public.gezi_paylasim (trip_id) values ('40700000-0000-4000-8000-000000000002');
reset role;
-- İnceleme 2: bu sürümden önce açılmış link (migration var olan satırları false yapar; yenilerin varsayılanı true).
update public.gezi_paylasim set akista = false where trip_id = '40700000-0000-4000-8000-000000000004';
do $$ begin assert (select bool_and(akista) from public.gezi_paylasim where trip_id <> '40700000-0000-4000-8000-000000000004'), '#533: yeni link akışa açık'; end $$;
select set_config('test.l1', (select id::text from public.gezi_paylasim where trip_id = '40700000-0000-4000-8000-000000000001'), false);
select set_config('test.l2', (select id::text from public.gezi_paylasim where trip_id = '40700000-0000-4000-8000-000000000002'), false);
select set_config('test.l3', (select id::text from public.gezi_paylasim where trip_id = '40700000-0000-4000-8000-000000000003'), false);
select set_config('test.l4', (select id::text from public.gezi_paylasim where trip_id = '40700000-0000-4000-8000-000000000004'), false);
select set_config('test.l3_token', (select token from public.gezi_paylasim where trip_id = '40700000-0000-4000-8000-000000000003'), false);
set role authenticated;
-- KK1/KK2/KK3: B, A ile birlikte gezdi: kişilerde A ve D var (yalnız ilk ad), C ve kendisi yok; akışta yalnız A'nın Antalya
-- linki (Bursa B'nin kendi seyahati, Eskişehir eski link); token, soyadı ve ♥ sayısı yok.
select pg_temp.as_user(:FB);
do $$
declare r record; m text;
begin
  assert (select array_agg(user_id order by user_id) from public.arkadaslarim()) = array['40700000-0000-4000-8000-0000000000a1', '40700000-0000-4000-8000-0000000000d4', '40700000-0000-4000-8000-0000000000e5']::uuid[], '#407 KK1: birlikte gezdiklerin';
  assert (select ad from public.arkadaslarim() where user_id = '40700000-0000-4000-8000-0000000000a1') = 'Ayşe', '#533 8a: kişi satırında ilk ad (U+00A0)';
  assert (select ad from public.arkadaslarim() where user_id = '40700000-0000-4000-8000-0000000000d4') = 'Deniz', '#533 8a: kişi satırında ilk ad';
  assert (select count(*) from public.arkadas_paylasimlari()) = 1, '#407 KK2 + #533 1, 2: yalnız birlikte gezilen kişinin, kendi seyahatin olmayan, yeni linki';
  select * into r from public.arkadas_paylasimlari();
  m := row_to_json(r)::text;
  assert r.id = current_setting('test.l3')::uuid and r.paylasan_ad = 'Ayşe' and r.sehir = 'Antalya', '#407 KK2: kart: ' || m;
  assert r.foto = 'https://lh3.googleusercontent.com/a/ayse407', '#533: kartta kişinin fotoğrafı: ' || m;
  assert r.gun_sayisi = 1 and r.kisi_sayisi = 1 and r.kisi_kip = 'gidiyor' and not r.begendim, '#407 KK2: özet: ' || m;
  assert position(current_setting('test.l3_token') in m) = 0 and position('Yılmaz' in m) = 0, '#407 KK3: token ve soyadı akışta yok';
  assert position('begeni_sayisi' in m) = 0, '#533 soru 1: ♥ sayısı istemciye dönmez';
  assert (select count(*) from public.gezi_paylasim) = 0, '#407 KK3: gezi_paylasim select kuralı değişmedi';
  assert (public.paylasim_ozeti_kimlik(current_setting('test.l3')::uuid) ->> 'kapali')::boolean is false, '#407 KK3: kart alıcı ekranını kimlikle açar';
  assert public.paylasim_ozeti_kimlik(current_setting('test.l3')::uuid) ->> 'paylasan' = 'Ayşe', '#407 KK3: alıcı ekranında ilk ad';
  assert public.paylasim_ozeti_kimlik(current_setting('test.l2')::uuid) is null, '#407 KK3: birlikte gezilmeyenin linki açılmaz';
  assert public.paylasim_ozeti_kimlik(current_setting('test.l4')::uuid) is null, '#533 2: eski link kimlikle açılmaz';
  assert public.paylasim_harita_izni_kimlik(current_setting('test.l3')::uuid), '#407 KK3: harita izni kimlikle';
  assert not public.paylasim_harita_izni_kimlik(current_setting('test.l2')::uuid), '#533 8c: birlikte gezilmeyenin haritası kimlikle açılmaz';
  assert not public.paylasim_harita_izni_kimlik(current_setting('test.l4')::uuid), '#533 8c: eski linkin haritası kimlikle açılmaz';
end $$;
select pg_temp.hata_bekle($$select public.paylasimdan_al_kimlik(current_setting('test.l2')::uuid)$$, 'P0002');
select pg_temp.hata_bekle($$select public.paylasimdan_al_kimlik(current_setting('test.l4')::uuid)$$, 'P0002');
select pg_temp.hata_bekle($$insert into public.paylasim_begeni (paylasim_id) values (current_setting('test.l4')::uuid)$$, '42501');
do $$ begin assert public.paylasimdan_al_kimlik(current_setting('test.l3')::uuid) is not null, '#407 KK3: Seyahatime al kimlikle'; end $$;
-- Soru 4: kimlikle açılış `acilma_sayisi`'na sayılır ama 500/gün tavanına sayılmaz; tavan dolu olsa da sayaç artar.
reset role;
update public.gezi_paylasim set acilma_sayisi = 0, acilma_gunu = current_date, acilma_gun_sayisi = 500 where id = current_setting('test.l3')::uuid;
set role authenticated;
select pg_temp.as_user(:FB);
select public.paylasim_ozeti_kimlik(current_setting('test.l3')::uuid);
reset role;
do $$ begin assert (select acilma_sayisi = 1 and acilma_gun_sayisi = 500 from public.gezi_paylasim where id = current_setting('test.l3')::uuid), '#533 soru 4: akıştan açılış tavana sayılmaz'; end $$;
-- Linkle açılış tavanı değişmedi: tavan doluyken sayaç durur.
set role anon;
select pg_temp.as_user(null);
select public.paylasim_ozeti(current_setting('test.l3_token'));
reset role;
do $$ begin assert (select acilma_sayisi = 1 from public.gezi_paylasim where id = current_setting('test.l3')::uuid), '#517 KK-ek2: linkle açılış tavanı sürüyor'; end $$;
set role authenticated;
-- A kendi paylaşımını akışta görmez; D, B ile aynı: Bursa (kendi seyahati) yok, Antalya var.
select pg_temp.as_user(:FA);
do $$ begin assert (select count(*) from public.arkadas_paylasimlari()) = 0, '#407 KK2: kendi paylaşımın akışta yok'; end $$;
select pg_temp.as_user(:FD);
do $$ begin assert (select array_agg(id) from public.arkadas_paylasimlari()) = array[current_setting('test.l3')::uuid], '#533 1: üyesi olduğun seyahatin linki akışta yok'; end $$;
-- C (birlikte gezmedi) A'nın linkini görmez, açamaz, beğenemez.
select pg_temp.as_user(:FC);
do $$
begin
  assert (select count(*) from public.arkadaslarim()) = 0 and (select count(*) from public.arkadas_paylasimlari()) = 0, '#407 KK3: C kimseyi görmez';
  assert public.paylasim_ozeti_kimlik(current_setting('test.l3')::uuid) is null and not public.paylasim_harita_izni_kimlik(current_setting('test.l3')::uuid), '#407 KK3: C açamaz';
end $$;
select pg_temp.hata_bekle($$insert into public.paylasim_begeni (paylasim_id) values (current_setting('test.l3')::uuid)$$, '42501');
select pg_temp.hata_bekle($$select public.paylasimdan_al_kimlik(current_setting('test.l3')::uuid)$$, 'P0002');
-- #533 8b: misafir oturum (Bursa üyesi G) akışı görmez, kimlikle açamaz, ♥ veremez.
select pg_temp.as_user(:FG, true);
do $$
begin
  assert (select count(*) from public.arkadas_paylasimlari()) = 0, '#533 8b: misafir akışı görmez';
  assert public.paylasim_ozeti_kimlik(current_setting('test.l3')::uuid) is null, '#533 8b: misafir kimlikle açamaz';
  assert not public.paylasim_harita_izni_kimlik(current_setting('test.l3')::uuid), '#533 8b: misafir haritayı kimlikle açamaz';
end $$;
select pg_temp.hata_bekle($$insert into public.paylasim_begeni (paylasim_id) values (current_setting('test.l3')::uuid)$$, '42501');
select pg_temp.hata_bekle($$select public.paylasimdan_al_kimlik(current_setting('test.l3')::uuid)$$, 'P0002');
-- KK3b: B ve D beğenir, kişi başına bir kez; başkası adına beğenemez; kim beğendi yalnız kendine görünür.
select pg_temp.as_user(:FB);
insert into public.paylasim_begeni (paylasim_id) values (current_setting('test.l3')::uuid);
select pg_temp.hata_bekle($$insert into public.paylasim_begeni (paylasim_id) values (current_setting('test.l3')::uuid)$$, '23505');
select pg_temp.hata_bekle($$insert into public.paylasim_begeni (paylasim_id, user_id) values (current_setting('test.l3')::uuid, '40700000-0000-4000-8000-0000000000d4')$$, '42501');
select pg_temp.hata_bekle($$insert into public.paylasim_begeni (paylasim_id) values (current_setting('test.l2')::uuid)$$, '42501');
select pg_temp.as_user(:FD);
insert into public.paylasim_begeni (paylasim_id) values (current_setting('test.l3')::uuid);
do $$ begin assert (select count(*) from public.paylasim_begeni) = 1, '#407 KK3b: yalnız kendi beğenini görürsün'; end $$;
select pg_temp.as_user(:FB);
do $$ begin assert (select begendim from public.arkadas_paylasimlari()), '#407 KK3b: benim beğenim'; end $$;
delete from public.paylasim_begeni where paylasim_id = current_setting('test.l3')::uuid;
select pg_temp.as_user(:FA);
do $$ begin assert (select count(*) from public.paylasim_begeni) = 0, '#407 KK3b: paylaşan kim beğendi görmez'; end $$;
delete from public.paylasim_begeni;
reset role;
do $$ begin assert (select count(*) from public.paylasim_begeni where paylasim_id = current_setting('test.l3')::uuid) = 1, '#407 KK3b: B geri aldı, başkasınınki silinmez'; end $$;
-- KK3: seyahatten çıkarılan (D) artık kişileri ve paylaşımları görmez, beğenemez.
delete from public.members where trip_id = '40700000-0000-4000-8000-000000000001' and user_id = :FD;
set role authenticated;
select pg_temp.as_user(:FD);
do $$
begin
  assert (select count(*) from public.arkadaslarim()) = 0 and (select count(*) from public.arkadas_paylasimlari()) = 0, '#407 KK3: çıkarılan kişi görmez';
  assert public.paylasim_ozeti_kimlik(current_setting('test.l3')::uuid) is null, '#407 KK3: çıkarılan kişi açamaz';
end $$;
select pg_temp.hata_bekle($$insert into public.paylasim_begeni (paylasim_id) values (current_setting('test.l3')::uuid)$$, '42501');
-- KK2: link kapanınca kart akıştan düşer; akıştan açılan ekran "{ad} bu paylaşımı kapattı." der (#533 4).
select pg_temp.as_user(:FA);
update public.gezi_paylasim set acik = false where id = current_setting('test.l3')::uuid;
select pg_temp.as_user(:FB);
do $$
declare o jsonb := public.paylasim_ozeti_kimlik(current_setting('test.l3')::uuid);
begin
  assert (select count(*) from public.arkadas_paylasimlari()) = 0, '#407 KK2: kapanan link düşer';
  assert (o ->> 'kapali')::boolean and o ->> 'paylasan' = 'Ayşe' and o - 'kapali' - 'paylasan' = '{}'::jsonb, '#533 4: kapalı + ilk ad, başka alan yok: ' || o::text;
end $$;
select pg_temp.hata_bekle($$select public.paylasimdan_al_kimlik(current_setting('test.l3')::uuid)$$, 'P0002');
select pg_temp.as_user(:FC);
do $$ begin assert public.paylasim_ozeti_kimlik(current_setting('test.l3')::uuid) is null, '#533 4: birlikte gezmeyene kapalı link de görünmez'; end $$;
reset role;
-- #533 8c: anon rolü hiçbir arkadaş fonksiyonunu çağıramaz.
set role anon;
select pg_temp.as_user(null);
select pg_temp.hata_bekle($$select * from public.arkadas_paylasimlari()$$, '42501');
select pg_temp.hata_bekle($$select * from public.arkadaslarim()$$, '42501');
select pg_temp.hata_bekle($$select public.paylasim_ozeti_kimlik(current_setting('test.l2')::uuid)$$, '42501');
select pg_temp.hata_bekle($$select public.paylasim_harita_izni_kimlik(current_setting('test.l2')::uuid)$$, '42501');
select pg_temp.hata_bekle($$select public.paylasimdan_al_kimlik(current_setting('test.l2')::uuid)$$, '42501');
select pg_temp.hata_bekle($$select public.ilk_kelime('a b')$$, '42501');
reset role;
set role authenticated;
select pg_temp.as_user(:FB);
select pg_temp.hata_bekle($$select public.paylasim_ozeti_govde(current_setting('test.l3')::uuid)$$, '42501');
reset role;
delete from public.trips where owner_id in (:FA, :FB, :FC, :FD, :FG);
delete from public.olaylar where user_id in (:FA, :FB, :FC, :FD, :FG);
delete from auth.users where id in (:FA, :FB, :FC, :FD, :FG);
do $$ begin assert (select count(*) from public.paylasim_begeni) = 0, '#407: hesap silinince beğeniler de silinir'; end $$;

-- #578 Profil v12: il il harita (KK3), gitmek istenen iller ve RLS'si (KK4), rozetler (KK5), gizlilik (KK6).
-- PA (Ece) ile PB (Deniz) birlikte gezdi; PC kimseyle gezmedi; PG misafir.
\set PA '''57800000-0000-4000-8000-0000000000a1'''
\set PB '''57800000-0000-4000-8000-0000000000b2'''
\set PC '''57800000-0000-4000-8000-0000000000c3'''
\set PG '''57800000-0000-4000-8000-0000000000e5'''
reset role;
-- KK3: 81 il merkezi kendi ilinde bulunur (koordinat → harita izdüşümü → il sınırı içinde-mi).
do $$
declare
  r record;
  yanlis text := '';
begin
  for r in select * from (values
    (1,37.00,35.32),(2,37.76,38.28),(3,38.76,30.54),(4,39.72,43.05),(5,40.65,35.83),(6,39.93,32.86),(7,36.89,30.71),(8,41.18,41.82),
    (9,37.85,27.85),(10,39.65,27.88),(11,40.14,29.98),(12,38.88,40.50),(13,38.40,42.11),(14,40.74,31.61),(15,37.72,30.29),
    (16,40.19,29.06),(17,40.15,26.41),(18,40.60,33.62),(19,40.55,34.95),(20,37.78,29.09),(21,37.91,40.24),(22,41.68,26.56),
    (23,38.68,39.22),(24,39.75,39.49),(25,39.90,41.27),(26,39.78,30.52),(27,37.07,37.38),(28,40.91,38.39),(29,40.46,39.48),
    (30,37.58,43.74),(31,36.20,36.16),(32,37.76,30.55),(33,36.80,34.63),(34,41.01,28.98),(35,38.42,27.14),(36,40.60,43.10),
    (37,41.38,33.78),(38,38.73,35.48),(39,41.73,27.22),(40,39.15,34.16),(41,40.77,29.92),(42,37.87,32.48),(43,39.42,29.98),
    (44,38.35,38.31),(45,38.61,27.43),(46,37.58,36.94),(47,37.31,40.74),(48,37.22,28.36),(49,38.75,41.49),(50,38.62,34.71),
    (51,37.97,34.68),(52,40.98,37.88),(53,41.02,40.52),(54,40.78,30.40),(55,41.29,36.33),(56,37.93,41.94),(57,42.03,35.15),
    (58,39.75,37.02),(59,40.98,27.51),(60,40.31,36.55),(61,41.00,39.72),(62,39.11,39.55),(63,37.16,38.79),(64,38.68,29.41),
    (65,38.49,43.38),(66,39.82,34.81),(67,41.45,31.79),(68,38.37,34.03),(69,40.26,40.23),(70,37.18,33.22),(71,39.85,33.51),
    (72,37.89,41.13),(73,37.52,42.46),(74,41.63,32.34),(75,41.11,42.70),(76,39.92,44.04),(77,40.65,29.27),(78,41.20,32.62),
    (79,36.72,37.12),(80,37.07,36.25),(81,40.84,31.16)) v (plaka, lat, lng)
  loop
    if public.il_bul(r.lat, r.lng) is distinct from r.plaka then
      yanlis := yanlis || format(' %s→%s', r.plaka, public.il_bul(r.lat, r.lng));
    end if;
  end loop;
  assert yanlis = '', '#578 KK3: il merkezi başka ilde:' || yanlis;
  assert (select count(*) from public.iller) = 81 and (select count(distinct plaka) from public.il_sinirlari) = 81, '#578 KK2: 81 il';
  -- Kıyı, ada ve göl: Boğaz'ın iki yakası, Büyükada, Bozcaada (haritada çizili değil, en yakın il), Akdamar, Eğirdir.
  assert public.il_bul(41.005, 28.977) = 34 and public.il_bul(40.990, 29.029) = 34 and public.il_bul(40.858, 29.120) = 34, '#578 KK3: İstanbul';
  assert public.il_bul(39.920, 32.854) = 6 and public.il_bul(38.419, 27.128) = 35 and public.il_bul(38.501, 43.373) = 65, '#578 KK3: Ankara, İzmir, Van';
  assert public.il_bul(39.834, 26.070) = 17 and public.il_bul(38.341, 43.034) = 65 and public.il_bul(37.874, 30.850) = 32, '#578 KK3: ada ve göl';
  assert public.il_bul(36.737, 27.687) = 48 and public.il_bul(38.643, 34.829) = 50, '#578 KK3: Datça, Göreme';
  assert public.il_bul(41.9, 12.49) is null and public.il_bul(37.98, 23.73) is null and public.il_bul(null, null) is null, '#578 KK3: yurt dışı ve boş koordinat';
  assert public.il_adi_sade('Hakkâri, Türkiye') = 'hakkari' and public.il_adi_sade('IĞDIR') = 'igdir', '#578 KK3: il adı sadeleşir';
end $$;

insert into auth.users (id, is_anonymous) values (:PA, false), (:PB, false), (:PC, false), (:PG, true);
insert into public.profiles (id, name, username, photo_url) values
  (:PA, 'Ece Özçınar', 'ece578', 'https://lh3.googleusercontent.com/a/ece578'), (:PB, 'Deniz Kaya', 'deniz578', null),
  (:PC, 'Can', 'can578', null);
-- T1 Bolu (PA kurdu, PB katıldı), bitti; T2 Kapadokya (PB kurdu, PA katıldı), yaklaşıyor; T3 PB yalnız, bitti, şehrin
-- koordinatı boşalmış (Hakkâri); T4 PB yalnız, bitti, Roma (yurt dışı); T5–T6 PB ile PA, bitti (Ekip ve Plancı için);
-- T7 PB yalnız, tarihsiz taslak.
insert into public.trips (id, owner_id, city_place_id, city_label, country_code, lat, lng, tz, start_date, end_date) values
  ('57800000-0000-4000-8000-000000000001', :PA, 'ChIJ-bolu-578', 'Bolu', 'TR', 40.735, 31.608, 'Europe/Istanbul', current_date - 40, current_date - 39),
  ('57800000-0000-4000-8000-000000000002', :PB, 'ChIJ-kapadokya-578', 'Kapadokya', 'TR', 38.643, 34.829, 'Europe/Istanbul', current_date + 10, current_date + 11),
  ('57800000-0000-4000-8000-000000000003', :PB, 'ChIJ-hakkari-578', 'Hakkâri', 'TR', null, null, 'Europe/Istanbul', current_date - 90, current_date - 88),
  ('57800000-0000-4000-8000-000000000004', :PB, 'ChIJ-roma-578', 'Roma', 'IT', 41.9, 12.49, 'Europe/Rome', current_date - 200, current_date - 198),
  ('57800000-0000-4000-8000-000000000005', :PB, 'ChIJ-izmir-578', 'İzmir', 'TR', 38.419, 27.128, 'Europe/Istanbul', current_date - 300, current_date - 299),
  ('57800000-0000-4000-8000-000000000006', :PB, 'ChIJ-datca-578', 'Datça', 'TR', 36.737, 27.687, 'Europe/Istanbul', current_date - 400, current_date - 399);
insert into public.trips (id, owner_id, city_place_id, city_label, country_code, lat, lng, tz) values
  ('57800000-0000-4000-8000-000000000007', :PB, 'ChIJ-van-578', 'Van', 'TR', 38.501, 43.373, 'Europe/Istanbul');
insert into public.members (trip_id, user_id, display_name) values
  ('57800000-0000-4000-8000-000000000001', :PB, 'Deniz Kaya'), ('57800000-0000-4000-8000-000000000002', :PA, 'Ece'),
  ('57800000-0000-4000-8000-000000000005', :PA, 'Ece'), ('57800000-0000-4000-8000-000000000006', :PA, 'Ece');
-- T1'in durakları: Ankara (gezildi), Van (atlandı), koordinatı boşalmış yer; T2'de (yaklaşan) Muğla durağı sayılmaz.
insert into public.places (id, trip_id, place_id, lat, lng) values
  ('57800000-0000-4000-8000-0000000000f1', '57800000-0000-4000-8000-000000000001', 'ChIJ-578-ankara', 39.92, 32.854),
  ('57800000-0000-4000-8000-0000000000f2', '57800000-0000-4000-8000-000000000001', 'ChIJ-578-van', 38.501, 43.373),
  ('57800000-0000-4000-8000-0000000000f3', '57800000-0000-4000-8000-000000000001', 'ChIJ-578-bos', null, null),
  ('57800000-0000-4000-8000-0000000000f4', '57800000-0000-4000-8000-000000000002', 'ChIJ-578-mugla', 37.035, 27.430),
  ('57800000-0000-4000-8000-0000000000f5', '57800000-0000-4000-8000-000000000005', 'ChIJ-578-yemek2', 38.42, 27.13),
  ('57800000-0000-4000-8000-0000000000f6', '57800000-0000-4000-8000-000000000006', 'ChIJ-578-yemek3', 36.74, 27.69);
insert into public.stops (trip_id, day_id, place_ref, order_key, minutes, skipped)
select p.trip_id, (select d.id from public.days d where d.trip_id = p.trip_id order by d.index limit 1), p.id, 'a' || right(p.id::text, 1), 60,
  p.id = '57800000-0000-4000-8000-0000000000f2'
from public.places p where p.id::text like '57800000-0000-4000-8000-0000000000f%';
-- Lezzet: üç gezilen yer il listesinde "yemek" (biri gizli satırda da olsa görünür satırı sayılır); Van atlandığı için sayılmaz.
insert into public.il_listeleri (il_slug, il) values ('il-578', 'Deneme');
insert into public.il_oneriler (il_slug, sira, ad, kategori, place_id, gorunur) values
  ('il-578', 1, 'A', 'yemek', 'ChIJ-578-ankara', true), ('il-578', 2, 'B', 'tatli_kahve', 'ChIJ-578-yemek2', true),
  ('il-578', 3, 'C', 'yemek', 'ChIJ-578-yemek3', true), ('il-578', 4, 'D', 'doga', 'ChIJ-578-van', true),
  ('il-578', 5, 'E', 'muze', 'ChIJ-578-yemek3', false);

set role authenticated;
-- KK4: sahibi yazar; arkadaşı okur; başkası ve misafir göremez, yazamaz.
select pg_temp.as_user(:PA);
insert into public.istek_iller (plaka) values (36), (48);
select pg_temp.hata_bekle($$insert into public.istek_iller (user_id, plaka) values ('57800000-0000-4000-8000-0000000000b2', 61)$$, '42501');
select pg_temp.hata_bekle($$insert into public.istek_iller (plaka) values (99)$$, '23503');
select pg_temp.hata_bekle($$insert into public.istek_iller (plaka) values (36)$$, '23505');
select pg_temp.hata_bekle($$update public.istek_iller set plaka = 1$$, '42501');
select pg_temp.as_user(:PB);
insert into public.istek_iller (plaka) values (61), (48);
do $$
begin
  assert (select array_agg(plaka order by plaka) from public.istek_iller where user_id = '57800000-0000-4000-8000-0000000000a1') = array[36, 48]::smallint[], '#578 KK4: arkadaş okur';
end $$;
delete from public.istek_iller where user_id = '57800000-0000-4000-8000-0000000000a1';
select pg_temp.as_user(:PC);
do $$ begin assert (select count(*) from public.istek_iller) = 0, '#578 KK4: birlikte gezmeyen okuyamaz'; end $$;
select pg_temp.hata_bekle($$insert into public.istek_iller (user_id, plaka) values ('57800000-0000-4000-8000-0000000000a1', 1)$$, '42501');
select pg_temp.as_user(:PG, true);
select pg_temp.hata_bekle($$insert into public.istek_iller (plaka) values (1)$$, '42501');
select pg_temp.as_user(:PA);
do $$ begin assert (select count(*) from public.istek_iller where user_id = auth.uid()) = 2, '#578 KK4: arkadaş başkasınınkini silemez'; end $$;
select pg_temp.hata_bekle($$select * from public.gidilen_iller$$, '42501');
select pg_temp.hata_bekle($$select * from public.profil_rozetleri$$, '42501');
select pg_temp.hata_bekle($$select * from public.il_sinirlari$$, '42501');
do $$ begin assert (select count(*) from public.iller) = 81, '#578: il listesi herkese açık'; end $$;

-- KK3, KK5, KK6: PA, PB'nin profiline bakar.
do $$
declare
  o jsonb := public.profil_ozeti('57800000-0000-4000-8000-0000000000b2');
begin
  assert o ->> 'ad' = 'Deniz Kaya' and not (o ->> 'kendi')::boolean and (o ->> 'harita_acik')::boolean, '#578: arkadaşın profili: ' || o::text;
  assert o -> 'gizlilik' = 'null'::jsonb, '#578 KK6: arkadaşın gizlilik ayarı dönmez';
  -- Bolu (şehir), Ankara (gezilen durak), Hakkâri (koordinatsız şehir, adıyla), İzmir, Muğla (Datça). Van atlandı, Kapadokya
  -- yaklaşıyor, Roma yurt dışı, koordinatı boş durak sayılmaz.
  assert o -> 'gidilen' = '[6, 14, 30, 35, 48]'::jsonb, '#578 KK3: gittiği iller: ' || (o -> 'gidilen')::text;
  assert o -> 'istek' = '[48, 61]'::jsonb or o -> 'istek' = '[61, 48]'::jsonb, '#578 KK4: istek';
  assert o -> 'benim_istek' = '[36, 48]'::jsonb, '#578 KK4: ortak iller için benim isteklerim';
  assert (o ->> 'yol_arkadasi')::integer = 1, '#578: yol arkadaşı';
  -- KK6: yalnız bitmiş geziler (Kapadokya ve tarihsiz Van yok); yeniden eskiye.
  assert (select array_agg(g ->> 'sehir' order by i) from jsonb_array_elements(o -> 'geziler') with ordinality x (g, i)) = array['Bolu', 'Hakkâri', 'Roma', 'İzmir', 'Datça'],
    '#578 KK6: arkadaşın yalnız geçmiş gezileri: ' || (o -> 'geziler')::text;
  assert (o -> 'geziler' -> 0 -> 'kisiler') = '[{"harf": "E", "foto": "https://lh3.googleusercontent.com/a/ece578"}]'::jsonb, '#578: gezideki diğer kişi: ' || (o -> 'geziler' -> 0 -> 'kisiler')::text;
  assert (o -> 'geziler' -> 0 ->> 'uyesiyim')::boolean and not (o -> 'geziler' -> 1 ->> 'uyesiyim')::boolean, '#578: izleyen üyesi mi';
  -- KK5: Lezzet 3 (Ankara, İzmir, Datça; gizli müze satırı sayılmaz), Ekip 3 (PA ile Bolu, İzmir, Datça), Plancı 3 (PA'nın
  -- katıldığı Kapadokya, İzmir, Datça). Kazanılmamış Doğa ve Kültür arkadaşa dönmez.
  assert o -> 'rozetler' = '{"lezzet": 3, "ekip": 3, "planci": 3}'::jsonb, '#578 KK5: rozetler: ' || (o -> 'rozetler')::text;
end $$;
-- Kendi profilinde: yaklaşan gezi de var, kazanılmamış rozetin sayısı da döner, gizlilik ayarı döner.
select pg_temp.as_user(:PB);
do $$
declare
  o jsonb := public.profil_ozeti('57800000-0000-4000-8000-0000000000b2');
begin
  assert (o ->> 'kendi')::boolean and o ->> 'gizlilik' = 'friends' and o -> 'benim_istek' = 'null'::jsonb, '#578: kendi profilin';
  assert o -> 'geziler' -> 0 ->> 'sehir' = 'Kapadokya' and jsonb_array_length(o -> 'geziler') = 6, '#578: kendi profilinde yaklaşan gezi önde';
  assert o -> 'rozetler' = '{"lezzet": 3, "doga": 0, "kultur": 0, "ekip": 3, "planci": 3}'::jsonb, '#578 KK5: kendi rozetlerin: ' || (o -> 'rozetler')::text;
end $$;
-- KK6: harita "yalnız ben" → arkadaş haritayı ve gezileri görmez.
update public.profiles set map_visibility = 'me' where id = auth.uid();
select pg_temp.as_user(:PA);
do $$
declare
  o jsonb := public.profil_ozeti('57800000-0000-4000-8000-0000000000b2');
begin
  assert not (o ->> 'harita_acik')::boolean and o -> 'gidilen' = 'null'::jsonb and o -> 'geziler' = '[]'::jsonb, '#578 KK6: gizli harita: ' || o::text;
end $$;
-- Birlikte gezmeyen ve misafir profili göremez.
select pg_temp.as_user(:PC);
do $$ begin assert public.profil_ozeti('57800000-0000-4000-8000-0000000000b2') is null, '#578: birlikte gezmeyen göremez'; end $$;
select pg_temp.as_user(:PG, true);
do $$ begin assert public.profil_ozeti('57800000-0000-4000-8000-0000000000b2') is null, '#578: misafir göremez'; end $$;
reset role;
set role anon;
select pg_temp.as_user(null);
select pg_temp.hata_bekle($$select public.profil_ozeti('57800000-0000-4000-8000-0000000000b2')$$, '42501');
select pg_temp.hata_bekle($$select * from public.istek_iller$$, '42501');
select pg_temp.hata_bekle($$select public.il_bul(41, 29)$$, '42501');
reset role;
delete from public.il_oneriler where il_slug = 'il-578';
delete from public.il_listeleri where il_slug = 'il-578';
delete from public.trips where id::text like '57800000-0000-4000-8000-00000000000%';
delete from public.olaylar where user_id in (:PA, :PB, :PC, :PG);
delete from auth.users where id in (:PA, :PB, :PC, :PG);
do $$ begin assert (select count(*) from public.istek_iller) = 0, '#578: hesap silinince istekler de silinir'; end $$;

\echo 'rls_test: TÜM TESTLER GEÇTİ'
