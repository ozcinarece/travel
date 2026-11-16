import { describe, expect, it, jest } from '@jest/globals';

// #246 KK1/KK4: Routes fonksiyonlarının anahtar doğrulaması. rotaNoktalari.ts bir Deno modülü (uygulamanın tsc denetimine
// girmesin diye) — tipi burada yazılıp çalışma anında yüklenir.
type Nokta = { key: string; lat: number; lng: number };
type SeyahatNoktalari = {
  mekanlar: { place_id: string; lat: number; lng: number }[];
  konaklamalar: { id: string; lat: number; lng: number }[];
  otel: { lat: number; lng: number } | null;
};
type Modul = {
  anahtarAl: (oge: unknown) => string | null;
  anahtarlariAyir: (a: string[]) => { placeIdler: string[]; konaklamaIdler: string[]; otel: boolean };
  noktalariCoz: (a: string[], db: SeyahatNoktalari) => { noktalar: Map<string, Nokta> } | { bilinmeyen: string[] };
  noktalariOku: (servis: unknown, tripId: string, a: string[]) => Promise<SeyahatNoktalari>;
};
const { anahtarAl, anahtarlariAyir, noktalariCoz, noktalariOku } = jest.requireActual<Modul>('../../../../supabase/functions/_shared/rotaNoktalari');

const KONAKLAMA = '7d3f2b1a-0c4e-4f5a-9b8c-1d2e3f4a5b6c';
const db: SeyahatNoktalari = {
  mekanlar: [
    { place_id: 'ChIJ_a', lat: 41.01, lng: 28.97 },
    { place_id: 'ChIJ_b', lat: 41.02, lng: 28.98 },
  ],
  konaklamalar: [{ id: KONAKLAMA, lat: 41.03, lng: 28.99 }],
  otel: { lat: 41.04, lng: 29.0 },
};

describe('#246 rota noktaları', () => {
  it('KK1: koordinat DB’den gelir, istemcinin gönderdiği yok sayılır', () => {
    const anahtarlar = [{ key: 'ChIJ_a', lat: 0, lng: 0 }, { key: `stay:${KONAKLAMA}`, lat: 89, lng: 179 }, 'hotel'].map(anahtarAl) as string[];
    const c = noktalariCoz(anahtarlar, db);
    expect('noktalar' in c).toBe(true);
    if (!('noktalar' in c)) return;
    expect(c.noktalar.get('ChIJ_a')).toEqual({ key: 'ChIJ_a', lat: 41.01, lng: 28.97 });
    expect(c.noktalar.get(`stay:${KONAKLAMA}`)).toEqual({ key: `stay:${KONAKLAMA}`, lat: 41.03, lng: 28.99 });
    expect(c.noktalar.get('hotel')).toEqual({ key: 'hotel', lat: 41.04, lng: 29.0 });
  });

  it('KK4: seyahatte olmayan anahtar reddedilir (fonksiyon 400 döner, Google’a gidilmez)', () => {
    expect(noktalariCoz(['ChIJ_a', 'ChIJ_baska_seyahat'], db)).toEqual({ bilinmeyen: ['ChIJ_baska_seyahat'] });
    expect(noktalariCoz(['ChIJ_a', 'stay:00000000-0000-4000-8000-000000000000'], db)).toEqual({
      bilinmeyen: ['stay:00000000-0000-4000-8000-000000000000'],
    });
    expect(noktalariCoz(['ChIJ_a', 'stay:bozuk'], db)).toEqual({ bilinmeyen: ['stay:bozuk'] });
    expect(noktalariCoz(['ChIJ_a', 'hotel'], { ...db, otel: null })).toEqual({ bilinmeyen: ['hotel'] });
    // Her çağrıda yeni rastgele anahtar: önbelleği atlama denemesi.
    expect('bilinmeyen' in noktalariCoz(['ChIJ_a', `rastgele-${Date.now()}`], db)).toBe(true);
  });

  it('anahtar dışındaki girdiler atılır', () => {
    expect(anahtarAl(null)).toBeNull();
    expect(anahtarAl({ key: '' })).toBeNull();
    expect(anahtarAl({ key: 5 })).toBeNull();
    expect(anahtarAl({ key: 'x'.repeat(301) })).toBeNull();
    expect(anahtarAl('ChIJ_a')).toBe('ChIJ_a');
  });

  it('DB sorgusu yalnız istenen anahtarlarla ve bu seyahatle sınırlı', async () => {
    expect(anahtarlariAyir(['ChIJ_a', `stay:${KONAKLAMA}`, 'stay:bozuk', 'hotel', 'ChIJ_a'])).toEqual({
      placeIdler: ['ChIJ_a'],
      konaklamaIdler: [KONAKLAMA],
      otel: true,
    });
    const cagrilar: { tablo: string; filtreler: [string, string, unknown][] }[] = [];
    const sorgu = (tablo: string, veri: unknown) => {
      const c = { tablo, filtreler: [] as [string, string, unknown][] };
      cagrilar.push(c);
      const zincir = {
        select: () => zincir,
        eq: (a: string, d: unknown) => (c.filtreler.push(['eq', a, d]), zincir),
        in: (a: string, d: unknown) => (c.filtreler.push(['in', a, d]), Promise.resolve({ data: veri, error: null })),
        maybeSingle: () => Promise.resolve({ data: veri, error: null }),
      };
      return zincir;
    };
    const servis = {
      from: (tablo: string) =>
        sorgu(tablo, tablo === 'places' ? db.mekanlar : tablo === 'stays' ? db.konaklamalar : { hotel_lat: 41.04, hotel_lng: 29.0 }),
    };
    const sonuc = await noktalariOku(servis, 'trip-1', ['ChIJ_a', `stay:${KONAKLAMA}`, 'hotel']);
    expect(sonuc.otel).toEqual({ lat: 41.04, lng: 29.0 });
    for (const c of cagrilar) expect(c.filtreler[0]).toEqual(['eq', c.tablo === 'trips' ? 'id' : 'trip_id', 'trip-1']);
    expect(cagrilar.find((c) => c.tablo === 'places')?.filtreler[1]).toEqual(['in', 'place_id', ['ChIJ_a']]);
  });
});
