// #79 KK2: Keşfet'in ekran durumu SEYAHAT bazlı modül belleğinde tutulur — ekran yeniden kurulsa da (yığın, sekme, hızlı
// yenileme) filtre, seçili pin ve son görünür bölge aynı kalır; pinler aynı filtreyle süzülür, kamera aynı bölgeden açılır.
// Birikim (karoYukleme.birikimiAl) zaten seyahat bazlı; bu dosya onun yanına ekran durumunu koyar.
import { useCallback, useState } from 'react';

import type { HaritaBolgesi } from '@/components/harita/tipler';

import { BOS_FILTRE, type Filtre } from './filtre';

/** #29: önizleme kartındaki mekan — çip önerisinden, arama sonucundan ya da listedeki pinden. */
export type KesfetSecimi = { place_id: string; kaynak: 'oneri' | 'arama' | 'liste' };

export type KesfetDurumu = {
  filtre: Filtre;
  secim: KesfetSecimi | null;
  /** Son görünür bölge (onRegionChangeComplete); ekran yeniden kurulunca harita buradan açılır. */
  bolge: HaritaBolgesi | null;
};

const durumlar = new Map<string, KesfetDurumu>();

export function kesfetDurumunuAl(seyahatId: string): KesfetDurumu {
  let d = durumlar.get(seyahatId);
  if (!d) {
    d = { filtre: BOS_FILTRE, secim: null, bolge: null };
    durumlar.set(seyahatId, d);
  }
  return d;
}

/** Testler için. */
export function kesfetDurumunuSifirla() {
  durumlar.clear();
}

type Guncelleme<T> = T | ((onceki: T) => T);

/**
 * `useState` gibi, ama değer seyahatin belleğine de yazılır: bileşen yeniden kurulunca son değerle başlar.
 * Aynı seyahatin başka bir bileşeni aynı anda aboneyse onu uyarmaz (Keşfet tek örnektir).
 */
export function useKesfetDurumu<K extends keyof KesfetDurumu>(seyahatId: string, alan: K): [KesfetDurumu[K], (v: Guncelleme<KesfetDurumu[K]>) => void] {
  const [deger, setDeger] = useState<KesfetDurumu[K]>(() => kesfetDurumunuAl(seyahatId)[alan]);
  const yaz = useCallback(
    (v: Guncelleme<KesfetDurumu[K]>) => {
      setDeger((onceki) => {
        const yeni = typeof v === 'function' ? (v as (o: KesfetDurumu[K]) => KesfetDurumu[K])(onceki) : v;
        kesfetDurumunuAl(seyahatId)[alan] = yeni;
        return yeni;
      });
    },
    [seyahatId, alan],
  );
  return [deger, yaz];
}
