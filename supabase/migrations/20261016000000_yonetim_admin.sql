-- #106: backoffice (yönetim paneli) yöneticileri ve içerik yazma yetkisi.
-- Admin = e-postası `admin_kullanicilar`da olan, e-postası doğrulanmış, anonim olmayan hesap (`is_admin()`).
-- İçerik tablolarına (#97/#98/#100) yazma yalnız admin; okuma: yayınlı satırlar herkese (mevcut politikalar),
-- taslaklar yalnız admin. `ana_sayfa_bolumleri` #109'da tablosuyla birlikte aynı fonksiyonla korunur.

create table public.admin_kullanicilar (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+$'),
  rol text not null default 'admin' check (rol in ('admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_kullanicilar enable row level security;
-- Oturumsuz istemci tabloya hiç dokunmaz (Supabase varsayılan yetkisi geri alınır).
revoke all on public.admin_kullanicilar from anon;

-- İlk yönetici: Ece (ürün sahibi). Diğerleri panelin Ayarlar sayfasından eklenir (#111).
insert into public.admin_kullanicilar (email) values ('ozcinar.ece@gmail.com');

-- JWT `email` claim'i tabloda olmalı VE oturumun auth kaydı aynı, doğrulanmış e-postayı taşımalı: doğrulanmamış
-- e-posta/şifre kaydı ya da eski bir JWT yönetici olamaz. security definer: tabloyu RLS'siz okur (özyineleme yok).
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_kullanicilar a
    join auth.users u on lower(u.email) = a.email
    where a.email = lower(auth.jwt() ->> 'email')
      and u.id = auth.uid()
      and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false)
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Admin listesini yalnız adminler görür ve değiştirir. `(select …)`: politika başına bir kez hesaplanır.
create policy admin_kullanicilar_admin on public.admin_kullanicilar for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- İçerik: admin taslak dahil her satırı okur ve yazar (yayınlı okuma politikalarına ek, OR ile birleşir).
create policy sehirler_admin on public.sehirler for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy yerler_admin on public.yerler for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy geziler_admin on public.geziler for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy gezi_gunleri_admin on public.gezi_gunleri for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy gezi_duraklari_admin on public.gezi_duraklari for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy sehir_rehberi_admin on public.sehir_rehberi for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- İçerik fotoğrafları (`icerik/` kovası, herkese açık okuma #97): yükleme, değiştirme, silme yalnız admin.
create policy icerik_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'icerik' and (select public.is_admin()));
create policy icerik_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'icerik' and (select public.is_admin()))
  with check (bucket_id = 'icerik' and (select public.is_admin()));
create policy icerik_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'icerik' and (select public.is_admin()));
