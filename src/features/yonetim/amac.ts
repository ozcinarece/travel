// #300 KK3: BO amaç çoklu seçimi — saf kural. Testli.
import { AKIS_AMACLARI, type Amac } from '@/features/icerik/amaclar';

/**
 * Bir amacı açar ya da kapatır. Sonuç `public.amac_listesi()` sırasında ve tekrarsız; listede olmayan eski değerler düşer
 * (DB check'i `amac_dizisi_gecerli` bunları zaten kabul etmez).
 */
export function amacDegistir(secili: readonly string[], amac: Amac): Amac[] {
  const acik = new Set(secili);
  if (acik.has(amac)) acik.delete(amac);
  else acik.add(amac);
  return AKIS_AMACLARI.filter((a) => acik.has(a));
}
