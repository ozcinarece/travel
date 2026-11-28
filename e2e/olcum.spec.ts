// #550 KK2 / KK-ek3: davet ve paylaşım sayfalarının açılış süresi (yalnız ölçüm; OLCUM=1 ile çalışır, CI'da atlanır).
// Kurulum #537'deki gibi: gzip'li yerel sunucu (e2e/sunucu.mjs), Supabase taklidi (yanıt ağ gecikmesi kadar bekletilir;
// taklit edilen istek tarayıcının ağ kısıtına girmez), Chrome DevTools ağ profili (CDP). Her satır 3 ölçümün ortancası.
//   OLCUM=1 npx playwright test e2e/olcum.spec.ts
import { devices, expect, test, type Page } from '@playwright/test';

import tr from '../src/i18n/tr.json';
import { ANDROID9_WEBVIEW, chrome74Yaklasimi } from './eskiTarayici';
import { DAVET_TOKENI, PAYLASIM_TOKENI, supabaseTaklidi } from './supabaseTaklidi';

test.skip(!process.env.OLCUM, 'yalnız ölçüm: OLCUM=1');
test.setTimeout(10 * 60_000);

const AG = {
  'Hızlı 3G (1,6 Mb/s, 562 ms)': { indir: (1.6e6 / 8) * 0.9, yukle: (750e3 / 8) * 0.9, gecikme: 562.5 },
  'Yavaş 3G (400 kb/s, 2 sn)': { indir: (400e3 / 8) * 0.9, yukle: (400e3 / 8) * 0.9, gecikme: 2000 },
} as const;
type Sonuc = { ilkMetin: number; hazir: number; js: number };

async function olc(page: Page, yol: string, hazirMetin: string, ag: (typeof AG)[keyof typeof AG]): Promise<Sonuc> {
  await supabaseTaklidi(page, { gecikmeMs: ag.gecikme });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: ag.gecikme, downloadThroughput: ag.indir, uploadThroughput: ag.yukle });
  const jsIstekleri = new Set<string>();
  let js = 0;
  cdp.on('Network.responseReceived', (e) => {
    if (/\/_expo\/static\/js\//.test(e.response.url)) jsIstekleri.add(e.requestId);
  });
  cdp.on('Network.loadingFinished', (e) => {
    if (jsIstekleri.has(e.requestId)) js += e.encodedDataLength;
  });
  const bas = Date.now();
  await page.goto(yol, { waitUntil: 'commit' });
  // İlk görünen metin: #549 açılış katmanı (600 ms'de belirir) ya da uygulamanın kendisi.
  await page.waitForFunction(() => (document.body?.innerText ?? '').trim().length > 0, null, { polling: 50, timeout: 120_000 });
  const ilkMetin = Date.now() - bas;
  await expect(page.getByText(hazirMetin)).toBeVisible({ timeout: 120_000 });
  const hazir = Date.now() - bas;
  await cdp.detach();
  return { ilkMetin, hazir, js };
}

const ortanca = (d: number[]) => [...d].sort((a, b) => a - b)[Math.floor(d.length / 2)];

test('açılış süreleri', async ({ browser }) => {
  const satirlar: string[] = ['| Sayfa | Ağ · tarayıcı | İlk görünen metin | Özet + düğme | İnen JS (aktarım) |', '|---|---|---|---|---|'];
  const sayfalar = [
    { ad: `/r/{token}`, yol: `/r/${DAVET_TOKENI}`, metin: tr.davet.katilGoogle },
    { ad: `/r/g/{token}`, yol: `/r/g/${PAYLASIM_TOKENI}`, metin: tr.paylasim.seyahatimeAl },
  ];
  const durumlar = [
    { ag: 'Hızlı 3G (1,6 Mb/s, 562 ms)', tarayici: 'Pixel 7 Chromium', ua: undefined },
    { ag: 'Yavaş 3G (400 kb/s, 2 sn)', tarayici: 'Pixel 7 Chromium', ua: undefined },
    { ag: 'Hızlı 3G (1,6 Mb/s, 562 ms)', tarayici: 'Android 9 WebView (Chrome 74 yaklaşımı)', ua: ANDROID9_WEBVIEW },
    { ag: 'Yavaş 3G (400 kb/s, 2 sn)', tarayici: 'Android 9 WebView (Chrome 74 yaklaşımı)', ua: ANDROID9_WEBVIEW },
  ] as const;
  for (const sayfa of sayfalar) {
    for (const d of durumlar) {
      const olcumler: Sonuc[] = [];
      for (let i = 0; i < 3; i++) {
        const baglam = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625, userAgent: d.ua ?? devices['Pixel 7'].userAgent });
        if (d.ua) await chrome74Yaklasimi(baglam);
        const page = await baglam.newPage();
        olcumler.push(await olc(page, sayfa.yol, sayfa.metin, AG[d.ag]));
        await baglam.close();
      }
      const sn = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} sn`;
      satirlar.push(
        `| ${sayfa.ad} | ${d.ag} · ${d.tarayici} | ${sn(ortanca(olcumler.map((o) => o.ilkMetin)))} | ${sn(ortanca(olcumler.map((o) => o.hazir)))} | ${Math.round(ortanca(olcumler.map((o) => o.js)) / 1024)} KB |`,
      );
    }
  }
  console.log('\n' + satirlar.join('\n') + '\n');
});
