// #561: Instagram/Facebook gömülü tarayıcısı Google'a yönlendirilmeden tanınır.
import { describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

import { GomuluTarayici, googleIleGiris } from '@/features/auth/giris';
import { gomuluTarayici } from '@/features/auth/gomuluTarayici';

const mockGetSession = jest.fn();
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'gezi://giris' }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: () => mockGetSession() } }, oturumKalici: true }));

const UA = {
  instagram:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.39 Mobile Safari/537.36 Instagram 357.0.0.25.101 Android',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.15.88 (iPhone15,2; iOS 18_1; tr_TR)',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/489.0.0.40.108;FBBV/123]',
  webview: 'Mozilla/5.0 (Linux; Android 13; SM-A536B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
};

describe('gomuluTarayici (#561 KK1)', () => {
  it.each([
    ['Instagram (Android)', UA.instagram],
    ['Instagram (iOS)', UA.instagramIos],
    ['Facebook (iOS)', UA.facebookIos],
    ['Android WebView', UA.webview],
  ])('%s gömülü sayılır', (_ad, ua) => expect(gomuluTarayici(ua)).toBe(true));

  it.each([
    ['Chrome / WhatsApp Custom Tab', UA.chromeAndroid],
    ['Safari / Safari görünümü', UA.safariIos],
    ['boş', ''],
    ['yok', null],
  ])('%s gömülü sayılmaz', (_ad, ua) => expect(gomuluTarayici(ua)).toBe(false));

  it("web + Instagram: googleIleGiris Google'a yönlendirmeden GomuluTarayici verir (#565 KK3)", async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: UA.instagram } });
    try {
      await expect(googleIleGiris()).rejects.toBeInstanceOf(GomuluTarayici);
      expect(mockGetSession).not.toHaveBeenCalled();
    } finally {
      if (nav) Object.defineProperty(globalThis, 'navigator', nav);
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    }
  });
});
