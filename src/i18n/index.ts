import tr from './tr.json';

// PRD §11: v1 yalnızca Türkçe; metinler tr.json'da, koda gömülmez.
type Sozluk = { [anahtar: string]: string | Sozluk };

const sozluk: Sozluk = tr;

/** `t('seyahatler.baslik')`, `t('x.y', { n: 3 })` → "{n}" yer tutucuları doldurulur. */
export function t(anahtar: string, degerler?: Record<string, string | number>): string {
  let dugum: string | Sozluk | undefined = sozluk;
  for (const parca of anahtar.split('.')) {
    dugum = typeof dugum === 'object' ? dugum[parca] : undefined;
  }
  if (typeof dugum !== 'string') return anahtar;
  if (!degerler) return dugum;
  return dugum.replace(/\{(\w+)\}/g, (tam, ad: string) => (ad in degerler ? String(degerler[ad]) : tam));
}
