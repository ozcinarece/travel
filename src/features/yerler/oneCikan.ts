// #69 §A3: öne çıkan kümesi kancası — liste değişince yeniden hesaplanır; dolu bir küme en fazla 10 sn'de bir değişir
// (rozet yanıp sönmesin). Küme boşken (açılış, ilk karolar) hemen hesaplanır (#70 incelemesi 🔴2).
import { useEffect, useRef, useState } from 'react';

import type { HafifYer } from './api';
import { ONE_CIKAN_YENILEME_MS, oneCikanlar } from './filtre';

export function useOneCikanlar(yerler: HafifYer[]): Set<string> {
  const [kume, setKume] = useState<Set<string>>(() => oneCikanlar(yerler));
  const sonHesap = useRef(0);
  const bos = kume.size === 0;
  useEffect(() => {
    const bekle = bos ? 0 : Math.max(0, sonHesap.current + ONE_CIKAN_YENILEME_MS - Date.now());
    const z = setTimeout(() => {
      const yeni = oneCikanlar(yerler);
      setKume((eski) => (yeni.size === eski.size && [...yeni].every((id) => eski.has(id)) ? eski : yeni));
      if (yeni.size > 0) sonHesap.current = Date.now();
    }, bekle);
    return () => clearTimeout(z);
  }, [yerler, bos]);
  return kume;
}
