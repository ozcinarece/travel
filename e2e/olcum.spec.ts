// #550 KK2 / KK-ek3: davet ve paylaşım sayfalarının açılış süresi (yalnız ölçüm; OLCUM=1 ile çalışır, CI'da atlanır).
// Kurulum #537'deki gibi: gzip'li yerel sunucu (e2e/sunucu.mjs), Supabase taklidi (yanıt ağ gecikmesi kadar bekletilir;
// taklit edilen istek tarayıcının ağ kısıtına girmez), Chrome DevTools ağ profili (CDP). Her satır 3 ölçümün ortancası.
// #643 KK3: "CPU 4×" satırı ayrıca işlemciyi 4 kat yavaşlatır (CDP `Emulation.setCPUThrottlingRate`; gerçek Android 9'a yakın).
//   OLCUM=1 npx playwright test e2e/olcum.spec.ts
import { devices, expect, test, type Page } from '@playwright/test';

import tr from '../src/i18n/tr.json';
import { ANDROID9_WEBVIEW, chrome74Yaklasimi } from './eskiTarayici';
import { DAVET_TOKENI, PAYLASIM_TOKENI, supabaseTaklidi, supabaseTaklidiCdp } from './supabaseTaklidi';

test.skip(!process.env.OLCUM, 'yalnız ölçüm: OLCUM=1');
test.setTimeout(10 * 60_000);

const AG = {
  'Hızlı 3G (1,6 Mb/s, 562 ms)': { indir: (1.6e6 / 8) * 0.9, yukle: (750e3 / 8) * 0.9, gecikme: 562.5 },
  'Yavaş 3G (400 kb/s, 2 sn)': { indir: (400e3 / 8) * 0.9, yukle: (400e3 / 8) * 0.9, gecikme: 2000 },
} as const;
type Sonuc = { ilkMetin: number; hazir: number; js: number; font: number; rpc: number };

async function olc(page: Page, yol: string, hazirMetin: string, ag: (typeof AG)[keyof typeof AG], cpu = 1): Promise<Sonuc> {
  const cagrilar = await supabaseTaklidi(page, { gecikmeMs: ag.gecikme });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: ag.gecikme, downloadThroughput: ag.indir, uploadThroughput: ag.yukle });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const jsIstekleri = new Set<string>();
  const fontIstekleri = new Set<string>();
  let js = 0;
  let font = 0;
  cdp.on('Network.responseReceived', (e) => {
    if (/\/_expo\/static\/js\//.test(e.response.url)) jsIstekleri.add(e.requestId);
    if (/\.(ttf|woff2)(\?|$)/.test(e.response.url)) fontIstekleri.add(e.requestId);
  });
  cdp.on('Network.loadingFinished', (e) => {
    if (jsIstekleri.has(e.requestId)) js += e.encodedDataLength;
    if (fontIstekleri.has(e.requestId)) font += e.encodedDataLength;
  });
  const bas = Date.now();
  await page.goto(yol, { waitUntil: 'commit' });
  // İlk görünen metin: #549 açılış katmanı (600 ms'de belirir) ya da uygulamanın kendisi.
  await page.waitForFunction(() => (document.body?.innerText ?? '').trim().length > 0, null, { polling: 50, timeout: 120_000 });
  const ilkMetin = Date.now() - bas;
  await expect(page.getByText(hazirMetin)).toBeVisible({ timeout: 120_000 });
  const hazir = Date.now() - bas;
  await cdp.detach();
  const rpc = cagrilar.filter((c) => /\/rpc\/(davet_ozeti|paylasim_ozeti)$/.test(c.yol)).length;
  return { ilkMetin, hazir, js, font, rpc };
}

const ortanca = (d: number[]) => [...d].sort((a, b) => a - b)[Math.floor(d.length / 2)];

