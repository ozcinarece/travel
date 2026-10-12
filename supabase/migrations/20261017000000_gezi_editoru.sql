-- #107: backoffice gezi editörü — yayın zamanı (planlı yayın), türetilen sayılar, sıralama, fotoğraf listesi.

-- Durum: yayin=false → Taslak; yayin=true ve yayin_at > now() → Planlı; aksi Yayında.
alter table public.geziler
  add column yayin_at timestamptz,
  add column updated_at timestamptz not null default now();

create function public.updated_at_yaz() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger geziler_updated_at before update on public.geziler
  for each row execute function public.updated_at_yaz();

-- Planlı gezi zamanı gelene kadar uygulamada görünmez (gezi, günleri, durakları). Admin politikaları (#106) ayrı.
create function public.gezi_yayinda(p_gezi uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.geziler g join public.sehirler s on s.id = g.sehir_id
    where g.id = p_gezi and g.yayin and s.yayin and (g.yayin_at is null or g.yayin_at <= now())
  );
$$;

drop policy geziler_select on public.geziler;
drop policy gezi_gunleri_select on public.gezi_gunleri;
drop policy gezi_duraklari_select on public.gezi_duraklari;
create policy geziler_select on public.geziler for select to anon, authenticated
  using (yayin and (yayin_at is null or yayin_at <= now())
    and exists (select 1 from public.sehirler s where s.id = sehir_id and s.yayin));
create policy gezi_gunleri_select on public.gezi_gunleri for select to anon, authenticated
  using (public.gezi_yayinda(gezi_id));
create policy gezi_duraklari_select on public.gezi_duraklari for select to anon, authenticated
  using (exists (select 1 from public.gezi_gunleri gg where gg.id = gezi_gun_id and public.gezi_yayinda(gg.gezi_id)));

-- KK4: gun_sayisi ve mekan_sayisi gün/durak değişince türetilir (en az 1 gün: tablo kısıtı 1–30).
create function public.gezi_sayilarini_yaz(p_gezi uuid) returns void
language sql security definer set search_path = ''
as $$
  update public.geziler g set
    gun_sayisi = least(30, greatest(1, (select count(*) from public.gezi_gunleri gg where gg.gezi_id = p_gezi))),
    mekan_sayisi = (select count(*) from public.gezi_duraklari d join public.gezi_gunleri gg on gg.id = d.gezi_gun_id where gg.gezi_id = p_gezi)
  where g.id = p_gezi;
$$;
revoke execute on function public.gezi_sayilarini_yaz(uuid) from public, anon, authenticated;

create function public.gezi_gunleri_sayac() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then perform public.gezi_sayilarini_yaz(old.gezi_id); end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.gezi_id <> old.gezi_id) then perform public.gezi_sayilarini_yaz(new.gezi_id); end if;
  return null;
end;
$$;

create function public.gezi_duraklari_sayac() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.gezi_sayilarini_yaz(gg.gezi_id) from public.gezi_gunleri gg where gg.id = old.gezi_gun_id;
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.gezi_gun_id <> old.gezi_gun_id) then
    perform public.gezi_sayilarini_yaz(gg.gezi_id) from public.gezi_gunleri gg where gg.id = new.gezi_gun_id;
  end if;
  return null;
end;
$$;

create trigger gezi_gunleri_sayac after insert or delete or update of gezi_id on public.gezi_gunleri
  for each row execute function public.gezi_gunleri_sayac();
create trigger gezi_duraklari_sayac after insert or delete or update of gezi_gun_id on public.gezi_duraklari
  for each row execute function public.gezi_duraklari_sayac();

-- Sürükle-sırala: tekillik deyim sonunda denetlensin (tek UPDATE ile yer değiştirme).
alter table public.gezi_gunleri drop constraint gezi_gunleri_gezi_id_sira_key,
  add constraint gezi_gunleri_gezi_id_sira_key unique (gezi_id, sira) deferrable initially immediate;
alter table public.gezi_duraklari drop constraint gezi_duraklari_gezi_gun_id_sira_key,
  add constraint gezi_duraklari_gezi_gun_id_sira_key unique (gezi_gun_id, sira) deferrable initially immediate;

-- Verilen sırayı 1..n olarak yazar. security invoker: RLS uygulanır (yalnız admin günceller).
create function public.gezi_gunleri_sirala(p_gezi uuid, p_idler uuid[]) returns void
language sql security invoker set search_path = ''
as $$
  update public.gezi_gunleri g set sira = x.n
  from unnest(p_idler) with ordinality as x(id, n)
  where g.id = x.id and g.gezi_id = p_gezi;
$$;

create function public.gezi_duraklari_sirala(p_gun uuid, p_idler uuid[]) returns void
language sql security invoker set search_path = ''
as $$
  update public.gezi_duraklari d set sira = x.n
  from unnest(p_idler) with ordinality as x(id, n)
  where d.id = x.id and d.gezi_gun_id = p_gun;
$$;

-- KK5: içerik fotoğrafları (`icerik/` kovasındaki dosya + altyazı); gezi ve yer (#108) ortak. Herkes okur, admin yazar.
create table public.icerik_fotolari (
  yol text primary key check (yol ~ '^(geziler|yerler)/[0-9a-f-]{36}/[^/]+$'),
  sahip_tur text not null check (sahip_tur in ('gezi', 'yer')),
  sahip_id uuid not null,
  altyazi text check (altyazi is null or char_length(altyazi) <= 200),
  sira integer not null default 0,
  created_at timestamptz not null default now(),
  check (split_part(yol, '/', 2)::uuid = sahip_id and split_part(yol, '/', 1) = case sahip_tur when 'gezi' then 'geziler' else 'yerler' end)
);
create index icerik_fotolari_sahip_idx on public.icerik_fotolari (sahip_tur, sahip_id, sira);

alter table public.icerik_fotolari enable row level security;
create policy icerik_fotolari_select on public.icerik_fotolari for select to anon, authenticated using (true);
create policy icerik_fotolari_admin on public.icerik_fotolari for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
