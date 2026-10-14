// #199: PostgREST gömmeleri — uygulama (önerilen gezi) ve BO (gezi editörü) aynı biçimi kullanır.

/**
 * Günlerin durakları AÇIK ilişkiyle (gezi_duraklari.gezi_gun_id) gömülür. İki tabloya da anahtarlı bir tablo (#192'nin
 * gezi_rota_onbellek'i gibi) PostgREST'te çoktan-çoğa yol açarsa ipuçsuz gömme belirsiz kalır (PGRST201) ve gezi hiç açılmaz.
 */
export const GEZI_GUNLERI_GOMME =
  'gezi_gunleri(id, gezi_id, sira, baslik, gezi_duraklari!gezi_duraklari_gezi_gun_id_fkey(id, gezi_gun_id, sira, place_id, ad, kategori, sure_dk, lat, lng))';
