// node --test scripts/web-node-modules.test.mjs (CI `uygulama` işinde çalışır)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { denetle, duzelt, metniYenidenYaz, yeniYol } from './web-node-modules.mjs';

function distKur(dosyalar) {
  const dist = path.join(mkdtempSync(path.join(tmpdir(), 'web-nm-')), 'dist');
  for (const [goreli, icerik] of Object.entries(dosyalar)) {
    const tam = path.join(dist, goreli);
    mkdirSync(path.dirname(tam), { recursive: true });
    writeFileSync(tam, icerik);
  }
  return dist;
}

test('yol: her derinlikteki node_modules bölümü nm olur, benzer adlar korunur', () => {
  assert.equal(yeniYol('assets/node_modules/@expo-google-fonts/figtree/400Regular/F.ttf'), 'assets/nm/@expo-google-fonts/figtree/400Regular/F.ttf');
  assert.equal(yeniYol('assets/node_modules/a/node_modules/b/x.png'), 'assets/nm/a/nm/b/x.png');
  assert.equal(yeniYol('assets/x/node_modules'), 'assets/x/nm');
  assert.equal(yeniYol('assets/my_node_modules/node_modules_x/y.png'), 'assets/my_node_modules/node_modules_x/y.png');
  assert.equal(yeniYol('assets/fonts/figtree/Figtree.woff2'), 'assets/fonts/figtree/Figtree.woff2');
});

test('metin: yalnız assets/ yollarındaki node_modules yeniden yazılır', () => {
  const js =
    'i.exports={uri:"/assets/node_modules/expo-router/assets/a.png",width:1};' +
    "var f='assets/node_modules/x/node_modules/y/F.ttf?v=1#z';" +
    'var u=`https://ornek.app/assets/node_modules/p/q.ttf`;' +
    'throw Error("Cannot find module in node_modules/foo");var k="myassets/node_modules/x";';
  const cikti = metniYenidenYaz(js);
  assert.ok(cikti.includes('uri:"/assets/nm/expo-router/assets/a.png"'));
  assert.ok(cikti.includes("'assets/nm/x/nm/y/F.ttf?v=1#z'"));
  assert.ok(cikti.includes('https://ornek.app/assets/nm/p/q.ttf'));
  // Varlık yolu olmayan metin değişmez.
  assert.ok(cikti.includes('Cannot find module in node_modules/foo'));
  assert.ok(cikti.includes('"myassets/node_modules/x"'));
  const html = '<link rel="preload" as="font" type="font/ttf" crossorigin href="/assets/node_modules/@expo-google-fonts/figtree/700Bold/F.ttf"/>';
  assert.equal(metniYenidenYaz(html), html.replace('/node_modules/', '/nm/'));
  const css = '@font-face{src:url(/assets/node_modules/a/F.ttf)}';
  assert.equal(metniYenidenYaz(css), '@font-face{src:url(/assets/nm/a/F.ttf)}');
});

