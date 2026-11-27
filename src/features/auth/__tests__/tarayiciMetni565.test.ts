// #565: gömülü tarayıcıda menü ipucu, depolaması kapalı gerçek tarayıcıda başka tarayıcı / gizli olmayan pencere.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

import { DepolamaYok, GomuluTarayici, girisHataAnahtari, googleIleGiris, tarayiciUygunDegilMi } from '@/features/auth/giris';
import { t } from '@/i18n';

const mockGetSession = jest.fn(async () => ({ data: { session: null } }));
const mockOAuth = jest.fn(async () => ({ data: { url: null }, error: null }));
const mockDurum = { kalici: true };
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'gezi://giris' }));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession(), signInWithOAuth: () => mockOAuth() } },
  get oturumKalici() {
    return mockDurum.kalici;
  },
}));

const UA = {
  instagram: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.39 Mobile Safari/537.36 Instagram 357.0.0.25.101 Android',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/489.0.0.40.108;FBBV/123]',
  webview: 'Mozilla/5.0 (Linux; Android 13; SM-A536B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
};
const KK1 = 'Instagram ya da Facebook gibi bir uygulamanın içinden giriş yapılamıyor. Linki uygulamanın menüsünden tarayıcıda aç ya da kopyalayıp Chrome veya Safari\'ye yapıştır.';
const KK2 = 'Bu tarayıcı girişe izin vermiyor. Linki başka bir tarayıcıda ya da gizli veya özel olmayan normal bir sekmede aç.';

const os = Platform.OS;
const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const ua = (deger: string) => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: deger } });
/** googleIleGiris'in hatası (yoksa null) ve davet / giriş metinleri. */
async function dene(): Promise<{ hata: unknown; davet: string | null; giris: string | null }> {
  try {
    await googleIleGiris();
    return { hata: null, davet: null, giris: null };
  } catch (e) {
    return { hata: e, davet: t(girisHataAnahtari(e, 'davet')), giris: t(girisHataAnahtari(e, 'giris')) };
  }
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
  mockDurum.kalici = true;
  mockGetSession.mockClear();
  mockOAuth.mockClear();
});
afterEach(() => {
  if (nav) Object.defineProperty(globalThis, 'navigator', nav);
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
});

describe('#565 tarayıcı metni duruma göre', () => {
  it('KK1: metinler issue ile birebir; iki yerde de aynı', () => {
    expect(t('davet.gomuluTarayici')).toBe(KK1);
    expect(t('giris.gomuluTarayici')).toBe(KK1);
    expect(t('davet.depolamaYok')).toBe(KK2);
    expect(t('giris.depolamaYok')).toBe(KK2);
  });

  it.each([
    ['Instagram', UA.instagram],
    ['Facebook', UA.facebook],
    ['; wv) WebView', UA.webview],
  ])('KK1/KK3: %s → GomuluTarayici, menü metni; Google\'a gidilmez (depolama kapalı olsa da)', async (_ad, deger) => {
    ua(deger);
    for (const kalici of [true, false]) {
      mockDurum.kalici = kalici;
      const r = await dene();
      expect(r.hata).toBeInstanceOf(GomuluTarayici);
      expect(r.davet).toBe(KK1);
      expect(r.giris).toBe(KK1);
      expect(tarayiciUygunDegilMi(r.hata)).toBe(true);
    }
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it.each([
    ['Chrome', UA.chrome],
    ['Safari', UA.safari],
  ])('KK2/KK3: depolaması kapalı %s → DepolamaYok, başka tarayıcı metni; Google\'a gidilmez', async (_ad, deger) => {
    ua(deger);
    mockDurum.kalici = false;
    const r = await dene();
    expect(r.hata).toBeInstanceOf(DepolamaYok);
    expect(r.hata).not.toBeInstanceOf(GomuluTarayici);
    expect(r.davet).toBe(KK2);
    expect(r.giris).toBe(KK2);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it.each([
    ['Chrome', UA.chrome],
    ['Safari', UA.safari],
  ])('KK4: normal %s → iki metin de yok, giriş Google\'a gider', async (_ad, deger) => {
    ua(deger);
    // RN jest ortamında window.location yok; web yönlendirme adresi origin'den kurulur.
    const w = globalThis as { location?: unknown };
    const konum = w.location;
    w.location = { origin: 'https://ornek.test' };
    const r = await dene();
    w.location = konum;
    expect(r.hata).toBeNull();
    expect(mockOAuth).toHaveBeenCalled();
    expect(girisHataAnahtari(new Error('x'), 'davet')).toBe('giris.hata');
    expect(tarayiciUygunDegilMi(new Error('x'))).toBe(false);
  });
});
