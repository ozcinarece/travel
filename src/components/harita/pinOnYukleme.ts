// #61 §6: tüm pin PNG'leri (daireler, ok, hap ikonları) haritadan önce Fresco belleğine alınır; `image` işaretçileri
// hazır olana kadar çizilmez (varsayılan kırmızı iğne görünmesin). Paket içi şemasız kaynaklar zaten eşzamanlı
// yüklenir; prefetch reddederse geçilir. En fazla 1,5 sn beklenir. Seyahat layout'unda bir kez tetiklenir
// (Keşfet / Program sekmesine girmeden), Harita yalnız sonucu bekler.
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { PIN_IKONLARI } from './pinIkonlari';

const ZAMAN_ASIMI_MS = 1500;
let hazir = false;
let soz: Promise<void> | null = null;

export function pinGorselleriniYukle(): Promise<void> {
  if (!soz) {
    const uriler = Object.values(PIN_IKONLARI)
      .map((k) => Image.resolveAssetSource(k)?.uri)
      .filter((u): u is string => !!u && /^(https?|file|asset|data):/.test(u));
    const zamanAsimi = new Promise<void>((cozul) => setTimeout(cozul, ZAMAN_ASIMI_MS));
    soz = Promise.race([Promise.allSettled(uriler.map((u) => Image.prefetch(u))).then(() => undefined), zamanAsimi]).then(() => {
      hazir = true;
    });
  }
  return soz;
}

/** Görseller bellekte mi? Layout'ta başlatıldıysa harita açıldığında genelde zaten hazırdır. */
export function usePinGorselleri(): boolean {
  const [durum, setDurum] = useState(hazir);
  useEffect(() => {
    if (durum) return;
    let aktif = true;
    pinGorselleriniYukle().then(() => {
      if (aktif) setDurum(true);
    });
    return () => {
      aktif = false;
    };
  }, [durum]);
  return durum;
}
