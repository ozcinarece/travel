-- #139 KK8: sihirbaz ölçümü — sihirbaz_bitti (seyahat kuruldu, 3 adım bitti) ve plan_kuruldu (meta: mekan, gün, atanmamış,
-- sure_sn = sihirbaz başlangıcından planın yazılmasına kadar; hedef < 180 sn).
alter table public.olaylar drop constraint if exists olaylar_tur_check;
alter table public.olaylar add constraint olaylar_tur_check
  check (tur in ('gezi_goruntulendi', 'gezi_alindi', 'yer_eklendi', 'davet_paylasildi', 'davet_acildi', 'davet_katildi', 'sihirbaz_bitti', 'plan_kuruldu'));
