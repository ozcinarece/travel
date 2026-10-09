// #59 B: harita pin ikonlarını (kategori ikonu + ✓ + ev + rota oku) önceden PNG'ye çevirir.
// Kaynak: src/components/ui/Ikon.tsx'teki yollar ve src/lib/pinIkonu.ts'teki kategori renkleri; Chromium ile
// @1x/@2x/@3x çizilir (Playwright). Çıktı: assets/pin/*.png + src/components/harita/pinIkonlari.ts (statik require haritası).
// Çalıştırma: node scripts/pin-ikonlari.mjs  (playwright global ya da node_modules'ta olmalı)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// ---- Kategori renkleri (pinIkonu.ts KATEGORI_PIN) ve rota tonları (theme.ts rotaRenkleri).
const pinKaynak = readFileSync(join(kok, 'src/lib/pinIkonu.ts'), 'utf8');
const kategoriler = [...pinKaynak.matchAll(/\{ renk: '(#[0-9a-f]{6})', ikon: '(\w+)' \}/g)].map(([, renk, ikon]) => ({ ikon, renk }));
const temaKaynak = readFileSync(join(kok, 'src/theme.ts'), 'utf8');
const rotaTonlari = [...temaKaynak.match(/rotaRenkleri = \[([^\]]+)\]/)[1].matchAll(/'(#[0-9a-f]{6})'/g)].map((m) => m[1]);

const BEYAZ = '#ffffff';
/** Üretilecek ikonlar: ad, renk, px boyut, çizgi kalınlığı (PinIcerigi ile aynı). */
const istekler = [
  ...kategoriler.map((k) => ({ ikon: k.ikon, renk: k.renk, boyut: 14, kalinlik: 2.1 })),
  // #61 §4: listeye eklenen mekan = kategori renginde DOLU daire + beyaz kategori ikonu.
  ...kategoriler.map((k) => ({ ikon: k.ikon, renk: BEYAZ, boyut: 14, kalinlik: 2.1 })),
  { ikon: 'tik', renk: BEYAZ, boyut: 14, kalinlik: 2.4 },
  { ikon: 'ev', renk: BEYAZ, boyut: 16, kalinlik: 2.2 },
  // #65 (docs/05 §4): araba süre hapı — rota tonunda araba glifi 12 px.
  ...rotaTonlari.map((renk) => ({ ikon: 'araba', renk, boyut: 12, kalinlik: 2.2 })),
  // #59 C: rota yön oku "›" (12 px, beyaz, hafif koyu hale).
  { ikon: 'ok', renk: BEYAZ, boyut: 12, kalinlik: 2.4, hale: true },
];

