-- #109: ana sayfa düzeni — bölümler (taslak, yalnız admin), yayın anlık görüntüsü (herkes okur), uygulamanın okuduğu görünüm.
-- Selam ve yaklaşan seyahat kartı sabittir; bu tabloda değildir.

create table public.ana_sayfa_bolumleri (
  id uuid primary key default gen_random_uuid(),
  tur text not null check (tur in ('tek_kart', 'serit', 'mozaik', 'sehir_seckisi')),
  baslik text not null check (char_length(baslik) between 1 and 80),
  sira integer not null check (sira >= 1),
  acik boolean not null default true,
  kaynak text not null default 'elle' check (kaynak in ('otomatik', 'elle')),
  -- tek_kart: {gezi_id} · serit: {gezi_idler: []} · mozaik: {yer_idler: []} · sehir_seckisi: {sehir_idler: []}
  icerik jsonb not null default '{}'::jsonb check (jsonb_typeof(icerik) = 'object'),
  baslangic_at timestamptz,
  bitis_at timestamptz,
  updated_at timestamptz not null default now(),
  check (baslangic_at is null or bitis_at is null or bitis_at > baslangic_at),
  -- Sürükle-sırala tek deyimde (ertelenebilir).
  constraint ana_sayfa_bolumleri_sira_tekil unique (sira) deferrable initially immediate
);

create trigger ana_sayfa_bolumleri_updated_at before update on public.ana_sayfa_bolumleri
  for each row execute function public.updated_at_yaz();

alter table public.ana_sayfa_bolumleri enable row level security;
revoke all on public.ana_sayfa_bolumleri from anon;
-- Taslak: yalnız admin okur ve yazar (#106 is_admin()).
create policy ana_sayfa_bolumleri_admin on public.ana_sayfa_bolumleri for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- KK5: "Yayınla" taslağın o anki halini tek satırda saklar; uygulama yalnız son yayını görür.
create table public.ana_sayfa_yayini (
  id bigint generated always as identity primary key,
  bolumler jsonb not null check (jsonb_typeof(bolumler) = 'array'),
  yayinlandi_at timestamptz not null default now(),
  yayinlayan text default (auth.jwt() ->> 'email')
);

alter table public.ana_sayfa_yayini enable row level security;
create policy ana_sayfa_yayini_select on public.ana_sayfa_yayini for select to anon, authenticated using (true);
create policy ana_sayfa_yayini_admin on public.ana_sayfa_yayini for insert to authenticated with check ((select public.is_admin()));

create function public.ana_sayfa_yayinla() returns timestamptz
language plpgsql security invoker set search_path = ''
as $$
declare
  zaman timestamptz;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin yayınlar' using errcode = '42501';
  end if;
  insert into public.ana_sayfa_yayini (bolumler)
    select coalesce(jsonb_agg(to_jsonb(b) - 'updated_at' order by b.sira), '[]'::jsonb) from public.ana_sayfa_bolumleri b
    returning yayinlandi_at into zaman;
  return zaman;
end;
$$;

-- "Öne çıkan gezi" otomatik: son N günde en çok alınan yayınlı gezi (olaylar.gezi_alindi; kullanıcılar arası sayım,
-- yalnız gezi kimliği döner). Eşitlikte gezi sırası, sonra yeni.
create function public.ana_sayfa_en_cok_alinan(p_gun integer default 30) returns uuid
language sql stable security definer set search_path = ''
as $$
  select g.id
  from public.geziler g
  join public.sehirler s on s.id = g.sehir_id
  left join public.olaylar o on o.hedef_id = g.id and o.tur = 'gezi_alindi' and o.created_at > now() - make_interval(days => p_gun)
  where g.yayin and s.yayin and (g.yayin_at is null or g.yayin_at <= now())
  group by g.id, g.sira, g.created_at
  order by count(o.id) desc, g.sira asc nulls last, g.created_at desc
  limit 1;
$$;

-- KK1 / KK4: uygulamanın okuduğu liste — son yayından açık ve zaman aralığındaki bölümler (sıra `sira` ile istemcide).
create view public.ana_sayfa_gorunen with (security_invoker = true) as
  select
    (b ->> 'id')::uuid as id,
    b ->> 'tur' as tur,
    b ->> 'baslik' as baslik,
    (b ->> 'sira')::integer as sira,
    b ->> 'kaynak' as kaynak,
    case
      when b ->> 'tur' = 'tek_kart' and b ->> 'kaynak' = 'otomatik'
        then coalesce(b -> 'icerik', '{}'::jsonb) || jsonb_build_object('gezi_id', public.ana_sayfa_en_cok_alinan())
      else b -> 'icerik'
    end as icerik,
    (b ->> 'baslangic_at')::timestamptz as baslangic_at,
    (b ->> 'bitis_at')::timestamptz as bitis_at
  from (select bolumler from public.ana_sayfa_yayini order by id desc limit 1) y,
    jsonb_array_elements(y.bolumler) b
  where (b ->> 'acik')::boolean
    and (b ->> 'baslangic_at' is null or (b ->> 'baslangic_at')::timestamptz <= now())
    and (b ->> 'bitis_at' is null or (b ->> 'bitis_at')::timestamptz > now());

grant select on public.ana_sayfa_gorunen to anon, authenticated;

-- ---------------------------------------------------------------- KK2 seed: bugünkü sabit düzen + ilk yayın
insert into public.ana_sayfa_bolumleri (tur, baslik, sira, kaynak, icerik) values
  ('tek_kart', 'Öne çıkan gezi', 1, 'otomatik', '{}'),
  ('serit', 'Önerilen geziler', 2, 'elle', jsonb_build_object('gezi_idler', (select coalesce(jsonb_agg(id order by sira nulls last, created_at desc), '[]'::jsonb) from public.geziler where yayin))),
  ('mozaik', 'Gezilecek yerler', 3, 'otomatik', '{}');

insert into public.ana_sayfa_yayini (bolumler, yayinlayan)
  select jsonb_agg(to_jsonb(b) - 'updated_at' order by b.sira), 'migration' from public.ana_sayfa_bolumleri b;
