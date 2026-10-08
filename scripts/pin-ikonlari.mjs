// #59 B: harita pin ikonlarını (kategori ikonu + ✓ + ev + rota oku) önceden PNG'ye çevirir.
// Kaynak: src/components/ui/Ikon.tsx'teki yollar ve src/lib/pinIkonu.ts'teki kategori renkleri; Chromium ile
// @1x/@2x/@3x çizilir (Playwright). Çıktı: assets/pin/*.png + src/components/harita/pinIkonlari.ts (statik require haritası).
// Çalıştırma: node scripts/pin-ikonlari.mjs  (playwright global ya da node_modules'ta olmalı)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try {
    return require('playwright');
  } catch {
    return require('/opt/node22/lib/node_modules/playwright');
  }
})();

// ---- Ikon.tsx'ten yolları çıkar: `ad === 'x' ? ( ...<Path d="..."/> ... ) :` blokları.
const ikonKaynak = readFileSync(join(kok, 'src/components/ui/Ikon.tsx'), 'utf8');
function ikonYollari(ad) {
  const bas = ikonKaynak.indexOf(`ad === '${ad}' ?`);
  if (bas < 0) throw new Error(`Ikon.tsx'te '${ad}' yok`);
  const son = ikonKaynak.indexOf(') : ', bas + 10);
  const blok = ikonKaynak.slice(bas, son);
  const etiketler = [...blok.matchAll(/<(Path|Circle|Rect)([^>]*)\/>/g)];
  return etiketler.map(([, tur, ozellikler]) => {
    const oz = {};
    for (const [, ad2, deger] of ozellikler.matchAll(/(\w+)=(?:"([^"]*)"|\{([^}]*)\})/g)) oz[ad2] = deger ?? ozellikler.match(new RegExp(`${ad2}=\\{([^}]*)\\}`))[1];
    return { tur, oz };
  });
}

// ---- Kategori renkleri (pinIkonu.ts KATEGORI_PIN).
const pinKaynak = readFileSync(join(kok, 'src/lib/pinIkonu.ts'), 'utf8');
const kategoriler = [...pinKaynak.matchAll(/\{ renk: '(#[0-9a-f]{6})', ikon: '(\w+)' \}/g)].map(([, renk, ikon]) => ({ ikon, renk }));

const BEYAZ = '#ffffff';
/** Üretilecek ikonlar: ad, renk, px boyut, çizgi kalınlığı (PinIcerigi ile aynı). */
const istekler = [
  ...kategoriler.map((k) => ({ ikon: k.ikon, renk: k.renk, boyut: 14, kalinlik: 2.1 })),
  { ikon: 'tik', renk: BEYAZ, boyut: 14, kalinlik: 2.4 },
  { ikon: 'ev', renk: BEYAZ, boyut: 16, kalinlik: 2.2 },
  // Taksi bacağı hapı ("taksi 14 dk", #33/#59 C).
  { ikon: 'taksi', renk: '#0f0f0f', boyut: 13, kalinlik: 2.2 },
  // #59 C: rota yön oku "›" (12 px, beyaz, hafif koyu hale).
  { ikon: 'ok', renk: BEYAZ, boyut: 12, kalinlik: 2.4, hale: true },
];

function svgMetni({ ikon, renk, boyut, kalinlik, hale }) {
  const ortak = `stroke="${renk}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const ogeler =
    ikon === 'ok'
      ? [{ tur: 'Path', oz: { d: 'M9 5l6 7-6 7' } }]
      : ikonYollari(ikon);
  const ic = ogeler
    .map(({ tur, oz }) => {
      // Ikon.tsx: 'tik' kalınlığı +0,6; 'daha' dolgulu (burada kullanılmıyor).
      const sw = oz.strokeWidth ? (oz.strokeWidth.includes('kalinlik') ? kalinlik + 0.6 : Number(oz.strokeWidth)) : kalinlik;
      if (tur === 'Path') return `<path d="${oz.d}" stroke-width="${sw}" ${ortak}/>`;
      if (tur === 'Circle') return `<circle cx="${oz.cx}" cy="${oz.cy}" r="${oz.r}" stroke-width="${sw}" ${ortak}/>`;
      return `<rect x="${oz.x}" y="${oz.y}" width="${oz.width}" height="${oz.height}" rx="${oz.rx ?? 0}" stroke-width="${sw}" ${ortak}/>`;
    })
    .join('');
  const golge = hale ? `<filter id="h"><feDropShadow dx="0" dy="0" stdDeviation="0.6" flood-color="#0f0f0f" flood-opacity="0.35"/></filter>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 24 24">${golge}<g${hale ? ' filter="url(#h)"' : ''}>${ic}</g></svg>`;
}

const dosyaAdi = (i) => `${i.ikon}-${i.renk.slice(1)}`;

const cikti = join(kok, 'assets/pin');
mkdirSync(cikti, { recursive: true });
const tarayici = await chromium.launch();
for (const olcek of [1, 2, 3]) {
  const baglam = await tarayici.newContext({ deviceScaleFactor: olcek, viewport: { width: 200, height: 200 } });
  const sayfa = await baglam.newPage();
  for (const i of istekler) {
    await sayfa.setContent(`<body style="margin:0;background:transparent"><div id="k" style="display:inline-block;line-height:0">${svgMetni(i)}</div></body>`);
    const png = await sayfa.locator('#k').screenshot({ omitBackground: true, type: 'png' });
    writeFileSync(join(cikti, `${dosyaAdi(i)}${olcek === 1 ? '' : `@${olcek}x`}.png`), png);
  }
  await baglam.close();
}
await tarayici.close();

// ---- Statik require haritası (Metro yalnız sabit yolları paketler).
const satirlar = istekler.map((i) => `  '${dosyaAdi(i)}': require('../../../assets/pin/${dosyaAdi(i)}.png'),`).join('\n');
writeFileSync(
  join(kok, 'src/components/harita/pinIkonlari.ts'),
  `// ÜRETİLMİŞ DOSYA — scripts/pin-ikonlari.mjs (#59 B). Elle düzenleme; ikon/renk değişince betiği çalıştır.
import type { ImageRequireSource } from 'react-native';

/** "<ikon>-<rrggbb>" → paketlenmiş PNG (@1x/@2x/@3x). */
export const PIN_IKONLARI: Record<string, ImageRequireSource> = {
${satirlar}
};

/** Pin içi ikonun PNG'si; üretilmemiş (ikon, renk) çifti için undefined → SVG'ye düşülür. */
export function pinIkonuPng(ikon: string, renk: string): ImageRequireSource | undefined {
  return PIN_IKONLARI[\`\${ikon}-\${renk.replace('#', '').toLowerCase()}\`];
}
`,
);
console.log(`${istekler.length} ikon × 3 ölçek → assets/pin, src/components/harita/pinIkonlari.ts`);
