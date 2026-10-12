import sozluk from '@/i18n/yonetim.json';

// Panel metinleri ayrı dosyada: tr.json mobil pakete girer, ona eklemek android çıktısını değiştirirdi (#106 KK1).
type Dugum = { [anahtar: string]: string | Dugum };

/** `ty('menu.geziler')`, `ty('rol', { ad: 'Ece' })` — `t()` ile aynı kural ("{ad}" yer tutucuları). */
export function ty(anahtar: string, degerler?: Record<string, string | number>): string {
  let dugum: string | Dugum | undefined = sozluk as Dugum;
  for (const parca of anahtar.split('.')) {
    dugum = typeof dugum === 'object' ? dugum[parca] : undefined;
  }
  if (typeof dugum !== 'string') return anahtar;
  if (!degerler) return dugum;
  return dugum.replace(/\{(\w+)\}/g, (tam, ad: string) => (ad in degerler ? String(degerler[ad]) : tam));
}
