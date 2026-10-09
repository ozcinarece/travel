import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { bolgeHesapla, zoomDelta } from '@/components/harita/geo';

import type { HafifYer } from '../api';
import { KARO_GECIKME_MS } from '../karolar';
import { karoBelleginiSifirla, karoSayaci, useKaroOnerileri } from '../karoYukleme';

const mockYakinYerler = jest.fn<() => Promise<HafifYer[]>>();
jest.mock('../api', () => ({ ...(jest.requireActual('../api') as object), yakinYerler: () => mockYakinYerler() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn() }));

const eskisehir = { lat: 39.7767, lng: 30.5206 };
const bolge = (zoom: number, dLat = 0) => bolgeHesapla({ lat: eskisehir.lat + dLat, lng: eskisehir.lng }, zoomDelta(zoom), zoomDelta(zoom) / 2, zoom);
const yer = (place_id: string): HafifYer => ({ place_id, ad: place_id, lat: 0, lng: 0, primary_type: null, tz: null, puan: 4.5, puan_sayisi: 100, acik: null, ulke_kodu: null });

// #71 KK3: harita dururken yeni tur açılmaz — aynı bölgeyle yeniden render tur sayısını artırmaz; yükleme biter.
describe('useKaroOnerileri (#71)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    karoBelleginiSifirla();
    mockYakinYerler.mockReset();
    mockYakinYerler.mockImplementation(async () => [yer(`p${Math.random()}`)]);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('aynı bölge nesnesiyle yeniden render → tur artmaz; yükleme bitince yukleniyor false', async () => {
    const b = bolge(14);
    const { result, rerender } = renderHook(({ bolge: bb }: { bolge: typeof b }) => useKaroOnerileri('s1', ['hepsi'], bb), { initialProps: { bolge: b } });
    // Küme değişimi "hemen" sayılır (0 ms): ilk tur.
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(karoSayaci.tur).toBe(1);
    for (let i = 0; i < 20; i++) {
      rerender({ bolge: b });
      await act(async () => {
        jest.advanceTimersByTime(KARO_GECIKME_MS + 10);
      });
    }
    expect(karoSayaci.tur).toBe(1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.yukleniyor).toBe(false);
    expect(result.current.yerler.length).toBeGreaterThan(0);
  });

  it('yeni bölge → 400 ms sonra bir tur; hızlı ardışık bölgeler tek tur', async () => {
    const { rerender } = renderHook(({ bolge: bb }: { bolge: ReturnType<typeof bolge> }) => useKaroOnerileri('s1', ['hepsi'], bb), { initialProps: { bolge: bolge(14) } });
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(karoSayaci.tur).toBe(1);
    rerender({ bolge: bolge(14, 0.05) });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    rerender({ bolge: bolge(14, 0.1) });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(karoSayaci.tur).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(KARO_GECIKME_MS);
    });
    expect(karoSayaci.tur).toBe(2);
  });
});
