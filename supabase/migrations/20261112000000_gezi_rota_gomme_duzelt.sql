-- #199 ACİL: önerilen gezi ekranı açılmıyordu. #192'nin gezi_rota_onbellek tablosu hem gezi_gunleri'ne (gezi_gun_id) hem
-- gezi_duraklari'na (kimden / kime) yabancı anahtarlıydı ve üç sütun birincil anahtarın parçasıydı → PostgREST tabloyu iki
-- tablo arasında çoktan-çoğa BAĞLANTI tablosu saydı. `gezi_gunleri(…, gezi_duraklari(…))` gömmesi (uygulamada useGezi, BO gezi
-- editörü, gezi-rota fonksiyonu) üç ilişki bulup belirsiz kaldı: PGRST201 "Could not embed because more than one relationship
-- was found for 'gezi_gunleri' and 'gezi_duraklari'" → gezi sorgusu hata, ekran "gezi açılamadı".
-- Düzeltme: gezi_gun_id'nin yabancı anahtarı kalkar (bağlantı tablosu sayılmak için iki tabloya da anahtar gerekir; PostgREST
-- sürümünden bağımsız). Temizlik yine tam: gün silinince durakları silinir → durak anahtarları (kimden / kime, on delete
-- cascade) bacakları siler; durak günü değişirse tetikleyici (gezi_duraklari_rota_bosalt) iki günü de boşaltır.
do $$
declare
  k record;
begin
  for k in
    select conname from pg_catalog.pg_constraint
    where contype = 'f' and conrelid = 'public.gezi_rota_onbellek'::regclass and confrelid = 'public.gezi_gunleri'::regclass
  loop
    execute format('alter table public.gezi_rota_onbellek drop constraint %I', k.conname);
  end loop;
end;
$$;

comment on column public.gezi_rota_onbellek.gezi_gun_id is
  '#199: yabancı anahtar YOK — gezi_gunleri ↔ gezi_duraklari gömmesini belirsiz yapmasın (PGRST201). Temizlik durak anahtarları ve gezi_duraklari_rota_bosalt tetikleyicisiyle.';

-- PostgREST şema önbelleği hemen yenilensin.
notify pgrst, 'reload schema';
