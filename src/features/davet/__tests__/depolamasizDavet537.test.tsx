// #537 KK: depolaması kapalı tarayıcıda (localStorage null ya da SecurityError) /r/{token} davet özetini ve
// "Google ile katıl"ı gösterir. expo-web-browser'ın web'deki maybeCompleteAuthSession'ı modül yüklenirken
// localStorage okur; taklit aynısını yapar. Ekran ve giris.ts gerçek modüllerle yüklenir.
/* eslint-disable @typescript-eslint/no-require-imports -- localStorage modül yüklenmeden önce bozulmalı */
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import type { DavetOzeti } from '@/lib/tipler';

const ozet: DavetOzeti = {
  trip_id: 'T1',
  name: null,
  city_label: 'Eskişehir',
  start_date: '2026-12-05',
  end_date: '2026-12-06',
  member_count: 1,
  place_count: 3,
  day_count: 2,
  inviter_name: 'Ayşe',
  inviter_photo: null,
  uye: false,
  gunler: [
    { index: 1, date: '2026-12-05', durak: 2 },
    { index: 2, date: '2026-12-06', durak: 1 },
  ],
};

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: () => {
    const ls = (globalThis as { localStorage?: Storage | null }).localStorage;
    (ls as Storage).getItem('ExpoWebBrowserRedirectHandle');
    return { type: 'failed' };
  },
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'gezi://giris' }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ hazir: true, hesapli: false }) }));
jest.mock('@/lib/acilis', () => ({ acilisKarariniKapat: jest.fn() }));
jest.mock('@/features/icerik/sorgular', () => ({ olayYaz: jest.fn() }));
jest.mock('@/features/profil/sorgular', () => ({ useProfil: () => ({ data: null, isPending: false }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({ token: 'B'.repeat(24) }) }));
jest.mock('@/features/davet/sorgular', () => ({
  DAVET_KANALI: 'web',
  useDavetOzeti: () => ({ data: ozet, isPending: false, isError: false, isFetching: false, refetch: jest.fn() }),
  useDavetleKatil: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDavetKarsilandi: () => jest.fn(),
  bekleyenDavetiYaz: jest.fn(async () => undefined),
  bekleyenDavetiSil: jest.fn(async () => undefined),
}));

function guvenlikHatasi(): never {
  const e = new Error('Access is denied for this document.');
  e.name = 'SecurityError';
  throw e;
}

// Ekran yüklenirken localStorage null: düzeltmeden önce giris.ts modül düzeyinde hata verip sayfayı düşürüyordu.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: null });
const Ekran = (require('@/app/r/[token]') as { default: React.ComponentType }).default;
const { t } = require('@/i18n') as typeof import('@/i18n');

describe('depolamasız tarayıcıda davet sayfası (#537)', () => {
  it.each([
    ['localStorage null', { configurable: true, value: null }],
    ['localStorage SecurityError', { configurable: true, get: guvenlikHatasi }],
  ])('%s: giriş modülü hata vermeden yüklenir', (_ad, tanim) => {
    Object.defineProperty(globalThis, 'localStorage', tanim as PropertyDescriptor);
    expect(() => jest.isolateModules(() => require('@/features/auth/giris'))).not.toThrow();
  });

  it('özet ve "Google ile katıl" görünür', () => {
    render(<Ekran />);
    expect(screen.getByText(t('davet.katilGoogle'))).toBeTruthy();
    expect(screen.getByText(t('davet.planBaslik'))).toBeTruthy();
    expect(screen.getByText(t('davet.davetEden', { ad: 'Ayşe' }))).toBeTruthy();
  });
});
