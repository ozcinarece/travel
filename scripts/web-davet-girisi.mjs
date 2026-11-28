// #550: web davet girişini (/r/{token}, /r/g/{token}) uygulamanın web çıktısına katar.
// Web yayını iki `expo export -p web` yapar: uygulamanın tamamı (dist) ve yalnız davet rotalarını içeren küçük giriş
// (`WEB_GIRIS=davet`, rota kökü src/davet-web; dist-davet). Bu betik:
//   1. küçük girişin JS'ini eski tarayıcılar için düşürür (KK4: Chrome 74 = Android 9 WebView, Safari 14; `?.`, `??`,
//      `??=`/`||=`/`&&=`, sınıf alanları) ve her dosyanın ES2019 olarak ayrıştırıldığını doğrular,
//   2. JS parçalarını ve eksik varlıkları dist'e kopyalar (adlar içerik özetli; çakışma olmaz),
//   3. dist'teki davet sayfalarını küçük girişin sayfalarıyla değiştirir; sayfalara girişin fontları için `preload` yazar
//      (KK2: fontlar JS'ten sonra değil, JS ile birlikte iner; açılış kapısı fontları bekler).
// Sonra (web-yayin'de) web-davet-acilis.mjs açılış katmanını, web-yonlendirmeler.js kopyaları ve `_redirects`'i yazar.
// Kullanım: node scripts/web-davet-girisi.mjs <dist> <dist-davet>
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DAVET_SAYFALARI } from './web-davet-acilis.mjs';

// Babel ve eklentileri Expo'nun kendi bağımlılıkları (babel-preset-expo); yeni paket eklenmez.
const presetGerek = createRequire(createRequire(import.meta.url).resolve('babel-preset-expo'));
const babel = presetGerek('@babel/core');
const gerek = createRequire(import.meta.url);
const acorn = gerek('acorn');
// Metro'nun kendi küçültücüsü (metro-minify-terser); Babel'in açtığı yardımcı değişkenleri yeniden sıkıştırır.
const { minify } = gerek('terser');

export const JS_DIZINI = '_expo/static/js/web';
/** Chrome 74 ve Safari 14'ün ikisinin de tam ayrıştırdığı sürüm (ES2020'nin `?.`/`??`'u Chrome 80'de geldi). */
export const HEDEF_ES = 2019;

const EKLENTILER = [
  ['@babel/plugin-transform-optional-chaining', { loose: true }],
  ['@babel/plugin-transform-nullish-coalescing-operator', { loose: true }],
  ['@babel/plugin-transform-logical-assignment-operators', { loose: true }],
  ['@babel/plugin-transform-class-properties', { loose: true }],
  ['@babel/plugin-transform-class-static-block', { loose: true }],
  ['@babel/plugin-transform-private-methods', { loose: true }],
  ['@babel/plugin-transform-private-property-in-object', { loose: true }],
].map(([ad, secenek]) => [presetGerek(ad), secenek]);

/** Kod ES2019 olarak ayrıştırılamıyorsa hatayı (konumuyla) fırlatır. */
export function ayristirilabilir(kod, ad = 'kod') {
  try {
    acorn.parse(kod, { ecmaVersion: HEDEF_ES, sourceType: 'script', allowHashBang: true });
  } catch (e) {
    const konum = typeof e.pos === 'number' ? ` …${kod.slice(Math.max(0, e.pos - 40), e.pos + 40)}…` : '';
    throw new Error(`${ad}: ES${HEDEF_ES} olarak ayrıştırılamadı (${e.message})${konum}`);
  }
}

/** Yeni sözdizimini eski karşılığına çevirir, ES2019 hedefiyle yeniden küçültür ve ES2019 ayrıştırmasını doğrular. */
export async function sozdizimiDusur(kod, ad = 'kod') {
  const sonuc = babel.transformSync(kod, {
    babelrc: false,
    configFile: false,
    sourceType: 'script',
    compact: true,
    minified: true,
    comments: false,
    plugins: EKLENTILER,
  });
  const kucuk = await minify(sonuc.code, { ecma: HEDEF_ES, module: false, toplevel: false, compress: true, mangle: true });
  ayristirilabilir(kucuk.code, ad);
  return kucuk.code;
}

function dosyalar(dizin) {
  const liste = [];
  for (const ad of readdirSync(dizin)) {
    const tam = path.join(dizin, ad);
    if (statSync(tam).isDirectory()) liste.push(...dosyalar(tam));
    else liste.push(tam);
  }
  return liste;
}

