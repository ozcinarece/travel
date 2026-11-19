// #368: şehir kimliği (place_id, saat dilimi, ülke kodu) — hat service_role ile `icerik-google` `islem: 'sehir'` çağırır.
// `places-*` fonksiyonları kullanıcı oturumu ister (401); onların yetkisi gevşetilmez. Google verisi loga yazılmaz.
import { sehirKimligi } from './dogrula.mjs';

/**
 * `google`: icerik-google çağıran fonksiyon (gövde → JSON; hata fırlatır). Şehir başına en çok 1 kimlik araması ve 1 Details.
 * Google'ın şehri bizimkinden 50 km'den uzaksa ya da eşleşme yoksa null.
 */
export async function sehirKimligiCoz(google, sehir, placeId) {
  const lat = Number(sehir.lat);
  const lng = Number(sehir.lng);
  const govde = { islem: 'sehir', ad: sehir.ad, merkez: { lat, lng }, ...(placeId ? { place_id: placeId } : {}) };
  const { yer } = await google(govde);
  return sehirKimligi({ lat, lng }, yer ?? null);
}
