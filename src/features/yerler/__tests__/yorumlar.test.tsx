import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

import { useYorumlar } from '../api';

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

  it('sekme kapalıyken sorgu devre dışı; açılınca etkin ve places-reviews çağrılır; önbellek 24 sa', async () => {
    const { rerender } = renderHook(({ acik }: { acik: boolean }) => useYorumlar('p1', acik), { initialProps: { acik: false } });
    expect(kayitlar.at(-1)?.enabled).toBe(false);
    rerender({ acik: true });
    const son = kayitlar.at(-1)!;
    expect(son.enabled).toBe(true);
    expect(son.queryKey).toEqual(['yorumlar', 'p1']);
    expect((son as unknown as { staleTime: number }).staleTime).toBe(24 * 60 * 60 * 1000);
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
});
