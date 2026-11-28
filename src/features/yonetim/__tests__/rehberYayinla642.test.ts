import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { rehberYayinla } from '../sehirSorgulari';

type Cevap = { data: unknown; error: unknown };
const mockCagrilar: { ad: string; argumanlar: Record<string, unknown> }[] = [];
const mockCevaplar: Cevap[] = [];
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (ad: string, argumanlar: Record<string, unknown>) => {
      mockCagrilar.push({ ad, argumanlar });
      return mockCevaplar.shift() ?? { data: 0, error: null };
    },
  },
}));

const S = '11111111-1111-4111-8111-000000000001';
const T = '2026-11-28T10:00:00.123456+00:00';

// #642 yayın sırası: yeni BO, `p_adlar`'lı migration bekçide beklerken canlıya çıkabilir.
describe('rehberYayinla (#642)', () => {
  beforeEach(() => {
    mockCagrilar.length = 0;
    mockCevaplar.length = 0;
  });

  it('ad yoksa p_adlar gönderilmez', async () => {
    mockCevaplar.push({ data: 0, error: null });
    await expect(rehberYayinla(S, T)).resolves.toBe(0);
    expect(mockCagrilar).toEqual([{ ad: 'rehber_yayinla', argumanlar: { p_sehir: S, p_beklenen: T } }]);
  });

  it('adlar p_adlar ile gider', async () => {
    mockCevaplar.push({ data: 2, error: null });
    await expect(rehberYayinla(S, T, { 'ChIJ-cam-sanat-0003': 'Cam Evi' })).resolves.toBe(2);
    expect(mockCagrilar).toEqual([{ ad: 'rehber_yayinla', argumanlar: { p_sehir: S, p_beklenen: T, p_adlar: { 'ChIJ-cam-sanat-0003': 'Cam Evi' } } }]);
  });

  it('fonksiyon bulunamadı (PGRST202): bir kez iki argümanla yeniden denenir', async () => {
    mockCevaplar.push({ data: null, error: { code: 'PGRST202' } }, { data: 1, error: null });
    await expect(rehberYayinla(S, T, { 'ChIJ-cam-sanat-0003': 'Cam Evi' })).resolves.toBe(1);
    expect(mockCagrilar.map((c) => c.argumanlar)).toEqual([{ p_sehir: S, p_beklenen: T, p_adlar: { 'ChIJ-cam-sanat-0003': 'Cam Evi' } }, { p_sehir: S, p_beklenen: T }]);
  });

  it('yeniden deneme de düşerse hata çıkar; başka hata yeniden denenmez', async () => {
    mockCevaplar.push({ data: null, error: { code: 'PGRST202' } }, { data: null, error: { code: 'PGRST202' } });
    await expect(rehberYayinla(S, T, { a: 'b' })).rejects.toEqual({ code: 'PGRST202' });
    expect(mockCagrilar).toHaveLength(2);
    mockCagrilar.length = 0;
    mockCevaplar.push({ data: null, error: { code: '40001' } });
    await expect(rehberYayinla(S, T, { a: 'b' })).rejects.toEqual({ code: '40001' });
    expect(mockCagrilar).toHaveLength(1);
  });
});
