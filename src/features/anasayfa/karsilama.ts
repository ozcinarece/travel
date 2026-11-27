// #569 KK5 (Ürün notu 27 Kasım 14:12, #586): gezisi olmayan kartın görselleri BO'dan — ana sayfa bölümü `karsilama`, içerik
// `kapaklar: [{url, atif?}]` (en çok 8). Her açılışta sıradaki görsel gösterilir; sıra cihazda (AsyncStorage, try/catch;
// depolama yoksa rastgele). Kendi kendine kayan slayt yok. Sıradaki görsel önceden indirilir. Hiç görsel yoksa (tür henüz
// yok, bölüm kapalı ya da boş) çağıran Eskişehir'in BO kapağına düşer (`yedekKapak`).
// `karsilama` türünün migration'ı #586'da: tür yokken görünümde böyle satır olmaz, okuma sessizce boş döner.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { fotoOnceYukle } from '@/components/ui/Foto';
import { kapakAtfiOku } from '@/features/icerik/kapakAtfi';

import type { Kapak } from './v9';

export const KARSILAMA_EN_COK = 8;
export const KARSILAMA_SIRA_ANAHTARI = 'anasayfa:karsilama:sira';

/** Bölüm satırından karşılama görselleri: yalnız `karsilama` türü, https adresli öğeler, en çok 8; biçim bozuksa boş. */
export function karsilamaKapaklari(bolumler: readonly { tur: string; icerik: unknown }[] | null | undefined): Kapak[] {
  const b = (bolumler ?? []).find((x) => x.tur === 'karsilama');
  const ham = b && b.icerik && typeof b.icerik === 'object' ? (b.icerik as { kapaklar?: unknown }).kapaklar : undefined;
  if (!Array.isArray(ham)) return [];
  const kapaklar: Kapak[] = [];
  for (const k of ham) {
    if (!k || typeof k !== 'object') continue;
    const { url, atif } = k as { url?: unknown; atif?: unknown };
    if (typeof url !== 'string' || !/^https:\/\/\S+$/.test(url)) continue;
    kapaklar.push({ url, atif: kapakAtfiOku(atif) });
    if (kapaklar.length === KARSILAMA_EN_COK) break;
  }
  return kapaklar;
}

/** Bu açılışta gösterilecek sıra: öncekinin bir sonrası (başa döner); önceki yoksa ilk; okunamadıysa rastgele. */
export function siradakiSira(onceki: string | null | undefined, adet: number, rastgele: () => number = Math.random): number {
  if (adet <= 0) return 0;
  if (onceki === undefined) return Math.floor(rastgele() * adet) % adet;
  const n = onceki === null ? NaN : Number.parseInt(onceki, 10);
  return Number.isInteger(n) && n >= 0 ? (n + 1) % adet : 0;
}

/**
 * Açılışta bir kez sıra seçer ve cihaza yazar; sıradakini önceden indirir. Görsel listesi gelene kadar (ya da boşsa) null.
 * Depolama okunurken null kalır (önce bir görsel gösterip sonra değiştirmesin); okuma hata verirse rastgele.
 */
export function useKarsilamaKapagi(kapaklar: readonly Kapak[]): Kapak | null {
  const adet = kapaklar.length;
  const [sira, setSira] = useState<number | null>(null);
  const secildi = useRef(false);
  useEffect(() => {
    if (adet === 0 || secildi.current) return;
    secildi.current = true;
    const sec = (onceki: string | null | undefined) => {
      const s = siradakiSira(onceki, adet);
      setSira(s);
      if (onceki !== undefined) AsyncStorage.setItem(KARSILAMA_SIRA_ANAHTARI, String(s)).catch(() => undefined);
    };
    try {
      AsyncStorage.getItem(KARSILAMA_SIRA_ANAHTARI).then(sec, () => sec(undefined));
    } catch {
      sec(undefined);
    }
  }, [adet]);
  const gosterilen = sira === null || adet === 0 ? null : kapaklar[sira % adet];
  const sonraki = sira === null || adet < 2 ? null : kapaklar[(sira + 1) % adet].url;
  useEffect(() => {
    if (sonraki) fotoOnceYukle(sonraki);
  }, [sonraki]);
  return gosterilen;
}
