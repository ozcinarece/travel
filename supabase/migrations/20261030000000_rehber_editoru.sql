-- #156 rehber editörü: serbest bölüm adı, "Uygulamada gizle", taslak (otomatik kayıt) + Yayınla, Geçmiş (son 20 sürüm).
-- Saklama biçimi değişmez: `sehir_rehberi.yazi_md` = `# Başlık` + markdown (mekan / foto uzantıları, İpucu = `>`).

-- ---------------------------------------------------------------- bölümler
-- Sabit 4 tür kalkar: yeni bölümün türü yok (null), adı serbest. Var olan 4 bölüm türüyle aynen kalır.
alter table public.sehir_rehberi
  alter column bolum drop not null,
  add column gizli boolean not null default false;

-- Gizli bölüm uygulamada yok (admin politikası hepsini görür).
drop policy sehir_rehberi_select on public.sehir_rehberi;
create policy sehir_rehberi_select on public.sehir_rehberi for select to anon, authenticated
  using (not gizli and exists (select 1 from public.sehirler s where s.id = sehir_id and s.yayin));

-- ---------------------------------------------------------------- taslak
-- Editör buraya yazar (2 sn'de bir); uygulama canlı `sehir_rehberi`ni okur, "Yayınla" taslağı oraya geçirir.
-- bolumler: [{id, baslik, ozet, govde, gizli, bolum}] sırayla; govde = başlıksız markdown.
-- bilinen: {place_id: {ad, kategori, lat, lng}} — editörde seçilen mekanlar (yayında taslak yer açmak için).
create table public.sehir_rehberi_taslak (
  sehir_id uuid primary key references public.sehirler(id) on delete cascade,
  bolumler jsonb not null check (jsonb_typeof(bolumler) = 'array'),
  bilinen jsonb not null default '{}'::jsonb check (jsonb_typeof(bilinen) = 'object'),
  updated_at timestamptz not null default now(),
  yayinlandi_at timestamptz
);
alter table public.sehir_rehberi_taslak enable row level security;
create policy sehir_rehberi_taslak_admin on public.sehir_rehberi_taslak for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Geçmiş: taslağın sürümleri (en çok 20; en yenisi üstte).
create table public.sehir_rehberi_surum (
  id bigint generated always as identity primary key,
  sehir_id uuid not null references public.sehirler(id) on delete cascade,
  bolumler jsonb not null check (jsonb_typeof(bolumler) = 'array'),
  neden text not null default 'kayit' check (neden in ('kayit', 'silme', 'donus', 'yayin')),
  yazan text default (coalesce(nullif(split_part(auth.jwt() -> 'user_metadata' ->> 'full_name', ' ', 1), ''), auth.jwt() ->> 'email')),
  created_at timestamptz not null default now()
);
create index sehir_rehberi_surum_sehir_idx on public.sehir_rehberi_surum (sehir_id, created_at desc);
alter table public.sehir_rehberi_surum enable row level security;
create policy sehir_rehberi_surum_admin on public.sehir_rehberi_surum for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Taslağı yazar. Eşzamanlılık: `p_onceki` editörün son okuduğu / yazdığı `updated_at`; sunucudaki taslak o değilse
-- (başka sekme ya da kişi yazmış) 40001 — eski sekme yeni taslağın üstüne yazamaz. İlk taslakta `p_onceki` null.
-- Sürüm: neden 'kayit' ise son sürüm 2 dakikadan eskiyse güncellemeden ÖNCEKİ hâl; diğer nedenlerde (silme, dönüş) her
-- zaman (silme / dönüşten önceki hâl). `bilinen` eskisiyle birleşir. Döner: taslağın yeni updated_at'i.
create function public.rehber_taslak_kaydet(
  p_sehir uuid, p_bolumler jsonb, p_bilinen jsonb default '{}'::jsonb, p_neden text default 'kayit', p_onceki timestamptz default null
)
returns timestamptz
language plpgsql security invoker set search_path = ''
as $$
declare
  v_eski public.sehir_rehberi_taslak;
  v_zaman timestamptz;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  select * into v_eski from public.sehir_rehberi_taslak where sehir_id = p_sehir for update;
  if v_eski.sehir_id is null then
    if p_onceki is not null then
      raise exception 'taslak değişti' using errcode = '40001';
    end if;
    insert into public.sehir_rehberi_taslak (sehir_id, bolumler, bilinen)
      values (p_sehir, p_bolumler, coalesce(p_bilinen, '{}'::jsonb))
    on conflict (sehir_id) do nothing
    returning updated_at into v_zaman;
    if v_zaman is null then
      raise exception 'taslak değişti' using errcode = '40001';
    end if;
  else
    if p_onceki is distinct from v_eski.updated_at then
      raise exception 'taslak değişti' using errcode = '40001';
    end if;
    -- Aynı işlemde iki kayıt aynı now()'ı alır; damga her yazışta ilerlesin.
    update public.sehir_rehberi_taslak
      set bolumler = p_bolumler, bilinen = bilinen || coalesce(p_bilinen, '{}'::jsonb),
          updated_at = greatest(now(), v_eski.updated_at + interval '1 microsecond')
      where sehir_id = p_sehir
      returning updated_at into v_zaman;
    if p_neden <> 'kayit' or not exists (
      select 1 from public.sehir_rehberi_surum where sehir_id = p_sehir and created_at > now() - interval '2 minutes'
    ) then
      insert into public.sehir_rehberi_surum (sehir_id, bolumler, neden) values (p_sehir, v_eski.bolumler, p_neden);
      delete from public.sehir_rehberi_surum
        where sehir_id = p_sehir
          and id not in (select id from public.sehir_rehberi_surum where sehir_id = p_sehir order by created_at desc, id desc limit 20);
    end if;
  end if;
  return v_zaman;
end;
$$;
revoke execute on function public.rehber_taslak_kaydet(uuid, jsonb, jsonb, text, timestamptz) from public, anon;
grant execute on function public.rehber_taslak_kaydet(uuid, jsonb, jsonb, text, timestamptz) to authenticated;

-- Yayınla: taslak canlı bölümlere geçer (taslakta olmayan bölüm ve bağlantıları silinir), her bölümün yazısındaki
-- mekanlar `icerik_mekanlari`na yazılır (yazı sırasıyla; bilinmeyen place_id taslak yer olarak açılır). Döner: açılan yer.
-- `p_beklenen`: editörün gördüğü taslağın updated_at'i; taslak o değilse (başka yerde değişmiş) 40001.
create function public.rehber_yayinla(p_sehir uuid, p_beklenen timestamptz) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_taslak public.sehir_rehberi_taslak;
  b record;
  v_md text;
  v_satir integer;
  v_mekanlar jsonb;
  v_acilan integer := 0;
begin
  if not public.is_admin() then
    raise exception 'yalnız admin' using errcode = '42501';
  end if;
  select * into v_taslak from public.sehir_rehberi_taslak where sehir_id = p_sehir for update;
  if v_taslak.sehir_id is null then
    raise exception 'taslak yok' using errcode = 'P0002';
  end if;
  if p_beklenen is distinct from v_taslak.updated_at then
    raise exception 'taslak değişti' using errcode = '40001';
  end if;
  set constraints public.sehir_rehberi_sira_tekil deferred;

  delete from public.icerik_mekanlari m
    where m.sahip_tur = 'rehber'
      and m.sahip_id in (select r.id from public.sehir_rehberi r where r.sehir_id = p_sehir)
      and m.sahip_id::text not in (select e ->> 'id' from jsonb_array_elements(v_taslak.bolumler) e);
  delete from public.sehir_rehberi r
    where r.sehir_id = p_sehir and r.id::text not in (select e ->> 'id' from jsonb_array_elements(v_taslak.bolumler) e);

  for b in select e, i from jsonb_array_elements(v_taslak.bolumler) with ordinality as x(e, i) loop
    v_md := '# ' || regexp_replace(trim(b.e ->> 'baslik'), '\s*\n\s*', ' ', 'g')
      || case when nullif(trim(coalesce(b.e ->> 'govde', '')), '') is null then '' else E'\n\n' || trim(b.e ->> 'govde') end;
    insert into public.sehir_rehberi (id, sehir_id, bolum, baslik, ozet, yazi_md, sira, gizli)
      values ((b.e ->> 'id')::uuid, p_sehir, nullif(b.e ->> 'bolum', ''), trim(b.e ->> 'baslik'), nullif(trim(coalesce(b.e ->> 'ozet', '')), ''),
              v_md, b.i::integer, coalesce((b.e ->> 'gizli')::boolean, false))
    on conflict (id) do update
      set bolum = excluded.bolum, baslik = excluded.baslik, ozet = excluded.ozet, yazi_md = excluded.yazi_md,
          sira = excluded.sira, gizli = excluded.gizli
      where public.sehir_rehberi.sehir_id = p_sehir;
    get diagnostics v_satir = row_count;
    if v_satir = 0 then
      raise exception 'bölüm başka şehrin: %', b.e ->> 'id' using errcode = '42501';
    end if;

    -- Yazıdaki mekanlar (satır içi `[ad](mekan:id)` ve satır başında `::mekan[id]`), editörün bildiği ad / konumla.
    select coalesce(jsonb_agg(
      jsonb_build_object('place_id', p.place_id, 'bicim', p.bicim)
        || case when v_taslak.bilinen ? p.place_id
             then (v_taslak.bilinen -> p.place_id) - 'ad'
                  || jsonb_build_object('ad', coalesce(nullif(v_taslak.bilinen -> p.place_id ->> 'ad', ''), nullif(p.ad, '')))
             else '{}'::jsonb end
      order by p.sira), '[]'::jsonb)
    into v_mekanlar
    from (
      select k.sira,
        coalesce(k.m[2], k.m[3]) as place_id,
        case when k.m[3] is not null then 'kart' else 'satir' end as bicim,
        trim(k.m[1]) as ad
      from regexp_matches(v_md, '\[([^\]]+)\]\(mekan:([A-Za-z0-9_-]{10,255})\)|^::mekan\[([A-Za-z0-9_-]{10,255})\][ \t]*$', 'gn')
        with ordinality as k(m, sira)
    ) p;
    v_acilan := v_acilan + public.icerik_mekanlari_yaz('rehber', (b.e ->> 'id')::uuid, v_mekanlar);
  end loop;

  -- Yayın damgası taslağınkinden önce olamaz ("Taslak değişiklik var" = updated_at > yayinlandi_at).
  update public.sehir_rehberi_taslak set yayinlandi_at = greatest(now(), updated_at) where sehir_id = p_sehir;
  insert into public.sehir_rehberi_surum (sehir_id, bolumler, neden) values (p_sehir, v_taslak.bolumler, 'yayin');
  delete from public.sehir_rehberi_surum
    where sehir_id = p_sehir
      and id not in (select id from public.sehir_rehberi_surum where sehir_id = p_sehir order by created_at desc, id desc limit 20);
  return v_acilan;
end;
$$;
revoke execute on function public.rehber_yayinla(uuid, timestamptz) from public, anon;
grant execute on function public.rehber_yayinla(uuid, timestamptz) to authenticated;
