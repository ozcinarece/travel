// #550 KK4 / KK-ek3: Android 9 WebView (Chrome 74) yaklaşımı. Sözdizimi derlemede doğrulanır (scripts/web-davet-girisi.mjs,
// ES2019 + BigInt); burada Chrome 74'te olmayan yerleşikler sayfa betiklerinden önce silinir ve kullanıcı aracısı Android 9
// WebView olur. Gerçek Chrome 74 motoru değildir: sözdizimi + yerleşik API yaklaşımıdır.
import type { BrowserContext } from '@playwright/test';

export const ANDROID9_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 9; SM-G960F Build/PPR1.180610.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.157 Mobile Safari/537.36';

/** Android 9'da güncellenmemiş Chrome 74 tarayıcısı (WebView değil: Google girişi gömülü tarayıcıda kapalı, #561). */
export const ANDROID9_CHROME74 =
  'Mozilla/5.0 (Linux; Android 9; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Mobile Safari/537.36';

/** Chrome 75+'ta gelen yerleşikler (sürüm parantezde). */
const CHROME74_YOK = `(() => {
  const sil = (o, k) => { try { if (o) delete o[k]; } catch (e) {} };
  sil(Promise, 'allSettled'); /* 76 */ sil(Promise, 'any'); /* 85 */ sil(window, 'AggregateError'); /* 85 */
  sil(String.prototype, 'replaceAll'); /* 85 */ sil(window, 'WeakRef'); /* 84 */ sil(window, 'FinalizationRegistry'); /* 84 */
  sil(Element.prototype, 'replaceChildren'); /* 86 */ sil(Array.prototype, 'at'); /* 92 */ sil(String.prototype, 'at'); /* 92 */
  sil(Crypto.prototype, 'randomUUID'); /* 92 */ sil(Object, 'hasOwn'); /* 93 */ sil(Array.prototype, 'findLast'); /* 97 */
  sil(Array.prototype, 'findLastIndex'); /* 97 */ sil(window, 'structuredClone'); /* 98 */ sil(AbortSignal, 'timeout'); /* 103 */
  sil(Array.prototype, 'toSorted'); sil(Array.prototype, 'toReversed'); sil(Array.prototype, 'with'); /* 110 */
  sil(Object, 'groupBy'); /* 117 */ sil(AbortSignal, 'any'); /* 116 */
})();`;

/** Bağlamdaki her sayfada Chrome 74'te olmayan yerleşikleri siler. */
export async function chrome74Yaklasimi(baglam: BrowserContext) {
  await baglam.addInitScript(CHROME74_YOK);
}