/** Sayfanın `<head>`'ine font ön yüklemesi yazar (aynı köken; FontFace CORS kipinde ister → `crossorigin`). */
export function fontOnYukle(html, fontlar) {
  if (!fontlar.length || html.includes('rel="preload" as="font"')) return html;
  const satirlar = fontlar.map((f) => `<link rel="preload" as="font" type="font/ttf" crossorigin href="${f}"/>`).join('');
  const yer = html.indexOf('</head>');
  if (yer < 0) throw new Error('</head> bulunamadı');
  return html.slice(0, yer) + satirlar + html.slice(yer);
}

/** Davet sayfalarının tam uygulamanın giriş JS'ini bulduğu meta (src/lib/davetWebGirisi.ts `UYGULAMA_JS_META`). */
export const UYGULAMA_JS_META = 'tripmate-uygulama-js';

/**
 * Tam uygulamanın giriş JS'inin adresini sayfaya meta olarak yazar. Davet girişi özeti çizdikten sonra bunu boşta önden
 * indirir (prefetch); "Seyahatime al", giriş ya da seyahate geçişteki tam yeniden yükleme beklemesin. İlk açılışta inmez.
 */
export function uygulamaJsYaz(html, adres) {
  if (!adres || html.includes(`name="${UYGULAMA_JS_META}"`)) return html;
  const yer = html.indexOf('</head>');
  if (yer < 0) throw new Error('</head> bulunamadı');
  return html.slice(0, yer) + `<meta name="${UYGULAMA_JS_META}" content="${adres}"/>` + html.slice(yer);
}

/** Küçük girişi dist'e katar; yazılan JS dosyalarını döner. */
export async function birlestir(dist, davet) {
  const jsKaynak = path.join(davet, JS_DIZINI);
  if (!existsSync(jsKaynak)) throw new Error(`davet girişinde JS yok: ${jsKaynak}`);
  for (const sayfa of DAVET_SAYFALARI) {
    if (!existsSync(path.join(davet, sayfa))) throw new Error(`davet girişinde sayfa yok: ${sayfa}`);
  }
  const jsHedef = path.join(dist, JS_DIZINI);
  mkdirSync(jsHedef, { recursive: true });
  // Tam uygulamanın giriş JS'i (kök sayfadan; yoksa önden indirme yazılmaz).
  const kokSayfa = path.join(dist, 'index.html');
  const uygulamaJs = existsSync(kokSayfa) ? (readFileSync(kokSayfa, 'utf8').match(/src="(\/_expo\/static\/js\/web\/entry-[0-9a-f]+\.js)"/)?.[1] ?? null) : null;
  const yazilan = [];
  for (const ad of readdirSync(jsKaynak)) {
    if (!ad.endsWith('.js')) continue; // kaynak haritaları yayına girmez
    const hedef = path.join(jsHedef, ad);
    if (existsSync(hedef)) throw new Error(`JS adı çakışıyor: ${ad}`);
    writeFileSync(hedef, await sozdizimiDusur(readFileSync(path.join(jsKaynak, ad), 'utf8'), ad));
    yazilan.push(ad);
  }
  // Varlıklar (font, ikon) iki derlemede aynı adla üretilir; yalnız eksik olan kopyalanır.
  const varlik = path.join(davet, 'assets');
  const fontlar = [];
  if (existsSync(varlik)) {
    for (const kaynak of dosyalar(varlik)) {
      // Yalnız açılış kapısının beklediği Figtree fontları ön yüklenir.
      if (/[\\/]Figtree_[^\\/]+\.ttf$/.test(kaynak)) fontlar.push('/' + path.relative(davet, kaynak).split(path.sep).join('/'));
      const hedef = path.join(dist, path.relative(davet, kaynak));
      if (existsSync(hedef)) continue;
      mkdirSync(path.dirname(hedef), { recursive: true });
      copyFileSync(kaynak, hedef);
    }
  }
  for (const sayfa of DAVET_SAYFALARI) {
    const hedef = path.join(dist, sayfa);
    mkdirSync(path.dirname(hedef), { recursive: true });
    writeFileSync(hedef, uygulamaJsYaz(fontOnYukle(readFileSync(path.join(davet, sayfa), 'utf8'), fontlar.sort()), uygulamaJs));
  }
  return yazilan;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dist, davet] = process.argv.slice(2);
  if (!dist || !davet) {
    console.error('kullanım: node scripts/web-davet-girisi.mjs <dist> <dist-davet>');
    process.exit(1);
  }
  const yazilan = await birlestir(dist, davet);
  console.log(`davet girişi (ES${HEDEF_ES}): ${yazilan.join(', ')}`);
  for (const sayfa of DAVET_SAYFALARI) console.log(`davet sayfası: ${sayfa}`);
}
