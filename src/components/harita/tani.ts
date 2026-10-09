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
  /** #75: son seçim değişiminde anahtarı değişen (kaldırılan + eklenen) işaretçi sayısı (hedef ≤ 4). */
  sonDegisim: 0,
  /** #75: dokunuş anı (ms, performance.now) ve dokunuş → iğne / kart süreleri (son 10). */
  dokunmaAni: 0,
  igneMs: [] as number[],
  kartMs: [] as number[],
  /** #79: MapView onMapReady sayısı (aynı örnekten ikincisi = pencereye yeniden bağlanma) ve bunun üzerine yeniden kurulum sayısı. */
  haritaHazir: 0,
  haritaYenidenKurulum: 0,
  /** #79: Keşfet ekranının kuruluş sayısı (1'den fazlaysa ekran yeniden mount oldu). */
  kesfetKurulum: 0,
};

const simdi = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

/** #75: dokunuş → seçili iğnenin çizildiği ilk kare / kartın göründüğü ilk kare; son 10 ölçüm. */
export function secimSuresiKaydet(tur: 'igne' | 'kart') {
  if (!taniSayaclari.dokunmaAni) return;
  const ms = Math.round(simdi() - taniSayaclari.dokunmaAni);
  const dizi = tur === 'igne' ? taniSayaclari.igneMs : taniSayaclari.kartMs;
  dizi.push(ms);
  if (dizi.length > 10) dizi.shift();
  if (__DEV__) console.log(`[harita] dokunuş → ${tur} ${ms} ms`);
}

export function medyan(dizi: number[]): number {
  if (dizi.length === 0) return 0;
  const s = [...dizi].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : Math.round((s[o - 1] + s[o]) / 2);
}

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
  taniSayaclari.dokunmaAni = simdi();
  if (__DEV__) console.log(`[harita] dokunma ${taniSayaclari.dokunma}: ${id}`);
}

export type TaniOzeti = { tur: number; istek: number; hata: number; bolgeOlayi: number; dokunma: number; sonDokunma: string; gorunen: number; png: number; ad: number; gorunum: number; render: number; sonDegisim: number; igneMs: number[]; kartMs: number[]; haritaHazir: number; haritaYenidenKurulum: number; kesfetKurulum: number };

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
    sonDegisim: taniSayaclari.sonDegisim,
    igneMs: [...taniSayaclari.igneMs],
    kartMs: [...taniSayaclari.kartMs],
    haritaHazir: taniSayaclari.haritaHazir,
    haritaYenidenKurulum: taniSayaclari.haritaYenidenKurulum,
    kesfetKurulum: taniSayaclari.kesfetKurulum,
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
