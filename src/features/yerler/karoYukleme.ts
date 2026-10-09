// #66: Keşfet öneri yükleyicisi — görünür karolardan önbellekte olmayanlar kaydırma bittikten 400 ms sonra istenir;
// sonuçlar seyahatin birikimli listesine eklenir. Karo önbelleği (tip kümesi + karo) geneldir; birikim SEYAHATE göre
// ayrılır (#68 incelemesi 🔴3). İkisi de oturum boyu modül belleğinde: ekran yeniden açılsa da az önce görülen mekanlar
// yerinde. Oturum başına karo isteği sayacı (__DEV__ konsolu + tur başına Sentry izi).
// #69: çip yok — istekler `hepsi` kümesi + seçili kategori kümeleriyle (KK10); birikim kümeden bağımsız tek liste.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { HaritaBolgesi } from '@/components/harita/tipler';
import { izBirak } from '@/lib/hataRaporu';

import { yakinYerler, type HafifYer, type OneriCipi } from './api';
import { birikimeEkle, birikimListesi, istenecekKarolar, KARO_EN_FAZLA_ISTEK, KARO_GECIKME_MS, karoOnbellekAnahtari, type Karo } from './karolar';

type Durum = 'yolda' | 'tamam';
/** tipKümesi|karo → durum (yolda / tamam). Hatalı istek silinir → sıradaki turda yeniden denenir. */
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
async function karoyuGetir(seyahatId: string, kume: OneriCipi, karo: Karo): Promise<number> {
  const anahtar = karoOnbellekAnahtari(kume, karo);
  karoDurumu.set(anahtar, 'yolda');
  karoSayaci.istek += 1;
  try {
    const yerler = await yakinYerler({ cip: kume, merkez: { lat: karo.merkez.lat, lng: karo.merkez.lng, yaricapM: karo.yaricapM } });
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
 * Bir yükleme turu: her küme için görünür karolardan önbellekte / yolda olmayanlar istenir; görünüm başına 12 karo sınırı
 * kümelerin toplamına uygulanır (ilk küme — `hepsi` — önce). Son hatadan sonra 30 sn yeni tur açılmaz
 * (`istenen: 0, hata: true`). Tur bitince tek Sentry izi.
 */
export async function turBaslat(seyahatId: string, kumeler: OneriCipi[], bolge: HaritaBolgesi, simdi = Date.now()): Promise<TurSonucu> {
  if (sonHataZamani && simdi - sonHataZamani < HATA_BEKLEME_MS) return { istenen: 0, yeni: 0, hata: true };
  const istekler: { kume: OneriCipi; karo: Karo }[] = [];
  for (const kume of kumeler) {
    const kalan = KARO_EN_FAZLA_ISTEK - istekler.length;
    if (kalan <= 0) break;
    for (const karo of istenecekKarolar(bolge, kume, (a) => karoDurumu.has(a), kalan)) istekler.push({ kume, karo });
  }
  if (istekler.length === 0) return { istenen: 0, yeni: 0, hata: false };
  karoSayaci.tur += 1;
  if (__DEV__) console.log(`[kesfet] ${kumeler.join('+')} zoom ${bolge.zoom.toFixed(2)} → ${istekler.length} karo isteği (oturum toplamı ${karoSayaci.istek + istekler.length})`);
  const sonuclar = await Promise.allSettled(istekler.map(({ kume, karo }) => karoyuGetir(seyahatId, kume, karo)));
  const yeni = sonuclar.reduce((t, s) => t + (s.status === 'fulfilled' ? s.value : 0), 0);
  const hata = sonuclar.some((s) => s.status === 'rejected');
  izBirak('kesfet.karo', `tur ${karoSayaci.tur}: ${kumeler.join('+')} ${istekler.length} karo, ${yeni} yeni mekan${hata ? ', hata var' : ''} (oturum ${karoSayaci.istek} istek)`, hata ? 'error' : 'info');
  return { istenen: istekler.length, yeni, hata };
}

export type KaroOnerileri = {
  /** Seyahatin birikimli listesi (popülerlik sırasıyla; yalnız yeni mekan gelince yeniden hesaplanır). */
  yerler: HafifYer[];
  /** En az bir karo turu yolda. */
  yukleniyor: boolean;
  /** Son turda en az bir karo isteği başarısız oldu (30 sn sonra sıradaki kaydırmada yeniden denenir). */
  hata: boolean;
};

/**
 * `kumeler`: istenecek tip kümeleri (#69: `['hepsi', ...seçili kategoriler]`). Küme listesi / seyahat değişince hemen,
 * bölge değişince 400 ms sonra yeni tur.
 */
export function useKaroOnerileri(seyahatId: string, kumeler: OneriCipi[], bolge: HaritaBolgesi | null): KaroOnerileri {
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

  const yukle = useCallback((id: string, k: OneriCipi[], b: HaritaBolgesi) => {
    setYolda((n) => n + 1);
    turBaslat(id, k, b)
      .then((s) => {
        if (!canli.current) return;
        setHata(s.hata);
        setSurum(birikimiAl(id).surum);
      })
      .finally(() => {
        if (canli.current) setYolda((n) => n - 1);
      });
  }, []);

  // Kaydırma / yakınlaştırma bitince 400 ms bekle; bu sürede yeni bölge gelirse öncekini iptal et. Küme / seyahat değişince hemen.
  const kumeAnahtari = kumeler.join('+');
  const oncekiAnahtar = useRef<string | null>(null);
  useEffect(() => {
    if (!bolge) return;
    const anahtar = `${seyahatId}|${kumeAnahtari}`;
    const hemen = oncekiAnahtar.current !== anahtar;
    oncekiAnahtar.current = anahtar;
    const z = setTimeout(() => yukle(seyahatId, kumeAnahtari.split('+') as OneriCipi[], bolge), hemen ? 0 : KARO_GECIKME_MS);
    return () => clearTimeout(z);
  }, [seyahatId, kumeAnahtari, bolge, yukle]);

  // Liste yalnız sürüm değişince yeniden sıralanır (#68 🔴2). Seyahat ekranı seyahat başına yeniden kurulur (key=id), bu
  // yüzden `seyahatId` bir kanca ömründe değişmez; yine de bağımlılıkta.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const yerler = useMemo(() => birikimListesi(birikimiAl(seyahatId).yerler), [seyahatId, surum]);
  return { yerler, yukleniyor: yolda > 0, hata };
}
