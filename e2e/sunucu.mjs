// #550: web çıktısını Cloudflare Pages gibi sunan yerel sunucu (uçtan uca testler ve ölçüm). gzip (seviye 6), `_redirects`
// 200 kuralları (`/r/:token /r/_token 200`), uzantısız yol → `.html`, bilinmeyen yol → index.html (Pages SPA davranışı),
// Pages'in önbellek başlıkları (`public, max-age=0, must-revalidate` + ETag, eşleşen istekte 304).
// Kullanım: node e2e/sunucu.mjs [dist] [port]   (ya da WEB_DIST / PORT)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const kok = path.resolve(process.argv[2] ?? process.env.WEB_DIST ?? 'dist');
const port = Number(process.argv[3] ?? process.env.PORT ?? 4310);

const TUR = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};
const SIKISIR = new Set(['.html', '.js', '.css', '.json', '.svg', '.ttf']);

const kurallar = existsSync(path.join(kok, '_redirects'))
  ? readFileSync(path.join(kok, '_redirects'), 'utf8')
      .split('\n')
      .map((s) => s.trim().split(/\s+/))
      .filter((p) => p.length === 3 && p[2] === '200')
      .map(([kaynak, hedef]) => {
        const adlar = [];
        const desen = new RegExp('^' + kaynak.replace(/:([A-Za-z_]+)/g, (_, ad) => (adlar.push(ad), '([^/]+)')) + '/?$');
        return { desen, hedef };
      })
  : [];

function dosyaBul(yol) {
  const aday = (p) => {
    const tam = path.join(kok, p);
    return tam.startsWith(kok) && existsSync(tam) && statSync(tam).isFile() ? tam : null;
  };
  const cozuk = decodeURIComponent(yol);
  for (const k of kurallar) if (k.desen.test(cozuk)) return aday(k.hedef + '.html') ?? aday(k.hedef);
  return aday(cozuk) ?? aday(cozuk.replace(/\/$/, '') + '.html') ?? aday(path.join(cozuk, 'index.html')) ?? aday('index.html');
}

createServer((istek, yanit) => {
  const yol = new URL(istek.url ?? '/', 'http://yerel').pathname;
  const dosya = dosyaBul(yol);
  if (!dosya) {
    yanit.writeHead(404).end();
    return;
  }
  const uzanti = path.extname(dosya);
  let govde = readFileSync(dosya);
  const etiket = `"${createHash('sha1').update(govde).digest('hex')}"`;
  const basliklar = { 'content-type': TUR[uzanti] ?? 'application/octet-stream', 'cache-control': 'public, max-age=0, must-revalidate', etag: etiket };
  if (istek.headers['if-none-match'] === etiket) {
    yanit.writeHead(304, basliklar).end();
    return;
  }
  if (SIKISIR.has(uzanti) && /\bgzip\b/.test(String(istek.headers['accept-encoding'] ?? ''))) {
    govde = gzipSync(govde, { level: 6 });
    basliklar['content-encoding'] = 'gzip';
  }
  basliklar['content-length'] = String(govde.length);
  yanit.writeHead(200, basliklar).end(govde);
}).listen(port, '127.0.0.1', () => console.log(`web çıktısı: http://127.0.0.1:${port} (${kok})`));
