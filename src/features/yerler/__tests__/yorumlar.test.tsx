import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

import { useYorumlar, YorumSiniri } from '../api';

type Secenek = { queryKey: unknown[]; enabled: boolean; queryFn: () => Promise<unknown> };
const kayitlar: Secenek[] = [];
jest.mock('@tanstack/react-query', () => ({
  useQuery: (o: Secenek) => {
    kayitlar.push(o);
    return { data: undefined, isPending: true, isError: false };
  },
}));
const mockInvoke = jest.fn<(ad: string, secenek: unknown) => Promise<{ data: unknown; error: null }>>();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (ad: string, secenek: unknown) => mockInvoke(ad, secenek) } } }));

// #80 KK8 / KK14: yorumlar yalnız Yorumlar sekmesi açıkken (acik=true) istenir; sekme kapalıyken sorgu devre dışı.
describe('useYorumlar (#80)', () => {
  beforeEach(() => {
    kayitlar.length = 0;
    mockInvoke.mockReset();
  });

  it('sekme kapalıyken sorgu devre dışı; açılınca etkin ve places-reviews çağrılır; #142 oturum boyu önbellek', async () => {
    const { rerender } = renderHook(({ acik }: { acik: boolean }) => useYorumlar('p1', acik), { initialProps: { acik: false } });
    expect(kayitlar.at(-1)?.enabled).toBe(false);
    rerender({ acik: true });
    const son = kayitlar.at(-1)!;
    expect(son.enabled).toBe(true);
    expect(son.queryKey).toEqual(['yorumlar', 'p1']);
    expect((son as unknown as { staleTime: number; gcTime: number }).staleTime).toBe(Infinity);
    expect((son as unknown as { staleTime: number; gcTime: number }).gcTime).toBe(Infinity);
    mockInvoke.mockResolvedValue({ data: { place_id: 'p1', puan: 4.6, puan_sayisi: 13204, yorumlar: [] }, error: null });
    const sonuc = (await son.queryFn()) as { puan_sayisi: number };
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke.mock.calls[0][0]).toBe('places-reviews');
    expect(mockInvoke.mock.calls[0][1]).toEqual({ body: { id: 'p1' } });
    expect(sonuc.puan_sayisi).toBe(13204);
    // Kimlik yoksa hiç etkinleşmez.
    rerender({ acik: true });
    const { unmount } = renderHook(() => useYorumlar(undefined, true));
    expect(kayitlar.at(-1)?.enabled).toBe(false);
    unmount();
  });

  it('#142 KK3: günlük sınır doluysa YorumSiniri (yeniden denenmez, önbelleğe girmez)', async () => {
    renderHook(() => useYorumlar('p2', true));
    const son = kayitlar.at(-1)! as unknown as Secenek & { retry: (n: number, e: unknown) => boolean };
    mockInvoke.mockResolvedValue({ data: { sinir: true }, error: null });
    await expect(son.queryFn()).rejects.toBeInstanceOf(YorumSiniri);
    expect(son.retry(0, new YorumSiniri())).toBe(false);
    expect(son.retry(0, new Error('ağ'))).toBe(true);
    expect(son.retry(1, new Error('ağ'))).toBe(false);
  });
});
