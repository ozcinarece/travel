-- #143 (kanvas 17–18): önerilen gezi kapağında ve yazar satırında "128 kez alındı" — gezinin kaç kez seyahate alındığı
-- (olaylar.gezi_alindi, kullanıcılar arası sayım). olaylar istemciye kapalı kalır; yalnız yayınlı gezinin toplamı döner,
-- kimin aldığı görünmez. Yayında olmayan (ya da olmayan) gezi için 0.
create index if not exists olaylar_hedef_tur_idx on public.olaylar (hedef_id, tur);

create function public.gezi_alinma_sayisi(p_gezi uuid) returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer
  from public.olaylar o
  where o.tur = 'gezi_alindi' and o.hedef_id = p_gezi
    and public.gezi_yayinda(p_gezi);
$$;

revoke all on function public.gezi_alinma_sayisi(uuid) from public;
grant execute on function public.gezi_alinma_sayisi(uuid) to anon, authenticated;
