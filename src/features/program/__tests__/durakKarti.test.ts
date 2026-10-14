import { describe, expect, it, jest } from '@jest/globals';

import type { Durak, Mekan } from '@/lib/tipler';
import type { ProgramSatiri } from '@/schedule/program';

import {
  ilerlemeParcalari,
  KART_ADIM,
  kartAdimi,
  kartGenisligi,
  kartIndeksi,
  kartKamerasi,
  kartListesi,
  kartSaati,
  kartSekmesi,
  odakKarti,
  sonrakiKart,
  yolTarifiBirincil,
  type DurakKarti,
} from '../durakKarti';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({}) }));

const mekan = (id: string, place_id: string, tip: string | null = 'museum'): Mekan => ({ id, place_id, lat: 39.7, lng: 30.5, primary_type: tip, default_minutes: 60 } as unknown as Mekan);
const durak = (id: string, place_ref: string, ek: Partial<Durak> = {}): Durak => ({ id, day_id: 'g1', place_ref, skipped: false, completed_at: null, minutes: 60, ...ek } as unknown as Durak);
const satir = (id: string, varisDk: number, ayrilisDk: number, durum: ProgramSatiri['durum'], yuruyus: ProgramSatiri['yuruyus'] = null): ProgramSatiri =>
  ({ durak: { id }, varisDk, ayrilisDk, durum, yuruyus } as unknown as ProgramSatiri);
const yuru = (dk: number, mod: 'yuruyus' | 'taksi' = 'yuruyus') => ({ sn: dk * 60, m: dk * 75, kestirim: false, mod });

describe('kartListesi (#99 KK1)', () => {
  const mekanIle = new Map([
    ['m1', mekan('m1', 'p1', 'mosque')],
    ['m2', mekan('m2', 'p2', 'tourist_attraction')],
    ['m3', mekan('m3', 'p3')],
  ]);
  const adlar = {
    p1: { place_id: 'p1', ad: 'Kurşunlu Cami', primary_type: 'mosque', puan: 4.6, puan_sayisi: 3100 },
    p2: { place_id: 'p2', ad: 'Odunpazarı Evleri', primary_type: 'tourist_attraction', puan: 4.7, puan_sayisi: 7600 },
  } as never;
  it('gün listesi sırasıyla kart; saat canlı programdan; ★ puan · yorum kısaltılmış; ad yoksa …; atlanan numarasız', () => {
    const k = kartListesi({
      gunDurak: [durak('d1', 'm1'), durak('d2', 'm2', { minutes: 90 }), durak('d3', 'm3', { skipped: true })],
      mekanIle,
      adlar,
      satirlar: [satir('d1', 600, 630, 'bekliyor', yuru(6)), satir('d2', 640, 730, 'bekliyor', yuru(10)), satir('d3', 730, 730, 'atlandi')],
    });
    expect(k.map((x) => [x.sira, x.numara, x.ad, x.kategori, x.dakika, kartSaati(x), x.puan, x.yorum])).toEqual([
      [1, 1, 'Kurşunlu Cami', 'Cami', 60, '10:00 – 10:30', 4.6, '3,1K'],
      [2, 2, 'Odunpazarı Evleri', 'Gezilecek yer', 90, '10:40 – 12:10', 4.7, '7,6K'],
      [3, null, '…', 'Müze', 60, null, null, null],
    ]);
    expect(k[2].durum).toBe('atlandi');
  });
  it('#140 KK3: geliş satırı — ilk durak otelden, sonrakiler önceki atlanmamış durağın numarasından; mod glifi', () => {
    const k = kartListesi({
      gunDurak: [durak('d1', 'm1'), durak('d3', 'm3', { skipped: true }), durak('d2', 'm2')],
      mekanIle,
      adlar,
      satirlar: [satir('d1', 551, 600, 'bekliyor', yuru(6)), satir('d3', 600, 600, 'atlandi'), satir('d2', 608, 700, 'bekliyor', yuru(8, 'taksi'))],
    });
    expect(k[0].gelis).toEqual({ metin: 'Otelden 6 dk yürüyüş', mod: 'yuruyus', dk: 6 });
    expect(k[1].gelis).toBeNull();
    expect(k[2].gelis).toEqual({ metin: '1. duraktan 8 dk araba', mod: 'taksi', dk: 8 });
    // Otelsiz günde ilk durağa bacak yok → geliş yok.
    expect(kartListesi({ gunDurak: [durak('d1', 'm1')], mekanIle, adlar, satirlar: [satir('d1', 540, 600, 'bekliyor')] })[0].gelis).toBeNull();
  });
  it('#140 KK7–8: Sonra: atlananı geçer; odak gezi gününde buradasın/sıradaki, planda ilk kart', () => {
    const k = kartListesi({
      gunDurak: [durak('d1', 'm1'), durak('d3', 'm3', { skipped: true }), durak('d2', 'm2')],
      mekanIle,
      adlar,
      satirlar: [satir('d1', 540, 600, 'gecildi'), satir('d3', 600, 600, 'atlandi'), satir('d2', 610, 700, 'siradaki', yuru(10))],
    });
    expect(sonrakiKart(k, 'd1')?.durakId).toBe('d2');
    expect(sonrakiKart(k, 'd2')).toBeNull();
    expect(odakKarti(k, true)?.durakId).toBe('d2');
    expect(odakKarti(k, false)?.durakId).toBe('d1');
    expect(odakKarti([], true)).toBeNull();
  });
  it('mekanı silinmiş durak karta girmez', () => {
    expect(kartListesi({ gunDurak: [durak('d9', 'yok'), durak('d1', 'm1')], mekanIle, adlar, satirlar: [] })).toHaveLength(1);
  });
});

