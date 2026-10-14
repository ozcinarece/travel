import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { bolgeHesapla, zoomDelta } from '@/components/harita/geo';

import type { HafifYer, OneriCipi } from '../api';
import { BOS_FILTRE, VARSAYILAN_FILTRE, type Filtre } from '../filtre';
import { birikimiAl, kesfetBelleginiSifirla, kesfetSayaci, useKesfetOnerileri } from '../kesfetYukleme';
import { alanCipi, sehirCipleri } from '../sehirListesi';

type Istek = { cip: OneriCipi; merkez: { lat: number; lng: number; yaricapM?: number }; sehir?: boolean };
const mockKesfetYerleri = jest.fn<(s: Istek) => Promise<{ yerler: HafifYer[]; yaricapM: number }>>();
jest.mock('../api', () => ({ ...(jest.requireActual('../api') as object), kesfetYerleri: (s: Istek) => mockKesfetYerleri(s) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn() }));

const eskisehir = { lat: 39.7767, lng: 30.5206 };
const ekran = (z: number, m = eskisehir) => bolgeHesapla(m, zoomDelta(z), zoomDelta(z) / 2, z);
let sira = 0;
const yer = (tip: string): HafifYer => ({ place_id: `p${++sira}`, ad: 'x', lat: eskisehir.lat, lng: eskisehir.lng, primary_type: tip, tz: null, puan: 4.6, puan_sayisi: 500, acik: null, ulke_kodu: null });

/** Sunucu taklidi: şehir isteğinde 8 km döner; "Bu alanda ara"da `alanSonucu` kadar yer. */
let alanSonucu = 10;
function sahteSunucu() {
  mockKesfetYerleri.mockImplementation(async (s) => {
    if (s.sehir) return { yerler: [yer('museum'), yer('hotel'), yer('restaurant')], yaricapM: 8000 };
    return { yerler: Array.from({ length: alanSonucu }, () => yer('restaurant')), yaricapM: s.merkez.yaricapM ?? 0 };
  });
}

function kanca(filtre: Filtre) {
  return renderHook(({ f }: { f: Filtre }) => useKesfetOnerileri('s1', eskisehir, sehirCipleri(f)), { initialProps: { f: filtre } });
}

describe('#189 Ek 2 useKesfetOnerileri', () => {
  beforeEach(() => {
    kesfetBelleginiSifirla();
    mockKesfetYerleri.mockReset();
    alanSonucu = 10;
    sahteSunucu();
  });

  it('KK10 akışı: Turistik açılış 3 · 5 kaydırma/zoom 0 · Yemek 1 · şehir dışı "Bu alanda ara" 1 (az sonuçta +1) → ≤ 6 istek', async () => {
    for (const azSonuc of [false, true]) {
      kesfetBelleginiSifirla();
      mockKesfetYerleri.mockClear();
      alanSonucu = azSonuc ? 2 : 10;
      const { result, rerender, unmount } = kanca(VARSAYILAN_FILTRE);
      await waitFor(() => expect(result.current.yukleniyor).toBe(false));
      await waitFor(() => expect(kesfetSayaci.istek).toBe(3));
      expect(mockKesfetYerleri.mock.calls.map(([s]) => [s.cip, s.sehir])).toEqual([
        ['turistik_tarihi', true],
        ['turistik_muze', true],
        ['turistik_manzara', true],
      ]);
      // Şehir dairesi sunucunun yarıçapıyla.
      await waitFor(() => expect(result.current.sehirAlani).toEqual({ merkez: eskisehir, yaricapM: 8000 }));
      // KK8: kaydırma / zoom (kanca bölge almıyor) ve aynı filtreyle yeniden çizim istek atmaz.
      for (let i = 0; i < 5; i++) rerender({ f: { ...VARSAYILAN_FILTRE } });
      expect(kesfetSayaci.istek).toBe(3);
      // Yemek çipi: bir istek.
      const yemek = { ...BOS_FILTRE, kategoriler: ['yemek' as const] };
      rerender({ f: yemek });
      await waitFor(() => expect(kesfetSayaci.istek).toBe(4));
      // Şehir dışına kaydır → "Bu alanda ara": görünüm için tek istek (az sonuçta bir kez 3 kat yarıçapla).
      const disarida = ekran(13, { lat: eskisehir.lat + 0.25, lng: eskisehir.lng });
      act(() => result.current.alandaAra(disarida, alanCipi(yemek)));
      await waitFor(() => expect(result.current.alanAraniyor).toBe(false));
      await waitFor(() => expect(kesfetSayaci.istek).toBe(azSonuc ? 6 : 5));
      const alanIstekleri = mockKesfetYerleri.mock.calls.map(([s]) => s).filter((s) => !s.sehir);
      expect(alanIstekleri[0].cip).toBe('yemek');
      expect(alanIstekleri[0].merkez.lat).toBeCloseTo(disarida.merkez.lat, 6);
      if (azSonuc) {
        expect(alanIstekleri[1].merkez.yaricapM).toBe(Math.min(15_000, Math.round(alanIstekleri[0].merkez.yaricapM! * 3)));
        expect(result.current.genisAlan?.yaricapM).toBe(alanIstekleri[1].merkez.yaricapM);
      } else expect(result.current.genisAlan).toBeNull();
      expect(result.current.arananlar.length).toBe(azSonuc ? 2 : 1);
      expect(kesfetSayaci.istek).toBeLessThanOrEqual(6);
      unmount();
    }
  });

  it('ekran yeniden açılınca ve Turistik\'e dönünce istek yok (oturum belleği); konaklama birikime girmez', async () => {
    const ilk = kanca(VARSAYILAN_FILTRE);
    await waitFor(() => expect(kesfetSayaci.istek).toBe(3));
    await waitFor(() => expect(ilk.result.current.yukleniyor).toBe(false));
    ilk.unmount();
    const ikinci = kanca(VARSAYILAN_FILTRE);
    await waitFor(() => expect(ikinci.result.current.yerler.length).toBeGreaterThan(0));
    expect(kesfetSayaci.istek).toBe(3);
    expect([...birikimiAl('s1').yerler.values()].some((y) => y.primary_type === 'hotel')).toBe(false);
  });

  it('merkez gelmeden istek yok; hatalı istek bellekten düşer ve sonraki filtre değişiminde yeniden denenir', async () => {
    const bos = renderHook(() => useKesfetOnerileri('s1', null, ['turistik_muze']));
    await act(async () => undefined);
    expect(kesfetSayaci.istek).toBe(0);
    bos.unmount();

    mockKesfetYerleri.mockRejectedValueOnce(new Error('502'));
    const { result, rerender } = renderHook(({ c }: { c: OneriCipi[] }) => useKesfetOnerileri('s1', eskisehir, c), { initialProps: { c: ['yemek'] as OneriCipi[] } });
    await waitFor(() => expect(result.current.hata).toBe(true));
    rerender({ c: ['yemek', 'kafe'] });
    await waitFor(() => expect(kesfetSayaci.istek).toBe(3));
    await waitFor(() => expect(result.current.hata).toBe(false));
    expect(mockKesfetYerleri.mock.calls.map(([s]) => s.cip)).toEqual(['yemek', 'yemek', 'kafe']);
  });
});
