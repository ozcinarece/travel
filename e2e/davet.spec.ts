// #550 KK3: davet (/r/{token}) ve paylaşım (/r/g/{token}) yolları web'de uçtan uca. İlk açılış küçük davet girişiyle
// (src/davet-web) gelir; giriş, seyahat ve ana sayfa tam uygulamada açılır. Supabase taklit (supabaseTaklidi.ts).
import { expect, test, type Page } from '@playwright/test';

import tr from '../src/i18n/tr.json';
import { ANDROID9_CHROME74, ANDROID9_WEBVIEW, chrome74Yaklasimi } from './eskiTarayici';
import { DAVET_TOKENI, DEPO_ANAHTARI, PAYLASIM_HARITALI, PAYLASIM_TOKENI, SEYAHAT, YENI_SEYAHAT, oturum, supabaseTaklidi } from './supabaseTaklidi';

/** Sayfanın indirdiği giriş (entry) JS dosyaları; önden indirme (prefetch) ayrı listede. */
function girisleriIzle(page: Page): string[] & { onden: string[] } {
  const liste = Object.assign([] as string[], { onden: [] as string[] });
  page.on('request', async (r) => {
    const ad = new URL(r.url()).pathname.match(/\/_expo\/static\/js\/web\/(entry-[0-9a-f]+\.js)$/)?.[1];
    if (!ad) return;
    const amac = (await r.allHeaders())['sec-purpose'] ?? '';
    (amac.includes('prefetch') ? liste.onden : liste).push(ad);
  });
  return liste;
}

async function sayfaGirisi(page: Page, yol: string): Promise<string> {
  const html = await (await page.request.get(yol)).text();
  return html.match(/src="\/_expo\/static\/js\/web\/(entry-[0-9a-f]+\.js)"/)![1];
}

/**
 * Tam uygulamanın giriş JS'ini `birak()` çağrılana kadar bekletir (yavaş ağ / önden indirmesiz tarayıcı benzetimi).
 * Davet girişi bekletilmez; önden indirme isteği de bekler, zararı yok.
 */
function paketiBeklet(page: Page, giris: string): { birak: () => void } {
  let birak = () => {};
  const bekle = new Promise<void>((r) => (birak = r));
  void page.route(`**/_expo/static/js/web/${giris}`, async (r) => {
    await bekle;
    await r.continue();
  });
  return { birak: () => birak() };
}

/** #549 açılış katmanı (kanvas 3e-A; `uzunNot` ile 8 sn sonra 3e-B notu) görünür. */
async function acilisKatmaniGorunur(page: Page, { uzunNot = false } = {}) {
  const katman = page.locator('#davet-acilis');
  await expect(katman.getByRole('heading', { name: tr.davet.webAcilis.baslik })).toBeVisible();
  await expect(katman.getByText(tr.davet.webAcilis.metin)).toBeVisible();
  await expect(katman.getByRole('img', { name: tr.marka.ad })).toBeVisible();
  if (!uzunNot) return;
  await expect(katman.getByText(tr.davet.webAcilis.uzun)).toBeVisible({ timeout: 12_000 });
  await expect(katman.getByRole('status')).toContainText(tr.davet.webAcilis.uzun);
}

async function girisliAc(page: Page) {
  const o = oturum();
  await page.addInitScript(([anahtar, deger]) => window.localStorage.setItem(anahtar, deger), [DEPO_ANAHTARI, JSON.stringify(o)] as const);
}

