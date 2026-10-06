// #33: rota çizgilerinden bacak etiketi pinleri ("🚶 12 dk" hapı, bacağın ortasında).
import { cizgiOrtasi } from '@/lib/polyline';

import type { HaritaCizgisi, HaritaPini } from './tipler';

export function bacakEtiketPinleri(cizgiler: HaritaCizgisi[]): HaritaPini[] {
  const pinler: HaritaPini[] = [];
  for (const c of cizgiler) {
    if (!c.etiket) continue;
    const orta = cizgiOrtasi(c.noktalar);
    if (!orta) continue;
    pinler.push({ id: `bacak:${c.id}`, konum: orta, renk: c.renk, tur: 'etiket', etiket: c.etiket, etiketIkon: c.etiketIkon });
  }
  return pinler;
}
