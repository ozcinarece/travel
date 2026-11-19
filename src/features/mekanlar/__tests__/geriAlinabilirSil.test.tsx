// #387 KK1–KK3: ✓ ile çıkarmanın ortak kancası — bant metni (güne atanmış / atanmamış), "Geri al" hiçbir şeyi silmez, 5 sn
// sonra bir kez silinir, ekrandan çıkışta ve arka planda silinir, ikinci çıkarma öncekini kesinleştirir.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Platform, type AppStateStatus } from 'react-native';

import { GeriAlBandi } from '@/components/listem/GeriAlBandi';

import { cikarMetni, GERI_AL_MS, useGeriAlinabilirSil } from '../geriAlinabilirSil';

const mockSil = jest.fn<(id: string, o?: { onError?: () => void }) => void>();
jest.mock('@/features/mekanlar/sorgular', () => ({ useMekanSil: () => ({ mutate: mockSil }) }));
jest.mock('@/features/gunler/sorgular', () => ({
  useGunler: () => ({ data: [{ id: 'g1', index: 1 }, { id: 'g2', index: 2 }] }),
  useDuraklar: () => ({ data: [{ place_ref: 'm-gunde', day_id: 'g2' }] }),
}));

let appDinleyici: ((d: AppStateStatus) => void) | null = null;
beforeEach(() => {
  jest.useFakeTimers();
  mockSil.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, f) => {
    appDinleyici = f as (d: AppStateStatus) => void;
    return { remove: () => (appDinleyici = null) } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const MEKAN = { id: 'm1', place_id: 'p1' };

describe('#387 KK2 bant metni', () => {
  it('güne atanmamış: "{ad} listeden çıktı"; atanmış: "{ad} {n}. günden de çıktı"', () => {
    const duraklar = [{ place_ref: 'm2', day_id: 'g2' }];
    const gunler = [{ id: 'g2', index: 2 }];
    expect(cikarMetni('m1', 'Atlıhan', duraklar, gunler)).toBe('Atlıhan listeden çıktı');
    expect(cikarMetni('m2', 'Atlıhan', duraklar, gunler)).toBe('Atlıhan 2. günden de çıktı');
  });

  it('kanca günü seyahatin duraklarından bulur', () => {
    const { result } = renderHook(() => useGeriAlinabilirSil('t1'));
    act(() => result.current.cikar({ id: 'm-gunde', place_id: 'p9' }, 'Sazova'));
    expect(result.current.bekleyen).toEqual({ mekanId: 'm-gunde', placeId: 'p9', metin: 'Sazova 2. günden de çıktı' });
  });
});

describe('#387 KK1 · KK3 silme zamanı', () => {
  it('"Geri al" basılırsa hiçbir şey silinmez', () => {
    const { result } = renderHook(() => useGeriAlinabilirSil('t1'));
    act(() => result.current.cikar(MEKAN, 'Atlıhan'));
    expect(mockSil).not.toHaveBeenCalled();
    act(() => result.current.geriAl());
    expect(result.current.bekleyen).toBeNull();
    act(() => jest.advanceTimersByTime(GERI_AL_MS * 2));
    expect(mockSil).not.toHaveBeenCalled();
  });

  it('5 sn sonra bir kez silinir ve bant kalkar', () => {
    const { result, unmount } = renderHook(() => useGeriAlinabilirSil('t1'));
    act(() => result.current.cikar(MEKAN, 'Atlıhan'));
    act(() => jest.advanceTimersByTime(GERI_AL_MS - 1));
    expect(mockSil).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockSil).toHaveBeenCalledTimes(1);
    expect(mockSil.mock.calls[0][0]).toBe('m1');
    expect(result.current.bekleyen).toBeNull();
    unmount();
    expect(mockSil).toHaveBeenCalledTimes(1);
  });

  it('bant açıkken ekrandan çıkılırsa silinir; süre dolunca ikinci kez silinmez', () => {
    const { result, unmount } = renderHook(() => useGeriAlinabilirSil('t1'));
    act(() => result.current.cikar(MEKAN, 'Atlıhan'));
    unmount();
    expect(mockSil).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(GERI_AL_MS);
    expect(mockSil).toHaveBeenCalledTimes(1);
  });

  it('uygulama arka plana gidince silinir, bant kalkar; öne gelince tekrar silinmez', () => {
    const { result } = renderHook(() => useGeriAlinabilirSil('t1'));
    act(() => result.current.cikar(MEKAN, 'Atlıhan'));
    act(() => appDinleyici?.('background'));
    expect(mockSil).toHaveBeenCalledTimes(1);
    expect(result.current.bekleyen).toBeNull();
    act(() => appDinleyici?.('active'));
    act(() => jest.advanceTimersByTime(GERI_AL_MS));
    expect(mockSil).toHaveBeenCalledTimes(1);
  });

  it('ikinci çıkarma öncekini hemen siler; bant yenisini gösterir', () => {
    const { result } = renderHook(() => useGeriAlinabilirSil('t1'));
    act(() => result.current.cikar(MEKAN, 'Atlıhan'));
    act(() => result.current.cikar({ id: 'm2', place_id: 'p2' }, 'Kurşunlu'));
    expect(mockSil).toHaveBeenCalledTimes(1);
    expect(mockSil.mock.calls[0][0]).toBe('m1');
    expect(result.current.bekleyen?.metin).toBe('Kurşunlu listeden çıktı');
    act(() => jest.advanceTimersByTime(GERI_AL_MS));
    expect(mockSil.mock.calls.map((c) => c[0])).toEqual(['m1', 'm2']);
  });

  it('silme hata verirse onHata çağrılır', () => {
    const onHata = jest.fn();
    mockSil.mockImplementation((_id, o) => o?.onError?.());
    const { result } = renderHook(() => useGeriAlinabilirSil('t1', onHata));
    act(() => result.current.cikar(MEKAN, 'Atlıhan'));
    act(() => jest.advanceTimersByTime(GERI_AL_MS));
    expect(onHata).toHaveBeenCalledTimes(1);
  });

  it('seyahat değişince bekleyen silinir ve bant kalkar', () => {
    const { result, rerender } = renderHook(({ id }: { id: string }) => useGeriAlinabilirSil(id), { initialProps: { id: 't1' } });
    act(() => result.current.cikar(MEKAN, 'Atlıhan'));
    rerender({ id: 't2' });
    expect(mockSil).toHaveBeenCalledTimes(1);
    expect(result.current.bekleyen).toBeNull();
  });
});

describe('#387 KK4 bant ekran okuyucu', () => {
  it('bant canlı bölge; iOS\'ta metin ve "Geri al" duyurulur', () => {
    const duyuru = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const eskiOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });
    try {
      const e = render(<GeriAlBandi metin="Atlıhan 2. günden de çıktı" onGeriAl={() => undefined} />);
      expect(e.getByTestId('geri-al-bandi').props.accessibilityLiveRegion).toBe('polite');
      expect(duyuru).toHaveBeenCalledWith('Atlıhan 2. günden de çıktı. Geri al');
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => eskiOS, configurable: true });
    }
  });
});
