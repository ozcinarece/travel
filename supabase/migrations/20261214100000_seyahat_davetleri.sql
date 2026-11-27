-- #573 Uygulama içi davet: Davetler kutusu (UX önerileri kanvası, "Uygulama içi davet (#573)"; not `nDavet1`).
-- Yeni tablo: seyahat_davetleri. Veri silme yok; Google'a istek yok.
-- KK1: satırda davet eden, davet edilen, seyahat ve durum (`bekliyor` | `katildi` | `reddetti` | `iptal`).
--   - Satırı yalnız davet eden ve davet edilen görür (select kuralı).
--   - Davet yalnız ortak seyahat geçmişi olan kişiye: şu an başka bir seyahatin ortak üyesi (`birlikte_gezdik`, #407 ile aynı
--     küme, v11 "Kimlerle?" yuvarlakları `arkadaslarim()`'dan gelir). Sunucuda `davet_gonder` denetler.
--   - İstemci tabloya doğrudan yazamaz (yalnız select izni). Davet `davet_gonder` ile oluşur; durumu yalnız davet edilen
--     `davete_katil` / `daveti_reddet` ile değiştirir.
--   - Aynı kişi aynı seyahate en çok bir bekleyen davet alır (kısmi tekil dizin).
-- KK4: Katıl, davet linkiyle katılmanın üyelik yolunu (`davetle_katil`, #137) aynen kullanır. Hayır yalnız durumu yazar;
--   davet edene bildirim yok (KK6).
-- Misafir (anonim) oturum davet gönderemez, alamaz, kutuyu görmez.
-- #605 inceleme 1: bekleyen davet üyeliğe ikinci bir kapı olmasın (çıkarılan kişi eski davetle geri girmesin).
--   - Kişi herhangi bir yoldan (link, davet, sahip devri…) üye olunca o seyahatteki bekleyen davetleri `katildi` olur.
--   - Link yenilenince (`rotate_invite_token`) seyahatin bütün bekleyen davetleri `iptal` olur.
--   - Üye çıkınca (sahip çıkarır ya da kendisi ayrılır) ona gelen ve onun gönderdiği bekleyen davetler `iptal` olur.
--   Tetikleyiciler yalnız `bekliyor` satırın durumunu değiştirir; satır silinmez.

create table public.seyahat_davetleri (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  davet_eden uuid not null references auth.users (id) on delete cascade,
  davet_edilen uuid not null references auth.users (id) on delete cascade,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'katildi', 'reddetti', 'iptal')),
  created_at timestamptz not null default now(),
  yanitlandi timestamptz,
  constraint kendine_davet_yok check (davet_eden <> davet_edilen)
);
create unique index seyahat_davetleri_tek_bekleyen on public.seyahat_davetleri (trip_id, davet_edilen) where durum = 'bekliyor';
create index seyahat_davetleri_edilen on public.seyahat_davetleri (davet_edilen) where durum = 'bekliyor';
create index seyahat_davetleri_eden on public.seyahat_davetleri (davet_eden);

alter table public.seyahat_davetleri enable row level security;
revoke all on public.seyahat_davetleri from public, anon, authenticated;
grant select on public.seyahat_davetleri to authenticated;
create policy seyahat_davetleri_select on public.seyahat_davetleri for select to authenticated
  using (davet_eden = auth.uid() or davet_edilen = auth.uid());

