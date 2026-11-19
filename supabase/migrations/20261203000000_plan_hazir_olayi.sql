-- #396 KK7: Plan hazır çekmecesinde "Arkadaşlarını çağır" ölçümü — plan_hazir_davet. Yalnız olay türü eklenir; olaylar
-- tablosunun yetki kuralları değişmez.
alter table public.olaylar drop constraint if exists olaylar_tur_check;
alter table public.olaylar add constraint olaylar_tur_check
  check (tur in ('gezi_goruntulendi', 'gezi_alindi', 'yer_eklendi', 'davet_paylasildi', 'davet_acildi', 'davet_katildi', 'sihirbaz_bitti', 'plan_kuruldu',
                 'ana_kart_acildi', 'ana_ara', 'planlamaya_devam', 'plan_hazir_davet'));
