-- #138 Profil kur adımı kalkar: giriş sonrası profil sunucuda kendiliğinden oluşur.
-- Ad ve foto sağlayıcıdan (Google: full_name/name, picture/avatar_url; Apple adı gizlerse "Gezgin"); kullanıcı adı addan,
-- alınmışsa sonuna sayı eklenir; harita gizliliği varsayılan "friends" (Arkadaşlarım). Profili olan kullanıcıda hiçbir şey
-- değişmez (KK7). Kullanıcı adı ve ad Profil › Düzenle'den değişir.

-- "Ece Özçınar" → "ece.ozcinar" (istemci lib/kullaniciAdi.addanOner ile aynı kural); 3 karakterden kısaysa "gezgin".
-- En çok 20 karakter: sayı eki için yer kalır (username ≤ 24).
create or replace function public.kullanici_adi_taban(ad text)
returns text
language sql immutable set search_path = ''
as $$
  select case when length(t) >= 3 then t else 'gezgin' end
  from (
    select trim(both '.' from left(
      regexp_replace(
        regexp_replace(
          -- Türkçe harfler (büyük/küçük) önce açıkça sadeleşir; lower() yalnız ASCII'ye kalır (yerel ayardan bağımsız).
          regexp_replace(lower(translate(coalesce(ad, ''), 'ÇĞİIÖŞÜÂÎÛçğıöşüâîû', 'cgiiosuaiucgiosuaiu')), '\s+', '.', 'g'),
          '[^a-z0-9_.]', '', 'g'),
        '\.{2,}', '.', 'g'),
      20)) as t
  ) x;
$$;

create or replace function public.profil_hazirla()
returns public.profiles
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  meta jsonb;
  ad text;
  taban text;
  aday text;
  n integer := 1;
begin
  if auth.uid() is null or public.is_anonymous() then
    raise exception 'hesap gerekli' using errcode = '42501';
  end if;
  select * into p from public.profiles where id = auth.uid();
  if found then
    return p;
  end if;
  select coalesce(u.raw_user_meta_data, '{}'::jsonb) into meta from auth.users u where u.id = auth.uid();
  ad := left(nullif(trim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), ''), 60);
  if ad is null then
    ad := 'Gezgin';
  end if;
  taban := public.kullanici_adi_taban(ad);
  aday := taban;
  loop
    begin
      insert into public.profiles (id, name, username, photo_url, map_visibility, onboarding_done_at)
      values (auth.uid(), ad, aday, nullif(coalesce(meta ->> 'picture', meta ->> 'avatar_url', ''), ''), 'friends', now())
      returning * into p;
      return p;
    exception when unique_violation then
      -- Aynı anda iki çağrı (ör. iki sekme): profil oluştuysa onu döndür; değilse kullanıcı adı alınmış → sıradaki sayı.
      select * into p from public.profiles where id = auth.uid();
      if found then
        return p;
      end if;
      n := n + 1;
      if n > 999 then
        raise;
      end if;
      aday := left(taban, 24 - length(n::text)) || n::text;
    end;
  end loop;
end;
$$;

grant execute on function public.profil_hazirla() to authenticated;
grant execute on function public.kullanici_adi_taban(text) to authenticated;
