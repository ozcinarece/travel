import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Web'de OAuth dönüşünde açılan pencereyi kapatır.
WebBrowser.maybeCompleteAuthSession();

// Apple girişi kod olarak hazır; Apple Developer hesabı gelene kadar bayrakla kapalı.
const APPLE_ACIK = process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1';

// Supabase → Auth → URL Configuration → Redirect URLs listesinde olmalı: gezi://giris ve web kökü/giris
function yonlendirmeAdresi(): string {
  if (Platform.OS === 'web') return `${window.location.origin}/giris`;
  return makeRedirectUri({ scheme: 'gezi', path: 'giris' });
}

/** PRD 0.1 KK1. Misafir (anonim) oturum varsa hesap ona bağlanır; user_id değişmez (PRD 3.10 KK3). */
export async function googleIleGiris(): Promise<void> {
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
  if (ad) await supabase.auth.updateUser({ data: { full_name: ad } });
}

/** Kullanıcı giriş penceresini kendisi kapattıysa hata gösterilmez. */
export function iptalMi(hata: unknown): boolean {
  return typeof hata === 'object' && hata !== null && (hata as { code?: string }).code === 'ERR_REQUEST_CANCELED';
}

export async function cikis(): Promise<void> {
  await supabase.auth.signOut();
}
