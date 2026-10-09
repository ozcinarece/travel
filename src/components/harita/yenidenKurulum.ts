// #79 kök neden: react-native-maps 1.27 Android `MapView`, görünümü pencereden ayrılınca (ekran yığında arkada kalınca ya
// da sekme ayrılınca: onDetachedFromWindow) GoogleMap'i durdurur, işaretçi listesini kendi kopyasına alır (`savedFeatures`)
// ve `features`'ı boşaltır; geri bağlanınca (onAttachedToWindow) haritayı `onCreate(savedMapState)` ile YENİDEN kurar,
// ikinci bir `onMapReady` yayar ve kopyadaki işaretçileri kendisi ekler. Arada React'in eklediği / kaldırdığı işaretçiler
// bu kopyayla ayrışır: kaldırılanlar geri gelir (filtre süzmesi kayıp, hayalet pin), yeni eklenenler eski haritaya gider
// (görünmez), simgesi henüz yüklenmemiş olanlar Google'ın kırmızı varsayılan iğnesiyle çizilir, dokunuşlar eski işaretçi
// eşlemesine düşer. İmzası: aynı MapView örneğinden ikinci `onMapReady`. Çare: o anki bölgeyle MapView'ı sıfırdan kurmak
// (React'in listesi tek gerçek olur).
/** Aynı örnekten ikinci onMapReady en az bu kadar sonra gelirse yeniden bağlanma sayılır (ilk kurulumda çift olay değil). */
export const YENIDEN_BAGLANMA_ESIGI_MS = 2000;

/**
 * `oncekiHazirMs`: bu MapView örneğinin önceki onMapReady anı (0 = henüz yok). İkinci olay eşikten geç geldiyse harita
 * yeniden kurulmalı.
 */
export function yenidenKurulsunMu(oncekiHazirMs: number, simdiMs: number, esikMs = YENIDEN_BAGLANMA_ESIGI_MS): boolean {
  return oncekiHazirMs > 0 && simdiMs - oncekiHazirMs >= esikMs;
}
