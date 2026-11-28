// #542: Cloudflare Pages adı `node_modules` olan klasörleri yüklemez; web çıktısındaki `assets/node_modules/...` varlıkları
// (Figtree fontları, expo-router görselleri) canlıda dosya yerine SPA yedeği (index.html) döner. Bu betik `expo export`
// sonrasında çalışır:
//   1. dist altındaki her `node_modules` klasör adını (her derinlikte) `nm` yapar (dosyalar taşınır),
//   2. dist'teki .js/.html/.css/.json dosyalarında `assets/` ile başlayan yollardaki `node_modules` bölümlerini aynı biçimde
//      yeniden yazar (JS paketindeki `uri`, sayfalardaki font `preload`'ları),
//   3. denetler (KK3): dist'te `node_modules` adlı klasör ya da `assets/…/node_modules/` adresi kalırsa hata verir.
// Belirli bir pakete (Figtree vb.) bağlı değildir.
// Kullanım: node scripts/web-node-modules.mjs <dist>             (taşı + yeniden yaz + denetle)
//           node scripts/web-node-modules.mjs --denetle <dist>   (yalnız denetle; yayın adımından hemen önce)
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const YASAK = 'node_modules';
export const YENI = 'nm';
const METIN_UZANTILARI = new Set(['.js', '.html', '.css', '.json']);
// `assets/` ile başlayan bir URL yolu (tırnak, boşluk, parantez, `?`/`#` gibi sınırlara kadar). Önünde harf/rakam olmamalı.
const VARLIK_YOLU = /(?<![A-Za-z0-9_-])assets\/[A-Za-z0-9@._~%+\-/]*/g;
const BOLUM = /(^|\/)node_modules(?=\/|$)/g;

/** Göreli (posix) yoldaki her `node_modules` bölümünü `nm` yapar: `assets/node_modules/a/node_modules/b.ttf` → `assets/nm/a/nm/b.ttf`. */
export function yeniYol(goreli) {
  return goreli.replace(BOLUM, `$1${YENI}`);
}

/** Metindeki `assets/…` yollarında `node_modules` bölümlerini yeniden yazar; başka yerlerdeki `node_modules` metnine dokunmaz. */
export function metniYenidenYaz(metin) {
  return metin.replace(VARLIK_YOLU, (yol) => yeniYol(yol));
}

function* gez(dizin) {
  for (const giris of readdirSync(dizin, { withFileTypes: true })) {
    const tam = path.join(dizin, giris.name);
    if (giris.isDirectory()) yield* gez(tam);
    else yield tam;
  }
}

/** dist'te kalan sorunları listeler: `node_modules` adlı klasörler ve metin dosyalarındaki `assets/…/node_modules/` adresleri. */
export function denetle(dist) {
  const sorunlar = [];
  const klasorler = (dizin) => {
    for (const giris of readdirSync(dizin, { withFileTypes: true })) {
      if (!giris.isDirectory()) continue;
      const tam = path.join(dizin, giris.name);
      if (giris.name === YASAK) sorunlar.push(`klasör: ${path.relative(dist, tam)}`);
      klasorler(tam);
    }
  };
  klasorler(dist);
  for (const dosya of gez(dist)) {
    if (!METIN_UZANTILARI.has(path.extname(dosya))) continue;
    const kalan = (readFileSync(dosya, 'utf8').match(VARLIK_YOLU) ?? []).filter((y) => y !== yeniYol(y));
    for (const y of new Set(kalan)) sorunlar.push(`adres: ${path.relative(dist, dosya)} → ${y}`);
  }
  return sorunlar;
}

/** Taşır, yeniden yazar ve denetler. Dönen değer: taşınan dosya ve değişen metin dosyası sayıları. */
export function duzelt(dist) {
  let tasinan = 0;
  let degisen = 0;
  const bosalan = new Set();
  for (const dosya of [...gez(dist)]) {
    const goreli = path.relative(dist, dosya).split(path.sep).join('/');
    const yeni = yeniYol(goreli);
    if (yeni === goreli) continue;
    const hedef = path.join(dist, ...yeni.split('/'));
    if (existsSync(hedef)) throw new Error(`${goreli} → ${yeni}: hedef zaten var`);
    mkdirSync(path.dirname(hedef), { recursive: true });
    renameSync(dosya, hedef);
    tasinan++;
    // Boşalan `node_modules` klasörleri (ve altları) sonra silinir.
    for (let d = path.dirname(dosya); d.startsWith(dist + path.sep); d = path.dirname(d)) bosalan.add(d);
  }
  for (const d of [...bosalan].sort((a, b) => b.length - a.length)) {
    if (existsSync(d) && readdirSync(d).length === 0) rmdirSync(d);
  }
  for (const dosya of gez(dist)) {
    if (!METIN_UZANTILARI.has(path.extname(dosya))) continue;
    const eski = readFileSync(dosya, 'utf8');
    const yeni = metniYenidenYaz(eski);
    if (yeni === eski) continue;
    writeFileSync(dosya, yeni);
    degisen++;
  }
  const sorunlar = denetle(dist);
  if (sorunlar.length) throw new Error(`dist'te node_modules kaldı (#542):\n  ${sorunlar.join('\n  ')}`);
  return { tasinan, degisen };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argumanlar = process.argv.slice(2);
  const yalnizDenetle = argumanlar[0] === '--denetle';
  const dist = argumanlar[yalnizDenetle ? 1 : 0];
  if (!dist || !existsSync(dist)) {
    console.error('kullanım: node scripts/web-node-modules.mjs [--denetle] <dist>');
    process.exit(1);
  }
  const kok = path.resolve(dist);
  try {
    if (yalnizDenetle) {
      const sorunlar = denetle(kok);
      if (sorunlar.length) throw new Error(`dist'te node_modules var; Cloudflare Pages bunları yüklemez (#542):\n  ${sorunlar.join('\n  ')}`);
      console.log('node_modules denetimi: temiz');
    } else {
      const { tasinan, degisen } = duzelt(kok);
      console.log(`node_modules → ${YENI}: ${tasinan} dosya taşındı, ${degisen} metin dosyası yeniden yazıldı`);
    }
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
