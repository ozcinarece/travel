// #578 KK3: `src/assets/turkiye-iller.json`'daki 81 il yolundan (turkey-map-react, MIT) `public.il_sinirlari` için SQL
// değerleri üretir. Yollar yalnız mutlak M, L, C, z içerir; her Bezier parçası iki noktayla (orta ve uç) örneklenir,
// koordinatlar haritanın SVG biriminde (viewBox) 1 ondalıkla yazılır. Kullanım:
//   node scripts/il-sinirlari.mjs > /tmp/degerler.sql
// Çıktı migration'daki `insert into public.il_sinirlari … values` listesidir.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const yol = fileURLToPath(new URL('../src/assets/turkiye-iller.json', import.meta.url));
const iller = JSON.parse(readFileSync(yol, 'utf8'));

/** SVG yolunu halkalara böler (her `M` yeni halka). */
export function halkalar(d) {
  const parca = d.match(/[MLCz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const sonuc = [];
  let halka = [];
  let komut = null;
  let x = 0;
  let y = 0;
  for (let i = 0; i < parca.length; ) {
    const p = parca[i];
    if (/^[MLCz]$/.test(p)) {
      komut = p;
      i += 1;
      if (p === 'z' && halka.length) {
        sonuc.push(halka);
        halka = [];
      }
      continue;
    }
    if (komut === 'M') {
      if (halka.length) sonuc.push(halka);
      x = Number(parca[i]);
      y = Number(parca[i + 1]);
      halka = [[x, y]];
      i += 2;
      komut = 'L';
    } else if (komut === 'L') {
      x = Number(parca[i]);
      y = Number(parca[i + 1]);
      halka.push([x, y]);
      i += 2;
    } else if (komut === 'C') {
      const [x1, y1, x2, y2, x3, y3] = parca.slice(i, i + 6).map(Number);
      for (const t of [0.5, 1]) {
        const u = 1 - t;
        halka.push([
          u ** 3 * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
          u ** 3 * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
        ]);
      }
      x = x3;
      y = y3;
      i += 6;
    } else {
      throw new Error(`beklenmeyen yol parçası: ${p}`);
    }
  }
  if (halka.length) sonuc.push(halka);
  return sonuc;
}

const sayi = (n) => String(Math.round(n * 10) / 10);

const satirlar = [];
for (const il of iller) {
  halkalar(il.d).forEach((h, parcaNo) => {
    // Ardışık aynı noktalar atılır (yuvarlamadan sonra).
    const noktalar = [];
    for (const [x, y] of h) {
      const n = `(${sayi(x)},${sayi(y)})`;
      if (noktalar[noktalar.length - 1] !== n) noktalar.push(n);
    }
    if (noktalar.length >= 3) satirlar.push(`  (${il.plaka}, ${parcaNo + 1}, '(${noktalar.join(',')})')`);
  });
}
process.stdout.write(`${satirlar.join(',\n')};\n`);
