import { describe, expect, it } from '@jest/globals';

import { degisimMetni, dolarMetni, googleOzeti, haftaCubuklari, icerikDurumu, selam, sureMetni, tarihEtiketi, yuzde, type IcerikSehri } from '../genelBakis';

// #157 (kanvas BO-0): gösterge metinleri, Google tahmini harcama, bu hafta grafiği, içerik sağlığı.
describe('genel bakış (#157)', () => {
  it('süre: "2 dk 40 sn", saniye, saat', () => {
    expect(sureMetni(160)).toBe('2 dk 40 sn');
    expect(sureMetni(45.4)).toBe('45 sn');
    expect(sureMetni(120)).toBe('2 dk');
    expect(sureMetni(3900)).toBe('1 sa 5 dk');
  });

  it('oran ve değişim: payda 0 → yok (sıfır değil)', () => {
    expect(yuzde(38, 100)).toBe('%38');
    expect(yuzde(1, 0)).toBeNull();
    expect(degisimMetni(124, 105)).toBe('+%18');
    expect(degisimMetni(95, 100)).toBe('−%5');
    expect(degisimMetni(5, 5)).toBe('%0');
    expect(degisimMetni(5, 0)).toBeNull();
  });

  it('Google: kalem × birim fiyat; çubuk bütçedeki pay, yorumlar sınıra göre; bütçe aşımı', () => {
    const o = googleOzeti({ mekan: 120, foto: 300, rota: 200, yorum: 96, butce: 10, fiyat: { mekan: 17, foto: 7, rota: 5, yorum: 20 }, yorum_sinir: 300 });
    expect(o.toplam).toBeCloseTo(2.04 + 2.1 + 1 + 1.92);
    expect(dolarMetni(o.toplam)).toBe('$7,06');
    expect(o.kalemler.map((k) => [k.anahtar, k.sayi, Math.round(k.oran * 100)])).toEqual([
      ['mekan', 120, 20],
      ['foto', 300, 21],
      ['rota', 200, 10],
    ]);
    expect(o.yorum).toEqual({ sayi: 96, sinir: 300, oran: 0.32 });
    expect(o.asildi).toBe(false);
    expect(googleOzeti({ mekan: 1000, foto: 0, rota: 0, yorum: 0, butce: 10, fiyat: { mekan: 17 }, yorum_sinir: null }).asildi).toBe(true);
    const fiyatsiz = googleOzeti({ mekan: 5, foto: 0, rota: 0, yorum: 0, butce: null, fiyat: null, yorum_sinir: null });
    expect([fiyatsiz.toplam, fiyatsiz.butce, fiyatsiz.yorum.oran]).toEqual([0, null, 0]);
  });

  it('bu hafta: Pzt…Paz, en yüksek 208 px, boş gün çubuksuz', () => {
    const gunler = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
    const c = haftaCubuklari(gunler.map((gun, i) => ({ gun, plan: i === 4 ? 26 : 13, katilim: i === 6 ? 0 : 5 })));
    expect(c.map((x) => x.etiket)).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
    expect(c[4].plan).toEqual({ x: 392, y: 32, h: 208 });
    expect(c[0].plan).toEqual({ x: 40, y: 136, h: 104 });
    expect(c[0].katilim.x).toBe(74);
    expect(c[6].katilim.h).toBe(0);
  });

  it('içerik sağlığı: ilk eksik ya da özet', () => {
    const tam: IcerikSehri = { id: 's', ad: 'Eskişehir', kapak: true, genis_kapak: true, bolum: 5, bos_bolum: 0, mekan: 8, gezi: 2 };
    expect(icerikDurumu(tam)).toEqual({ tamam: true, anahtar: 'tamam' });
    expect(icerikDurumu({ ...tam, bos_bolum: 2 })).toEqual({ tamam: false, anahtar: 'bosBolum', n: 2 });
    expect(icerikDurumu({ ...tam, genis_kapak: false }).anahtar).toBe('genisKapakYok');
    expect(icerikDurumu({ ...tam, bolum: 0 }).anahtar).toBe('rehberYok');
    expect(icerikDurumu({ ...tam, gezi: 0 }).anahtar).toBe('geziYok');
  });

  it('başlık: Türkiye saatiyle tarih ve selam', () => {
    expect(tarihEtiketi(new Date('2026-10-13T06:00:00Z'))).toBe('13 EKİM SALI');
    expect(tarihEtiketi(new Date('2026-10-13T22:30:00Z'))).toBe('14 EKİM ÇARŞAMBA');
    expect(selam(new Date('2026-10-13T06:00:00Z'))).toBe('gunaydin');
    expect(selam(new Date('2026-10-13T11:00:00Z'))).toBe('iyiGunler');
    expect(selam(new Date('2026-10-13T19:00:00Z'))).toBe('iyiAksamlar');
  });
});
