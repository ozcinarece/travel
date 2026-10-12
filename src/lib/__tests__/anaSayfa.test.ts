import { describe, expect, it, jest } from '@jest/globals';

import { bolumKimlikleri, cizimBloklari, gorunenBolumler, type AnaSayfaBolumu } from '../anaSayfa';

jest.mock('../supabase', () => ({ supabase: {} }));

const b = (sira: number, alan: Partial<AnaSayfaBolumu> = {}): AnaSayfaBolumu => ({
  id: `b${sira}`,
  tur: 'serit',
  baslik: `B${sira}`,
  sira,
  kaynak: 'elle',
  icerik: {},
  baslangic_at: null,
  bitis_at: null,
  ...alan,
});

// #109 KK4 / KK6: uygulama yalnız açık ve aralıktaki bölümleri, sırayla gösterir.
describe('gorunenBolumler (#109)', () => {
  const simdi = new Date('2026-10-20T09:00:00Z');

  it('sıra; kapalı bölüm düşer', () => {
    expect(gorunenBolumler([b(3), b(1), b(2, { acik: false })], simdi).map((x) => x.sira)).toEqual([1, 3]);
  });

  it('planlı yayın aralığı: başlangıç dahil, bitiş hariç', () => {
    const liste = [
      b(1, { baslangic_at: '2026-10-20T09:00:00Z' }),
      b(2, { baslangic_at: '2026-10-21T09:00:00Z' }),
      b(3, { bitis_at: '2026-10-20T09:00:00Z' }),
      b(4, { baslangic_at: '2026-10-01T00:00:00Z', bitis_at: '2026-11-01T00:00:00Z' }),
    ];
    expect(gorunenBolumler(liste, simdi).map((x) => x.sira)).toEqual([1, 4]);
  });
});

describe('cizimBloklari ve bolumKimlikleri (#109 KK1)', () => {
  it('tek kart + şerit tek blok (başlık şeridin); diğerleri tek başına', () => {
    const bl = cizimBloklari([b(1, { tur: 'tek_kart', baslik: 'Öne çıkan' }), b(2, { baslik: 'Önerilen geziler' }), b(3, { tur: 'mozaik', baslik: 'Gezilecek yerler' }), b(4, { tur: 'tek_kart', baslik: 'Tek' })]);
    expect(bl.map((x) => [x.baslik, x.bolumler.map((y) => y.sira)])).toEqual([
      ['Önerilen geziler', [1, 2]],
      ['Gezilecek yerler', [3]],
      ['Tek', [4]],
    ]);
  });

  it('elle: yalnız yayında olanlar, verilen sırayla; otomatik: gezi sırası / öne çıkan sırası', () => {
    const kaynak = {
      geziler: [
        { id: 'g1', sira: 2, created_at: '2026-01-01' },
        { id: 'g2', sira: 1, created_at: '2026-01-02' },
        { id: 'g3', sira: null, created_at: '2026-01-03' },
      ],
      yerler: [
        { id: 'y1', one_cikan_sira: 2 },
        { id: 'y2', one_cikan_sira: null },
        { id: 'y3', one_cikan_sira: 1 },
      ],
      sehirler: [{ id: 's1' }],
    };
    expect(bolumKimlikleri(b(1, { icerik: { gezi_idler: ['g3', 'yok', 'g1'] } }), kaynak)).toEqual(['g3', 'g1']);
    expect(bolumKimlikleri(b(1, { kaynak: 'otomatik' }), kaynak)).toEqual(['g2', 'g1', 'g3']);
    expect(bolumKimlikleri(b(1, { tur: 'mozaik', kaynak: 'otomatik' }), kaynak)).toEqual(['y3', 'y1']);
    expect(bolumKimlikleri(b(1, { tur: 'tek_kart', kaynak: 'otomatik', icerik: { gezi_id: 'g1' } }), kaynak)).toEqual(['g1']);
    expect(bolumKimlikleri(b(1, { tur: 'tek_kart', kaynak: 'otomatik', icerik: {} }), kaynak)).toEqual(['g2']);
    expect(bolumKimlikleri(b(1, { tur: 'tek_kart', icerik: { gezi_id: 'yok' } }), kaynak)).toEqual([]);
    expect(bolumKimlikleri(b(1, { tur: 'sehir_seckisi', icerik: { sehir_idler: ['s1', 's9'] } }), kaynak)).toEqual(['s1']);
  });
});
