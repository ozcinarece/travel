-- #345 KK1: kapak fotoğrafının atfı. Commons fotoğrafında yazar + lisans + kaynak sayfası (CC BY / BY-SA'da zorunlu),
-- kendi fotoğrafımızda {"yazar": "Tripmate"}. Kapak boş olabilir; atıf yalnız kapakla birlikte anlamlı. Google fotoğrafı
-- içerik tablolarına hiç girmez (PRD §7). Okuma ve yazma kuralları satırın mevcut politikalarıyla aynı (yayındaysa herkes
-- okur, yalnız admin yazar); yeni politika yok.

create function public.kapak_atfi_gecerli(a jsonb) returns boolean
language sql
immutable
set search_path = ''
as $$
  -- coalesce: CHECK'te null "geçti" sayılır; eksik alan null üretmesin, reddedilsin.
  select a is null or coalesce((
    jsonb_typeof(a) = 'object'
    -- Yalnız bu üç alan.
    and (select coalesce(bool_and(k in ('yazar', 'lisans', 'kaynak_url')), true) from jsonb_object_keys(a) k)
    and jsonb_typeof(a -> 'yazar') = 'string'
    and char_length(btrim(a ->> 'yazar')) between 1 and 200
    and (a -> 'lisans' is null or jsonb_typeof(a -> 'lisans') = 'null'
      or (jsonb_typeof(a -> 'lisans') = 'string' and char_length(a ->> 'lisans') between 1 and 60))
    and (a -> 'kaynak_url' is null or jsonb_typeof(a -> 'kaynak_url') = 'null'
      or (jsonb_typeof(a -> 'kaynak_url') = 'string' and a ->> 'kaynak_url' ~ '^https://' and char_length(a ->> 'kaynak_url') <= 500))
  ), false);
$$;

alter table public.geziler add column kapak_atif jsonb check (public.kapak_atfi_gecerli(kapak_atif));
alter table public.sehirler add column kapak_atif jsonb check (public.kapak_atfi_gecerli(kapak_atif));
alter table public.yerler add column kapak_atif jsonb check (public.kapak_atfi_gecerli(kapak_atif));

comment on column public.geziler.kapak_atif is '#345: {yazar, lisans, kaynak_url}; kendi fotoğrafımızda {"yazar":"Tripmate"}';
comment on column public.sehirler.kapak_atif is '#345: {yazar, lisans, kaynak_url}; kendi fotoğrafımızda {"yazar":"Tripmate"}';
comment on column public.yerler.kapak_atif is '#345: {yazar, lisans, kaynak_url}; kendi fotoğrafımızda {"yazar":"Tripmate"}';
