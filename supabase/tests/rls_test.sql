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
-- Seed + ilk yayın: üç bölüm, sırayla; taslak tablo anon'a kapalı, admin olmayana boş.
set role anon;
do $$
begin
  assert (select string_agg(tur, ',' order by sira) from public.ana_sayfa_gorunen) = 'tek_kart,serit,mozaik', 'seed bölümleri sırayla görünür';
  assert (select icerik ->> 'gezi_id' from public.ana_sayfa_gorunen where tur = 'tek_kart') is not null, 'otomatik öne çıkan gezi çözülür';
end $$;
select pg_temp.hata_bekle($$select count(*) from public.ana_sayfa_bolumleri$$, '42501');
select pg_temp.hata_bekle($$select public.ana_sayfa_yayinla()$$, '42501');
set role authenticated;
select pg_temp.as_email(:B, 'b@ornek.com');
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
do $$ begin assert (select string_agg(baslik, ',' order by sira) from public.ana_sayfa_gorunen) = 'Öne çıkan gezi,Önerilen geziler,Gezilecek yerler', 'yayın öncesi eski düzen'; end $$;
set role authenticated;
select pg_temp.as_email(:E, 'ozcinar.ece@gmail.com');
do $$ begin assert public.ana_sayfa_yayinla() is not null, 'admin yayınlar'; end $$;
set role anon;
do $$
begin
  assert (select string_agg(baslik, ',' order by sira) from public.ana_sayfa_gorunen) = 'Önerilen geziler,Öne çıkan gezi,Gezilecek yerler,Şimdi', 'yayından sonra: yeni sıra; kapalı ve zamanı gelmemiş bölüm yok';
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

\echo 'rls_test: TÜM TESTLER GEÇTİ'
