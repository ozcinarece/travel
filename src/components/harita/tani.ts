// #71: harita tanı sayaçları — cihazda logcat olmadan doğrulama için (Keşfet'te filtre düğmesine uzun basınca şerit açılır).
// Harita dururken tur sayısı artıyor mu, pine dokununca onPress geliyor mu, işaretçi sayısı ne — hepsi buradan okunur.
import { useEffect, useState } from 'react';

import { karoSayaci } from '@/features/yerler/karoYukleme';

export const taniSayaclari = {
  /** onRegionChangeComplete (kamera durdu) sayısı. */
  bolgeOlayi: 0,
  /** İşaretçi onPress sayısı ve son dokunulan pin. */
  dokunma: 0,
  sonDokunma: '',
  /** Son render'da çizilen işaretçi sayıları. */
  gorunen: 0,
  pngIsaretci: 0,
  adIsaretci: 0,
  gorunumIsaretci: 0,
  /** Harita bileşeni render sayısı. */
  render: 0,
};

export function isaretciSayilariniKaydet(gorunen: number, plan: { tur: 'png' | 'ad' | 'gorunum' }[]) {
  taniSayaclari.render += 1;
  taniSayaclari.gorunen = gorunen;
  taniSayaclari.pngIsaretci = plan.filter((i) => i.tur === 'png').length;
  taniSayaclari.adIsaretci = plan.filter((i) => i.tur === 'ad').length;
  taniSayaclari.gorunumIsaretci = plan.filter((i) => i.tur === 'gorunum').length;
  if (__DEV__) console.log(`[harita] işaretçi ${gorunen} (png ${taniSayaclari.pngIsaretci} · ad ${taniSayaclari.adIsaretci} · görünüm ${taniSayaclari.gorunumIsaretci}) · tur ${karoSayaci.tur}`);
}

export function dokunmaKaydet(id: string) {
  taniSayaclari.dokunma += 1;
  taniSayaclari.sonDokunma = id;
  if (__DEV__) console.log(`[harita] dokunma ${taniSayaclari.dokunma}: ${id}`);
}

export type TaniOzeti = { tur: number; istek: number; hata: number; bolgeOlayi: number; dokunma: number; sonDokunma: string; gorunen: number; png: number; ad: number; gorunum: number; render: number };

export function taniOzeti(): TaniOzeti {
  return {
    tur: karoSayaci.tur,
    istek: karoSayaci.istek,
    hata: karoSayaci.hata,
    bolgeOlayi: taniSayaclari.bolgeOlayi,
    dokunma: taniSayaclari.dokunma,
    sonDokunma: taniSayaclari.sonDokunma,
    gorunen: taniSayaclari.gorunen,
    png: taniSayaclari.pngIsaretci,
    ad: taniSayaclari.adIsaretci,
    gorunum: taniSayaclari.gorunumIsaretci,
    render: taniSayaclari.render,
  };
}

/** Açıkken yarım saniyede bir sayaç özeti (kapalıyken null; zamanlayıcı kurulmaz). */
export function useTani(acik: boolean): TaniOzeti | null {
  const [ozet, setOzet] = useState<TaniOzeti | null>(null);
  useEffect(() => {
    if (!acik) return;
    const z = setInterval(() => setOzet(taniOzeti()), 500);
    return () => clearInterval(z);
  }, [acik]);
  return acik ? ozet : null;
}
