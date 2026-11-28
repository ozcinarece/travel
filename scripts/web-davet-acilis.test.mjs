// node --test scripts/web-davet-acilis.test.mjs (CI `uygulama` işinde çalışır)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BELIRME_MS, KATMAN_ID, YENILE_SN, katmanEkle, katmanHtml } from './web-davet-acilis.mjs';

const metin = JSON.parse(readFileSync(new URL('../src/i18n/tr.json', import.meta.url), 'utf8'));
const sayfa = '<!DOCTYPE html><html><head><title>x</title></head><body class="b"><div id="root"></div><script src="/a.js"></script></body></html>';

test('metinler tr.json davet.webAcilis ve marka.ad', () => {
  const html = katmanHtml(metin);
  assert.ok(html.includes(`<h1>${metin.davet.webAcilis.baslik}</h1>`));
  assert.ok(html.includes(metin.davet.webAcilis.metin));
  assert.ok(html.includes(metin.davet.webAcilis.uzun));
  assert.ok(html.includes(`aria-label="${metin.marka.ad}"`));
});

test('katman body başına, React kökünün dışına yazılır', () => {
  const cikti = katmanEkle(sayfa, metin);
  const katman = cikti.indexOf(`id="${KATMAN_ID}"`);
  assert.ok(cikti.indexOf('<body class="b">') < katman);
  assert.ok(katman < cikti.indexOf('<div id="root"></div>'));
  // Kök boş kalır: hidrasyon etkilenmez.
  assert.ok(cikti.includes('<div id="root"></div>'));
});

test('iki kez çalışınca bir kez yazılır', () => {
  const bir = katmanEkle(sayfa, metin);
  assert.equal(katmanEkle(bir, metin), bir);
});

test('not 8 sn gecikmeli; hareket azaltılınca noktalar durur, not kalır', () => {
  const html = katmanHtml(metin);
  assert.match(html, /\.da-uzun\{[^}]*animation:da-uzun 0s linear 8s forwards/);
  assert.match(html, /prefers-reduced-motion:reduce\)\{#davet-acilis \.da-noktalar span\{animation:none\}\}/);
  // Hızlı ağda görünmesin: içerik gecikmeli belirir.
  assert.ok(html.includes(`animation:da-belir 0s linear ${BELIRME_MS}ms both`));
  // İlerleme yüzdesi ya da çubuk yok.
  assert.doesNotMatch(html, /%<|progress/);
});

test('metin HTML kaçırılır', () => {
  const kirli = { ...metin, davet: { ...metin.davet, webAcilis: { baslik: '<b>', metin: 'a & b', uzun: '"x"', yenile: '<i>' } } };
  const html = katmanHtml(kirli);
  assert.ok(html.includes('<h1>&lt;b&gt;</h1>'));
  assert.ok(html.includes('a &amp; b'));
  assert.ok(html.includes('&quot;x&quot;'));
  assert.ok(html.includes('&lt;i&gt;'));
});

test('body yoksa hata', () => {
  assert.throws(() => katmanEkle('<html></html>', metin));
});

test('eski motor: inset ve flex gap yok (Android 9 WebView = Chrome 74, #552)', () => {
  const stil = katmanHtml(metin).match(/<style[^>]*>(.*?)<\/style>/)[1];
  assert.doesNotMatch(stil, /inset\s*:/);
  assert.doesNotMatch(stil, /(^|[;{])\s*(row-|column-)?gap\s*:/);
  assert.match(stil, /position:fixed;top:0;right:0;bottom:0;left:0/);
  assert.match(stil, /\.da-noktalar span\+span\{margin-left:8px\}/);
  assert.match(stil, /\.da-satir\{margin:6px 0 0;/);
});

test('30 sn\'de not "sayfayı yenile"ye döner; yalnız CSS, hareket azaltılınca da (#557)', () => {
  assert.equal(YENILE_SN, 30);
  const html = katmanHtml(metin);
  assert.ok(html.includes(metin.davet.webAcilis.yenile));
  const stil = html.match(/<style[^>]*>(.*?)<\/style>/)[1];
  assert.match(stil, /\.da-uzun-ilk\{overflow:hidden;animation:da-gizle 0s linear 30s forwards\}/);
  assert.match(stil, /\.da-uzun-yenile\{[^}]*visibility:hidden;animation:da-goster 0s linear 30s forwards\}/);
  // Hareket azaltma kuralı yalnız noktaları durdurur; metin değişimine dokunmaz.
  const azalt = stil.match(/@media \(prefers-reduced-motion:reduce\)\{(.*)\}$/)[1];
  assert.doesNotMatch(azalt, /da-uzun/);
  // Katmanda betik yok: JS'ye bağlı değil.
  assert.doesNotMatch(html, /<script/i);
});

test('#550 KK-ek2: role="status" kapsayıcıda değil, yalnız 8 sn notunda', () => {
  const html = katmanHtml(metin);
  assert.ok(html.includes(`<div id="${KATMAN_ID}">`));
  const roller = html.match(/role="status"/g) ?? [];
  assert.equal(roller.length, 1);
  assert.match(html, /<p class="da-uzun" role="status">/);
});
