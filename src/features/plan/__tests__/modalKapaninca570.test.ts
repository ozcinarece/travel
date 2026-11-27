// #570 KK8: iOS'ta ⋯ Modal'ının `onDismiss`'i gelmezse "Günü sil" onayı 500 ms sonra yine açılır; ikisi birden açmaz.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { MODAL_KAPANMA_YEDEK_MS, useModalKapaninca } from '@/features/plan/modalKapaninca';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useModalKapaninca (#570 KK8)', () => {
  it('onDismiss hiç gelmezse 500 ms sonra bir kez açar', () => {
    const ac = jest.fn();
    const { result } = renderHook(() => useModalKapaninca(ac));
    act(() => result.current.iste('g2'));
    act(() => jest.advanceTimersByTime(MODAL_KAPANMA_YEDEK_MS - 1));
    expect(ac).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(ac).toHaveBeenCalledTimes(1);
    expect(ac).toHaveBeenCalledWith('g2');
    expect(MODAL_KAPANMA_YEDEK_MS).toBe(500);
  });

  it('onDismiss önce gelirse hemen açar; yedek zamanlayıcı ikinci kez açmaz', () => {
    const ac = jest.fn();
    const { result } = renderHook(() => useModalKapaninca(ac));
    act(() => result.current.iste('g2'));
    act(() => jest.advanceTimersByTime(100));
    act(() => result.current.kapandi());
    expect(ac).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1000));
    expect(ac).toHaveBeenCalledTimes(1);
  });

  it('yedek açtıktan sonra geç gelen onDismiss ikinci kez açmaz; istek yokken onDismiss bir şey yapmaz', () => {
    const ac = jest.fn();
    const { result } = renderHook(() => useModalKapaninca(ac));
    act(() => result.current.kapandi());
    expect(ac).not.toHaveBeenCalled();
    act(() => result.current.iste('g3'));
    act(() => jest.advanceTimersByTime(MODAL_KAPANMA_YEDEK_MS));
    act(() => result.current.kapandi());
    expect(ac).toHaveBeenCalledTimes(1);
  });

  it('ekran kapanırsa zamanlayıcı temizlenir', () => {
    const ac = jest.fn();
    const { result, unmount } = renderHook(() => useModalKapaninca(ac));
    act(() => result.current.iste('g2'));
    unmount();
    jest.advanceTimersByTime(1000);
    expect(ac).not.toHaveBeenCalled();
  });
});
