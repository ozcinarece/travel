import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { bolgeHesapla, zoomDelta } from '@/components/harita/geo';

import type { HafifYer } from '../api';
import { gorunurKarolar, KARO_EN_FAZLA_ISTEK } from '../karolar';
import { oneCikanlar } from '../filtre';
import { birikimiAl, HATA_BEKLEME_MS, karoBelleginiSifirla, karoSayaci, turBaslat } from '../karoYukleme';

// Karo isteği sahte: cevap (ya da hata) test başına kurulur.
const mockYakinYerler = jest.fn<(s: { cip: string; merkez: { lat: number; lng: number; yaricapM?: number } }) => Promise<HafifYer[]>>();
jest.mock('../api', () => ({ yakinYerler: (s: unknown) => mockYakinYerler(s as never) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn() }));

const eskisehir = { lat: 39.7767, lng: 30.5206 };
const bolge = (zoom: number, merkez = eskisehir) => bolgeHesapla(merkez, zoomDelta(zoom), zoomDelta(zoom) / 2, zoom);
const yer = (place_id: string, puan = 4.5, n = 100): HafifYer => ({ place_id, ad: place_id, lat: 0, lng: 0, primary_type: null, tz: null, puan, puan_sayisi: n, acik: null, ulke_kodu: null });

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
    const t1 = await turBaslat('s1', ['hepsi'], b);
    expect(t1.istenen).toBe(Math.min(hepsi, KARO_EN_FAZLA_ISTEK));
    expect(t1.hata).toBe(false);
    const t2 = await turBaslat('s1', ['hepsi'], b);
    expect(t1.istenen + t2.istenen).toBe(hepsi);
    expect((await turBaslat('s1', ['hepsi'], b)).istenen).toBe(0);
    expect(mockYakinYerler).toHaveBeenCalledTimes(hepsi);
    expect(karoSayaci.istek).toBe(hepsi);
    // Birikim: her karodan 1 benzersiz + 'ortak' bir kez.
    expect(birikimiAl('s1').yerler.size).toBe(hepsi + 1);
  });

  it('yoldaki karo yeniden istenmez (eşzamanlı iki tur)', async () => {
    const b = bolge(14);
    const [a, c] = await Promise.all([turBaslat('s1', ['hepsi'], b), turBaslat('s1', ['hepsi'], b)]);
    const hepsi = gorunurKarolar(b).length;
    expect(a.istenen + c.istenen).toBe(Math.min(hepsi, 2 * KARO_EN_FAZLA_ISTEK));
    expect(mockYakinYerler).toHaveBeenCalledTimes(a.istenen + c.istenen);
  });

  it('hatalı karo önbellekten düşer; 30 sn geri çekilme, sonra yeniden denenir', async () => {
    mockYakinYerler.mockRejectedValue(new Error('502'));
    const b = bolge(15);
    const t1 = await turBaslat('s1', ['hepsi'], b, 1000);
    expect(t1.hata).toBe(true);
    expect(karoSayaci.hata).toBe(t1.istenen);
    // Hemen ardından: geri çekilme, istek yok.
    expect(await turBaslat('s1', ['hepsi'], b, 2000)).toEqual({ istenen: 0, yeni: 0, hata: true });
    // 30 sn sonra aynı karolar yeniden istenir ve başarılı olur.
    mockYakinYerler.mockResolvedValue([yer('x')]);
    const t3 = await turBaslat('s1', ['hepsi'], b, Date.now() + HATA_BEKLEME_MS + 1);
    expect(t3.istenen).toBe(t1.istenen);
    expect(t3.hata).toBe(false);
    expect(birikimiAl('s1').yerler.has('x')).toBe(true);
  });

  it('birikim seyahate göre ayrı; karo önbelleği ortak', async () => {
    const b = bolge(14);
    // Görünümün tüm karoları (iki tur) Roma seyahatiyle istenir.
    await turBaslat('roma', ['hepsi'], b);
    await turBaslat('roma', ['hepsi'], b);
    const roma = birikimiAl('roma').yerler.size;
    expect(roma).toBeGreaterThan(0);
    // Aynı karolar başka seyahat için yeniden istenmez (önbellek ortak) → Eskişehir birikimi boş kalır, Roma'nınki karışmaz.
    const t = await turBaslat('eskisehir', ['hepsi'], b);
    expect(t.istenen).toBe(0);
    expect(birikimiAl('eskisehir').yerler.size).toBe(0);
    expect(birikimiAl('roma').yerler.size).toBe(roma);
  });

  it('#69 KK10: birden çok küme — `hepsi` önce, 12 sınırı kümelerin toplamına; kategori kümesi ayrı önbellek anahtarı', async () => {
    const b = bolge(14);
    const hepsi = gorunurKarolar(b).length;
    const t1 = await turBaslat('s1', ['hepsi', 'muze'], b);
    expect(t1.istenen).toBe(KARO_EN_FAZLA_ISTEK);
    const ilkTur = mockYakinYerler.mock.calls.map((c) => c[0].cip);
    expect(ilkTur.slice(0, Math.min(hepsi, KARO_EN_FAZLA_ISTEK)).every((c) => c === 'hepsi')).toBe(true);
    // Turlar sürünce iki kümenin tüm karoları istenir: toplam 2 × görünüm.
    let toplam = t1.istenen;
    for (let i = 0; i < 10 && toplam < 2 * hepsi; i++) toplam += (await turBaslat('s1', ['hepsi', 'muze'], b)).istenen;
    expect(toplam).toBe(2 * hepsi);
    expect((await turBaslat('s1', ['hepsi', 'muze'], b)).istenen).toBe(0);
  });

  it('#70 🔴3: iki seyahat, ayrı öne çıkanlar', async () => {
    mockYakinYerler.mockImplementation(async ({ merkez }) => (merkez.lat > 41 ? [yer('colosseo', 4.8, 300_000), yer('r2', 4.7, 100_000)] : [yer('kursunlu', 4.6, 9_000), yer('e2', 4.2, 300)]));
    const roma = bolgeHesapla({ lat: 41.9, lng: 12.5 }, zoomDelta(14), zoomDelta(14) / 2, 14);
    await turBaslat('roma', ['hepsi'], roma);
    await turBaslat('eskisehir', ['hepsi'], bolge(14));
    const romaOne = oneCikanlar([...birikimiAl('roma').yerler.values()]);
    const eskOne = oneCikanlar([...birikimiAl('eskisehir').yerler.values()]);
    expect([...romaOne]).toEqual(['colosseo']);
    expect([...eskOne]).toEqual(['kursunlu']);
    // Birlikte sıralansaydı Eskişehir'e ★ kalmazdı.
    expect(oneCikanlar([...birikimiAl('roma').yerler.values(), ...birikimiAl('eskisehir').yerler.values()]).has('kursunlu')).toBe(false);
  });
});