describe('kartKamerasi (#99 KK2)', () => {
  it('merkez pinin güneyinde (pin kartın üstünde kalır); zoom 14–17 arasına sıkıştırılır', () => {
    const k = kartKamerasi({ konum: { lat: 39.78, lng: 30.5 }, zoom: 15, ekranYukseklik: 800 });
    expect(k.konum.lng).toBe(30.5);
    expect(k.konum.lat).toBeLessThan(39.78);
    expect(39.78 - k.konum.lat).toBeCloseTo(((220 + 14) / 2) * (360 / 2 ** 15 / 800), 8);
    expect(kartKamerasi({ konum: { lat: 0, lng: 0 }, zoom: 11, ekranYukseklik: 800 }).zoom).toBe(14);
    expect(kartKamerasi({ konum: { lat: 0, lng: 0 }, zoom: 19, ekranYukseklik: 800 }).zoom).toBe(17);
  });
});

describe('kartIndeksi (#99 KK2)', () => {
  it('ofset → en yakın kart, sınırlar içinde; adım ekran genişliğinden', () => {
    expect(kartIndeksi(0, 5)).toBe(0);
    expect(kartIndeksi(KART_ADIM * 2 + 40, 5)).toBe(2);
    expect(kartIndeksi(KART_ADIM * 9, 5)).toBe(4);
    expect(kartIndeksi(-50, 5)).toBe(0);
    expect(kartIndeksi(420 * 3, 5, 420)).toBe(3);
  });
});

