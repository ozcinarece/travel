-- #183 Harcamalar (kanvas 25 · 25b · 25c): harcama, kişi payları, ödeşme; IBAN (yalnız seyahat arkadaşları görür); fiş kovası.
--
-- Tutarlar kuruş (bigint). Döviz harcaması kayıt anındaki kurla ₺'ye çevrilir (tl_kurus); paylar ve bakiyeler ₺ kuruşudur ve
-- bir harcamanın payları toplamı tl_kurus'a eşittir (ertelenmiş kısıt: harcama ve payları aynı işlemde yazılır —
-- harcama_kaydet). Kişi sütunları (ödeyen, pay sahibi, ödeşme tarafları) auth.users'a bağlı değildir: seyahatten ayrılan ya da
-- hesabını silen birinin harcaması ve payı kalır, kimsenin bakiyesi kendiliğinden değişmez. Yazarken kişinin o an seyahat üyesi
-- olduğu denetlenir; ayrılan biriyle kalan borç yine ödeşilebilir. Paylar yalnız harcama_kaydet'le yazılır (doğrudan yazım yok);
-- harcamanın doğrudan güncellenmesi de "Son değişiklikler" akışına düşer.

-- ---------------------------------------------------------------- tablolar

create table public.harcamalar (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  aciklama text not null default '' check (char_length(aciklama) <= 80),
  tutar_kurus bigint not null check (tutar_kurus > 0),
  -- ISO 4217.
  para_birimi text not null default 'TRY' check (para_birimi ~ '^[A-Z]{3}$'),
  tl_kurus bigint not null check (tl_kurus > 0),
  kategori text not null default 'diger' check (kategori in ('yemek', 'ulasim', 'konaklama', 'bilet', 'diger')),
  odeyen_id uuid not null,
  -- Durağa bağlı harcama; durak silinince bağ boşalır.
  stop_id uuid references public.stops (id) on delete set null,
  -- Storage: fisler/{trip_id}/… (yalnız üyeler).
  fis_yolu text check (char_length(fis_yolu) <= 200),
  olusturan uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint try_karsiligi check (para_birimi <> 'TRY' or tl_kurus = tutar_kurus),
  -- Fiş yalnız bu seyahatin klasöründen.
  constraint fis_klasoru check (fis_yolu is null or fis_yolu like trip_id::text || '/%'),
  unique (id, trip_id)
);

create index harcamalar_trip_idx on public.harcamalar (trip_id, created_at desc);
create index harcamalar_stop_idx on public.harcamalar (stop_id) where stop_id is not null;

create table public.harcama_paylari (
  harcama_id uuid not null,
  trip_id uuid not null,
  user_id uuid not null,
  pay_kurus bigint not null check (pay_kurus >= 0),
  primary key (harcama_id, user_id),
  foreign key (harcama_id, trip_id) references public.harcamalar (id, trip_id) on delete cascade
);

create index harcama_paylari_trip_idx on public.harcama_paylari (trip_id);

-- "Ödendi işaretle" / "Ödedim": kimden → kime, ₺ kuruş.
create table public.odesmeler (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kimden uuid not null,
  kime uuid not null,
  tl_kurus bigint not null check (tl_kurus > 0),
  olusturan uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint kendine_degil check (kimden <> kime)
);

create index odesmeler_trip_idx on public.odesmeler (trip_id, created_at desc);

