// node --test scripts/web-davet-girisi.test.mjs (CI `uygulama` işinde çalışır)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { JS_DIZINI, ayristirilabilir, birlestir, fontOnYukle, sozdizimiDusur } from './web-davet-girisi.mjs';

test('KK4: ?., ??, ??=, sınıf alanları ve statik blok ES2019 karşılığına düşer', async () => {
  const kaynak = 'var a={b:{c:1}};var x=a?.b?.c??2;a.d??=3;a.e||=4;class K{#g=1;static s=2;static{this.t=3}h=()=>this.#g;get g(){return this.#g}}';
  assert.throws(() => ayristirilabilir(kaynak), /ES2019/);
  const cikti = await sozdizimiDusur(kaynak);
  ayristirilabilir(cikti);
  assert.doesNotMatch(cikti, /\?\.|\?\?/);
  // Anlam aynı kalır.
  const sonuc = new Function(`${cikti};return [x,a.d,a.e,new K().g,K.s,K.t];`)();
  assert.deepEqual(sonuc, [1, 3, 4, 1, 2, 3]);
});

test('KK4: BigInt değişmezi (Chrome 67, Safari 14) kabul edilir; ?. ve ?? reddedilir', async () => {
  ayristirilabilir('var b=(BigInt(1)*5000n)/10000n;');
  assert.throws(() => ayristirilabilir('var a={};var x=a?.b;'), /\?\./);
  assert.throws(() => ayristirilabilir('var a=null;var x=a??1;'), /\?\?/);
  assert.throws(() => ayristirilabilir('var a={};a.b??=1;'), /ES2019/);
  const cikti = await sozdizimiDusur('var a={b:2};var x=a?.b??0n;');
  ayristirilabilir(cikti);
});

test('birleştirme: JS ve davet sayfaları dist\'e, eksik varlık kopyalanır, var olan korunur', async () => {
  const kok = mkdtempSync(path.join(tmpdir(), 'davet-girisi-'));
  const dist = path.join(kok, 'dist');
  const davet = path.join(kok, 'dist-davet');
  const yaz = (dosya, icerik) => {
    mkdirSync(path.dirname(dosya), { recursive: true });
    writeFileSync(dosya, icerik);
  };
  yaz(path.join(dist, 'r/[token].html'), 'eski');
  yaz(path.join(dist, 'r/g/[token].html'), 'eski');
  yaz(path.join(dist, JS_DIZINI, 'entry-a.js'), 'var buyuk=window.a?.b??1;');
  yaz(path.join(dist, 'assets/ortak.ttf'), 'dist');
  yaz(path.join(davet, 'r/[token].html'), '<html lang="tr"><head></head>davet</html>');
  yaz(path.join(davet, 'r/g/[token].html'), '<html lang="tr"><head></head>paylasim</html>');
  yaz(path.join(davet, JS_DIZINI, 'entry-b.js'), 'var k=window.x?.y??1;');
  yaz(path.join(davet, JS_DIZINI, 'entry-b.js.map'), '{}');
  yaz(path.join(davet, 'assets/ortak.ttf'), 'davet');
  yaz(path.join(davet, 'assets/yeni.png'), 'png');

  const yazilan = await birlestir(dist, davet);
  assert.deepEqual(yazilan, ['entry-b.js']);
  const onYukleme = '<link rel="preload" as="font" type="font/ttf" crossorigin href="/assets/ortak.ttf"/>';
  assert.equal(readFileSync(path.join(dist, 'r/[token].html'), 'utf8'), `<html lang="tr"><head>${onYukleme}</head>davet</html>`);
  assert.equal(readFileSync(path.join(dist, 'r/g/[token].html'), 'utf8'), `<html lang="tr"><head>${onYukleme}</head>paylasim</html>`);
  ayristirilabilir(readFileSync(path.join(dist, JS_DIZINI, 'entry-b.js'), 'utf8'));
  // Uygulamanın kendi JS'i de yerinde düşürülür (KK4: Google dönüşü /giris tam uygulamada açılır).
  const uygulama = readFileSync(path.join(dist, JS_DIZINI, 'entry-a.js'), 'utf8');
  ayristirilabilir(uygulama);
  assert.doesNotMatch(uygulama, /\?\.|\?\?/);
  assert.ok(!existsSync(path.join(dist, JS_DIZINI, 'entry-b.js.map')));
  assert.equal(readFileSync(path.join(dist, 'assets/ortak.ttf'), 'utf8'), 'dist');
  assert.equal(readFileSync(path.join(dist, 'assets/yeni.png'), 'utf8'), 'png');

  // İkinci kez çalışmak (aynı ad) hata verir: eski çıktıya karışmasın.
  await assert.rejects(() => birlestir(dist, davet), /çakışıyor/);
});

test('font ön yüklemesi bir kez yazılır', () => {
  const bir = fontOnYukle('<html><head><title>x</title></head><body></body></html>', ['/assets/a.ttf', '/assets/b.ttf']);
  assert.equal((bir.match(/rel="preload" as="font"/g) ?? []).length, 2);
  assert.ok(bir.indexOf('a.ttf') < bir.indexOf('</head>'));
  assert.equal(fontOnYukle(bir, ['/assets/a.ttf']), bir);
  assert.equal(fontOnYukle('<head></head>', []), '<head></head>');
});
