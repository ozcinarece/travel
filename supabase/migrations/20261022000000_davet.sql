-- #137 Davetle katılma (uygulama + web), ilk açılış karşılaması, olay türleri.
--
-- Akış (PRD 3.10 → Tripmate 1/8):
--   /r/{token} → davet_ozeti(token): giriş gerektirmez, plan salt-okunur özet (günler + durak sayıları; Google verisi yok).
--   Giriş sonrası davetle_katil(token, kanal): üyelik; zaten üyeyse tekrar yazmaz. kanal 'web' ise landed_at boş kalır →
--   uygulama ilk açılışta davet_karsilama() ile o seyahate düşer, davet_karsilandi(trip) damgayı yazar.
--   Katılmamış kişi hiçbir listede görünmez (KK4): "davet bekliyor" satırı yok, üyelik yalnız katılınca yazılır.

alter table public.members
  add column if not exists joined_via text check (joined_via in ('web', 'app')),
  add column if not exists landed_at timestamptz;

-- Olay türleri (#110 listesine ek): davet_katildi (üyelik yazıldı; meta.kanal web|app). davet_paylasildi ve davet_acildi #110'da.
alter table public.olaylar drop constraint if exists olaylar_tur_check;
alter table public.olaylar add constraint olaylar_tur_check
  check (tur in ('gezi_goruntulendi', 'gezi_alindi', 'yer_eklendi', 'davet_paylasildi', 'davet_acildi', 'davet_katildi'));

-- Davet özeti (anon + authenticated): seyahat kimliği, ad, şehir, tarihler, davet eden, sayılar, gün başına durak sayısı.
-- Kullanıcı zaten üyeyse `uye` true. Token bilinmiyorsa null.
create or replace function public.davet_ozeti(token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'trip_id', t.id,
    'name', t.name,
    'city_label', t.city_label,
    'start_date', t.start_date,
    'end_date', t.end_date,
    'member_count', (select count(*) from public.members m where m.trip_id = t.id),
    'place_count', (select count(*) from public.places p where p.trip_id = t.id),
    'day_count', (select count(*) from public.days d where d.trip_id = t.id),
    'inviter_name', (select m.display_name from public.members m where m.trip_id = t.id and m.role = 'owner'),
    'uye', coalesce((select true from public.members m where m.trip_id = t.id and m.user_id = auth.uid()), false),
    'gunler', coalesce((
      select jsonb_agg(jsonb_build_object('index', d.index, 'date', d.date,
        'durak', (select count(*) from public.stops s where s.day_id = d.id)) order by d.index)
      from public.days d where d.trip_id = t.id), '[]'::jsonb)
  )
  from public.trips t
  where t.invite_token = token;
$$;

-- Katılım: oturum zorunlu (42501); token yoksa P0002. Ad: profil → sağlayıcı adı → 'Gezgin'. Zaten üyeyse satır değişmez.
create or replace function public.davetle_katil(token text, kanal text default 'app')
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  seyahat public.trips%rowtype;
  zaten boolean;
  ad text;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli' using errcode = '42501';
  end if;
  if kanal not in ('web', 'app') then
    raise exception 'kanal web ya da app' using errcode = '22023';
  end if;
  select * into seyahat from public.trips t where t.invite_token = token;
  if seyahat.id is null then
    raise exception 'davet geçersiz' using errcode = 'P0002';
  end if;
  zaten := exists (select 1 from public.members m where m.trip_id = seyahat.id and m.user_id = auth.uid());
  if not zaten then
    select coalesce(
      (select p.name from public.profiles p where p.id = auth.uid()),
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), ''),
      'Gezgin')
    into ad
    from auth.users u where u.id = auth.uid();
    insert into public.members (trip_id, user_id, guest, display_name, joined_via, landed_at)
    values (seyahat.id, auth.uid(), public.is_anonymous(), left(coalesce(ad, 'Gezgin'), 40), kanal,
            case when kanal = 'app' then now() end);
  end if;
  return jsonb_build_object(
    'trip_id', seyahat.id,
    'zaten_uye', zaten,
    'name', seyahat.name,
    'city_label', seyahat.city_label,
    'inviter_name', (select m.display_name from public.members m where m.trip_id = seyahat.id and m.role = 'owner'),
    'day_count', (select count(*) from public.days d where d.trip_id = seyahat.id),
    'place_count', (select count(*) from public.places p where p.trip_id = seyahat.id));
end;
$$;

-- Web'de katılıp uygulamayı sonradan açan: henüz "düşülmemiş" en yeni üyelik (KK2). Yoksa null.
create or replace function public.davet_karsilama()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'trip_id', t.id,
    'name', t.name,
    'city_label', t.city_label,
    'inviter_name', (select o.display_name from public.members o where o.trip_id = t.id and o.role = 'owner'),
    'day_count', (select count(*) from public.days d where d.trip_id = t.id),
    'place_count', (select count(*) from public.places p where p.trip_id = t.id))
  from public.members m join public.trips t on t.id = m.trip_id
  where m.user_id = auth.uid() and m.joined_via = 'web' and m.landed_at is null
  order by m.joined_at desc
  limit 1;
$$;

create or replace function public.davet_karsilandi(t uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.members set landed_at = now() where trip_id = t and user_id = auth.uid() and landed_at is null;
$$;

grant execute on function public.davet_ozeti(text) to anon, authenticated;
grant execute on function public.davetle_katil(text, text), public.davet_karsilama(), public.davet_karsilandi(uuid) to authenticated;
