import { describe, expect, it, jest } from '@jest/globals';

import { tumGunlereOtel } from '@/features/konaklama/sorgular';

// Bellekte `stays` ve `days`: tekrar Kaydet'in (#652 KK1) DB'de ikinci otel satırı açmadığını gösterir.
const stays: { id: string; trip_id: string; place_id: string | null; lat: number; lng: number; label: string | null; takma_ad: string | null }[] = [];
const mockInsert = jest.fn((satir: { trip_id: string; place_id: string | null; lat: number; lng: number }) => {
  const yeni = { id: `stay-${stays.length + 1}`, label: null, takma_ad: null, ...satir };
  stays.push(yeni);
  return { select: () => ({ single: async () => ({ data: { id: yeni.id }, error: null }) }) };
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tablo: string) => ({
      select: () => ({ eq: async () => ({ data: tablo === 'stays' ? stays.map((s) => ({ ...s })) : [{ id: 'gun-1' }], error: null }) }),
      insert: (satir: { trip_id: string; place_id: string | null; lat: number; lng: number }) => mockInsert(satir),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({}) }));
jest.mock('@/features/yerler/api', () => ({ useHafifYerler: () => ({ data: [] }) }));

describe('#652 KK1: tekrar Kaydet aynı oteli kullanır', () => {
  it('aynı seçimle iki kayıt tek stays satırı açar ve aynı kimliği döner', async () => {
    const secim = { place_id: 'ChIJ-otel', ad: 'Grand Otel', lat: 39.77, lng: 30.52 };
    const ilk = await tumGunlereOtel('s1', secim);
    const ikinci = await tumGunlereOtel('s1', secim);
    expect(ikinci).toBe(ilk);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(stays).toHaveLength(1);
  });
});
