// #66: Keşfet öneri yükleyicisi — görünür karolardan önbellekte olmayanlar kaydırma bittikten 400 ms sonra istenir;
// sonuçlar çipin birikimli listesine eklenir. Önbellek (çip + karo) ve birikim oturum boyu modül belleğinde: ekran
// yeniden açılsa da az önce görülen mekanlar yerinde. Oturum başına karo isteği sayacı (__DEV__ konsolu + Sentry izi).
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HaritaBolgesi } from '@/components/harita/tipler';
import { izBirak } from '@/lib/hataRaporu';

import { yakinYerler, type HafifYer, type OneriCipi } from './api';
import { birikimeEkle, birikimListesi, istenecekKarolar, KARO_GECIKME_MS, karoOnbellekAnahtari, type Karo } from './karolar';

type Durum = 'yolda' | 'tamam';
/** çip|karo → durum (yolda / tamam). Hatalı istek silinir → sıradaki kaydırmada yeniden denenir. */
const karoDurumu = new Map<string, Durum>();
/** çip → place_id → yer. */
const birikimler = new Map<OneriCipi, Map<string, HafifYer>>();
/** Oturum başına karo isteği sayısı (#66 KK7). */
export const karoSayaci = { istek: 0, hata: 0 };

/** Testler için: önbellek, birikim ve sayaç sıfırlanır. */
export function karoBelleginiSifirla() {
  karoDurumu.clear();
  birikimler.clear();
  karoSayaci.istek = 0;
  karoSayaci.hata = 0;
}

function birikim(cip: OneriCipi): Map<string, HafifYer> {
  let b = birikimler.get(cip);
  if (!b) {
    b = new Map();
    birikimler.set(cip, b);
  }
  return b;
}

/** Karoyu ister; yeni gelen mekan sayısını döner. Hata fırlatır (durum geri alınır). */
async function karoyuGetir(cip: OneriCipi, karo: Karo): Promise<number> {
  const anahtar = karoOnbellekAnahtari(cip, karo);
  karoDurumu.set(anahtar, 'yolda');
  karoSayaci.istek += 1;
  try {
    const yerler = await yakinYerler({ cip, merkez: { lat: karo.merkez.lat, lng: karo.merkez.lng, yaricapM: karo.yaricapM } });
    karoDurumu.set(anahtar, 'tamam');
    const yeni = birikimeEkle(birikim(cip), yerler);
    izBirak('kesfet.karo', `${anahtar} → ${yerler.length} yer, ${yeni} yeni (oturum ${karoSayaci.istek}. istek)`);
    return yeni;
  } catch (e) {
    karoDurumu.delete(anahtar);
    karoSayaci.hata += 1;
    izBirak('kesfet.karo', `${anahtar} hata (${(e as Error).message})`, 'error');
    throw e;
  }
}

export type KaroOnerileri = {
  /** Çipin birikimli listesi (popülerlik sırasıyla). */
  yerler: HafifYer[];
  /** En az bir karo isteği yolda. */
  yukleniyor: boolean;
  /** Son turda en az bir karo isteği başarısız oldu (sıradaki kaydırmada yeniden denenir). */
  hata: boolean;
};

export function useKaroOnerileri(cip: OneriCipi, bolge: HaritaBolgesi | null): KaroOnerileri {
  const [, yenile] = useState(0);
  const [yolda, setYolda] = useState(0);
  const [hata, setHata] = useState(false);
  const canli = useRef(true);
  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  const yukle = useCallback(
    (c: OneriCipi, b: HaritaBolgesi) => {
      const karolar = istenecekKarolar(b, c, (a) => karoDurumu.has(a));
      if (karolar.length === 0) return;
      if (__DEV__) console.log(`[kesfet] ${c} zoom ${b.zoom.toFixed(2)} → ${karolar.length} karo isteği (oturum toplamı ${karoSayaci.istek + karolar.length})`);
      setYolda((n) => n + karolar.length);
      setHata(false);
      for (const k of karolar) {
        karoyuGetir(c, k)
          .then((yeni) => {
            if (canli.current && yeni > 0) yenile((n) => n + 1);
          })
          .catch(() => {
            if (canli.current) setHata(true);
          })
          .finally(() => {
            if (canli.current) setYolda((n) => n - 1);
          });
      }
    },
    [],
  );

  // Kaydırma / yakınlaştırma bitince 400 ms bekle; bu sürede yeni bölge gelirse öncekini iptal et. Çip değişince hemen.
  const oncekiCip = useRef<OneriCipi | null>(null);
  useEffect(() => {
    if (!bolge) return;
    const hemen = oncekiCip.current !== cip;
    oncekiCip.current = cip;
    const z = setTimeout(() => yukle(cip, bolge), hemen ? 0 : KARO_GECIKME_MS);
    return () => clearTimeout(z);
  }, [cip, bolge, yukle]);

  return { yerler: birikimListesi(birikimler.get(cip)), yukleniyor: yolda > 0, hata };
}
