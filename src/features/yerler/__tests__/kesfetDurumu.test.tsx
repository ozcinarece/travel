import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { BOS_FILTRE } from '../filtre';
import { kesfetDurumunuAl, kesfetDurumunuSifirla, useKesfetDurumu } from '../kesfetDurumu';

const bolge = { merkez: { lat: 39.78, lng: 30.51 }, yaricapM: 800, latDelta: 0.01, lngDelta: 0.008, zoom: 15.1 };

describe('useKesfetDurumu (#79 KK2)', () => {
  beforeEach(() => kesfetDurumunuSifirla());

  it('ekran yeniden kurulunca filtre, seçim ve bölge aynı kalır', () => {
    const ilk = renderHook(() => ({ filtre: useKesfetDurumu('s1', 'filtre'), secim: useKesfetDurumu('s1', 'secim'), bolge: useKesfetDurumu('s1', 'bolge') }));
    expect(ilk.result.current.filtre[0]).toEqual(BOS_FILTRE);
    act(() => {
      ilk.result.current.filtre[1]((f) => ({ ...f, puan: 4.5, yorum: 5000 }));
      ilk.result.current.secim[1]({ place_id: 'p1', kaynak: 'oneri' });
      ilk.result.current.bolge[1](bolge);
    });
    expect(ilk.result.current.filtre[0]).toEqual({ ...BOS_FILTRE, puan: 4.5, yorum: 5000 });
    ilk.unmount();

    const ikinci = renderHook(() => ({ filtre: useKesfetDurumu('s1', 'filtre'), secim: useKesfetDurumu('s1', 'secim'), bolge: useKesfetDurumu('s1', 'bolge') }));
    expect(ikinci.result.current.filtre[0]).toEqual({ ...BOS_FILTRE, puan: 4.5, yorum: 5000 });
    expect(ikinci.result.current.secim[0]).toEqual({ place_id: 'p1', kaynak: 'oneri' });
    expect(ikinci.result.current.bolge[0]).toEqual(bolge);
  });

  it('seyahatler birbirinden ayrı; doğrudan okuma da aynı değeri verir', () => {
    const a = renderHook(() => useKesfetDurumu('a', 'filtre'));
    act(() => a.result.current[1]({ ...BOS_FILTRE, oneCikan: true }));
    const b = renderHook(() => useKesfetDurumu('b', 'filtre'));
    expect(b.result.current[0]).toEqual(BOS_FILTRE);
    expect(kesfetDurumunuAl('a').filtre.oneCikan).toBe(true);
    expect(kesfetDurumunuAl('b').filtre.oneCikan).toBe(false);
  });
});
