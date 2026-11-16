-- #226: Places Edge Function'larında kullanıcı başına günlük sınır.
-- Sayaç kullanıcı kimliğinin SHA-256 özetiyle (hex) tutulur; kimlik açık yazılmaz. Gün Türkiye saatiyle.
-- Bütün misafirlerin (anonim oturum) ortak günlük tavanı aynı tabloda sabit 'misafir-toplam' satırında sayılır:
-- her anonim oturum yeni bir kimlik (yeni kota) aldığı için tek başına kullanıcı sınırı misafiri durdurmaz.
-- Yalnız Edge Function'lar (service_role) artırır; anon ve authenticated (yönetici dahil) okuyamaz, yazamaz.

create table public.places_gunluk_sayac (
  ozet text not null check (ozet ~ '^[0-9a-f]{64}$' or ozet = 'misafir-toplam'),
  gun date not null default ((now() at time zone 'Europe/Istanbul')::date),
  kategori text not null check (kategori in ('details', 'photo', 'nearby', 'autocomplete', 'metin', 'link')),
  adet integer not null default 0 check (adet >= 0),
  primary key (ozet, gun, kategori)
);
alter table public.places_gunluk_sayac enable row level security;
revoke all on public.places_gunluk_sayac from public, anon, authenticated;
-- Politika yok: RLS açık + yetki yok → anon / authenticated hiçbir satıra erişemez.

-- Atomik artırma: p_adet (Google isteği sayısı; places-light'ta önbellekte olmayan kimlik sayısı, en çok 25) sınırı
-- aşmıyorsa sayacı p_adet artırır ve true döner; aşıyorsa sayaç değişmez, false döner.
-- p_toplam_sinir verilirse (misafir) istek ayrıca 'misafir-toplam' satırından geçer; ikisinden biri sığmazsa ikisi de değişmez.
-- Kilit sırası hep önce toplam, sonra kullanıcı satırı (kilitlenme olmaz).
create function public.places_sinir_artir(p_ozet text, p_kategori text, p_sinir integer, p_adet integer default 1,
  p_toplam_sinir integer default null) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_gun constant date := (now() at time zone 'Europe/Istanbul')::date;
  v_adet integer;
begin
  if p_adet is null or p_adet not between 1 and 25 then
    raise exception 'p_adet 1–25' using errcode = '22023';
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

-- Temizlik: 7 günden eski sayaç satırları her gece silinir (sınır yalnız bugünü okur).
create function public.places_sayac_temizle()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.places_gunluk_sayac where gun < (now() at time zone 'Europe/Istanbul')::date - 7;
$$;
revoke execute on function public.places_sayac_temizle() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('places-sayac-temizle', '41 3 * * *', 'select public.places_sayac_temizle()');
  end if;
exception when others then
  raise notice 'pg_cron zamanlanamadı: %', sqlerrm;
end;
$$;
