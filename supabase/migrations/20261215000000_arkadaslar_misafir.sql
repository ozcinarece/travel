-- #574 inceleme (PR #612, "değişiklik iste" 1): misafir yol arkadaşı "Kimlerle?"de görünüp `davet_gonder`'i (biri tutmazsa
-- hiçbiri, 42501) bütünüyle düşürüyordu. Karar (b): `arkadaslarim()` her kişi için `misafir` döndürür (hesabı anonim mi;
-- `davet_gonder` ile aynı ölçüt: `auth.users.is_anonymous`). İstemci "Kimlerle?"de bu kişileri göstermez; `davet_gonder` değişmez.
-- Arkadaşlar sekmesi (#407): küme, sıra, ad ve fotoğraf aynı; yalnız bir kolon eklendi.
-- Veri silme yok; Google'a istek yok. Dönüş tipi değiştiği için `create or replace` olmaz: fonksiyon düşürülüp aynı adla,
-- aynı yetkilerle (security definer, search_path = '', yalnız authenticated) yeniden kurulur. Fonksiyona bağlı nesne yok
-- (`cascade` yok); tablo ya da satır değişmez.

drop function public.arkadaslarim();

-- KK1 (#407): kişi satırı. Ad, ortak seyahatlerden en son katılınandaki görünen adın ilk kelimesi; en son katılan önde.
create function public.arkadaslarim() returns table (user_id uuid, ad text, foto text, misafir boolean)
language sql stable security definer set search_path = ''
as $$
  select x.user_id, public.ilk_kelime(x.ad), (select p.photo_url from public.profiles p where p.id = x.user_id),
    coalesce((select u.is_anonymous from auth.users u where u.id = x.user_id), false)
  from (
    select distinct on (b.user_id) b.user_id, b.display_name as ad, b.joined_at
    from public.members a
    join public.members b on b.trip_id = a.trip_id and b.user_id <> a.user_id
    where a.user_id = auth.uid()
    order by b.user_id, b.joined_at desc
  ) x
  order by x.joined_at desc, x.user_id
$$;

revoke all on function public.arkadaslarim() from public, anon, authenticated;
grant execute on function public.arkadaslarim() to authenticated;

notify pgrst, 'reload schema';
