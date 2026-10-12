import { describe, expect, it } from '@jest/globals';

import { butceAsildi, csvDosyaAdi, csvMetni, degisim, grafik, grafikAdimi, haftaEtiketi, kartlar, kisaSayi, oran, yuzdeMetni, type Ozet } from '../genelBakis';
import { ty } from '../metin';

const haftalar = Array.from({ length: 12 }, (_, i) => {
  const t = new Date(Date.UTC(2026, 6, 20 + i * 7));
  return { hafta: t.toISOString().slice(0, 10), kullanici: 10 + i * 3, seyahat: 4 + i * 2 };
});

const ozet = (alan: Partial<Ozet> = {}): Ozet => ({
  aralik_gun: 30,
  kullanici: { toplam: 1284, son7: 96 },
  seyahat: { toplam: 642, bu_hafta: 48, onceki_hafta: 40 },
  gezi_alindi: { toplam: 213, onceki: 190, tum: 120, gunler: 60, mekan: 33 },
  paylasim: { paylasildi: 87, paylasildi_onceki: 80, acildi: 310, olay_var: true, katilim: 12, katilim_onceki: 0 },
  google: { ay: 18400, onceki_ay: 15000, butce: 25000 },
  haftalik: haftalar,
  en_cok_alinan: [{ id: 'g1', baslik: "Odunpazarı'ndan Porsuk'a", sehir: 'Eskişehir', gun_sayisi: 2, goruntu: 1240, alindi: 96, kalp: 210 }],
  bugun: { kullanici: 14, seyahat: 9, gezi_alindi: 3, kesfet: 1120, mekan_paneli: 2340, yorum: 410 },
  ...alan,
});

describe('sayı biçimleri', () => {
  it('kanvastaki gibi kısaltır', () => {
    expect(kisaSayi(18400)).toBe('18,4K');
    expect(kisaSayi(25000)).toBe('25K');
    expect(kisaSayi(9870)).toBe('9.870');
    expect(kisaSayi(1_240_000)).toBe('1,2M');
  });
  it('yüzde: 10 altı tek ondalık, düşüş eksi', () => {
    expect(yuzdeMetni(8.08)).toBe('+8,1%');
    expect(yuzdeMetni(12.1)).toBe('+12%');
    expect(yuzdeMetni(-3.2)).toBe('−3,2%');
    expect(degisim(5, 0)).toBeNull();
    expect(degisim(48, 40)).toBe(20);
  });
  it('oran: alındı / görüntü', () => {
    expect(oran(96, 1240)).toBe('8%');
    expect(oran(3, 0)).toBe('—');
  });
});

describe('KPI kartları (KK1)', () => {
  it('kanvas sırası ve metinleri', () => {
    const k = kartlar(ozet(), ty);
    expect(k.map((x) => x.baslik)).toEqual(['Kullanıcı', 'Seyahat', 'Gezi alındı', 'Paylaşım', 'Google API']);
    expect(k[0]).toMatchObject({ deger: '1.284', alt: 'son 7 gün +96' });
    expect(yuzdeMetni(k[0].degisim!)).toBe('+8,1%');
    expect(k[1]).toMatchObject({ deger: '642', alt: 'bu hafta 48', degisim: 20 });
    expect(k[2].alt).toBe('tüm gezi 120 · seçili gün 60 · yalnız mekan 33');
    expect(k[3]).toMatchObject({ deger: '87', alt: 'davet linki açılma 310' });
    expect(k[4]).toMatchObject({ deger: '18,4K', alt: 'istek / ay · bütçe 25K', degisim: null });
  });
  it('davet olayı yokken paylaşım linkle katılımı gösterir', () => {
    const k = kartlar(ozet({ paylasim: { paylasildi: 0, paylasildi_onceki: 0, acildi: 0, olay_var: false, katilim: 12, katilim_onceki: 0 } }), ty);
    expect(k[3]).toMatchObject({ deger: '12', alt: 'linkle katılım', degisim: null });
  });
  it('bütçe eşiği', () => {
    expect(butceAsildi(ozet())).toBe(false);
    expect(butceAsildi(ozet({ google: { ay: 25000, onceki_ay: 0, butce: 25000 } }))).toBe(true);
    expect(butceAsildi(ozet({ google: { ay: 25000, onceki_ay: 0, butce: null } }))).toBe(false);
  });
});

describe('haftalık grafik (KK2)', () => {
  it('yuvarlak adım', () => {
    expect(grafikAdimi(43)).toBe(10);
    expect(grafikAdimi(0)).toBe(1);
    expect(grafikAdimi(7)).toBe(2);
    expect(grafikAdimi(240)).toBe(50);
  });
  it('kanvas geometrisi: 6 çizgi, x 30–540, çift haftalar + son hafta etiketli', () => {
    const g = grafik(haftalar);
    expect(g.cizgiler.map((c) => c.y)).toEqual([160, 132, 104, 76, 48, 20]);
    expect(g.cizgiler.map((c) => c.etiket)).toEqual(['0', '10', '20', '30', '40', '50']);
    expect(g.xEtiketleri[0]).toEqual({ x: 30, etiket: '20 Tem' });
    expect(g.xEtiketleri[1].etiket).toBe('');
    expect(g.xEtiketleri[10].etiket).toBe('28 Eyl');
    expect(g.xEtiketleri[11]).toEqual({ x: 540, etiket: '5 Eki' });
    expect(g.kullanici.yol.startsWith('M30.0 132.0 L76.4')).toBe(true);
    expect(g.kullanici.son).toEqual({ x: 540, y: 160 - (43 / 50) * 140 });
  });
  it('boş seri çizgisiz', () => {
    const g = grafik([]);
    expect(g.kullanici).toEqual({ yol: '', son: null });
    expect(g.cizgiler).toHaveLength(6);
  });
  it('hafta etiketi', () => {
    expect(haftaEtiketi('2026-10-12')).toBe('12 Eki');
  });
});

describe('CSV (KK6)', () => {
  it('bölümler ve tırnaklama', () => {
    const csv = csvMetni(ozet({ en_cok_alinan: [{ id: 'g', baslik: 'Bursa, "üç" gün', sehir: 'Bursa', gun_sayisi: 3, goruntu: 980, alindi: 61, kalp: 150 }] }), ty);
    const satirlar = csv.split('\r\n');
    expect(satirlar[0]).toBe('Metrik,Değer');
    expect(satirlar).toContain('Kullanıcı,1284');
    expect(satirlar).toContain('Hafta,Kullanıcı,Seyahat');
    expect(satirlar).toContain('2026-07-20,10,4');
    expect(satirlar).toContain('"Bursa, ""üç"" gün",Bursa,3,980,61,150,6%');
    expect(satirlar).toContain('Yorum isteği,410');
  });
  it('dosya adı', () => {
    expect(csvDosyaAdi(7, new Date(2026, 9, 2))).toBe('genel-bakis-7-gun-2026-10-02.csv');
  });
});