test.describe('davet /r/{token}', () => {
  test('girişsiz: özet ve "Google ile katıl" küçük girişle açılır, sayfa Türkçe', async ({ page }) => {
    await supabaseTaklidi(page);
    const girisler = girisleriIzle(page);
    const davetGirisi = await sayfaGirisi(page, `/r/${DAVET_TOKENI}`);
    const uygulamaGirisi = await sayfaGirisi(page, '/');
    expect(davetGirisi).not.toBe(uygulamaGirisi);

    await page.goto(`/r/${DAVET_TOKENI}`);
    await expect(page.getByText(/^Deneme seni Test · davet-550.* davet etti$/)).toBeVisible();
    await expect(page.getByText(tr.davet.planBaslik)).toBeVisible();
    await expect(page.getByText(tr.davet.katilGoogle)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    // #549 açılış katmanı kalkar.
    await expect(page.locator('#davet-acilis')).toHaveCount(0);
    // KK1: çalıştırılan tek giriş davet girişi.
    expect([...girisler]).toEqual([davetGirisi]);
    // Öz-inceleme 1: özet çizildikten sonra tam uygulamanın girişi boşta önden iner (çalıştırılmaz).
    await expect.poll(() => girisler.onden).toEqual([uygulamaGirisi]);
    expect([...girisler]).toEqual([davetGirisi]);
  });

  test('Google ile katıl → Google dönüşü → davetle_katil → seyahate geçiş @webkit', async ({ page }) => {
    const cagrilar = await supabaseTaklidi(page);
    // Tam uygulamanın paketi yavaş gelir (önden indirme işe yaramadı, ör. Safari): geçişte sayfa boş kalmaz (Ürün, #637).
    const paket = paketiBeklet(page, await sayfaGirisi(page, '/'));
    await page.goto(`/r/${DAVET_TOKENI}`);
    await expect(page.getByText(tr.davet.katilGoogle)).toBeVisible();
    await page.getByText(tr.davet.katilGoogle).click();
    // Dönüş /giris?code=… (tam uygulama) → oturum → ana sayfa bekleyen daveti açar → katılım → seyahat.
    // Paket bekletildiği için sayfanın `load` olayı gelmez: adresin değişmesi yeter.
    await page.waitForURL(/\/giris\?code=/, { waitUntil: 'commit' });
    // Paket gelene kadar /giris'in statik HTML'i kanvas 3e-A'yı, 8 sn sonra 3e-B notunu gösterir.
    await acilisKatmaniGorunur(page, { uzunNot: true });
    paket.birak();
    await expect(page.locator('#davet-acilis')).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(() => cagrilar.find((c) => c.yol === '/rest/v1/rpc/davetle_katil')?.govde, { timeout: 30_000 }).toEqual({ token: DAVET_TOKENI, kanal: 'web' });
    expect(cagrilar.some((c) => c.yol.startsWith('/auth/v1/token?grant_type=pkce'))).toBe(true);
    // Katılımdan sonra davet ekranından çıkılır, seyahatin verisi istenir. (Taklit boş seyahatte web'deki seyahat ekranı
    // main'de de hata kartına düşüyor — ayrı bulgu, bu işin kapsamı dışında; burada yalnız geçiş doğrulanır.)
    await expect.poll(() => cagrilar.some((c) => c.yol.startsWith(`/rest/v1/trips?`) && c.yol.includes(`id=eq.${SEYAHAT}`)), { timeout: 30_000 }).toBe(true);
    await expect(page).not.toHaveURL(/\/r\//);
  });

  test('girişli açılış: küçük girişte katılır, seyahat tam uygulamayla açılır @webkit', async ({ page }) => {
    await girisliAc(page);
    const cagrilar = await supabaseTaklidi(page);
    const girisler = girisleriIzle(page);
    const uygulamaGirisi = await sayfaGirisi(page, '/');
    const paket = paketiBeklet(page, uygulamaGirisi);
    await page.goto(`/r/${DAVET_TOKENI}`);
    await page.waitForURL(new RegExp(`/seyahat/${SEYAHAT}/gezi\\?katildin=1`), { timeout: 30_000, waitUntil: 'commit' });
    expect(cagrilar.filter((c) => c.yol === '/rest/v1/rpc/davetle_katil')).toHaveLength(1);
    // Katıl → seyahat yeniden yüklemesinde de paket gelene kadar kanvas 3e-A (#637).
    await acilisKatmaniGorunur(page);
    paket.birak();
    await expect(page.locator('#davet-acilis')).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(() => [...girisler, ...girisler.onden].includes(uygulamaGirisi)).toBe(true);
  });

  test('bilinmeyen davet: "Bu davet geçersiz"', async ({ page }) => {
    await supabaseTaklidi(page);
    await page.goto('/r/Zz9Yy8Xx');
    await expect(page.getByText(tr.davet.gecersizBaslik)).toBeVisible();
  });
});

test.describe('paylaşım /r/g/{token}', () => {
  test('girişsiz: özet ve Seyahatime al → giriş (tam uygulama), link bekler', async ({ page }) => {
    await supabaseTaklidi(page);
    const girisler = girisleriIzle(page);
    const davetGirisi = await sayfaGirisi(page, `/r/g/${PAYLASIM_TOKENI}`);
    await page.goto(`/r/g/${PAYLASIM_TOKENI}`);
    await expect(page.getByText('Test · paylaşım-550')).toBeVisible();
    await expect(page.getByText(tr.paylasim.girisNot)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    expect([...girisler]).toEqual([davetGirisi]);

    await page.getByText(tr.paylasim.seyahatimeAl).click();
    await page.waitForURL(/\/giris$/);
    await expect(page.getByText(tr.giris.google)).toBeVisible();
    const bekleyen = await page.evaluate(() => Object.entries(window.localStorage).find(([, v]) => v.includes('Pq1Rs2Tu3Vw4Xy5Za6Bc7De8')));
    expect(bekleyen).toBeTruthy();
  });

  test('girişli: Seyahatime al → paylasimdan_al → yeni seyahat', async ({ page }) => {
    await girisliAc(page);
    const cagrilar = await supabaseTaklidi(page);
    await page.goto(`/r/g/${PAYLASIM_TOKENI}`);
    await page.getByText(tr.paylasim.seyahatimeAl).click();
    await page.waitForURL(new RegExp(`/seyahat/${YENI_SEYAHAT}/gezi`), { timeout: 30_000 });
    expect(cagrilar.find((c) => c.yol === '/rest/v1/rpc/paylasimdan_al')?.govde).toEqual({ p_token: PAYLASIM_TOKENI });
  });

  test('"Haritada gör": harita parçası ancak basınca iner', async ({ page }) => {
    await supabaseTaklidi(page);
    // Google Haritalar betiği testte yüklenmez (dış ağ yok); yalnız parçanın inişi ve 220 px kutu doğrulanır.
    await page.route('https://maps.googleapis.com/**', (r) => r.abort());
    const parcalar: string[] = [];
    page.on('request', (r) => {
      if (/\/_expo\/static\/js\/web\/Harita-/.test(r.url())) parcalar.push(r.url());
    });
    await page.goto(`/r/g/${PAYLASIM_HARITALI}`);
    await expect(page.getByText(tr.paylasim.haritadaGor)).toBeVisible();
    expect(parcalar).toHaveLength(0);
    await page.getByText(tr.paylasim.haritadaGor).click();
    await expect(page.getByTestId('paylasim-harita')).toBeVisible();
    await expect.poll(() => parcalar.length).toBe(1);
  });
});

// #542 KK2: Cloudflare Pages `node_modules` klasörlerini yüklemez (yerel sunucu da öyle davranır, e2e/sunucu.mjs). Bütün
// font istekleri font döner; yedek HTML (OTS "invalid sfntVersion") değil.
test.describe('web fontları (#542)', () => {
  for (const [ad, yol, metin] of [
    ['davet', `/r/${DAVET_TOKENI}`, tr.davet.katilGoogle],
    ['paylaşım', `/r/g/${PAYLASIM_TOKENI}`, tr.paylasim.seyahatimeAl],
  ] as const) {
    test(`${ad}: bütün font istekleri 200 ve font türüyle döner, FontFace hatasız yüklenir`, async ({ page }) => {
      await supabaseTaklidi(page);
      const fontlar: { url: string; durum: number; tur: string }[] = [];
      page.on('response', (r) => {
        const adres = new URL(r.url()).pathname;
        if (r.request().resourceType() === 'font' || /\.(ttf|otf|woff2?)$/.test(adres))
          fontlar.push({ url: adres, durum: r.status(), tur: r.headers()['content-type'] ?? '' });
      });
      await page.goto(yol);
      await expect(page.getByText(metin)).toBeVisible();
      const yuzler = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].map((f) => ({ aile: f.family, durum: f.status }));
      });
      expect(fontlar.length).toBeGreaterThan(0);
      for (const f of fontlar) {
        expect(f.url).not.toContain('node_modules');
        // Ön yükleme ile FontFace aynı dosyayı iki kez isteyebilir; ikincisi önbellekten doğrulanır (304, ETag).
        expect([200, 304], `${f.url} ${f.durum}`).toContain(f.durum);
        if (f.durum === 200) expect(f.tur, f.url).toMatch(/^(font\/|application\/octet-stream)/);
      }
      for (const url of new Set(fontlar.map((f) => f.url))) expect(fontlar.some((f) => f.url === url && f.durum === 200), url).toBe(true);
      expect(yuzler.filter((y) => y.durum === 'error')).toEqual([]);
      expect(yuzler.some((y) => /Figtree/.test(y.aile) && y.durum === 'loaded')).toBe(true);
    });
  }
});

