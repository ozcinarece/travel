import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { bolgeHesapla, zoomDelta } from '@/components/harita/geo';

import type { HafifYer } from '../api';
import { karoBelleginiSifirla, karoSayaci, useKaroOnerileri } from '../karoYukleme';

const mockYakinYerler = jest.fn<() => Promise<HafifYer[]>>();
jest.mock('../api', () => ({ ...(jest.requireActual('../api') as object), yakinYerler: () => mockYakinYerler() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn() }));

const eskisehir = { lat: 39.7767, lng: 30.5206 };
const bolge = (zoom: number, dLat = 0) => bolgeHesapla({ lat: eskisehir.lat + dLat, lng: eskisehir.lng }, zoomDelta(zoom), zoomDelta(zoom) / 2, zoom);
const yer = (place_id: string): HafifYer => ({ place_id, ad: place_id, lat: 0, lng: 0, primary_type: null, tz: null, puan: 4.5, puan_sayisi: 100, acik: null, ulke_kodu: null });

// #71 ürün kararı: açılışta tek tur; harita kaydırılınca / yakınlaştırılınca / filtre değişince istek yok; "Bu bölgeyi tara" = 1 tur.
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

  it('bölge gelmeden tur yok; ilk bölgeyle 1 tur; bölge 10 kez değişince tur artmaz; yükleme biter', async () => {
    const { result, rerender } = renderHook(({ b }: { b: ReturnType<typeof bolge> | null }) => useKaroOnerileri('s1', b), { initialProps: { b: null as ReturnType<typeof bolge> | null } });
    expect(karoSayaci.tur).toBe(0);
    expect(result.current.sonTaranan).toBeNull();
    await act(async () => {
      rerender({ b: bolge(14) });
    });
    expect(karoSayaci.tur).toBe(1);
    for (let i = 1; i <= 10; i++) {
      await act(async () => {
        rerender({ b: bolge(14 + (i % 3), i * 0.05) });
        jest.advanceTimersByTime(1000);
      });
    }
    expect(karoSayaci.tur).toBe(1);
    expect(result.current.yukleniyor).toBe(false);
    expect(result.current.yerler.length).toBeGreaterThan(0);
    expect(result.current.sonTaranan?.merkez.lat).toBeCloseTo(eskisehir.lat);
  });

  it('"Bu bölgeyi tara": dokunuş başına en fazla 1 tur; yoldayken ikinci dokunuş yok sayılır; sonuçlar birikime eklenir', async () => {
    // Zoom 12 görünümü ≤ 12 karo: tek tur görünümün tamamını kapsar.
    const { result } = renderHook(() => useKaroOnerileri('s1', bolge(12)));
    await act(async () => {});
    expect(karoSayaci.tur).toBe(1);
    const once = result.current.yerler.length;
    const uzak = bolge(12, 0.3);
    await act(async () => {
      result.current.tara(uzak, ['hepsi']);
      result.current.tara(uzak, ['hepsi']);
    });
    expect(karoSayaci.tur).toBe(2);
    expect(result.current.sonTaranan).toBe(uzak);
    expect(result.current.yerler.length).toBeGreaterThan(once);
    // Aynı bölge yeniden taranırsa önbellekteki karolar istenmez (tur sayılmaz).
    await act(async () => {
      result.current.tara(uzak, ['hepsi']);
    });
    expect(karoSayaci.tur).toBe(2);
  });
});
