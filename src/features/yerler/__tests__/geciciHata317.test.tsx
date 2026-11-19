// #317 inceleme 1: hata kutusu 5 sn sonra ya da kapatılınca kalkar; hata yeniden gelince yeniden görünür.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { HATA_SURESI_MS, useGeciciGorunur } from '../geciciHata';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('#317 useGeciciGorunur', () => {
  it('hata 5 sn görünür, sonra kalkar', () => {
    const { result } = renderHook(() => useGeciciGorunur(true, 'ekleHata'));
    expect(result.current[0]).toBe(true);
    act(() => jest.advanceTimersByTime(HATA_SURESI_MS - 1));
    expect(result.current[0]).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current[0]).toBe(false);
  });

  it('kapat() hemen gizler (panel kapanınca)', () => {
    const { result } = renderHook(() => useGeciciGorunur(true, 'sinir'));
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
  });

  it('hata kalkıp yeniden gelince ya da metin değişince süre baştan başlar', () => {
    const { result, rerender } = renderHook(({ aktif, anahtar }: { aktif: boolean; anahtar: string }) => useGeciciGorunur(aktif, anahtar), {
      initialProps: { aktif: true, anahtar: 'hata' },
    });
    act(() => jest.advanceTimersByTime(HATA_SURESI_MS));
    expect(result.current[0]).toBe(false);
    rerender({ aktif: true, anahtar: 'sinir' });
    expect(result.current[0]).toBe(true);
    act(() => jest.advanceTimersByTime(HATA_SURESI_MS));
    expect(result.current[0]).toBe(false);
    rerender({ aktif: false, anahtar: 'sinir' });
    rerender({ aktif: true, anahtar: 'sinir' });
    expect(result.current[0]).toBe(true);
  });

  it('hata yokken görünmez', () => {
    const { result } = renderHook(() => useGeciciGorunur(false));
    expect(result.current[0]).toBe(false);
  });
});
