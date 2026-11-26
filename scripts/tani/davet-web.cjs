// #537 tanı: canlı web davet sayfasını mobil boyutta açar, 25 sn sonra ne gösterdiğini yazar. Token uydurmadır
// (geçerli değil): sağlıklı sayfa ~2 sn'de "Bu davet geçersiz" der; çark kalırsa hata yeniden üretilmiş olur.
// Loga yalnız durum, konsol hataları ve isteklerin yolu (sorgu dizesi ve gövde olmadan) yazılır.
const { chromium, devices } = require('playwright');
(async () => {
  const adres = process.argv[2];
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR' });
  const p = await c.newPage();
  const t0 = Date.now();
  const iz = (m) => console.log(`${String(Date.now() - t0).padStart(6)} ms  ${m}`);
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && iz(`konsol ${m.type()}: ${m.text().slice(0, 300)}`));
  p.on('pageerror', (e) => iz(`SAYFA HATASI: ${e.message.slice(0, 500)}`));
  const yol = (u) => { try { const x = new URL(u); return x.host + x.pathname.replace(/\/r\/(g\/)?[^/]+/, '/r/$1…'); } catch { return '?'; } };
  p.on('request', (r) => /supabase|pages\.dev/.test(r.url()) && r.resourceType() !== 'image' && iz(`istek ${r.method()} ${yol(r.url())}`));
  p.on('response', (r) => /supabase/.test(r.url()) && iz(`yanıt ${r.status()} ${yol(r.url())} ${r.headers()['content-type'] ?? ''}`));
  p.on('requestfailed', (r) => iz(`İSTEK DÜŞTÜ ${yol(r.url())} ${r.failure()?.errorText}`));
  const yanit = await p.goto(adres, { waitUntil: 'load', timeout: 60000 }).catch((e) => iz(`goto: ${e.message}`));
  iz(`belge ${yanit?.status()}`);
  for (const sn of [3, 8, 15, 25]) {
    await p.waitForTimeout(sn * 1000 - (Date.now() - t0));
    const metin = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200));
    const cark = await p.evaluate(() => document.querySelectorAll('[role="progressbar"]').length);
    iz(`${sn} sn · çark ${cark} · metin: ${metin || '(boş)'}`);
  }
  await p.screenshot({ path: 'tani-davet.png' });
  await b.close();
})();
