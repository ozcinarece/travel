import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { bolgeHesapla, zoomDelta } from '@/components/harita/geo';

import type { HafifYer } from '../api';
import { gorunurKarolar, KARO_EN_FAZLA_ISTEK } from '../karolar';
import { birikimiAl, HATA_BEKLEME_MS, karoBelleginiSifirla, karoSayaci, turBaslat } from '../karoYukleme';

// Karo isteği sahte: cevap (ya da hata) test başına kurulur.
const mockYakinYerler = jest.fn<(s: { cip: string; merkez: { lat: number; lng: number; yaricapM?: number } }) => Promise<HafifYer[]>>();
jest.mock('../api', () => ({ yakinYerler: (s: unknown) => mockYakinYerler(s as never) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn() }));

const eskisehir = { lat: 39.7767, lng: 30.5206 };
const bolge = (zoom: number, merkez = eskisehir) => bolgeHesapla(merkez, zoomDelta(zoom), zoomDelta(zoom) / 2, zoom);
const yer = (place_id: string): HafifYer => ({ place_id, ad: place_id, lat: 0, lng: 0, primary_type: null, tz: null, puan: 4.5, puan_sayisi: 100, acik: null, ulke_kodu: null });

// #66 / #68 incelemesi: tur başına ≤ 12 istek, yoldaki / tamamlanan karolar yeniden istenmez, hata sonrası geri çekilme ve
// yeniden deneme, birikim seyahate göre ayrı.
describe('turBaslat (#66, #68)', () => {
  beforeEach(() => {
    karoBelleginiSifirla();
    mockYakinYerler.mockReset();
    let n = 0;
    mockYakinYerler.mockImplementation(async () => [yer(`p${n++}`), yer('ortak')]);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('görünümdeki karolardan en fazla 12 istenir; ikinci tur kalanları ister, üçüncü tur hiç istemez', async () => {
    const b = bolge(13);
    const hepsi = gorunurKarolar(b).length;
    const t1 = await turBaslat('s1', 'populer', b);
    expect(t1.istenen).toBe(Math.min(hepsi, KARO_EN_FAZLA_ISTEK));
    expect(t1.hata).toBe(false);
    const t2 = await turBaslat('s1', 'populer', b);
    expect(t1.istenen + t2.istenen).toBe(hepsi);
    expect((await turBaslat('s1', 'populer', b)).istenen).toBe(0);
    expect(mockYakinYerler).toHaveBeenCalledTimes(hepsi);
    expect(karoSayaci.istek).toBe(hepsi);
    // Birikim: her karodan 1 benzersiz + 'ortak' bir kez.
    expect(birikimiAl('s1').yerler.size).toBe(hepsi + 1);
  });

  it('yoldaki karo yeniden istenmez (eşzamanlı iki tur)', async () => {
    const b = bolge(14);
    const [a, c] = await Promise.all([turBaslat('s1', 'populer', b), turBaslat('s1', 'populer', b)]);
    const hepsi = gorunurKarolar(b).length;
    expect(a.istenen + c.istenen).toBe(Math.min(hepsi, 2 * KARO_EN_FAZLA_ISTEK));
    expect(mockYakinYerler).toHaveBeenCalledTimes(a.istenen + c.istenen);
  });

  it('hatalı karo önbellekten düşer; 30 sn geri çekilme, sonra yeniden denenir', async () => {
    mockYakinYerler.mockRejectedValue(new Error('502'));
    const b = bolge(15);
    const t1 = await turBaslat('s1', 'populer', b, 1000);
    expect(t1.hata).toBe(true);
    expect(karoSayaci.hata).toBe(t1.istenen);
    // Hemen ardından: geri çekilme, istek yok.
    expect(await turBaslat('s1', 'populer', b, 2000)).toEqual({ istenen: 0, yeni: 0, hata: true });
    // 30 sn sonra aynı karolar yeniden istenir ve başarılı olur.
    mockYakinYerler.mockResolvedValue([yer('x')]);
    const t3 = await turBaslat('s1', 'populer', b, Date.now() + HATA_BEKLEME_MS + 1);
    expect(t3.istenen).toBe(t1.istenen);
    expect(t3.hata).toBe(false);
    expect(birikimiAl('s1').yerler.has('x')).toBe(true);
  });

  it('birikim seyahate göre ayrı; karo önbelleği ortak', async () => {
    const b = bolge(14);
    // Görünümün tüm karoları (iki tur) Roma seyahatiyle istenir.
    await turBaslat('roma', 'populer', b);
    await turBaslat('roma', 'populer', b);
    const roma = birikimiAl('roma').yerler.size;
    expect(roma).toBeGreaterThan(0);
    // Aynı karolar başka seyahat için yeniden istenmez (önbellek ortak) → Eskişehir birikimi boş kalır, Roma'nınki karışmaz.
    const t = await turBaslat('eskisehir', 'populer', b);
    expect(t.istenen).toBe(0);
    expect(birikimiAl('eskisehir').yerler.size).toBe(0);
    expect(birikimiAl('roma').yerler.size).toBe(roma);
  });
});
