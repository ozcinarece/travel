-- #246 KK2: Routes fonksiyonları (route-matrix, route-legs) da günlük sayaçtan geçer: yeni `rota` kategorisi.
-- Sayılan şey Google'a giden ELEMAN: matriste kaynak × hedef (25 × 25 = 625'e kadar), route-legs'te her computeRoutes 1.
-- Bu yüzden tek çağrının adedi 1–625 olabilir (Places çağrıları en çok 25 gönderir; sınır Edge Function'da).

alter table public.places_gunluk_sayac drop constraint places_gunluk_sayac_kategori_check;
alter table public.places_gunluk_sayac add constraint places_gunluk_sayac_kategori_check
  check (kategori in ('details', 'photo', 'nearby', 'autocomplete', 'metin', 'link', 'rota'));

-- Gövde #226 ile aynı; yalnız p_adet üst sınırı 25 → 625.
create or replace function public.places_sinir_artir(p_ozet text, p_kategori text, p_sinir integer, p_adet integer default 1,
  p_toplam_sinir integer default null) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_gun constant date := (now() at time zone 'Europe/Istanbul')::date;
  v_adet integer;
begin
  if p_adet is null or p_adet not between 1 and 625 then
    raise exception 'p_adet 1–625' using errcode = '22023';
  end if;
  if p_ozet = 'misafir-toplam' then
    raise exception 'özet geçersiz' using errcode = '22023';
  end if;
  if p_sinir is null or p_adet > p_sinir or p_adet > coalesce(p_toplam_sinir, p_adet) then
    return false;
  end if;
  if p_toplam_sinir is not null then
    insert into public.places_gunluk_sayac as s (ozet, gun, kategori, adet) values ('misafir-toplam', v_gun, p_kategori, p_adet)
    on conflict (ozet, gun, kategori) do update set adet = s.adet + excluded.adet where s.adet + excluded.adet <= p_toplam_sinir
    returning s.adet into v_adet;
    if v_adet is null then
      return false;
    end if;
    v_adet := null;
  end if;
  insert into public.places_gunluk_sayac as s (ozet, gun, kategori, adet) values (p_ozet, v_gun, p_kategori, p_adet)
  on conflict (ozet, gun, kategori) do update set adet = s.adet + excluded.adet where s.adet + excluded.adet <= p_sinir
  returning s.adet into v_adet;
  if v_adet is null and p_toplam_sinir is not null then
    -- Kullanıcı sınırı doldu: toplamdan alınan pay geri verilir (satır bu işlemde kilitli).
    update public.places_gunluk_sayac set adet = adet - p_adet
    where ozet = 'misafir-toplam' and gun = v_gun and kategori = p_kategori;
  end if;
  return v_adet is not null;
end;
$$;
revoke execute on function public.places_sinir_artir(text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.places_sinir_artir(text, text, integer, integer, integer) to service_role;