-- KK7: IBAN profil ayarlarından girilir; profiles herkese açık olduğu için ayrı tablo. Okuyabilen: sahibi ve açık borcun karşı
-- tarafı (aynı seyahatin şimdiki üyesi, misafir değil, o seyahatte borçlu; IBAN sahibi alacaklı).
-- Boşluksuz, büyük harf saklanır (uygulama biçimler ve mod-97 ile denetler).
create table public.odeme_bilgileri (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  iban text not null check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- yardımcılar

-- Çağıran o seyahatin üyesiyse: u da üye mi? (Üye olmayan çağırana hep false — üyelik sorgulanamaz.)
create or replace function public.seyahat_uyesi_mi(t uuid, u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_member(t) and exists (select 1 from public.members m where m.trip_id = t and m.user_id = u);
$$;

-- Harcamayı (ve paylarını) yalnız ekleyen ya da seyahat sahibi düzenler/siler.
create or replace function public.harcamayi_duzenler(h uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.harcamalar x
    where x.id = h and public.is_member(x.trip_id) and (x.olusturan = auth.uid() or public.is_owner(x.trip_id))
  );
$$;

-- Kişinin seyahatteki net bakiyesi (₺ kuruş): + alacaklı, − borçlu. Ödeyen harcamanın tamamını alacaklanır, pay sahibi payı kadar
-- borçlanır; ödeşmede veren alacaklanır, alan borçlanır (uygulamadaki netBakiyeler ile aynı).
create or replace function public.seyahat_net(t uuid, u uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce((select sum(h.tl_kurus) from public.harcamalar h where h.trip_id = t and h.odeyen_id = u), 0)
       - coalesce((select sum(p.pay_kurus) from public.harcama_paylari p where p.trip_id = t and p.user_id = u), 0)
       + coalesce((select sum(o.tl_kurus) from public.odesmeler o where o.trip_id = t and o.kimden = u), 0)
       - coalesce((select sum(o.tl_kurus) from public.odesmeler o where o.trip_id = t and o.kime = u), 0);
$$;

-- Seyahatin hesabında adı geçen biri mi (ayrılmış olsa da): ödeyen, pay sahibi ya da ödeşme tarafı.
create or replace function public.seyahat_hesabinda(t uuid, u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.harcamalar h where h.trip_id = t and h.odeyen_id = u)
      or exists (select 1 from public.harcama_paylari p where p.trip_id = t and p.user_id = u)
      or exists (select 1 from public.odesmeler o where o.trip_id = t and u in (o.kimden, o.kime));
$$;

-- IBAN'ı görebilir mi: çağıran misafir değil ve u ile birlikte şimdiki üyesi olduğu bir seyahatte çağıran borçlu, u alacaklı.
create or replace function public.iban_gorebilir(u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not public.is_anonymous() and exists (
    select 1 from public.members a join public.members b on b.trip_id = a.trip_id
    where a.user_id = auth.uid() and b.user_id = u
      and public.seyahat_net(a.trip_id, auth.uid()) < 0 and public.seyahat_net(a.trip_id, u) > 0
  );
$$;

-- fisler/{trip_id}/dosya: klasör bir seyahat kimliğiyse ve çağıran üyeyse.
create or replace function public.fis_seyahat_uyesi(yol text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when (storage.foldername(yol))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_member(((storage.foldername(yol))[1])::uuid)
    else false
  end;
$$;

-- fisler/{trip_id}/dosya'yı silebilir mi: yükleyen ya da seyahatin sahibi (fişte kart bilgisi olabilir).
create or replace function public.fis_silebilir(yol text, sahip text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.fis_seyahat_uyesi(yol) and (
    sahip = auth.uid()::text
    or case
      when (storage.foldername(yol))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.is_owner(((storage.foldername(yol))[1])::uuid)
      else false
    end
  );
$$;

-- ---------------------------------------------------------------- tetikleyiciler

-- Doğrudan yazımda (istemci): ödeyen o an üye olmalı; durak aynı seyahatin durağı olmalı; oluşturan ve seyahat değişmez; her
-- güncelleme updated_at'i ilerletir — böylece akışa düşer (ödeyen sessizce değişmez). harcama_kaydet tanımlayıcı yetkiyle çalışır,
-- aynı denetimleri kendisi yapar.
create or replace function public.harcamalar_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if not public.is_member(new.trip_id) then
      raise exception 'seyahat bulunamadı' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.trip_id <> old.trip_id or new.olusturan is distinct from old.olusturan) then
      raise exception 'trip_id ve olusturan değiştirilemez' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      new.updated_at := now();
    end if;
    if (tg_op = 'INSERT' or new.odeyen_id <> old.odeyen_id) and not public.seyahat_uyesi_mi(new.trip_id, new.odeyen_id) then
      raise exception 'ödeyen seyahatte değil' using errcode = '22023';
    end if;
    if new.stop_id is not null and (tg_op = 'INSERT' or new.stop_id is distinct from old.stop_id)
       and not exists (select 1 from public.stops s where s.id = new.stop_id and s.trip_id = new.trip_id) then
      raise exception 'durak bu seyahatte değil' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger harcamalar_guard
before insert or update on public.harcamalar
for each row execute function public.harcamalar_guard();

-- Paylara istemci doğrudan yazamaz (yetki yok); bu tetikleyici yalnız ek bir savunma: yeni pay sahibi o an üye olmalı.
create or replace function public.harcama_paylari_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' and (new.harcama_id <> old.harcama_id or new.user_id <> old.user_id or new.trip_id <> old.trip_id) then
      raise exception 'pay sahibi değiştirilemez' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' and not public.seyahat_uyesi_mi(new.trip_id, new.user_id) then
      raise exception 'pay sahibi seyahatte değil' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger harcama_paylari_guard
before insert or update on public.harcama_paylari
for each row execute function public.harcama_paylari_guard();

-- Ödeşme: çağıran üye ve taraflardan biri; karşı taraf ya üye ya da bu seyahatin hesabında adı geçen biri (ayrılan biriyle kalan
-- borç da kapanır). Tutar açık borcu aşamaz: veren o kadar borçlu, alan o kadar alacaklı olmalı.
create or replace function public.odesmeler_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if not public.is_member(new.trip_id) or auth.uid() is null or auth.uid() not in (new.kimden, new.kime) then
      raise exception 'ödeşmeyi yalnız iki taraftan biri işaretler' using errcode = '42501';
    end if;
    -- Kendine ödeşme kendine_degil kısıtıyla reddedilir.
    if new.kimden = new.kime then
      return new;
    end if;
    if not (public.seyahat_uyesi_mi(new.trip_id, new.kimden) or public.seyahat_hesabinda(new.trip_id, new.kimden))
       or not (public.seyahat_uyesi_mi(new.trip_id, new.kime) or public.seyahat_hesabinda(new.trip_id, new.kime)) then
      raise exception 'ödeşmenin tarafı bu seyahatte değil' using errcode = '22023';
    end if;
    if -public.seyahat_net(new.trip_id, new.kimden) < new.tl_kurus or public.seyahat_net(new.trip_id, new.kime) < new.tl_kurus then
      raise exception 'ödeşme açık borcu aşıyor' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger odesmeler_guard
before insert on public.odesmeler
for each row execute function public.odesmeler_guard();

-- Payların toplamı = harcamanın ₺ karşılığı. İşlem sonunda (ertelenmiş) denetlenir; harcama silindiyse denetlenecek bir şey yok.
create or replace function public.harcama_toplami_denetle()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  satir jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  h uuid := case when tg_table_name = 'harcamalar' then (satir ->> 'id')::uuid else (satir ->> 'harcama_id')::uuid end;
  tl bigint;
  toplam bigint;
begin
  select x.tl_kurus into tl from public.harcamalar x where x.id = h;
  if tl is null then
    return null;
  end if;
  select coalesce(sum(p.pay_kurus), 0) into toplam from public.harcama_paylari p where p.harcama_id = h;
  if toplam <> tl then
    raise exception 'payların toplamı harcamaya eşit olmalı (% ≠ %)', toplam, tl using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger harcamalar_toplam
after insert or update of tl_kurus on public.harcamalar
deferrable initially deferred
for each row execute function public.harcama_toplami_denetle();

create constraint trigger harcama_paylari_toplam
after insert or update or delete on public.harcama_paylari
deferrable initially deferred
for each row execute function public.harcama_toplami_denetle();

-- Değişiklik akışı ("Son değişiklikler · Geri al"). Harcama güncellemesi updated_at ilerleyince kaydedilir (harcama_kaydet ve
-- istemcinin doğrudan güncellemesi — tetikleyici ilerletir); durak silinince bağın boşalması (FK) akışa düşmez.
create trigger harcamalar_log_ekle_sil after insert or delete on public.harcamalar for each row execute function public.log_change();
create trigger harcamalar_log_degistir after update on public.harcamalar
  for each row when (old.updated_at is distinct from new.updated_at) execute function public.log_change();
create trigger odesmeler_log after insert or delete on public.odesmeler for each row execute function public.log_change();

-- Paylar: entity_id = harcama kimliği (aynı işlemdeki harcama satırıyla birlikte geri alınır); satırın tamamı yazılır.
create or replace function public.harcama_paylari_log()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  eski jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  yeni jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  satir jsonb := coalesce(yeni, eski);
  seyahat uuid := (satir ->> 'trip_id')::uuid;
  kim uuid := (select u.id from auth.users u where u.id = auth.uid());
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.trips where id = seyahat) then
    return old;
  end if;
  if tg_op = 'UPDATE' and eski = yeni then
    return new;
  end if;
  insert into public.changes (trip_id, user_id, entity, entity_id, field, old, new)
  values (seyahat, kim, 'harcama_paylari', satir ->> 'harcama_id', case when tg_op = 'UPDATE' then 'pay_kurus' end, eski, yeni);
  return coalesce(new, old);
end;
$$;

create trigger harcama_paylari_log after insert or update or delete on public.harcama_paylari
  for each row execute function public.harcama_paylari_log();

-- ---------------------------------------------------------------- RPC'ler

-- KK4: harcama ve payları tek işlemde — payların tek yazım yolu. Tanımlayıcı yetkiyle çalışır, yetki içeride: üye; düzenlemede
-- ekleyen ya da sahip. p_id boşsa yeni harcama. p_paylar: [{"user_id": …, "pay_kurus": …}] (₺ kuruş; sıfır paylar yazılmaz).
-- Ödeyen (yeni ya da değiştiyse) ve yeni pay sahipleri o an üye olmalı (ayrılmış birinin var olan payı kalabilir). Listede olmayan
-- eski paylar silinir; değişmeyen pay yeniden yazılmaz. Toplam kısıtı işlev sonunda denetlenir (hata çağırana döner).
create or replace function public.harcama_kaydet(
  p_trip_id uuid,
  p_id uuid,
  p_aciklama text,
  p_tutar_kurus bigint,
  p_para_birimi text,
  p_tl_kurus bigint,
  p_kategori text,
  p_odeyen uuid,
  p_stop_id uuid,
  p_fis_yolu text,
  p_paylar jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  kimlik uuid := p_id;
  kisi record;
  eski public.harcamalar;
begin
  if auth.uid() is null or not public.is_member(p_trip_id) then
    raise exception 'seyahat bulunamadı' using errcode = '42501';
  end if;
  if kimlik is not null then
    select * into eski from public.harcamalar where id = kimlik and trip_id = p_trip_id;
    if eski.id is null or not public.harcamayi_duzenler(kimlik) then
      raise exception 'harcamayı yalnız ekleyen ya da sahip düzenler' using errcode = '42501';
    end if;
  end if;
  if (kimlik is null or p_odeyen is distinct from eski.odeyen_id) and not public.seyahat_uyesi_mi(p_trip_id, p_odeyen) then
    raise exception 'ödeyen seyahatte değil' using errcode = '22023';
  end if;
  if p_stop_id is not null and (kimlik is null or p_stop_id is distinct from eski.stop_id)
     and not exists (select 1 from public.stops s where s.id = p_stop_id and s.trip_id = p_trip_id) then
    raise exception 'durak bu seyahatte değil' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(p_paylar) = 'array' then p_paylar else '[]'::jsonb end) e
    where (e ->> 'pay_kurus')::bigint > 0
      and not public.seyahat_uyesi_mi(p_trip_id, (e ->> 'user_id')::uuid)
      and not exists (select 1 from public.harcama_paylari p where p.harcama_id = kimlik and p.user_id = (e ->> 'user_id')::uuid)
  ) then
    raise exception 'pay sahibi seyahatte değil' using errcode = '22023';
  end if;
  if jsonb_typeof(p_paylar) is distinct from 'array'
     or not exists (select 1 from jsonb_array_elements(p_paylar) e where (e ->> 'pay_kurus')::bigint > 0) then
    raise exception 'harcama en az bir kişiye bölünür' using errcode = '22023';
  end if;

  if kimlik is null then
    insert into public.harcamalar (trip_id, aciklama, tutar_kurus, para_birimi, tl_kurus, kategori, odeyen_id, stop_id, fis_yolu, olusturan)
    values (p_trip_id, trim(coalesce(p_aciklama, '')), p_tutar_kurus, coalesce(p_para_birimi, 'TRY'), p_tl_kurus,
            coalesce(p_kategori, 'diger'), p_odeyen, p_stop_id, p_fis_yolu, auth.uid())
    returning id into kimlik;
  else
    update public.harcamalar
    set aciklama = trim(coalesce(p_aciklama, '')), tutar_kurus = p_tutar_kurus, para_birimi = coalesce(p_para_birimi, 'TRY'),
        tl_kurus = p_tl_kurus, kategori = coalesce(p_kategori, 'diger'), odeyen_id = p_odeyen, stop_id = p_stop_id,
        fis_yolu = p_fis_yolu, updated_at = now()
    where id = kimlik and trip_id = p_trip_id;
  end if;

  delete from public.harcama_paylari p
  where p.harcama_id = kimlik
    and not exists (
      select 1 from jsonb_array_elements(p_paylar) e where (e ->> 'user_id')::uuid = p.user_id and (e ->> 'pay_kurus')::bigint > 0
    );
  for kisi in
    select (e ->> 'user_id')::uuid as uid, (e ->> 'pay_kurus')::bigint as pay
    from jsonb_array_elements(p_paylar) e
    where (e ->> 'pay_kurus')::bigint > 0
  loop
    insert into public.harcama_paylari (harcama_id, trip_id, user_id, pay_kurus)
    values (kimlik, p_trip_id, kisi.uid, kisi.pay)
    on conflict (harcama_id, user_id) do update set pay_kurus = excluded.pay_kurus
      where public.harcama_paylari.pay_kurus <> excluded.pay_kurus;
  end loop;

  set constraints public.harcamalar_toplam, public.harcama_paylari_toplam immediate;
  set constraints public.harcamalar_toplam, public.harcama_paylari_toplam deferred;
  return kimlik;
end;
$$;

revoke all on function public.harcama_kaydet(uuid, uuid, text, bigint, text, bigint, text, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.harcama_kaydet(uuid, uuid, text, bigint, text, bigint, text, uuid, uuid, text, jsonb) to authenticated;

-- #141 KK6 geri al, #183 ile genişler: harcama (ekleme silinir; silme payları ile geri yazılır; düzenleme alanları ve aynı
-- işlemdeki pay değişiklikleri geri döner — yalnız ekleyen ya da sahip) ve ödeşme (ekleme silinir, silme geri yazılır — yalnız
-- iki taraftan biri). Plan verisi bölümü değişmedi.
create or replace function public.degisikligi_geri_al(c bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d public.changes;
  eski jsonb;
  setler text;
  sutunlar text;
  r record;
  izinli text[];
  ekleyen uuid;
  h uuid;
  hr public.harcamalar;
  satir jsonb;
begin
  select * into d from public.changes where id = c;
  if d.id is null then
    raise exception 'değişiklik yok' using errcode = 'P0002';
  end if;
  if not public.is_member(d.trip_id) or public.is_anonymous() then
    raise exception 'yetki yok' using errcode = '42501';
  end if;

  if d.entity = 'harcamalar' then
    h := d.entity_id::uuid;
    ekleyen := coalesce((select x.olusturan from public.harcamalar x where x.id = h), (coalesce(d.old, d.new) ->> 'olusturan')::uuid);
    if auth.uid() is distinct from ekleyen and not public.is_owner(d.trip_id) then
      raise exception 'harcamayı yalnız ekleyen ya da sahip değiştirir' using errcode = '42501';
    end if;
    if d.field is null and d.old is null then
      delete from public.harcamalar where id = h and trip_id = d.trip_id;
    elsif d.field is null then
      hr := jsonb_populate_record(null::public.harcamalar, d.old);
      if hr.stop_id is not null and not exists (select 1 from public.stops s where s.id = hr.stop_id) then
        hr.stop_id := null;
      end if;
      -- Ekleyenin hesabı silinmişse oluşturan boş; fiş dosyası harcama silinirken silindiği için bağ da boş.
      if hr.olusturan is not null and not exists (select 1 from auth.users u where u.id = hr.olusturan) then
        hr.olusturan := null;
      end if;
      hr.fis_yolu := null;
      insert into public.harcamalar select hr.* on conflict do nothing;
      insert into public.harcama_paylari
        select (jsonb_populate_record(null::public.harcama_paylari, x.old)).*
        from public.changes x
        where x.trip_id = d.trip_id and x.at = d.at and x.entity = 'harcama_paylari' and x.entity_id = d.entity_id and x.new is null
      on conflict do nothing;
    else
      if not exists (select 1 from public.harcamalar x where x.id = h and x.trip_id = d.trip_id) then
        raise exception 'geri alınamaz' using errcode = '22023';
      end if;
      select jsonb_object_agg(x.field, x.old), string_agg(format('%I = (y.r).%I', x.field, x.field), ', ')
        into eski, setler
        from public.changes x
        where x.trip_id = d.trip_id and x.entity = 'harcamalar' and x.entity_id = d.entity_id and x.at = d.at
          and x.field = any (array['aciklama', 'tutar_kurus', 'para_birimi', 'tl_kurus', 'kategori', 'odeyen_id', 'stop_id', 'fis_yolu']);
      if eski ? 'stop_id' and eski ->> 'stop_id' is not null
         and not exists (select 1 from public.stops s where s.id = (eski ->> 'stop_id')::uuid) then
        eski := jsonb_set(eski, '{stop_id}', 'null'::jsonb);
      end if;
      execute format('update public.harcamalar t set %s updated_at = now() from (select jsonb_populate_record(null::public.harcamalar, $1) as r) y where t.id = $2 and t.trip_id = $3',
                     coalesce(setler || ',', ''))
        using coalesce(eski, '{}'::jsonb), h, d.trip_id;
      -- Aynı işlemdeki pay değişiklikleri sondan başa geri alınır.
      for r in
        select x.old, x.new from public.changes x
        where x.trip_id = d.trip_id and x.at = d.at and x.entity = 'harcama_paylari' and x.entity_id = d.entity_id
        order by x.id desc
      loop
        if r.old is null then
          delete from public.harcama_paylari where harcama_id = h and user_id = (r.new ->> 'user_id')::uuid;
        elsif r.new is null then
          insert into public.harcama_paylari select (jsonb_populate_record(null::public.harcama_paylari, r.old)).* on conflict do nothing;
        else
          update public.harcama_paylari set pay_kurus = (r.old ->> 'pay_kurus')::bigint
          where harcama_id = h and user_id = (r.old ->> 'user_id')::uuid;
        end if;
      end loop;
    end if;
    return;
  end if;

  if d.entity = 'odesmeler' then
    satir := coalesce(d.old, d.new);
    if auth.uid() is distinct from (satir ->> 'kimden')::uuid and auth.uid() is distinct from (satir ->> 'kime')::uuid then
      raise exception 'ödeşmeyi yalnız iki taraf değiştirir' using errcode = '42501';
    end if;
    if d.old is null then
      delete from public.odesmeler where id = d.entity_id::uuid and trip_id = d.trip_id;
    else
      insert into public.odesmeler
        select o.id, o.trip_id, o.kimden, o.kime, o.tl_kurus,
               case when exists (select 1 from auth.users u where u.id = o.olusturan) then o.olusturan end, o.created_at
        from jsonb_populate_record(null::public.odesmeler, d.old) o
      on conflict do nothing;
    end if;
    return;
  end if;

  if d.field is not null then
    -- Geri alınabilir alanlar (beyaz liste); varış / tamamlama / kimlik alanları geri alınmaz.
    izinli := case d.entity
      when 'places' then array['note', 'default_minutes']
      when 'stops' then array['day_id', 'order_key', 'minutes', 'skipped']
      when 'days' then array['start_time', 'end_time', 'order_manual', 'start_stay_id', 'end_stay_id']
    end;
    if izinli is null then
      raise exception 'geri alınamaz' using errcode = '22023';
    end if;
    select jsonb_object_agg(x.field, x.old), string_agg(format('%I = (y.r).%I', x.field, x.field), ', ')
      into eski, setler
      from public.changes x
      where x.trip_id = d.trip_id and x.entity = d.entity and x.entity_id = d.entity_id and x.at = d.at
        and x.field = any (izinli);
    if setler is null then
      raise exception 'geri alınamaz' using errcode = '22023';
    end if;
    -- PRD 3.8 KK3: notu yalnız ekleyen ya da sahip değiştirir; tanımlayıcı yetkiyle çalışıldığı için places_guard burada
    -- devreye girmez, aynı kural burada uygulanır.
    if d.entity = 'places' and eski ? 'note' then
      select p.added_by into ekleyen from public.places p where p.id = d.entity_id::uuid and p.trip_id = d.trip_id;
      if auth.uid() is distinct from ekleyen and not public.is_owner(d.trip_id) then
        raise exception 'notu yalnızca ekleyen ya da sahip düzenler' using errcode = '42501';
      end if;
    end if;
    execute format('update public.%I t set %s from (select jsonb_populate_record(null::public.%I, $1) as r) y where t.id = $2 and t.trip_id = $3',
                   d.entity, setler, d.entity)
      using eski, d.entity_id::uuid, d.trip_id;
  elsif d.old is null then
    if d.entity not in ('places', 'stops') then
      raise exception 'geri alınamaz' using errcode = '22023';
    end if;
    execute format('delete from public.%I where id = $1 and trip_id = $2', d.entity) using d.entity_id::uuid, d.trip_id;
  else
    if d.entity not in ('places', 'stops') then
      raise exception 'geri alınamaz' using errcode = '22023';
    end if;
    -- Önce mekanlar, sonra aynı işlemde silinen duraklar (mekan silinince durağı da gider). Yalnız kayıtta olan sütunlar
    -- yazılır; sonradan eklenen NOT NULL sütunlar (ör. stops.auto_completed) tablo varsayılanını alır.
    for r in
      select x.entity, x.old from public.changes x
      where x.trip_id = d.trip_id and x.at = d.at and x.field is null and x.new is null and x.entity in ('places', 'stops')
        and x.old ->> 'trip_id' = d.trip_id::text
      order by case x.entity when 'places' then 0 else 1 end, x.id
    loop
      select string_agg(format('%I', a.attname), ', ' order by a.attnum) into sutunlar
        from pg_catalog.pg_attribute a
        where a.attrelid = format('public.%I', r.entity)::regclass and a.attnum > 0 and not a.attisdropped and r.old ? a.attname;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
                     r.entity, sutunlar, sutunlar, r.entity)
        using r.old;
    end loop;
  end if;
end;
$$;

revoke execute on function public.degisikligi_geri_al(bigint) from public, anon;
grant execute on function public.degisikligi_geri_al(bigint) to authenticated;

revoke execute on function public.seyahat_uyesi_mi(uuid, uuid), public.harcamayi_duzenler(uuid), public.seyahat_net(uuid, uuid),
  public.seyahat_hesabinda(uuid, uuid), public.iban_gorebilir(uuid), public.fis_seyahat_uyesi(text), public.fis_silebilir(text, text) from public, anon;
grant execute on function public.seyahat_uyesi_mi(uuid, uuid), public.harcamayi_duzenler(uuid), public.seyahat_net(uuid, uuid),
  public.seyahat_hesabinda(uuid, uuid), public.iban_gorebilir(uuid), public.fis_seyahat_uyesi(text), public.fis_silebilir(text, text) to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.harcamalar enable row level security;
alter table public.harcama_paylari enable row level security;
alter table public.odesmeler enable row level security;
alter table public.odeme_bilgileri enable row level security;

-- Seyahat üyesi okur ve ekler; harcamayı ekleyen ya da sahip düzenler/siler.
create policy harcamalar_select on public.harcamalar for select to authenticated using (public.is_member(trip_id));
create policy harcamalar_insert on public.harcamalar for insert to authenticated
  with check (public.is_member(trip_id) and olusturan = auth.uid());
create policy harcamalar_update on public.harcamalar for update to authenticated
  using (public.is_member(trip_id) and (olusturan = auth.uid() or public.is_owner(trip_id)))
  with check (public.is_member(trip_id));
create policy harcamalar_delete on public.harcamalar for delete to authenticated
  using (public.is_member(trip_id) and (olusturan = auth.uid() or public.is_owner(trip_id)));

-- Paylar yalnız okunur; yazım harcama_kaydet'le (tek işlem, akışa düşer). Harcama silinince paylar cascade ile gider.
create policy harcama_paylari_select on public.harcama_paylari for select to authenticated using (public.is_member(trip_id));
revoke insert, update, delete on public.harcama_paylari from authenticated, anon;

-- Ödeşmeyi kimden ya da kime olan işaretler ve siler (düzenleme yok).
create policy odesmeler_select on public.odesmeler for select to authenticated using (public.is_member(trip_id));
create policy odesmeler_insert on public.odesmeler for insert to authenticated
  with check (public.is_member(trip_id) and olusturan = auth.uid() and auth.uid() in (kimden, kime));
create policy odesmeler_delete on public.odesmeler for delete to authenticated
  using (public.is_member(trip_id) and auth.uid() in (kimden, kime));
revoke update on public.odesmeler from authenticated;

create policy odeme_bilgileri_select on public.odeme_bilgileri for select to authenticated
  using (user_id = auth.uid() or public.iban_gorebilir(user_id));
create policy odeme_bilgileri_insert on public.odeme_bilgileri for insert to authenticated with check (user_id = auth.uid());
create policy odeme_bilgileri_update on public.odeme_bilgileri for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy odeme_bilgileri_delete on public.odeme_bilgileri for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- Storage: fiş fotoğrafları (özel kova)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fisler', 'fisler', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy fisler_select on storage.objects for select to authenticated
  using (bucket_id = 'fisler' and public.fis_seyahat_uyesi(name));
create policy fisler_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fisler' and public.fis_seyahat_uyesi(name));
-- Silme: yükleyen ya da seyahatin sahibi.
create policy fisler_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fisler' and public.fis_silebilir(name, owner_id));

-- ---------------------------------------------------------------- Realtime

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.harcamalar, public.harcama_paylari, public.odesmeler;
  end if;
end;
$$;
