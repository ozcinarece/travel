-- #47 E16: pin panelindeki gezgin ipucu hapları kaldırıldı; RPC artık kullanılmıyor.
-- stop_ratings.tags sütunu kalır (boş yazılır, #47 E15).
drop function if exists public.mekan_ipuclari(text);