/** 24×24 görünüm alanında ikonun iç öğeleri (Ikon.tsx yolları). */
function ikonIci(ikon, renk, kalinlik) {
  const ortak = `stroke="${renk}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const ogeler = ikon === 'ok' ? [{ tur: 'Path', oz: { d: 'M9 5l6 7-6 7' } }] : ikonYollari(ikon);
  return ogeler
    .map(({ tur, oz }) => {
      // Ikon.tsx: 'tik' kalınlığı +0,6; 'daha' dolgulu (burada kullanılmıyor).
      const sw = oz.strokeWidth ? (oz.strokeWidth.includes('kalinlik') ? kalinlik + 0.6 : Number(oz.strokeWidth)) : kalinlik;
      if (tur === 'Path') return `<path d="${oz.d}" stroke-width="${sw}" ${ortak}/>`;
      if (tur === 'Circle') return `<circle cx="${oz.cx}" cy="${oz.cy}" r="${oz.r}" stroke-width="${sw}" ${ortak}/>`;
      return `<rect x="${oz.x}" y="${oz.y}" width="${oz.width}" height="${oz.height}" rx="${oz.rx ?? 0}" stroke-width="${sw}" ${ortak}/>`;
    })
    .join('');
}

function svgMetni({ ikon, renk, boyut, kalinlik, hale }) {
  const golge = hale ? `<filter id="h"><feDropShadow dx="0" dy="0" stdDeviation="0.6" flood-color="#0f0f0f" flood-opacity="0.35"/></filter>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 24 24">${golge}<g${hale ? ' filter="url(#h)"' : ''}>${ikonIci(ikon, renk, kalinlik)}</g></svg>`;
}

const dosyaAdi = (i) => `${i.ikon}-${i.renk.slice(1)}`;

// ---- #61 §6 / #65 (docs/05 §2): TAM pin görselleri — Android'de görünüm yakalaması yok (Marker `image`).
// Daire 28 px: öneri beyaz zemin + kategori 2 px kenar · listede kategori dolu + beyaz 2 px kenar + sağ üstte ✓ rozeti
// (15 px siyah, 1,5 px beyaz kenar) · tamamlandı yeşil + ✓ · otel siyah kare r9 + ev 16. Hepsinde gölge 0 2 6 %22
// (kanvas PAD piksel pay; çapa yine merkez). Seçili = iğne 38 × 46 (2,5 px kenar, 2 px siyah dış halka, 17 px glif,
// gölge 0 4 10 %30); çapa iğnenin ucu (IGNE_CAPA).
const SIYAH = '#0f0f0f';
const YESIL = '#1f8a4c';
const PAD = 8;
const IGNE_PAD = 12;
const IGNE = { en: 38, boy: 46 };
/** #73 A: zoom ≥ 17,5 (pin 34) seçili iğne 44 × 53. */
const IGNE_34 = { en: 44, boy: 53 };
/** #73 A: yakınlaşınca pin boyu kademeleri (28 taban; 30 / 32 / 34 ek). Glif boyu oranla (28 → 14, 34 → 17). */
const BOYLAR = [28, 30, 32, 34];
/** Siyah dış halkanın yol ucundan dışa taşması ((2,5 + 4) / 2 px): görünen uç bu kadar aşağıda — çapa buna göre (#67 incelemesi). */
const IGNE_HALKA = 3.25;
/** { ad, cap, zemin, kenar, kenarKalinlik, ikon, ikonRenk, kare?, rozet?, igne?, yildiz? } — igne: IGNE ya da IGNE_34 ölçüsü. */
const pinIstekleri = [];
for (const k of kategoriler) {
  // #66 (docs/05 §2, KesfetZoom7): zoom < 13 küçük öneri pini 20 px, 1,5 px kenar, 11 px glif.
  pinIstekleri.push({ ad: `kucuk-${k.ikon}-20`, cap: 20, zemin: BEYAZ, kenar: k.renk, kenarKalinlik: 1.5, ikon: k.ikon, ikonRenk: k.renk, ikonPx: 11 });
  for (const cap of BOYLAR) {
    const ikonPx = Math.round(14 * cap / 28);
    pinIstekleri.push({ ad: `daire-${k.ikon}-${cap}`, cap, zemin: BEYAZ, kenar: k.renk, kenarKalinlik: 2, ikon: k.ikon, ikonRenk: k.renk, ikonPx });
    pinIstekleri.push({ ad: `dolu-${k.ikon}-${cap}`, cap, zemin: k.renk, kenar: BEYAZ, kenarKalinlik: 2, ikon: k.ikon, ikonRenk: BEYAZ, ikonPx, rozet: true });
    // #69 (docs/05 §2): öne çıkan — aynı görünüm + sol üstte turuncu ★ rozeti (öneri / listede).
    pinIstekleri.push({ ad: `one-daire-${k.ikon}-${cap}`, cap, zemin: BEYAZ, kenar: k.renk, kenarKalinlik: 2, ikon: k.ikon, ikonRenk: k.renk, ikonPx, yildiz: true });
    pinIstekleri.push({ ad: `one-dolu-${k.ikon}-${cap}`, cap, zemin: k.renk, kenar: BEYAZ, kenarKalinlik: 2, ikon: k.ikon, ikonRenk: BEYAZ, ikonPx, rozet: true, yildiz: true });
  }
  for (const [on, igne] of [['igne-', IGNE], ['igne34-', IGNE_34]]) {
    pinIstekleri.push({ ad: `${on}daire-${k.ikon}`, igne, zemin: BEYAZ, kenar: k.renk, kenarKalinlik: 2.5, ikon: k.ikon, ikonRenk: k.renk });
    pinIstekleri.push({ ad: `${on}dolu-${k.ikon}`, igne, zemin: k.renk, kenar: BEYAZ, kenarKalinlik: 2.5, ikon: k.ikon, ikonRenk: BEYAZ, rozet: true });
    pinIstekleri.push({ ad: `${on}one-daire-${k.ikon}`, igne, zemin: BEYAZ, kenar: k.renk, kenarKalinlik: 2.5, ikon: k.ikon, ikonRenk: k.renk, yildiz: true });
    pinIstekleri.push({ ad: `${on}one-dolu-${k.ikon}`, igne, zemin: k.renk, kenar: BEYAZ, kenarKalinlik: 2.5, ikon: k.ikon, ikonRenk: BEYAZ, rozet: true, yildiz: true });
  }
}
for (const cap of BOYLAR) {
  const ikonPx = Math.round(14 * cap / 28);
  pinIstekleri.push({ ad: `tik-${cap}`, cap, zemin: SIYAH, kenar: BEYAZ, kenarKalinlik: 2, ikon: 'tik', ikonRenk: BEYAZ, ikonPx, kalinlik: 2.4 });
  pinIstekleri.push({ ad: `tamam-${cap}`, cap, zemin: YESIL, kenar: BEYAZ, kenarKalinlik: 2, ikon: 'tik', ikonRenk: BEYAZ, ikonPx, kalinlik: 2.4 });
  pinIstekleri.push({ ad: `otel-${cap}`, cap, zemin: SIYAH, kenar: SIYAH, kenarKalinlik: 0, ikon: 'ev', ikonRenk: BEYAZ, ikonPx: Math.round(16 * cap / 28), kare: true });
}
for (const [on, igne] of [['igne-', IGNE], ['igne34-', IGNE_34]]) {
  pinIstekleri.push({ ad: `${on}tik`, igne, zemin: SIYAH, kenar: BEYAZ, kenarKalinlik: 2.5, ikon: 'tik', ikonRenk: BEYAZ, kalinlik: 2.4 });
  pinIstekleri.push({ ad: `${on}tamam`, igne, zemin: YESIL, kenar: BEYAZ, kenarKalinlik: 2.5, ikon: 'tik', ikonRenk: BEYAZ, kalinlik: 2.4 });
}

const GOLGE = `<filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f0f0f" flood-opacity="0.22"/></filter>`;
const IGNE_GOLGE = `<filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f0f0f" flood-opacity="0.3"/></filter>`;
const glif = (i, px, cx, cy) => `<g transform="translate(${cx - px / 2} ${cy - px / 2}) scale(${px / 24})">${ikonIci(i.ikon, i.ikonRenk, i.kalinlik ?? 2.1)}</g>`;
/** ✓ rozeti: 15 px siyah daire, 1,5 px beyaz kenar, 9 px beyaz ✓; merkezi (cx, cy). */
const TURUNCU = '#ff5a1f';
const YILDIZ = 'M12 2l3 7 7 .6-5.3 4.6 1.7 7.1L12 17.6 5.6 21.3l1.7-7.1L2 9.6 9 9z';
/** #69 ★ rozeti: 15 px turuncu daire, 1,5 px beyaz kenar, 8 px beyaz dolu yıldız; merkezi (cx, cy). */
const yildizRozet = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="6.75" fill="${TURUNCU}" stroke="${BEYAZ}" stroke-width="1.5"/><g transform="translate(${cx - 4} ${cy - 4}) scale(${8 / 24})"><path d="${YILDIZ}" fill="${BEYAZ}"/></g>`;
const rozet = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="6.75" fill="${SIYAH}" stroke="${BEYAZ}" stroke-width="1.5"/>${glif({ ikon: 'tik', ikonRenk: BEYAZ, kalinlik: 2.6 }, 9, cx, cy)}`;

function pinSvg(i) {
  if (i.igne) {
    // İğne: r baş + uca inen damla; kenar 2,5 (yol üstünde), dışında 2 px siyah halka (6,5 px siyah alt vuruş).
    // #73: IGNE (38 × 46) ya da IGNE_34 (44 × 53); eğri, glif ve rozet konumu oranla (k).
    const olcu = i.igne;
    const k = olcu.en / IGNE.en;
    const W = olcu.en + 2 * IGNE_PAD;
    const H = olcu.boy + 2 * IGNE_PAD;
    const cx = W / 2;
    const bas = IGNE_PAD + olcu.en / 2; // baş merkezi y
    const uc = IGNE_PAD + olcu.boy; // uç y
    const r = olcu.en / 2 - i.kenarKalinlik / 2;
    const yol = `M${cx} ${uc} C${cx - 6 * k} ${uc - 9 * k} ${cx - r} ${bas + 11 * k} ${cx - r} ${bas} a${r} ${r} 0 1 1 ${2 * r} 0 C${cx + r} ${bas + 11 * k} ${cx + 6 * k} ${uc - 9 * k} ${cx} ${uc} Z`;
    const rz = `${i.rozet ? rozet(cx + 12 * k, bas - 12 * k) : ''}${i.yildiz ? yildizRozet(cx - 12 * k, bas - 12 * k) : ''}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${IGNE_GOLGE}<g filter="url(#g)"><path d="${yol}" fill="${i.zemin}" stroke="${SIYAH}" stroke-width="${i.kenarKalinlik + 4}" stroke-linejoin="round"/><path d="${yol}" fill="${i.zemin}" stroke="${i.kenar}" stroke-width="${i.kenarKalinlik}" stroke-linejoin="round"/></g>${glif(i, Math.round(17 * k), cx, bas)}${rz}</svg>`;
  }
  const { cap } = i;
  const W = cap + 2 * PAD;
  const c = W / 2;
  const sekil = i.kare
    ? `<rect x="${PAD}" y="${PAD}" width="${cap}" height="${cap}" rx="9" fill="${i.zemin}"/>`
    : `<circle cx="${c}" cy="${c}" r="${(cap - i.kenarKalinlik) / 2}" fill="${i.zemin}" stroke="${i.kenar}" stroke-width="${i.kenarKalinlik}"/>`;
  const rk = cap / 28;
  const rz = `${i.rozet ? rozet(c + 10 * rk, c - 10 * rk) : ''}${i.yildiz ? yildizRozet(c - 10 * rk, c - 10 * rk) : ''}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${GOLGE}<g filter="url(#g)">${sekil}</g>${glif(i, i.ikonPx ?? 14, c, c)}${rz}</svg>`;
}

const cikti = join(kok, 'assets/pin');
// Eski üretimden kalan görseller silinir (ad değişince artık paketlenmesinler).
rmSync(cikti, { recursive: true, force: true });
mkdirSync(cikti, { recursive: true });
const tarayici = await chromium.launch();
for (const olcek of [1, 2, 3]) {
  const baglam = await tarayici.newContext({ deviceScaleFactor: olcek, viewport: { width: 200, height: 200 } });
  const sayfa = await baglam.newPage();
  const ciz = async (svg, ad) => {
    await sayfa.setContent(`<body style="margin:0;background:transparent"><div id="k" style="display:inline-block;line-height:0">${svg}</div></body>`);
    const png = await sayfa.locator('#k').screenshot({ omitBackground: true, type: 'png' });
    writeFileSync(join(cikti, `${ad}${olcek === 1 ? '' : `@${olcek}x`}.png`), png);
  };
  for (const i of istekler) await ciz(svgMetni(i), dosyaAdi(i));
  for (const i of pinIstekleri) await ciz(pinSvg(i), i.ad);
  await baglam.close();
}
await tarayici.close();

// ---- Statik require haritası (Metro yalnız sabit yolları paketler).
const satirlar = [...istekler.map(dosyaAdi), ...pinIstekleri.map((i) => i.ad)].map((ad) => `  '${ad}': require('../../../assets/pin/${ad}.png'),`).join('\n');
writeFileSync(
  join(kok, 'src/components/harita/pinIkonlari.ts'),
  `// ÜRETİLMİŞ DOSYA — scripts/pin-ikonlari.mjs (#59 B). Elle düzenleme; ikon/renk değişince betiği çalıştır.
import type { ImageRequireSource } from 'react-native';

/** "<ikon>-<rrggbb>" → paketlenmiş PNG (@1x/@2x/@3x). */
export const PIN_IKONLARI: Record<string, ImageRequireSource> = {
${satirlar}
};

/** "<ikon>-<rrggbb>" anahtarı. */
export function pinIkonuAnahtari(ikon: string, renk: string): string {
  return \`\${ikon}-\${renk.replace('#', '').toLowerCase()}\`;
}

/** #65: iğne (seçili) görselinin çapası — PNG içinde ucun konumu (kenar payı dahil). */
export const IGNE_CAPA = { x: 0.5, y: ${(IGNE_PAD + IGNE.boy + IGNE_HALKA) / (IGNE.boy + 2 * IGNE_PAD)} } as const;
/** #73: 34 kademesinde (44 × 53) seçili iğnenin çapası. */
export const IGNE_CAPA_34 = { x: 0.5, y: ${(IGNE_PAD + IGNE_34.boy + IGNE_HALKA) / (IGNE_34.boy + 2 * IGNE_PAD)} } as const;

/** Pin içi ikonun PNG'si; üretilmemiş (ikon, renk) çifti için undefined → SVG'ye düşülür. */
export function pinIkonuPng(ikon: string, renk: string): ImageRequireSource | undefined {
  return PIN_IKONLARI[pinIkonuAnahtari(ikon, renk)];
}
`,
);
console.log(`${istekler.length} ikon + ${pinIstekleri.length} pin × 3 ölçek → assets/pin, src/components/harita/pinIkonlari.ts`);
