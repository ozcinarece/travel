// #569 KK5 (#586 bekler): gezisi olmayan kartın karşılama görselleri — `karsilama` bölümünden okuma (en çok 8, yalnız https),
// her açılışta sıradaki (sıra cihazda; depolama yoksa rastgele), sıradakinin önceden indirilmesi, tür yokken boş.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';

import { KARSILAMA_SIRA_ANAHTARI, karsilamaKapaklari, siradakiSira, useKarsilamaKapagi } from '../karsilama';

const mockOnceYukle = jest.fn();
jest.mock('@/components/ui/Foto', () => ({ fotoOnceYukle: (u: string) => mockOnceYukle(u) }));

const bolum = (kapaklar: unknown) => ({ tur: 'karsilama', icerik: { kapaklar } });
const url = (i: number) => `https://x.supabase.co/storage/v1/object/public/icerik/anasayfa/k${i}.webp`;

beforeEach(async () => {
  mockOnceYukle.mockClear();
  await AsyncStorage.clear();
});

describe('karsilamaKapaklari', () => {
  it('yalnız karsilama bölümü; https adresliler, atıf okunur; en çok 8', () => {
    const k = karsilamaKapaklari([
      { tur: 'raf', icerik: { kapaklar: [{ url: url(99) }] } },
      bolum([{ url: url(1), atif: { yazar: 'Ali', lisans: 'CC BY 4.0' } }, { url: 'http://duz/a.jpg' }, { url: 3 }, null, { url: url(2) }, ...Array.from({ length: 10 }, (_, i) => ({ url: url(10 + i) }))]),
    ]);
    expect(k).toHaveLength(8);
    expect(k[0]).toEqual({ url: url(1), atif: { yazar: 'Ali', lisans: 'CC BY 4.0', kaynak_url: null } });
    expect(k[1]).toEqual({ url: url(2), atif: null });
  });

  it('tür yoksa, bölüm yoksa ya da içerik bozuksa boş (çağıran Eskişehir kapağına düşer)', () => {
    expect(karsilamaKapaklari(undefined)).toEqual([]);
    expect(karsilamaKapaklari([])).toEqual([]);
    expect(karsilamaKapaklari([{ tur: 'karsilama', icerik: null }])).toEqual([]);
    expect(karsilamaKapaklari([bolum('bozuk')])).toEqual([]);
  });
});

describe('siradakiSira', () => {
  it('öncekinin bir sonrası, başa döner; ilk açılışta ilk; depolama okunamadıysa rastgele', () => {
    expect(siradakiSira('0', 3)).toBe(1);
    expect(siradakiSira('2', 3)).toBe(0);
    expect(siradakiSira('7', 3)).toBe(2);
    expect(siradakiSira(null, 3)).toBe(0);
    expect(siradakiSira('bozuk', 3)).toBe(0);
    expect(siradakiSira(undefined, 4, () => 0.6)).toBe(2);
  });
});

describe('useKarsilamaKapagi', () => {
  const kapaklar = [1, 2, 3].map((i) => ({ url: url(i), atif: null }));

  it('her açılışta sıradaki görsel; sıra cihaza yazılır; sıradaki önceden indirilir; kendiliğinden değişmez', async () => {
    const bir = renderHook(() => useKarsilamaKapagi(kapaklar));
    await waitFor(() => expect(bir.result.current?.url).toBe(url(1)));
    expect(await AsyncStorage.getItem(KARSILAMA_SIRA_ANAHTARI)).toBe('0');
    expect(mockOnceYukle).toHaveBeenCalledWith(url(2));
    bir.rerender({});
    expect(bir.result.current?.url).toBe(url(1));
    bir.unmount();

    const iki = renderHook(() => useKarsilamaKapagi(kapaklar));
    await waitFor(() => expect(iki.result.current?.url).toBe(url(2)));
    expect(await AsyncStorage.getItem(KARSILAMA_SIRA_ANAHTARI)).toBe('1');
    expect(mockOnceYukle).toHaveBeenLastCalledWith(url(3));
  });

  it('depolama hata verirse rastgele bir görsel (çökmez); tek görselde önceden indirme yok', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('depolama yok'));
    const r = renderHook(() => useKarsilamaKapagi(kapaklar));
    await waitFor(() => expect(r.result.current).not.toBeNull());
    expect(kapaklar.map((k) => k.url)).toContain(r.result.current!.url);
    getItem.mockRestore();

    mockOnceYukle.mockClear();
    const tek = renderHook(() => useKarsilamaKapagi([kapaklar[0]]));
    await waitFor(() => expect(tek.result.current?.url).toBe(url(1)));
    expect(mockOnceYukle).not.toHaveBeenCalled();
  });

  it('görsel yoksa null', () => {
    const r = renderHook(() => useKarsilamaKapagi([]));
    expect(r.result.current).toBeNull();
  });
});
