-- #142 KK3: Google yorumları maliyeti — yorumlar yalnız sekmeye dokununca, oturumda cihazda tutulur, DB'ye yazılmaz (PRD §7).
-- `places-reviews` Google'a gitmeden önce günün kullanımını (api_sayac, #110) panel ayarındaki sınırla karşılaştırır; sınır
-- doluysa uygulama sekmede "Google'da aç" gösterir. Varsayılan 300/gün; panelde `yorum_gunluk_sinir` ile değişir.
insert into public.yonetim_ayarlari (anahtar, deger) values ('yorum_gunluk_sinir', '300') on conflict (anahtar) do nothing;

create or replace function public.yorum_kotasi()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'kullanilan', coalesce((select s.google from public.api_sayac s where s.gun = (now() at time zone 'Europe/Istanbul')::date and s.fonksiyon = 'places-reviews'), 0),
    'sinir', (select (a.deger #>> '{}')::integer from public.yonetim_ayarlari a where a.anahtar = 'yorum_gunluk_sinir'));
$$;
revoke execute on function public.yorum_kotasi() from public, anon, authenticated;
grant execute on function public.yorum_kotasi() to service_role;

-- Backoffice genel bakış: bugünkü yorum kullanımı / sınır (yalnız yönetici).
create or replace function public.yonetim_yorum_kotasi()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  return public.yorum_kotasi();
end;
$$;
revoke execute on function public.yonetim_yorum_kotasi() from public, anon;
grant execute on function public.yonetim_yorum_kotasi() to authenticated;