describe('#168 durak kartı', () => {
  const mekanIle = new Map([
    ['m1', mekan('m1', 'p1', 'mosque')],
    ['m2', mekan('m2', 'p2', 'museum')],
    ['m3', mekan('m3', 'p3', 'museum')],
  ]);
  // p1 her gün 09:00–17:00; p2 Pazartesi (Google 1) kapalı, diğer günler 10:00–18:00; p3 saat bilgisi yok.
  const hafta = (ac: string, kapa: string, haric: number[] = []) => [0, 1, 2, 3, 4, 5, 6].filter((g) => !haric.includes(g)).map((gun) => ({ gun, ac, kapaGun: gun, kapa }));
  const adlar = {
    p1: { place_id: 'p1', ad: 'Kurşunlu Külliyesi', primary_type: 'mosque', puan: 4.7, puan_sayisi: 3100, periyotlar: hafta('09:00', '17:00') },
    p2: { place_id: 'p2', ad: 'Cam Müzesi', primary_type: 'museum', puan: 4.5, puan_sayisi: 900, periyotlar: hafta('10:00', '18:00', [1]) },
    p3: { place_id: 'p3', ad: 'Taş Müzesi', primary_type: 'museum', puan: null, puan_sayisi: null, periyotlar: null },
  } as never;
  const gunDurak = [durak('d1', 'm1'), durak('d2', 'm2'), durak('d3', 'm3')];
  const satirlar = [satir('d1', 9 * 60 + 30, 10 * 60 + 15, 'gecildi', yuru(6)), satir('d2', 10 * 60 + 27, 11 * 60, 'siradaki', yuru(12)), satir('d3', 11 * 60 + 8, 12 * 60, 'bekliyor', yuru(8, 'taksi'))];

  it('KK6: kart soldan 12, sağdan 28 px içeride; sonraki kart 20 px görünür', () => {
    expect(kartGenisligi(390)).toBe(350);
    expect(kartAdimi(390)).toBe(358);
    expect(12 + kartGenisligi(390) + 8).toBe(390 - 20);
    expect(kartGenisligi(1024)).toBe(520);
  });

  it('KK3: Açık / Kapalı planlanan varışta, o günün saatleriyle; tarihsiz gün ya da saat bilgisi yoksa gösterilmez', () => {
    // Salı (Google 2): p2 10:27'de açık.
    expect(kartListesi({ gunDurak, mekanIle, adlar, satirlar, haftaGunu: 2 }).map((k) => k.acik)).toEqual([true, true, null]);
    // Pazartesi: p2 kapalı.
    expect(kartListesi({ gunDurak, mekanIle, adlar, satirlar, haftaGunu: 1 }).map((k) => k.acik)).toEqual([true, false, null]);
    // Varış açılıştan önce: kapalı.
    expect(kartListesi({ gunDurak: [durak('d1', 'm1')], mekanIle, adlar, satirlar: [satir('d1', 8 * 60, 9 * 60, 'bekliyor')], haftaGunu: 2 })[0].acik).toBe(false);
    expect(kartListesi({ gunDurak, mekanIle, adlar, satirlar }).map((k) => k.acik)).toEqual([null, null, null]);
    // Atlanan durakta varış yok.
    expect(kartListesi({ gunDurak: [durak('d1', 'm1', { skipped: true })], mekanIle, adlar, satirlar: [satir('d1', 600, 600, 'atlandi')], haftaGunu: 2 })[0].acik).toBeNull();
  });

  it('KK2: ilerleme — planda öncekiler geçilmiş; gezide yalnız gezilenler; bu durak her zaman kendi parçası', () => {
    const k = kartListesi({ gunDurak, mekanIle, adlar, satirlar });
    expect(ilerlemeParcalari(k, 'd2', false)).toEqual(['gecildi', 'bu', 'sonra']);
    expect(ilerlemeParcalari(k, 'd1', false)).toEqual(['bu', 'sonra', 'sonra']);
    expect(ilerlemeParcalari(k, 'd3', true)).toEqual(['gecildi', 'sonra', 'bu']);
    expect(ilerlemeParcalari(k, 'd1', true)).toEqual(['bu', 'sonra', 'sonra']);
    expect(ilerlemeParcalari(k, 'yok', false)).toEqual(['sonra', 'sonra', 'sonra']);
  });

  it('KK7: plan modunda sekme geliş (mod glifi); otelsiz ilk durakta "Günün ilk durağı"; atlanan soluk', () => {
    const k = kartListesi({ gunDurak, mekanIle, adlar, satirlar });
    const sec = { gezi: false, konum: null, tz: 'Europe/Istanbul' };
    expect(kartSekmesi(k[1], sec)).toEqual({ metin: '1. duraktan 12 dk yürüyüş', ikon: 'yurume', ton: 'normal' });
    expect(kartSekmesi(k[2], sec)).toEqual({ metin: '2. duraktan 8 dk araba', ikon: 'araba', ton: 'normal' });
    // Planda durum (gecildi / siradaki) sekmeyi değiştirmez.
    expect(kartSekmesi(k[0], sec).metin).toBe('Otelden 6 dk yürüyüş');
    const ilk = kartListesi({ gunDurak: [durak('d1', 'm1')], mekanIle, adlar, satirlar: [satir('d1', 540, 600, 'bekliyor')] })[0];
    expect(kartSekmesi(ilk, sec)).toEqual({ metin: 'Günün ilk durağı', ikon: 'pin', ton: 'normal' });
    const atlanan = kartListesi({ gunDurak: [durak('d1', 'm1', { skipped: true })], mekanIle, adlar, satirlar: [satir('d1', 600, 600, 'atlandi')] })[0];
    expect(kartSekmesi(atlanan, { ...sec, gezi: true })).toEqual({ metin: 'Atlandı', ikon: null, ton: 'soluk' });
  });

  it('KK8–9: gezi modunda sıradaki kalan yol (konum yoksa geliş); buradayken varış anı; gezilen ✓', () => {
    const k = kartListesi({ gunDurak, mekanIle, adlar, satirlar });
    const sec = { gezi: true, konum: null, tz: 'Europe/Istanbul' };
    expect(kartSekmesi(k[1], sec)).toEqual({ metin: 'Sıradaki · 1. duraktan 12 dk yürüyüş', ikon: 'yurume', ton: 'normal' });
    // ~300 m kuzeyde: kuş uçuşu kestirim (#140 KK9 ile aynı hesap).
    const konum = { lat: k[1].konum.lat + 0.0027, lng: k[1].konum.lng };
    expect(kartSekmesi(k[1], { ...sec, konum }).metin).toMatch(/^Sıradaki · \d+ dk kaldı · 300 m$/);
    expect(kartSekmesi(k[0], sec)).toEqual({ metin: 'Gezildi', ikon: 'tik', ton: 'gezildi' });
    expect(kartSekmesi(k[2], sec).metin).toBe('2. duraktan 8 dk araba');
    const burada: DurakKarti = { ...k[1], durum: 'buradasin', varildi: '2026-10-16T08:05:00Z' };
    expect(kartSekmesi(burada, sec)).toEqual({ metin: "Buradasın · 11:05'te geldin", ikon: 'tik', ton: 'burada' });
    expect(kartSekmesi({ ...burada, varildi: null }, sec).metin).toBe('Buradasın');
  });

  it('KK7–9: birincil düğme planda ve buradayken Mekan rehberi, sıradaki durağa giderken Yol tarifi', () => {
    expect(yolTarifiBirincil({ durum: 'siradaki' }, false)).toBe(false);
    expect(yolTarifiBirincil({ durum: 'siradaki' }, true)).toBe(true);
    expect(yolTarifiBirincil({ durum: 'buradasin' }, true)).toBe(false);
    expect(yolTarifiBirincil({ durum: 'bekliyor' }, true)).toBe(false);
    expect(yolTarifiBirincil({ durum: null }, false)).toBe(false);
  });
});
