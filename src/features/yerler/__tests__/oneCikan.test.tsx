import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import type { HafifYer } from '../api';
import { ONE_CIKAN_YENILEME_MS } from '../filtre';
import { useOneCikanlar } from '../oneCikan';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const yer = (place_id: string, puan: number, n: number): HafifYer => ({ place_id, ad: place_id, lat: 0, lng: 0, primary_type: null, tz: null, puan, puan_sayisi: n, acik: null, ulke_kodu: null });

// #70 incelemesi 🔴2: açılışta boş küme hemen dolar; dolu küme en fazla 10 sn'de bir değişir.
describe('useOneCikanlar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('boş liste → ilk karolar gelince hemen ★; sonraki değişiklik 10 sn bekler', () => {
    const { result, rerender } = renderHook((yerler: HafifYer[]) => useOneCikanlar(yerler), { initialProps: [] as HafifYer[] });
    expect(result.current.size).toBe(0);
    // 1 sn sonra ilk karo geldi: bekleme yok.
    act(() => jest.advanceTimersByTime(1000));
    const ilk = [yer('a', 4.8, 30_000), yer('b', 4.2, 100)];
    rerender(ilk);
    act(() => jest.advanceTimersByTime(0));
    expect([...result.current]).toEqual(['a']);
    // Liste büyüdü, yeni lider var: 10 sn dolmadan değişmez, dolunca değişir.
    const ikinci = [...ilk, yer('c', 4.9, 100_000), ...Array.from({ length: 8 }, (_, i) => yer(`z${i}`, 4.0, 50))];
    rerender(ikinci);
    act(() => jest.advanceTimersByTime(ONE_CIKAN_YENILEME_MS - 500));
    expect([...result.current]).toEqual(['a']);
    act(() => jest.advanceTimersByTime(600));
    expect([...result.current]).toEqual(['c', 'a']);
  });
});
