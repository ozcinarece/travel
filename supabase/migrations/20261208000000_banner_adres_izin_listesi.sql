-- #406 2/2 KK-ek1: banner görsel adresi izin listesiyle denetlenir. Yasak listesi (`..`, `%2e`, …) sekme ve satır sonunu
-- yakalamıyordu: `…/public/icerik/.<TAB>./avatars/u1/a.jpg` geçiyor, tarayıcının URL ayrıştırıcısı sekmeyi silince adres
-- public `avatars` kovasına gidiyordu (#428 onay notu). Artık adreste yalnız `A-Z a-z 0-9 . _ ~ / : ( ) , -` ve iki onaltılık
-- haneli `%XX` olabilir; kontrol, boşluk, `'` ve diğer her karakter reddedilir (#438 inceleme 1: parantez ve virgül Commons'ta
-- sık geçer, yol hilesi açmaz). Kodlanmış kontrol karakteri (`%00`–`%1F`, `%7F`) de reddedilir (#438 inceleme 7).
-- Commons yalnız `upload.wikimedia.org/wikipedia/commons/` altından: `/wikipedia/en/` gibi yerel vikilerdeki adil kullanım
-- dosyaları serbest lisanslı değildir (#438 inceleme 7). Önceki yol hilesi kuralları aynen kalır.
create or replace function public.banner_gorsel_adresi_gecerli(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select p is not null
    and char_length(p) <= 500
    and p ~ '^([A-Za-z0-9._~/:(),-]|%[0-9A-Fa-f]{2})+$'
    and p !~* '%([01][0-9a-f]|7f)'
    and p ~ '^https://(upload\.wikimedia\.org/wikipedia/commons/|xwqeobelyeuzoxyuvauw\.supabase\.co/storage/v1/object/public/icerik/)'
    and p !~* '(\.\.|%2e|%2f|%5c|%25|\\)'
$$;

-- Kurala uymayan mevcut banner görseli varsa migration durur (CHECK yalnız yeni yazımda denetler; sessizce yayında kalmasın).
do $$
begin
  if exists (
    select 1 from public.ana_sayfa_bolumleri
    where tur = 'banner' and icerik ? 'kapak_url' and not public.banner_gorsel_adresi_gecerli(icerik ->> 'kapak_url')
  ) then
    raise exception 'ana_sayfa_bolumleri: izin listesine uymayan banner görseli var; önce panelden düzelt';
  end if;
  -- Canlıdaki son yayın da (uygulama onu okur).
  if exists (
    select 1 from (select bolumler from public.ana_sayfa_yayini order by id desc limit 1) y, jsonb_array_elements(y.bolumler) b
    where b ->> 'tur' = 'banner' and b -> 'icerik' ? 'kapak_url' and not public.banner_gorsel_adresi_gecerli(b -> 'icerik' ->> 'kapak_url')
  ) then
    raise exception 'ana_sayfa_yayini: son yayında izin listesine uymayan banner görseli var; düzeltip yeniden yayınla';
  end if;
end $$;