// KK4 / KK-ek3: Chrome 74 yaklaşımı: UA + Chrome 75+ yerleşikleri yok (e2e/eskiTarayici.ts).
test.describe('Android 9 WebView (Chrome 74 yaklaşımı)', () => {
  test.use({ userAgent: ANDROID9_WEBVIEW });

  test('davet ve paylaşım özetleri hatasız açılır', async ({ page, context }) => {
    await chrome74Yaklasimi(context);
    const hatalar: string[] = [];
    page.on('pageerror', (e) => hatalar.push(e.message));
    await supabaseTaklidi(page);
    await page.goto(`/r/g/${PAYLASIM_TOKENI}`);
    await expect(page.getByText(tr.paylasim.seyahatimeAl)).toBeVisible();
    await page.goto(`/r/${DAVET_TOKENI}`);
    await expect(page.getByText(tr.davet.katilGoogle)).toBeVisible();
    expect(hatalar).toEqual([]);
  });
});

test.describe('Android 9 Chrome 74 tarayıcısı (yaklaşım)', () => {
  test.use({ userAgent: ANDROID9_CHROME74 });

  test('Google ile katıl → Google dönüşü (/giris, tam uygulama) → davetle_katil, hatasız', async ({ page, context }) => {
    await chrome74Yaklasimi(context);
    const hatalar: string[] = [];
    page.on('pageerror', (e) => hatalar.push(e.message));
    const cagrilar = await supabaseTaklidi(page);
    await page.goto(`/r/${DAVET_TOKENI}`);
    await page.getByText(tr.davet.katilGoogle).click();
    await page.waitForURL(/\/giris\?code=/);
    await expect.poll(() => cagrilar.some((c) => c.yol === '/rest/v1/rpc/davetle_katil'), { timeout: 30_000 }).toBe(true);
    expect(hatalar).toEqual([]);
  });
});
