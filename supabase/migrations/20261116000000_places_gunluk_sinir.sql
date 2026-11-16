-- #226: Places Edge Function'larında kullanıcı başına günlük sınır.
-- Sayaç kullanıcı kimliğinin SHA-256 özetiyle (hex) tutulur; kimlik açık yazılmaz. Gün Türkiye saatiyle.
-- Yalnız Edge Function'lar (service_role) artırır; anon ve authenticated (yönetici dahil) okuyamaz, yazamaz.

create table public.places_gunluk_sayac (
  ozet text not null check (ozet ~ '^[0-9a-f]{64}$'),
  gun date not null default ((now() at time zone 'Europe/Istanbul')::date),
  kategori text not null check (kategori in ('details', 'photo', 'nearby', 'autocomplete', 'link')),
  adet integer not null default 0 check (adet >= 0),
  primary key (ozet, gun, kategori)
);
alter table public.places_gunluk_sayac enable row level security;
revoke all on public.places_gunluk_sayac from public, anon, authenticated;
-- Politika yok: RLS açık + yetki yok → anon / authenticated hiçbir satıra erişemez.

-- Atomik artırma: p_adet (Google isteği sayısı; places-light'ta önbellekte olmayan kimlik sayısı, en çok 25) sınırı
-- aşmıyorsa sayacı p_adet artırır ve true döner; aşıyorsa sayaç değişmez, false döner.
create function public.places_sinir_artir(p_ozet text, p_kategori text, p_sinir integer, p_adet integer default 1) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_adet integer;
begin
  if p_adet is null or p_adet not between 1 and 25 then
    raise exception 'p_adet 1–25' using errcode = '22023';
  end if;
  if p_sinir is null or p_adet > p_sinir then
    return false;
  end if;
  insert into public.places_gunluk_sayac as s (ozet, kategori, adet) values (p_ozet, p_kategori, p_adet)
  on conflict (ozet, gun, kategori) do update set adet = s.adet + excluded.adet where s.adet + excluded.adet <= p_sinir
  returning s.adet into v_adet;
  return v_adet is not null;
end;
$$;
revoke execute on function public.places_sinir_artir(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.places_sinir_artir(text, text, integer, integer) to service_role;
