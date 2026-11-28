import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { gomuluTarayici } from '@/features/auth/gomuluTarayici';
import { oturumKalici, supabase } from '@/lib/supabase';

// Web'de OAuth dönüşünde açılan pencereyi kapatır. Depolaması kapalı tarayıcıda localStorage okuması hata verir;
// modül düzeyinde olduğu için korumasız kalırsa /r/{token} dahil bütün sayfa hata ekranına düşer (#537).
try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // depolama yok: kapatılacak giriş penceresi de yok
}

// Apple girişi kod olarak hazır; Apple Developer hesabı gelene kadar bayrakla kapalı.
const APPLE_ACIK = process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1';

// Supabase → Auth → URL Configuration → Redirect URLs listesinde olmalı: gezi://giris ve web kökü/giris
// #550: expo-auth-session yalnız yerelde gerekir; `process.env.EXPO_OS` derlemede sabitlenir, web paketinde bu dal ve
// paket (expo-crypto dahil) hiç yer almaz.
function yonlendirmeAdresi(): string {
  if (Platform.OS === 'web') return `${window.location.origin}/giris`;
  if (process.env.EXPO_OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- yalnız yerel dal (yukarıdaki not)
    const { makeRedirectUri } = require('expo-auth-session') as typeof import('expo-auth-session');
    return makeRedirectUri({ scheme: 'gezi', path: 'giris' });
  }
  return `${window.location.origin}/giris`;
}

/** #552: depolaması kapalı tarayıcı; Google'a yönlendirilmez (dönüşte doğrulayıcı ve davet kaybolur). */
export class DepolamaYok extends Error {
  constructor() {
    super('Bu tarayıcıda Google girişi tamamlanamaz');
    this.name = 'DepolamaYok';
  }
}

/** #561 / #565 KK3: gömülü tarayıcı (Instagram, Facebook, WebView); Google'a yönlendirilmez, ayrı metinle linki tarayıcıda açtırır. */
export class GomuluTarayici extends Error {
  constructor() {
    super('Uygulama içi tarayıcıda Google girişi tamamlanamaz');
    this.name = 'GomuluTarayici';
  }
}

/**
 * #565: giriş hatasının metin anahtarı (saf; test edilir). Gömülü tarayıcı → `{yer}.gomuluTarayici` (menüden tarayıcıda aç);
 * depolaması kapalı gerçek tarayıcı → `{yer}.depolamaYok` (başka tarayıcı ya da gizli olmayan pencere); diğerleri `giris.hata`.
 */
export function girisHataAnahtari(e: unknown, yer: 'davet' | 'giris'): string {
  if (e instanceof GomuluTarayici) return `${yer}.gomuluTarayici`;
  if (e instanceof DepolamaYok) return `${yer}.depolamaYok`;
  return 'giris.hata';
}

/** #565: tekrar denemenin işe yaramadığı, linki başka yerde açmayı gerektiren hata. */
export function tarayiciUygunDegilMi(e: unknown): boolean {
  return e instanceof GomuluTarayici || e instanceof DepolamaYok;
}

/** PRD 0.1 KK1. Misafir (anonim) oturum varsa hesap ona bağlanır; user_id değişmez (PRD 3.10 KK3). */
export async function googleIleGiris(): Promise<void> {
  // Bellekteki PKCE doğrulayıcısı tam sayfa yönlendirmede silinir: dönüşte oturum kurulmaz, kullanıcı bağlamsız giriş
  // ekranına düşer ve her denemede aynı döngüye girer. Yönlendirmeden önce dur, sayfa hata gösterir.
  // #561/#565: Instagram/Facebook gömülü tarayıcısında Google `disallowed_useragent` sayfası açar. Gömülü tarayıcı önce
  // bakılır (depolaması da kapalı olabilir; doğru yol yine menüden tarayıcıda açmak).
  // #577 KK3: ana ekrana eklenmiş iOS web uygulaması (`navigator.standalone`) gömülü sayılmaz.
  const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & { standalone?: boolean });
  if (Platform.OS === 'web' && gomuluTarayici(nav?.userAgent, nav?.standalone === true)) throw new GomuluTarayici();
  if (Platform.OS === 'web' && !oturumKalici) throw new DepolamaYok();
  const redirectTo = yonlendirmeAdresi();
  const options = { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sonuc = session?.user.is_anonymous
    ? await supabase.auth.linkIdentity({ provider: 'google', options })
    : await supabase.auth.signInWithOAuth({ provider: 'google', options });
  if (sonuc.error) throw sonuc.error;
  // Web tam sayfa yönlendirir; dönüşte detectSessionInUrl oturumu kurar.
  if (Platform.OS === 'web' || !sonuc.data.url) return;

  const tarayici = await WebBrowser.openAuthSessionAsync(sonuc.data.url, redirectTo);
  if (tarayici.type !== 'success') return; // kullanıcı vazgeçti
  const url = new URL(tarayici.url);
  const hata = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (hata) throw new Error(hata);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('OAuth dönüşünde code yok');
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function appleKullanilabilir(): Promise<boolean> {
  if (!APPLE_ACIK || Platform.OS !== 'ios') return false;
  const Apple = await import('expo-apple-authentication');
  return Apple.isAvailableAsync();
}

/** Apple adı yalnızca ilk girişte verir; profil kurulumu için user_metadata'ya yazılır. */
export async function appleIleGiris(): Promise<void> {
  const Apple = await import('expo-apple-authentication');
  const kimlik = await Apple.signInAsync({
    requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
  });
  if (!kimlik.identityToken) throw new Error('Apple identityToken yok');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: kimlik.identityToken });
  if (error) throw error;
  const ad = [kimlik.fullName?.givenName, kimlik.fullName?.familyName].filter(Boolean).join(' ');
  if (!ad) return;
  await supabase.auth.updateUser({ data: { full_name: ad } });
  // #138: profil kök düzende kendiliğinden oluşur; ad gelmeden "Gezgin / gezginN" olarak oluştuysa sunucu adı ve
  // kullanıcı adını Apple'ın verdiği adla düzeltir (elle değiştirilmiş profile dokunmaz).
  await supabase.rpc('profil_hazirla', { p_ad: ad });
}

/** Kullanıcı giriş penceresini kendisi kapattıysa hata gösterilmez. */
export function iptalMi(hata: unknown): boolean {
  return typeof hata === 'object' && hata !== null && (hata as { code?: string }).code === 'ERR_REQUEST_CANCELED';
}

export async function cikis(): Promise<void> {
  await supabase.auth.signOut();
}
