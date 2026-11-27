/**
 * #561: Instagram ve Facebook'un gömülü tarayıcısı (ve Android WebView) Google girişini `disallowed_useragent` ile
 * reddeder. Bunu Google'a yönlendirmeden önce tanırız. WhatsApp'ın Custom Tab'ı (Chrome kimliği, `; wv)` yok) ve
 * iOS'taki Safari görünümü bu listede değil; orada giriş çalışır.
 */
const GOMULU = /Instagram|FBAN|FBAV|; wv\)/;

export function gomuluTarayici(ua: string | null | undefined): boolean {
  return !!ua && GOMULU.test(ua);
}