test('dist: dosyalar taşınır, js/html/css/json yeniden yazılır, node_modules klasörü kalmaz', () => {
  const dist = distKur({
    'assets/node_modules/@expo-google-fonts/figtree/400Regular/F.abc.ttf': 'FONT',
    'assets/node_modules/expo-router/assets/node_modules/derin/x.png': 'PNG',
    'assets/images/logo.png': 'LOGO',
    '_expo/static/js/web/entry-1.js': 'a={uri:"/assets/node_modules/@expo-google-fonts/figtree/400Regular/F.abc.ttf"}',
    'r/[token].html': '<link href="/assets/node_modules/@expo-google-fonts/figtree/400Regular/F.abc.ttf"><img src="/assets/node_modules/expo-router/assets/node_modules/derin/x.png">',
    'stil.css': 'url("/assets/node_modules/expo-router/assets/node_modules/derin/x.png")',
    'metadata.json': '{"a":"assets/node_modules/expo-router/assets/node_modules/derin/x.png"}',
    'not.txt': '/assets/node_modules/a/F.abc.ttf',
    _headers: '/assets/node_modules/*\n  Cache-Control: max-age=31536000\n',
    _redirects: '/eski.ttf /assets/node_modules/a/F.abc.ttf 301\n',
    'ikon.svg': '<svg><image href="/assets/node_modules/a/x.png"/></svg>',
    'manifest.webmanifest': '{"icons":[{"src":"/assets/node_modules/a/i.png"}]}',
    'sw.mjs': 'export const u="/assets/node_modules/a/F.abc.ttf";',
    'ikili.bin': '/assets/node_modules/dokunulmaz',
  });
  assert.equal(denetle(dist).length, 13); // 2 klasör + 11 adres (html iki ayrı adres)
  assert.deepEqual(duzelt(dist), { tasinan: 2, degisen: 10 });
  assert.deepEqual(denetle(dist), []);
  assert.equal(readFileSync(path.join(dist, 'assets/nm/@expo-google-fonts/figtree/400Regular/F.abc.ttf'), 'utf8'), 'FONT');
  assert.equal(readFileSync(path.join(dist, 'assets/nm/expo-router/assets/nm/derin/x.png'), 'utf8'), 'PNG');
  assert.equal(readFileSync(path.join(dist, 'assets/images/logo.png'), 'utf8'), 'LOGO');
  assert.ok(!existsSync(path.join(dist, 'assets/node_modules')));
  assert.equal(readFileSync(path.join(dist, '_expo/static/js/web/entry-1.js'), 'utf8'), 'a={uri:"/assets/nm/@expo-google-fonts/figtree/400Regular/F.abc.ttf"}');
  assert.ok(readFileSync(path.join(dist, 'r/[token].html'), 'utf8').includes('src="/assets/nm/expo-router/assets/nm/derin/x.png"'));
  assert.ok(readFileSync(path.join(dist, 'stil.css'), 'utf8').includes('/assets/nm/expo-router/assets/nm/derin/x.png'));
  assert.ok(readFileSync(path.join(dist, 'metadata.json'), 'utf8').includes('assets/nm/expo-router/assets/nm/derin/x.png'));
  assert.equal(readFileSync(path.join(dist, 'not.txt'), 'utf8'), '/assets/nm/a/F.abc.ttf');
  assert.ok(readFileSync(path.join(dist, '_headers'), 'utf8').startsWith('/assets/nm/*\n'));
  assert.equal(readFileSync(path.join(dist, '_redirects'), 'utf8'), '/eski.ttf /assets/nm/a/F.abc.ttf 301\n');
  assert.ok(readFileSync(path.join(dist, 'ikon.svg'), 'utf8').includes('/assets/nm/a/x.png'));
  assert.ok(readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8').includes('/assets/nm/a/i.png'));
  assert.ok(readFileSync(path.join(dist, 'sw.mjs'), 'utf8').includes('/assets/nm/a/F.abc.ttf'));
  // Metin sayılmayan dosyaya dokunulmaz.
  assert.equal(readFileSync(path.join(dist, 'ikili.bin'), 'utf8'), '/assets/node_modules/dokunulmaz');
  // İkinci çalıştırma bir şey değiştirmez.
  assert.deepEqual(duzelt(dist), { tasinan: 0, degisen: 0 });
});

test('denetim (KK3): node_modules klasörü ya da adresi varsa hata', () => {
  const klasor = distKur({ 'baska/node_modules/x.js': '1', 'index.html': '<p>ok</p>' });
  assert.deepEqual(denetle(klasor), ['klasör: baska/node_modules']);
  const adres = distKur({ 'index.html': '<link href="/assets/node_modules/a.ttf">' });
  assert.deepEqual(denetle(adres), ['adres: index.html → assets/node_modules/a.ttf']);
  assert.deepEqual(denetle(distKur({ 'index.html': 'node_modules hakkında bir metin' })), []);
});

test('denetim güvenlik ağı: kaçışlı ve %2F adresler, node_modules adlı dosya', () => {
  const kacisli = distKur({ 'a.js': 'var u="\\/assets\\/node_modules\\/a\\/F.ttf";' });
  assert.deepEqual(denetle(kacisli), ['adres: a.js → assets\\/node_modules\\/a\\/F.ttf']);
  // duzelt kaçışlı biçimi yeniden yazmaz; denetim düşürür.
  assert.throws(() => duzelt(kacisli), /node_modules kaldı/);
  const yuzde = distKur({ 'a.json': '{"u":"assets%2Fnode_modules%2Fa%2FF.ttf"}', 'b.html': '<a href="/assets/x%2fnode_modules/y">' });
  assert.deepEqual(denetle(yuzde).sort(), ['adres: a.json → assets%2Fnode_modules%2Fa%2FF.ttf', 'adres: b.html → assets/x%2fnode_modules/y']);
  assert.deepEqual(denetle(distKur({ 'baska/node_modules': 'dosya' })), ['dosya: baska/node_modules']);
  // Benzer adlar ve varlık yolu olmayan metin sorun değil.
  const temiz = distKur({ 'a.js': 'x="assets\\/node_modules_x\\/a";y="assets%2Fmy_node_modules";z="require(\'node_modules/a\')"' });
  assert.deepEqual(denetle(temiz), []);
});

test('hedef zaten varsa üzerine yazılmaz, hata verilir', () => {
  const dist = distKur({ 'assets/node_modules/a.ttf': 'ESKI', 'assets/nm/a.ttf': 'VAR' });
  assert.throws(() => duzelt(dist), /hedef zaten var/);
  assert.equal(readFileSync(path.join(dist, 'assets/nm/a.ttf'), 'utf8'), 'VAR');
});
