-- #229: kullanıcı rehberi kapanır.
-- KK1: profiles yalnız sahibine ve en az bir ortak seyahati olan üyelere görünür. Ortak üyelik `ortak_seyahat_var` ile
--   denetlenir (security definer: members kuralına takılmadan, döngüsüz; search_path boş; yalnız authenticated çağırır).
--   Başkasının profilini okuyan diğer yerler (davet_ozeti, username_available, üye adı tetikleyicisi, BO) zaten security
--   definer fonksiyonlardır; istemcide başkasının profili yalnız aynı seyahatin üyeleri için okunur (mekanlar/sorgular.ts).
-- KK2: avatars kovası listelenemez. Kova public kalır: dosyaya genel adresle erişim RLS'ye bakmaz. storage.objects select
--   kuralı yalnız kendi klasörüne daralır; Storage upsert (üzerine yazma) ve remove kendi dosyasını görmeyi gerektirir.

create function public.ortak_seyahat_var(u uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members ben join public.members o on o.trip_id = ben.trip_id
     where ben.user_id = auth.uid() and o.user_id = u
  );
$$;
revoke execute on function public.ortak_seyahat_var(uuid) from public, anon;
grant execute on function public.ortak_seyahat_var(uuid) to authenticated;

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.ortak_seyahat_var(id));

drop policy avatars_select on storage.objects;
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
