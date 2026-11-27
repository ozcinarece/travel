// #577: iOS'taki öbür uygulama içi tarayıcılar (WKWebView) da gömülü sayılır; Safari ve iOS tarayıcıları sayılmaz.
import { describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

import { GomuluTarayici, girisHataAnahtari, googleIleGiris } from '@/features/auth/giris';
import { gomuluTarayici } from '@/features/auth/gomuluTarayici';

const mockGetSession = jest.fn(async () => ({ data: { session: null } }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'gezi://giris' }));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession(), signInWithOAuth: jest.fn(async () => ({ error: null })) } },
  oturumKalici: true,
}));

const UA = {
  linkedinIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1734',
  wkWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  wkWebViewIpad: 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  criOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  fxiOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
  edgiOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.2903.68 Mobile/15E148 Safari/605.1.15',
  gsa: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/343.0.695551749 Mobile/15E148 Safari/604.1',
  standalone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

function webdeNavigator(nav: Record<string, unknown>, fn: () => Promise<void>) {
  const os = Platform.OS;
  const eski = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const eskiWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: nav });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://ornek.test' } } });
  return fn().finally(() => {
    if (eski) Object.defineProperty(globalThis, 'navigator', eski);
    if (eskiWindow) Object.defineProperty(globalThis, 'window', eskiWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  });
}

describe('gomuluTarayici, iOS WKWebView (#577)', () => {
  it.each([
    ['LinkedIn (iOS)', UA.linkedinIos],
    ['genel WKWebView (iPhone)', UA.wkWebView],
    ['genel WKWebView (iPad)', UA.wkWebViewIpad],
  ])('KK1: %s gömülü sayılır', (_ad, ua) => expect(gomuluTarayici(ua)).toBe(true));

  it.each([
    ['Safari / Safari görünümü (WhatsApp)', UA.safari],
    ['Chrome (CriOS)', UA.criOS],
    ['Firefox (FxiOS)', UA.fxiOS],
    ['Edge (EdgiOS)', UA.edgiOS],
    ['Google uygulaması (GSA)', UA.gsa],
  ])('KK2: %s gömülü sayılmaz', (_ad, ua) => expect(gomuluTarayici(ua)).toBe(false));

  it('KK3: ana ekrana eklenmiş web uygulaması (standalone) gömülü sayılmaz', () => {
    expect(gomuluTarayici(UA.standalone, true)).toBe(false);
  });

  it("KK1: web + LinkedIn iOS: googleIleGiris Google'a yönlendirmeden GomuluTarayici verir", async () => {
    mockGetSession.mockClear();
    await webdeNavigator({ userAgent: UA.linkedinIos }, async () => {
      const hata = await googleIleGiris().catch((e: unknown) => e);
      expect(hata).toBeInstanceOf(GomuluTarayici);
      // #565 KK1 metni (menüden tarayıcıda aç) çıkar.
      expect(girisHataAnahtari(hata, 'davet')).toBe('davet.gomuluTarayici');
      expect(girisHataAnahtari(hata, 'giris')).toBe('giris.gomuluTarayici');
      expect(mockGetSession).not.toHaveBeenCalled();
    });
  });

  it('KK3: web + standalone: googleIleGiris GomuluTarayici vermez', async () => {
    mockGetSession.mockClear();
    await webdeNavigator({ userAgent: UA.standalone, standalone: true }, async () => {
      await expect(googleIleGiris()).resolves.toBeUndefined();
      expect(mockGetSession).toHaveBeenCalled();
    });
  });
});
