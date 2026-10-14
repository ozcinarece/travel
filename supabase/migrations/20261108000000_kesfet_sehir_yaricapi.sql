-- #189 Ek 2: Keşfet şehir listesinin yarıçapı (places-nearby `sehir: true`). Eşiklerle aynı ayar kaydında; varsayılan 8 km.
update public.yonetim_ayarlari
set deger = deger || '{"sehir_yaricap_m": 8000}'::jsonb
where anahtar = 'kesfet_esikleri' and not (deger ? 'sehir_yaricap_m');
