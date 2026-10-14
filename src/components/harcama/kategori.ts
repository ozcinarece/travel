// #183 (kanvas 25): harcama kategorilerinin 40 px kutusu — açık zemin + koyu çizgi ikon.
import type { IkonAdi } from '@/components/ui/Ikon';
import type { HarcamaKategorisi } from '@/features/harcama/hesap';

export const KATEGORI_GORUNUMU: Record<HarcamaKategorisi, { ikon: IkonAdi; zemin: string; renk: string }> = {
  yemek: { ikon: 'catal', zemin: '#ffe2cc', renk: '#d9480f' },
  ulasim: { ikon: 'tramvay', zemin: '#dce6ff', renk: '#2c64f5' },
  konaklama: { ikon: 'yatak', zemin: '#eef2ff', renk: '#152a6b' },
  bilet: { ikon: 'bilet', zemin: '#e6e0fa', renk: '#7b4fe0' },
  diger: { ikon: 'cuzdan', zemin: '#e3f5ee', renk: '#0e7a52' },
};

/** Durağın kategorisinden harcama kategorisi tahmini (Plan'dan açılınca). */
export function durakKategorisi(primaryType: string | null | undefined): HarcamaKategorisi {
  const t = primaryType ?? '';
  if (/restaurant|cafe|bakery|bar|food|meal|coffee/.test(t)) return 'yemek';
  if (/museum|attraction|gallery|zoo|aquarium|park|landmark|theater|cinema/.test(t)) return 'bilet';
  if (/hotel|lodging|hostel/.test(t)) return 'konaklama';
  if (/station|airport|transit/.test(t)) return 'ulasim';
  return 'diger';
}