test('açılış süreleri', async ({ browser }) => {
  const satirlar: string[] = ['| Sayfa | Ağ · tarayıcı | İlk görünen metin | Özet + düğme | İnen JS (aktarım) | İnen font (aktarım) | Özet RPC çağrısı |', '|---|---|---|---|---|---|---|'];
  const sayfalar = [
    { ad: `/r/{token}`, yol: `/r/${DAVET_TOKENI}`, metin: tr.davet.katilGoogle },
    { ad: `/r/g/{token}`, yol: `/r/g/${PAYLASIM_TOKENI}`, metin: tr.paylasim.seyahatimeAl },
  ];
  const durumlar = [
    { ag: 'Hızlı 3G (1,6 Mb/s, 562 ms)', tarayici: 'Pixel 7 Chromium', ua: undefined, cpu: 1 },
    { ag: 'Hızlı 3G (1,6 Mb/s, 562 ms)', tarayici: 'Pixel 7 Chromium · CPU 4×', ua: undefined, cpu: 4 },
    { ag: 'Yavaş 3G (400 kb/s, 2 sn)', tarayici: 'Pixel 7 Chromium', ua: undefined, cpu: 1 },
    { ag: 'Hızlı 3G (1,6 Mb/s, 562 ms)', tarayici: 'Android 9 WebView (Chrome 74 yaklaşımı)', ua: ANDROID9_WEBVIEW, cpu: 1 },
    { ag: 'Yavaş 3G (400 kb/s, 2 sn)', tarayici: 'Android 9 WebView (Chrome 74 yaklaşımı)', ua: ANDROID9_WEBVIEW, cpu: 1 },
  ] as const;
  for (const sayfa of sayfalar) {
    for (const d of durumlar) {
      const olcumler: Sonuc[] = [];
      for (let i = 0; i < 3; i++) {
        const baglam = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625, userAgent: d.ua ?? devices['Pixel 7'].userAgent });
        if (d.ua) await chrome74Yaklasimi(baglam);
        const page = await baglam.newPage();
        olcumler.push(await olc(page, sayfa.yol, sayfa.metin, AG[d.ag], d.cpu));
        await baglam.close();
      }
      const sn = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} sn`;
      satirlar.push(
        `| ${sayfa.ad} | ${d.ag} · ${d.tarayici} | ${sn(ortanca(olcumler.map((o) => o.ilkMetin)))} | ${sn(ortanca(olcumler.map((o) => o.hazir)))} | ${Math.round(ortanca(olcumler.map((o) => o.js)) / 1024)} KB | ${Math.round(ortanca(olcumler.map((o) => o.font)) / 1024)} KB | ${Math.max(...olcumler.map((o) => o.rpc))} |`,
      );
    }
  }
  console.log('\n' + satirlar.join('\n') + '\n');
});

/**
 * Öz-inceleme 1: davet girişinden tam uygulamaya geçiş ("Seyahatime al" → giriş ekranı), hızlı 3G. Özet göründükten sonra
 * kullanıcı `bekleme` kadar sayfada kalır, sonra basar. "Önden indirme yok" satırında sayfadaki meta çıkarılır (önceki hal).
 * Sunucu Pages gibi `max-age=0, must-revalidate` + ETag verir: önden inen dosya geçişte 304 ile yeniden doğrulanır.
 */
test('geçiş süresi: Seyahatime al → giriş', async ({ browser }) => {
  const ag = AG['Hızlı 3G (1,6 Mb/s, 562 ms)'];
  const satirlar: string[] = ['| Geçiş (hızlı 3G, Pixel 7) | Özette bekleme | Basıştan giriş ekranına |', '|---|---|---|'];
  for (const onYukleme of [false, true]) {
    for (const bekleme of [3000, 10_000]) {
      const sureler: number[] = [];
      for (let i = 0; i < 3; i++) {
        const baglam = await browser.newContext({ ...devices['Pixel 7'] });
        const page = await baglam.newPage();
        // page.route HTTP önbelleğini kapatır; taklit CDP ile (önden indirilen dosya önbellekte kalsın).
        await supabaseTaklidiCdp(page, { gecikmeMs: ag.gecikme });
        // Önceki hal: sayfadaki meta kaldırılır (önden indirme tetiklenmez). Ertelenmiş betikler bundan önce çalışır, ama
        // önden indirme özet çizildikten sonra meta'yı okuduğundan yeterince erken.
        if (!onYukleme) {
          await page.addInitScript(() =>
            document.addEventListener('DOMContentLoaded', () => document.querySelector('meta[name="tripmate-uygulama-js"]')?.remove()),
          );
        }
        const cdp = await baglam.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: ag.gecikme, downloadThroughput: ag.indir, uploadThroughput: ag.yukle });
        await page.goto(`/r/g/${PAYLASIM_TOKENI}`, { waitUntil: 'commit' });
        await expect(page.getByText(tr.paylasim.seyahatimeAl)).toBeVisible({ timeout: 120_000 });
        await page.waitForTimeout(bekleme);
        const bas = Date.now();
        await page.getByText(tr.paylasim.seyahatimeAl).click();
        await expect(page.getByText(tr.giris.google)).toBeVisible({ timeout: 120_000 });
        sureler.push(Date.now() - bas);
        await baglam.close();
      }
      satirlar.push(`| ${onYukleme ? 'önden indirme var' : 'önden indirme yok (önce)'} | ${bekleme / 1000} sn | ${(ortanca(sureler) / 1000).toFixed(1).replace('.', ',')} sn |`);
    }
  }
  console.log('\n' + satirlar.join('\n') + '\n');
});
