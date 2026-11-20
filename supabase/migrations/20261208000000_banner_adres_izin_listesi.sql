-- #406 2/2 KK-ek1: banner görsel adresi izin listesiyle denetlenir. Yasak listesi (`..`, `%2e`, …) sekme ve satır sonunu
-- yakalamıyordu: `…/public/icerik/.<TAB>./avatars/u1/a.jpg` geçiyor, tarayıcının URL ayrıştırıcısı sekmeyi silince adres
-- public `avatars` kovasına gidiyordu (#428 onay notu). Artık adreste yalnız `A-Z a-z 0-9 . _ ~ / : % -` olabilir; kontrol,
-- boşluk ve diğer her karakter reddedilir. Önceki önek ve yol hilesi kuralları aynen kalır.
create or replace function public.banner_gorsel_adresi_gecerli(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select p is not null
    and char_length(p) <= 500
    and p ~ '^[A-Za-z0-9._~/:%-]+$'
    and p ~ '^https://(upload\.wikimedia\.org/|xwqeobelyeuzoxyuvauw\.supabase\.co/storage/v1/object/public/icerik/)'
    and p !~* '(\.\.|%2e|%2f|%5c|%25|\\)'
$$;
