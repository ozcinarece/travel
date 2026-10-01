import type { SeyahatOzet } from '@/lib/tipler';
import { aktifMi, yerelTarih } from '@/lib/zaman';

/**
 * PRD 3.1 KK1–KK3: aktif (bugün aralıkta) · yaklaşan (gelecek + tarihsiz; sorgu tarihe göre artan, tarihsizler sonda)
 * · geçmiş (dönüş geçti; yeniden eskiye). "Bugün" seyahat şehrinin dilimine göredir.
 */
export function siniflandir(liste: SeyahatOzet[], an = new Date()) {
  const aktif: SeyahatOzet[] = [];
  const yaklasan: SeyahatOzet[] = [];
  const gecmis: SeyahatOzet[] = [];
  for (const sy of liste) {
    if (aktifMi(sy, an)) aktif.push(sy);
    else if (sy.end_date && sy.end_date < yerelTarih(an, sy.tz)) gecmis.push(sy);
    else yaklasan.push(sy);
  }
  gecmis.sort((a, b) => (a.end_date! > b.end_date! ? -1 : a.end_date! < b.end_date! ? 1 : 0));
  return { aktif, yaklasan, gecmis };
}
