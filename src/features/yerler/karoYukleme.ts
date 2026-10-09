// #66: Keşfet öneri yükleyicisi — görünür karolardan önbellekte olmayanlar kaydırma bittikten 400 ms sonra istenir;
// sonuçlar seyahatin birikimli listesine eklenir. Karo önbelleği (çip + karo) geneldir; birikim SEYAHATE göre ayrılır
// (#68 incelemesi 🔴3: Roma'dan sonra Eskişehir'de Roma mekanları kalmasın). İkisi de oturum boyu modül belleğinde: ekran
// yeniden açılsa da az önce görülen mekanlar yerinde. Oturum başına karo isteği sayacı (__DEV__ konsolu + tur başına Sentry izi).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { HaritaBolgesi } from '@/components/harita/tipler';
import { izBirak } from '@/lib/hataRaporu';

import { yakinYerler, type HafifYer, type OneriCipi } from './api';
import { birikimeEkle, birikimListesi, istenecekKarolar, KARO_GECIKME_MS, karoOnbellekAnahtari, type Karo } from './karolar';

type Durum = 'yolda' | 'tamam';
/** çip|karo → durum (yolda / tamam). Hatalı istek silinir → sıradaki turda yeniden denenir. */
const karoDurumu = new Map<string, Durum>();
type Birikim = { yerler: Map<string, HafifYer>; surum: number };
/** seyahat id → place_id → yer. `surum` her yeni mekanda artar (liste memo'su buna bağlı; #68 🔴2). */
const birikimler = new Map<string, Birikim>();
/** Oturum başına karo isteği sayısı (#66 KK7). */
export const karoSayaci = { istek: 0, hata: 0, tur: 0 };
/** Son başarısız istekten sonra bu kadar ms yeni tur başlatılmaz (Google kesintisinde geri çekilme). */
export const HATA_BEKLEME_MS = 30_000;
let sonHataZamani = 0;

/** Testler için: önbellek, birikim ve sayaç sıfırlanır. */
export function karoBelleginiSifirla() {
  karoDurumu.clear();
  birikimler.clear();
  karoSayaci.istek = 0;
  karoSayaci.hata = 0;
  karoSayaci.tur = 0;
  sonHataZamani = 0;
}

export function birikimiAl(seyahatId: string): Birikim {
  let b = birikimler.get(seyahatId);
  if (!b) {
    b = { yerler: new Map(), surum: 0 };
    birikimler.set(seyahatId, b);
  }
  return b;
}

/** Karoyu ister; yeni gelen mekan sayısını döner. Hata fırlatır (durum geri alınır, sıradaki turda yeniden denenir). */
async function karoyuGetir(seyahatId: string, cip: OneriCipi, karo: Karo): Promise<number> {
  const anahtar = karoOnbellekAnahtari(cip, karo);
  karoDurumu.set(anahtar, 'yolda');
  karoSayaci.istek += 1;
  try {
    const yerler = await yakinYerler({ cip, merkez: { lat: karo.merkez.lat, lng: karo.merkez.lng, yaricapM: karo.yaricapM } });
    karoDurumu.set(anahtar, 'tamam');
    const b = birikimiAl(seyahatId);
    const yeni = birikimeEkle(b.yerler, yerler);
    if (yeni > 0) b.surum += 1;
    return yeni;
  } catch (e) {
    karoDurumu.delete(anahtar);
    karoSayaci.hata += 1;
    sonHataZamani = Date.now();
    throw e;
  }
}

export type TurSonucu = { istenen: number; yeni: number; hata: boolean };

/**
 * Bir yükleme turu: görünür karolardan önbellekte / yolda olmayanlar (en fazla 12) istenir. Son hatadan sonra 30 sn
 * yeni tur açılmaz (`istenen: 0, hata: true`). Tur bitince tek Sentry izi.
 */
export async function turBaslat(seyahatId: string, cip: OneriCipi, bolge: HaritaBolgesi, simdi = Date.now()): Promise<TurSonucu> {
  if (sonHataZamani && simdi - sonHataZamani < HATA_BEKLEME_MS) return { istenen: 0, yeni: 0, hata: true };
  const karolar = istenecekKarolar(bolge, cip, (a) => karoDurumu.has(a));
  if (karolar.length === 0) return { istenen: 0, yeni: 0, hata: false };
  karoSayaci.tur += 1;
  if (__DEV__) console.log(`[kesfet] ${cip} zoom ${bolge.zoom.toFixed(2)} → ${karolar.length} karo isteği (oturum toplamı ${karoSayaci.istek + karolar.length})`);
  const sonuclar = await Promise.allSettled(karolar.map((k) => karoyuGetir(seyahatId, cip, k)));
  const yeni = sonuclar.reduce((t, s) => t + (s.status === 'fulfilled' ? s.value : 0), 0);
  const hata = sonuclar.some((s) => s.status === 'rejected');
  izBirak('kesfet.karo', `tur ${karoSayaci.tur}: ${cip} ${karolar.length} karo, ${yeni} yeni mekan${hata ? ', hata var' : ''} (oturum ${karoSayaci.istek} istek)`, hata ? 'error' : 'info');
  return { istenen: karolar.length, yeni, hata };
}

export type KaroOnerileri = {
  /** Seyahatin birikimli listesi (popülerlik sırasıyla; yalnız yeni mekan gelince yeniden hesaplanır). */
  yerler: HafifYer[];
  /** En az bir karo isteği yolda. */
  yukleniyor: boolean;
  /** Son turda en az bir karo isteği başarısız oldu (30 sn sonra sıradaki kaydırmada yeniden denenir). */
  hata: boolean;
};

export function useKaroOnerileri(seyahatId: string, cip: OneriCipi, bolge: HaritaBolgesi | null): KaroOnerileri {
  const [surum, setSurum] = useState(() => birikimiAl(seyahatId).surum);
  const [yolda, setYolda] = useState(0);
  const [hata, setHata] = useState(false);
  const canli = useRef(true);
  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  const yukle = useCallback((id: string, c: OneriCipi, b: HaritaBolgesi) => {
    setYolda((n) => n + 1);
    turBaslat(id, c, b)
      .then((s) => {
        if (!canli.current) return;
        setHata(s.hata);
        setSurum(birikimiAl(id).surum);
      })
      .finally(() => {
        if (canli.current) setYolda((n) => n - 1);
      });
  }, []);

  // Kaydırma / yakınlaştırma bitince 400 ms bekle; bu sürede yeni bölge gelirse öncekini iptal et. Çip / seyahat değişince hemen.
  const oncekiAnahtar = useRef<string | null>(null);
  useEffect(() => {
    if (!bolge) return;
    const anahtar = `${seyahatId}|${cip}`;
    const hemen = oncekiAnahtar.current !== anahtar;
    oncekiAnahtar.current = anahtar;
    const z = setTimeout(() => yukle(seyahatId, cip, bolge), hemen ? 0 : KARO_GECIKME_MS);
    return () => clearTimeout(z);
  }, [seyahatId, cip, bolge, yukle]);

  // Liste yalnız sürüm değişince yeniden sıralanır (#68 🔴2). Seyahat ekranı seyahat başına yeniden kurulur (key=id), bu
  // yüzden `seyahatId` bir kanca ömründe değişmez; yine de bağımlılıkta.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const yerler = useMemo(() => birikimListesi(birikimiAl(seyahatId).yerler), [seyahatId, surum]);
  return { yerler, yukleniyor: yolda > 0, hata };
}
