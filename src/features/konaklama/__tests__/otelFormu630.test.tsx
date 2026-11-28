// #630 KK3: otel formu (`/yeni/otel`) arama kutusu canlı ad gelmeden "Otelim" ya da takma adla açılmaz; ad gelene kadar
// boş başlar, gelince otelin kendi (Google) adını gösterir. place_id'siz noktada noktanın kendi adı kalır.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { t } from '@/i18n';

import OtelEkrani from '@/app/yeni/otel';

import type { Konaklama } from '../plan';

const mockSatirlar = { data: [] as Konaklama[], isPending: false };
const mockCanli = { data: undefined as Record<string, { ad: string }> | undefined };
const mockHafifIds: string[][] = [];

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ trip: 'T1' }),
}));
jest.mock('@/components/harita/HaritaEkrani', () => ({
  HaritaEkrani: (p: { arama: ReactNode; ustEk: ReactNode; altPanel: ReactNode }) => (
    <>
      {p.arama}
      {p.ustEk}
      {p.altPanel}
    </>
  ),
  BilgiHapi: () => null,
  EylemHapi: () => null,
}));
jest.mock('@/components/yerler/GoogleAtfi', () => ({ GoogleAtfi: () => null }));
jest.mock('@/features/seyahatler/sorgular', () => ({
  useSeyahat: () => ({ isPending: false, isError: false, data: { id: 'T1', city_label: 'Eskişehir', lat: 39.77, lng: 30.52 } }),
  useOtelKaydet: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/features/gunler/sorgular', () => ({
  useGunler: () => ({ isPending: false, data: [{ id: 'G1', index: 0, start_stay_id: 'S1', end_stay_id: 'S1' }] }),
}));
jest.mock('@/features/konaklama/sorgular', () => ({ useKonaklamaSatirlari: () => mockSatirlar }));
jest.mock('@/features/yerler/api', () => ({
  ...jest.requireActual<object>('@/features/yerler/api'),
  useOtelOnerileri: () => ({ data: undefined, isFetching: false, isError: false }),
  useHafifYerler: (ids: string[]) => {
    mockHafifIds.push(ids);
    return mockCanli;
  },
}));

const otel = (k: Partial<Konaklama>): Konaklama =>
  ({ id: 'S1', trip_id: 'T1', place_id: 'ChIJ-otel', lat: 39.78, lng: 30.51, label: null, takma_ad: null, ...k }) as Konaklama;

const kutu = () => screen.getByLabelText(t('otel.ara'));

beforeEach(() => {
  mockCanli.data = undefined;
  mockHafifIds.length = 0;
});

describe('#630 KK3 otel formu arama kutusu', () => {
  it('canlı ad gelmeden boş başlar ("Otelim" yazmaz), gelince otelin adını gösterir', () => {
    mockSatirlar.data = [otel({})];
    const { rerender } = render(<OtelEkrani />);
    expect(kutu().props.value).toBe('');
    expect(screen.queryByDisplayValue(t('otel.adsiz'))).toBeNull();
    expect(mockHafifIds.at(-1)).toEqual(['ChIJ-otel']);

    mockCanli.data = { 'ChIJ-otel': { ad: 'Divan Otel' } };
    rerender(<OtelEkrani />);
    expect(kutu().props.value).toBe('Divan Otel');
  });

  it('takma adlı otelde kutu takma adla açılmaz; canlı ad gelince onu gösterir', () => {
    mockSatirlar.data = [otel({ takma_ad: 'Bizim otel' })];
    const { rerender } = render(<OtelEkrani />);
    expect(kutu().props.value).toBe('');
    expect(screen.queryByDisplayValue('Bizim otel')).toBeNull();

    mockCanli.data = { 'ChIJ-otel': { ad: 'Divan Otel' } };
    rerender(<OtelEkrani />);
    expect(kutu().props.value).toBe('Divan Otel');
  });

  it('kullanıcı kutuyu temizleyince canlı ad geri gelmez', () => {
    mockSatirlar.data = [otel({})];
    mockCanli.data = { 'ChIJ-otel': { ad: 'Divan Otel' } };
    const { rerender } = render(<OtelEkrani />);
    expect(kutu().props.value).toBe('Divan Otel');
    fireEvent.changeText(kutu(), '');
    rerender(<OtelEkrani />);
    expect(kutu().props.value).toBe('');
  });

  it('koordinatı boşalmış otelin adı istenmez (#318)', () => {
    mockSatirlar.data = [otel({ lat: null, lng: null } as unknown as Partial<Konaklama>)];
    render(<OtelEkrani />);
    expect(kutu().props.value).toBe('');
    expect(mockHafifIds.every((ids) => ids.length === 0)).toBe(true);
  });

  it("place_id'siz noktada noktanın kendi adı kalır, Google'a istek yok", () => {
    mockSatirlar.data = [otel({ place_id: null, label: 'Teyzemin evi', takma_ad: 'Ev' })];
    render(<OtelEkrani />);
    expect(kutu().props.value).toBe('Teyzemin evi');
    expect(mockHafifIds.every((ids) => ids.length === 0)).toBe(true);
  });
});
