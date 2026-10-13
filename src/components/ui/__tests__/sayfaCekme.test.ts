import { describe, expect, it } from '@jest/globals';

import { durmaNoktasi } from '@/components/harita/AltSayfa';
import { cekmeKarari, kapatilsinMi } from '@/components/ui/sayfaCekme';

// Ekran 800: katlı 70 · yarı 360 · tam 740 → öteleme (0 = tam açık): katlı 670, yarı 380, tam 0.
const Y = { katli: 70, yari: 360, tam: 740 };

describe('#164 KK5 durmaNoktasi: adım adım', () => {
  it('küçükten yukarı hızlı fırlatma tama değil yarıma gider', () => {
    expect(durmaNoktasi(600, -5, Y)).toBe('tam');
    expect(durmaNoktasi(600, -5, Y, 'katli')).toBe('yari');
  });
  it('yarımdan yukarı tama, aşağı küçüğe; tamdan aşağı hızlı fırlatma yarımda durur', () => {
    expect(durmaNoktasi(200, -1, Y, 'yari')).toBe('tam');
    expect(durmaNoktasi(500, 1, Y, 'yari')).toBe('katli');
    expect(durmaNoktasi(300, 6, Y, 'tam')).toBe('yari');
  });
  it('kısa çekiş aynı halde kalır', () => {
    expect(durmaNoktasi(380 + 40, 0, Y, 'yari')).toBe('yari');
    expect(durmaNoktasi(670 - 30, 0, Y, 'katli')).toBe('katli');
  });
});

describe('#164 KK7 cekmeKarari: içerikten aşağı çekiş', () => {
  it('içerik en üstteyken aşağı çekiş sayfayı taşır', () => {
    expect(cekmeKarari({ dx: 0, dy: 12, icerikY: 0, kilitli: false })).toBe('basla');
  });
  it('içerik kaymışsa önce içerik kayar (beklenir); yukarı ve yatay hareket içeriğe bırakılır', () => {
    expect(cekmeKarari({ dx: 0, dy: 40, icerikY: 120, kilitli: false })).toBe('bekle');
    expect(cekmeKarari({ dx: 0, dy: -20, icerikY: 0, kilitli: false })).toBe('birak');
    expect(cekmeKarari({ dx: 40, dy: 10, icerikY: 0, kilitli: false })).toBe('birak');
    expect(cekmeKarari({ dx: 2, dy: 4, icerikY: 0, kilitli: false })).toBe('bekle');
  });
  it('aşağı çekmeyi kullanan başka işlev (≡ sıralama) öncelikli', () => {
    expect(cekmeKarari({ dx: 0, dy: 30, icerikY: 0, kilitli: true })).toBe('birak');
  });
});

describe('#164 KK8 kapatilsinMi: Modal alt sayfa', () => {
  it('yüksekliğin %25’i (en az 80 px) ya da hızlı fırlatma kapatır', () => {
    expect(kapatilsinMi({ dy: 130, vy: 0 }, 480)).toBe(true);
    expect(kapatilsinMi({ dy: 110, vy: 0 }, 480)).toBe(false);
    expect(kapatilsinMi({ dy: 70, vy: 0 }, 200)).toBe(false);
    expect(kapatilsinMi({ dy: 30, vy: 1.4 }, 480)).toBe(true);
    expect(kapatilsinMi({ dy: 10, vy: 2 }, 480)).toBe(false);
  });
});