-- KK1: davet oluşturma (#574 "Geziyi oluştur" çağırır). Davet eden seyahatin üyesi, misafir değil. Her kişi: ben değil, hesabı
-- misafir değil, seyahatte henüz üye değil ve benimle ortak seyahat geçmişi var; biri tutmazsa hiçbiri yazılmaz (42501).
-- Zaten bekleyen davet varsa yeni satır yazılmaz. En çok 20 kişi. Dönen: yeni yazılan davet sayısı.
create function public.davet_gonder(p_trip uuid, p_kisiler uuid[]) returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  k uuid;
  yazilan integer := 0;
  n integer;
begin
  if auth.uid() is null or public.is_anonymous() then
    raise exception 'oturum gerekli' using errcode = '42501';
  end if;
  if p_trip is null or not public.is_member(p_trip) then
    raise exception 'seyahat yok' using errcode = '42501';
  end if;
  if p_kisiler is null or cardinality(p_kisiler) = 0 then
    return 0;
  end if;
  if cardinality(p_kisiler) > 20 then
    raise exception 'en çok 20 kişi' using errcode = '22023';
  end if;
  foreach k in array (select array_agg(distinct x) from unnest(p_kisiler) x) loop
    if k is null or k = auth.uid()
      or exists (select 1 from public.members m where m.trip_id = p_trip and m.user_id = k) then
      continue;
    end if;
    if not exists (select 1 from auth.users u where u.id = k and not coalesce(u.is_anonymous, false))
      or not public.birlikte_gezdik(k) then
      raise exception 'davet yalnız birlikte gezdiğin kişiye' using errcode = '42501';
    end if;
    insert into public.seyahat_davetleri (trip_id, davet_eden, davet_edilen)
    values (p_trip, auth.uid(), k)
    on conflict (trip_id, davet_edilen) where durum = 'bekliyor' do nothing;
    get diagnostics n = row_count;
    yazilan := yazilan + n;
  end loop;
  return yazilan;
end;
$$;

-- Davet geçerli mi: bekliyor, bana, davet eden hâlâ o seyahatin üyesi ve ben henüz üye değilim.
create function public.davet_gecerli(p_davet uuid) returns public.seyahat_davetleri
language sql stable security definer set search_path = ''
as $$
  select d.* from public.seyahat_davetleri d
  where d.id = p_davet and d.davet_edilen = auth.uid() and d.durum = 'bekliyor'
    and exists (select 1 from public.members m where m.trip_id = d.trip_id and m.user_id = d.davet_eden)
    and not exists (select 1 from public.members m where m.trip_id = d.trip_id and m.user_id = auth.uid())
$$;

-- KK2 · KK3: bekleyen davetlerim, yeniden eskiye. Davet edenin ilk adı ve fotoğrafı; seyahatin adı, şehri, tarihleri, gün
-- sayısı; kişiler = üyeler, davet eden önde, sonra katılış sırası (ilk ad; sıra numarası, kullanıcı kimliği dönmez). Fotoğraf,
-- davet edeninki dahil, yalnız benimle ortak seyahati olan kişininki (#229). Token, mekanlar ve Google verisi dönmez.
create function public.davetlerim() returns table (
  id uuid, trip_id uuid, davet_eden_ad text, davet_eden_foto text, ad text, sehir text,
  start_date date, end_date date, gun_sayisi integer, kisiler jsonb, olusturuldu timestamptz)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.trip_id,
    public.ilk_kelime((select m.display_name from public.members m where m.trip_id = d.trip_id and m.user_id = d.davet_eden)),
    case when public.ortak_seyahat_var(d.davet_eden) then (select p.photo_url from public.profiles p where p.id = d.davet_eden) end,
    t.name, t.city_label, t.start_date, t.end_date,
    (select count(*) from public.days g where g.trip_id = t.id)::integer,
    coalesce((
      select jsonb_agg(jsonb_build_object('sira', x.sira, 'ad', x.ad, 'foto', x.foto) order by x.sira)
      from (
        select row_number() over (order by (m.user_id = d.davet_eden) desc, m.joined_at, m.user_id)::integer as sira,
          public.ilk_kelime(m.display_name) as ad,
          case when public.ortak_seyahat_var(m.user_id) then (select p.photo_url from public.profiles p where p.id = m.user_id) end as foto
        from public.members m where m.trip_id = t.id) x), '[]'::jsonb),
    d.created_at
  from public.seyahat_davetleri d
  join public.trips t on t.id = d.trip_id
  -- `davet_gecerli` ile aynı koşul.
  where not public.is_anonymous()
    and d.davet_edilen = auth.uid() and d.durum = 'bekliyor'
    and exists (select 1 from public.members m where m.trip_id = d.trip_id and m.user_id = d.davet_eden)
    and not exists (select 1 from public.members m where m.trip_id = d.trip_id and m.user_id = auth.uid())
  order by d.created_at desc
  limit 20
$$;

-- KK4 · Katıl: önce durum `katildi`, sonra davet linkiyle katılmanın üyelik yolu (`davetle_katil`, kanal app) aynen.
-- Dönen, `davetle_katil`'in cevabı (seyahat kimliği, zaten_uye…). Davet bana değilse ya da artık bekliyor değilse P0002.
create function public.davete_katil(p_davet uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d public.seyahat_davetleri;
  seyahat uuid;
  sonuc jsonb;
begin
  if auth.uid() is null or public.is_anonymous() then
    raise exception 'oturum gerekli' using errcode = '42501';
  end if;
  -- Kilit sırası seyahat → davet satırı (#605 öz-inceleme 1). `rotate_invite_token` önce seyahat satırını (FOR UPDATE)
  -- sonra tetikleyiciyle davet satırlarını kilitler; burada da önce seyahat: ters sırada kilitlenip kilitlenme olmaz.
  -- KEY SHARE yalnız token yenileme ve seyahat silmeyle çakışır (üyelik insert'ünün yabancı anahtar kilidiyle aynı).
  select x.trip_id into seyahat from public.seyahat_davetleri x where x.id = p_davet and x.davet_edilen = auth.uid();
  if seyahat is null then
    raise exception 'davet yok' using errcode = 'P0002';
  end if;
  perform 1 from public.trips t where t.id = seyahat for key share;
  d := public.davet_gecerli(p_davet);
  if d.id is null then
    raise exception 'davet yok' using errcode = 'P0002';
  end if;
  -- Satırı kilitle: eşzamanlı `daveti_reddet` beklesin; kilit alınca hâlâ bekliyor mu bak.
  perform 1 from public.seyahat_davetleri x where x.id = d.id and x.durum = 'bekliyor' for update;
  if not found then
    raise exception 'davet yok' using errcode = 'P0002';
  end if;
  -- Yalnız hâlâ bekleyen davet `katildi` olur; bu arada reddedildiyse (ya da başka bir istek yanıtladıysa) üyelik hiç
  -- yazılmaz. Önce durum, sonra üyelik: üyelik tetikleyicisi (`davet_uye_oldu`) bu satırı bekliyor bulmasın.
  update public.seyahat_davetleri x set durum = 'katildi', yanitlandi = now() where x.id = d.id and x.durum = 'bekliyor';
  if not found then
    raise exception 'davet yok' using errcode = 'P0002';
  end if;
  sonuc := public.davetle_katil((select t.invite_token from public.trips t where t.id = d.trip_id), 'app');
  return sonuc;
end;
$$;

-- KK4 · Hayır: durum `reddetti`; bildirim yok. Geri al istemcide (5 sn bant kapanınca çağrılır).
create function public.daveti_reddet(p_davet uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_anonymous() then
    raise exception 'oturum gerekli' using errcode = '42501';
  end if;
  update public.seyahat_davetleri x set durum = 'reddetti', yanitlandi = now()
  where x.id = p_davet and x.davet_edilen = auth.uid() and x.durum = 'bekliyor';
  if not found then
    raise exception 'davet yok' using errcode = 'P0002';
  end if;
end;
$$;

-- #605 inceleme 1: bekleyen davet yalnız üye olmayan kişiye ve yalnız güncel link dönemi için geçerlidir.
-- Üye olunca (hangi yoldan olursa olsun) o seyahatteki bekleyen davetler kapanır.
create function public.davet_uye_oldu() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.seyahat_davetleri set durum = 'katildi', yanitlandi = now()
   where trip_id = new.trip_id and davet_edilen = new.user_id and durum = 'bekliyor';
  return new;
end;
$$;
create trigger seyahat_davetleri_uye_oldu after insert on public.members
  for each row execute function public.davet_uye_oldu();

-- Üye çıkınca ona gelen ve onun gönderdiği bekleyen davetler kapanır; yeniden üye olsa da eski davetler canlanmaz.
create function public.davet_uye_cikti() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.seyahat_davetleri set durum = 'iptal', yanitlandi = now()
   where trip_id = old.trip_id and (davet_edilen = old.user_id or davet_eden = old.user_id) and durum = 'bekliyor';
  return old;
end;
$$;
create trigger seyahat_davetleri_uye_cikti after delete on public.members
  for each row execute function public.davet_uye_cikti();

-- Link yenilenince (`rotate_invite_token`) seyahatin bütün bekleyen davetleri kapanır: eski davet yeni linkle katılamaz.
create function public.davet_link_yenilendi() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.seyahat_davetleri set durum = 'iptal', yanitlandi = now()
   where trip_id = new.id and durum = 'bekliyor';
  return new;
end;
$$;
create trigger seyahat_davetleri_link_yenilendi after update of invite_token on public.trips
  for each row when (old.invite_token is distinct from new.invite_token)
  execute function public.davet_link_yenilendi();

revoke all on function public.davet_uye_oldu(), public.davet_uye_cikti(), public.davet_link_yenilendi()
  from public, anon, authenticated;

revoke all on function public.davet_gonder(uuid, uuid[]), public.davet_gecerli(uuid), public.davetlerim(),
  public.davete_katil(uuid), public.daveti_reddet(uuid)
  from public, anon, authenticated;
grant execute on function public.davet_gonder(uuid, uuid[]), public.davetlerim(), public.davete_katil(uuid),
  public.daveti_reddet(uuid)
  to authenticated;
