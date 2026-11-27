/**
 * #561: Instagram ve Facebook'un gömülü tarayıcısı (ve Android WebView) Google girişini `disallowed_useragent` ile
 * reddeder. Bunu Google'a yönlendirmeden önce tanırız. WhatsApp'ın Custom Tab'ı (Chrome kimliği, `; wv)` yok) ve
 * iOS'taki Safari görünümü bu listede değil; orada giriş çalışır.
 *
 * #577: iOS'ta öbür uygulama içi tarayıcılar (LinkedIn, TikTok…) WKWebView kullanır. Kullanıcı aracılarında
 * `AppleWebKit` ve `Mobile/` var, `Safari/` yok. Gerçek Safari, Safari görünümü (WhatsApp) ve iOS Chrome / Firefox /
 * Edge (`CriOS`, `FxiOS`, `EdgiOS`) `Safari/` taşır. Ana ekrana eklenmiş web uygulamasında da `Safari/` yoktur; onu
 * `navigator.standalone` ayırır.
 */
const GOMULU = /Instagram|FBAN|FBAV|; wv\)/;
const IOS_WEBKIT = /(iPhone|iPad|iPod).*AppleWebKit.*Mobile\//;

export function gomuluTarayici(ua: string | null | undefined, standalone = false): boolean {
  if (!ua) return false;
  if (GOMULU.test(ua)) return true;
  return !standalone && IOS_WEBKIT.test(ua) && !ua.includes('Safari/');
}
