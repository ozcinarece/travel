-- #138 Profil kur adımı kalkar: giriş sonrası profil sunucuda kendiliğinden oluşur.
-- Ad ve foto sağlayıcıdan (Google: full_name/name, picture/avatar_url; Apple adı gizlerse "Gezgin"); kullanıcı adı addan,
-- alınmışsa sonuna rastgele 4–6 haneli ek; harita gizliliği varsayılan "friends" (Arkadaşlarım). Profili olan kullanıcıda hiçbir şey
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

-- Kullanıcı adı adayı: ilk deneme taban; sonra rastgele 4–6 haneli ek (tavan yok: "gezgin" binlerce kişide de dolmaz).
create or replace function public.kullanici_adi_adayi(taban text, deneme integer)
returns text
language sql volatile set search_path = ''
as $$
  select case when deneme <= 1 then taban
    else left(taban, 24 - h) || lpad(floor(random() * power(10, h))::bigint::text, h, '0') end
  from (select case when deneme <= 4 then 4 when deneme <= 7 then 5 else 6 end as h) x;
$$;

-- p_ad: sağlayıcının oturum dışında verdiği ad (Apple adı yalnız ilk girişte istemciye verir). Profil yokken ad olarak
-- kullanılır; profil kendiliğinden "Gezgin" olarak oluşmuşsa ad ve (otomatik "gezgin…" ise) kullanıcı adı bununla düzelir.
create or replace function public.profil_hazirla(p_ad text default null)
returns public.profiles
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  meta jsonb;
  ad text;
  verilen text := left(nullif(trim(coalesce(p_ad, '')), ''), 60);
  taban text;
  aday text;
  n integer := 1;
begin
  if auth.uid() is null or public.is_anonymous() then
    raise exception 'hesap gerekli' using errcode = '42501';
  end if;
  select * into p from public.profiles where id = auth.uid();
  if found then
    if verilen is null or p.name <> 'Gezgin' then
      return p;
    end if;
    -- Kendiliğinden "Gezgin" oluşmuş profil, sonradan gelen adla düzelir; kullanıcı elle değiştirdiyse dokunulmaz.
    if p.username !~ '^gezgin[0-9]*$' then
      update public.profiles set name = verilen where id = auth.uid() returning * into p;
      return p;
    end if;
    taban := public.kullanici_adi_taban(verilen);
    loop
      aday := public.kullanici_adi_adayi(taban, n);
      begin
        update public.profiles set name = verilen, username = aday where id = auth.uid() returning * into p;
        return p;
      exception when unique_violation then
        n := n + 1;
        if n > 10 then
          raise;
        end if;
      end;
    end loop;
  end if;
  select coalesce(u.raw_user_meta_data, '{}'::jsonb) into meta from auth.users u where u.id = auth.uid();
  ad := coalesce(verilen, left(nullif(trim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), ''), 60), 'Gezgin');
  taban := public.kullanici_adi_taban(ad);
  loop
    aday := public.kullanici_adi_adayi(taban, n);
    begin
      insert into public.profiles (id, name, username, photo_url, map_visibility, onboarding_done_at)
      values (auth.uid(), ad, aday, nullif(coalesce(meta ->> 'picture', meta ->> 'avatar_url', ''), ''), 'friends', now())
      returning * into p;
      return p;
    exception when unique_violation then
      -- Aynı anda iki çağrı (ör. iki sekme): profil oluştuysa onu döndür; değilse kullanıcı adı alınmış → rastgele ek.
      select * into p from public.profiles where id = auth.uid();
      if found then
        return p;
      end if;
      n := n + 1;
      if n > 10 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.profil_hazirla(text), public.kullanici_adi_taban(text), public.kullanici_adi_adayi(text, integer) from public, anon;
grant execute on function public.profil_hazirla(text) to authenticated;
grant execute on function public.kullanici_adi_taban(text) to authenticated;
