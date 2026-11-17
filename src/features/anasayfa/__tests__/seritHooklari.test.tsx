// #290 KK5 · KK9 · KK11: şerit ve "Harcamaları kapat" hook'ları gerçek hesapla; Supabase sorguları elle verilir.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

import { seritAdimMetni, useAcikBorc, useSeritAdimi } from '@/features/anasayfa/serit';
import type { SeyahatOzet } from '@/lib/tipler';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

type Sorgu = { data?: unknown; isError?: boolean };
let mockOturum: { session: { user: { id: string } } | null } = { session: { user: { id: 'ben' } } };
jest.mock('@/lib/oturum', () => ({ useOturum: () => mockOturum }));

const mockSecenekler: Record<string, unknown> = {};
let mockHarcamalar: Sorgu = { data: [] };
let mockOdesmeler: Sorgu = { data: [] };
let mockUyeler: Sorgu = { data: [] };
jest.mock('@/features/harcama/sorgular', () => ({
  useHarcamalar: (_id: string, s: unknown) => ((mockSecenekler.harcama = s), mockHarcamalar),
  useOdesmeler: (_id: string, s: unknown) => ((mockSecenekler.odesme = s), mockOdesmeler),
}));
let mockGunler: Sorgu = { data: [] };
let mockDuraklar: Sorgu = { data: [] };
let mockMekanlar: Sorgu = { data: [] };
let mockOteller: Sorgu = { data: [] };
jest.mock('@/features/gunler/sorgular', () => ({ useGunler: () => mockGunler, useDuraklar: () => mockDuraklar }));
jest.mock('@/features/konaklama/sorgular', () => ({ useKonaklamaSatirlari: () => mockOteller }));
jest.mock('@/features/mekanlar/sorgular', () => ({
  useMekanlar: () => mockMekanlar,
  useUyeler: (_id: string, s: unknown) => ((mockSecenekler.uye = s), mockUyeler),
}));

const sy: SeyahatOzet = {
  id: 's1',
  name: null,
  city_label: 'Bursa',
  start_date: '2099-03-10',
  end_date: '2099-03-11',
  tz: 'Europe/Istanbul',
  hotel_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
  members: [],
  places: [{ count: 1 }],
};

beforeEach(() => {
  mockOturum = { session: { user: { id: 'ben' } } };
  mockHarcamalar = { data: [] };
  mockOdesmeler = { data: [] };
  mockUyeler = { data: [{ user_id: 'ben' }, { user_id: 'a' }] };
  mockGunler = { data: [{ id: 'g1', trip_id: 's1', index: 1, date: '2099-03-10', start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null }] };
  mockMekanlar = { data: [{ id: 'm1', trip_id: 's1', place_id: 'p', primary_type: 'restaurant', lat: 0, lng: 0, google_fetched_at: '', default_minutes: 60, added_by: null, note: null, created_at: '2026-01-01' }] };
  mockDuraklar = { data: [{ id: 'd1', trip_id: 's1', day_id: 'g1', place_ref: 'm1', order_key: 'a', minutes: 60, skipped: false }] };
  mockOteller = { data: [] };
});

describe('#290 KK5: Keşfet şeridinde otel adımı', () => {
  it('otelsiz planlanan seyahat → "Sıradaki adım: otel seç"', () => {
    const { result } = renderHook(() => useSeritAdimi(sy));
    expect(result.current).toEqual({ tur: 'otel' });
    expect(seritAdimMetni(result.current!)).toBe('Sıradaki adım: otel seç');
  });

  it('#290 KK4: sorgulardan biri hata verirse adım null (şerit tarih satırını gösterir); yüklenirken undefined', () => {
    mockOteller = { isError: true };
    expect(renderHook(() => useSeritAdimi(sy)).result.current).toBeNull();
    mockOteller = {};
    expect(renderHook(() => useSeritAdimi(sy)).result.current).toBeUndefined();
  });
});

describe('#290 KK9 · KK11: useAcikBorc', () => {
  it('KK9: üç sorgu yalnız bir kez yeniden dener', () => {
    renderHook(() => useAcikBorc(sy));
    expect(mockSecenekler).toEqual({ harcama: { retry: 1 }, odesme: { retry: 1 }, uye: { retry: 1 } });
  });

  it('KK9: sorgulardan biri hata verirse null (sıradaki durum çizilir)', () => {
    for (const hata of ['harcama', 'odesme', 'uye'] as const) {
      mockHarcamalar = hata === 'harcama' ? { isError: true } : { data: [] };
      mockOdesmeler = hata === 'odesme' ? { isError: true } : { data: [] };
      mockUyeler = hata === 'uye' ? { isError: true } : { data: [] };
      expect(renderHook(() => useAcikBorc(sy)).result.current).toBeNull();
    }
  });

  it('KK11: oturum yoksa null (sorgular hiç çalışmasa da alt bölüm takılı kalmaz)', () => {
    mockOturum = { session: null };
    mockHarcamalar = {};
    mockOdesmeler = {};
    mockUyeler = {};
    expect(renderHook(() => useAcikBorc(sy)).result.current).toBeNull();
  });

  it('veri gelene kadar undefined; gelince borç özeti', () => {
    mockHarcamalar = {};
    expect(renderHook(() => useAcikBorc(sy)).result.current).toBeUndefined();
    mockHarcamalar = { data: [] };
    expect(renderHook(() => useAcikBorc(sy)).result.current).toEqual(expect.objectContaining({ transfer: 0, benimNet: 0, karsilar: [] }));
  });
});
