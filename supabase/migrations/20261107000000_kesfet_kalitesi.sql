-- #189 Keşfet kalitesi: places-nearby süzgecinin ayarları. Eşikler (yorum / puan alt sınırı) panel ayarında; elle gizlenen yerler
-- ayrı tabloda. İkisini de Edge Function tek RPC'yle (yalnız service_role) okur. Google verisi saklanmaz: yalnız place_id (Google
-- koşullarına göre saklanabilir), neden, ekleyen, tarih.

-- KK2 varsayılanları (Ayarlar #111 düzenler). Puan 0 = puan şartı yok.
insert into public.yonetim_ayarlari (anahtar, deger) values ('kesfet_esikleri', '{
  "turistik": {"yorum": 50, "puan": 3.8},
  "yemek": {"yorum": 30, "puan": 3.8},
  "kafe": {"yorum": 30, "puan": 3.8},
  "park": {"yorum": 20, "puan": 0},
  "alisveris": {"yorum": 30, "puan": 3.8}
}'::jsonb) on conflict (anahtar) do nothing;

-- KK5: Keşfet'te gösterilmeyecek yerler. Yalnız admin okur ve yazar (BO; şimdilik supabase-sql ile de eklenebilir).
create table public.kesfet_gizli (
  place_id text primary key check (place_id ~ '^[A-Za-z0-9_-]{10,255}$'),
  neden text not null default '' check (char_length(neden) <= 300),
  ekleyen uuid default auth.uid(),
  tarih timestamptz not null default now()
);
alter table public.kesfet_gizli enable row level security;
revoke all on public.kesfet_gizli from anon;
create policy kesfet_gizli_admin on public.kesfet_gizli for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- places-nearby'nin okuduğu tek kayıt: eşikler (yoksa null → fonksiyon varsayılanları) ve gizli place_id'ler.
create or replace function public.kesfet_suzgec_ayarlari()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'esikler', (select a.deger from public.yonetim_ayarlari a where a.anahtar = 'kesfet_esikleri'),
    'gizli', coalesce((select jsonb_agg(g.place_id order by g.place_id) from public.kesfet_gizli g), '[]'::jsonb)
  );
$$;
revoke execute on function public.kesfet_suzgec_ayarlari() from public, anon, authenticated;
grant execute on function public.kesfet_suzgec_ayarlari() to service_role;
