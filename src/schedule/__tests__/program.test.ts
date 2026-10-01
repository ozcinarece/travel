import { describe, expect, it } from '@jest/globals';

import { acilisDurumu, kapaliGunler } from '../acilis';
import { kaydirSuresi, miniCubuk } from '../kaydir';
import { enUcuzEklemeIndeksi, programHesapla, type ProgramDuragi } from '../program';

const otel = { lat: 41.9, lng: 12.5 };
const d = (id: string, dakika: number, ek: Partial<ProgramDuragi> = {}): ProgramDuragi => ({
  id,
  key: id,
  konum: { lat: 41.9 + Number(id.slice(1)) * 0.005, lng: 12.5 },
  dakika,
  varildiDk: null,
  skipped: false,
  ...ek,
});
// Her bacak 10 dk, 800 m.
const sabit = () => ({ sn: 600, m: 800 });

describe('programHesapla', () => {
  it('saatleri sırayla toplar, otele dönüşü ekler', () => {
    const p = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 90), d('d2', 60)], otel, yuruyus: sabit, simdiDk: null });
    expect(p.satirlar.map((s) => [s.varisDk, s.ayrilisDk])).toEqual([
      [550, 640], // 09:10 – 10:40
      [650, 710], // 10:50 – 11:50
    ]);
    expect(p.bitisDk).toBe(720); // 12:00
    expect(p.yuruyusSn).toBe(1800);
    expect(p.kestirimVar).toBe(false);
  });

  it('önbellek yoksa kestirim kullanır ve işaretler', () => {
    const p = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30)], otel, yuruyus: () => null, simdiDk: null });
    expect(p.kestirimVar).toBe(true);
    expect(p.satirlar[0].yuruyus?.kestirim).toBe(true);
    expect(p.satirlar[0].varisDk).toBeGreaterThan(540);
  });

  it('atlanan durak zamanı etkilemez', () => {
    const p = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30, { skipped: true }), d('d2', 30)], otel, yuruyus: sabit, simdiDk: null });
    expect(p.satirlar[0].durum).toBe('atlandi');
    expect(p.satirlar[1].varisDk).toBe(550);
  });

  it('KK7: varış işareti sonrakileri kaydırır; durumlar', () => {
    // d1'e 09:30'da varıldı (plan 09:10), 60 dk kalınacak → ayrılış 10:30, d2 varış 10:40.
    const p = programHesapla({
      baslangic: '09:00',
      duraklar: [d('d1', 60, { varildiDk: 570 }), d('d2', 30), d('d3', 30)],
      otel,
      yuruyus: sabit,
      simdiDk: 600,
    });
    expect(p.satirlar[0].durum).toBe('buradasin');
    expect(p.satirlar[1].durum).toBe('siradaki');
    expect(p.satirlar[1].varisDk).toBe(640);
    expect(p.satirlar[2].durum).toBe('bekliyor');
  });

  it('süre dolunca yürüyüş başlamış sayılır: önceki geçildi', () => {
    const p = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30, { varildiDk: 550 }), d('d2', 30)], otel, yuruyus: sabit, simdiDk: 585 });
    expect(p.satirlar[0].durum).toBe('gecildi');
    expect(p.satirlar[1].durum).toBe('siradaki');
  });

  it('otelsiz günde ilk durağa yürüyüş yok', () => {
    const p = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30)], otel: null, yuruyus: sabit, simdiDk: null });
    expect(p.satirlar[0].yuruyus).toBeNull();
    expect(p.satirlar[0].varisDk).toBe(540);
    expect(p.oteleDonus).toBeNull();
  });
});

describe('enUcuzEklemeIndeksi', () => {
  it('yeni durağı en yakın komşuların arasına koyar', () => {
    const sira = [
      { key: 'a', konum: { lat: 41.9, lng: 12.5 } },
      { key: 'c', konum: { lat: 41.92, lng: 12.5 } },
    ];
    const yeni = { key: 'b', konum: { lat: 41.91, lng: 12.5 } };
    expect(enUcuzEklemeIndeksi(sira, yeni, null, () => null)).toBe(1);
    const uzak = { key: 'z', konum: { lat: 41.95, lng: 12.5 } };
    expect(enUcuzEklemeIndeksi(sira, uzak, null, () => null)).toBe(2);
  });
});

describe('acilisDurumu', () => {
  // Pzt–Cum 09:00–18:00, Cmt 10:00–14:00; Pazar kapalı.
  const periyotlar = [
    ...[1, 2, 3, 4, 5].map((g) => ({ gun: g, ac: '09:00', kapaGun: g, kapa: '18:00' })),
    { gun: 6, ac: '10:00', kapaGun: 6, kapa: '14:00' },
  ];
  it('açık / bugün kapalı / bu saatte kapalı', () => {
    expect(acilisDurumu(periyotlar, 1, 600)).toEqual({ durum: 'acik' });
    expect(acilisDurumu(periyotlar, 0, 600)).toEqual({ durum: 'kapali_gun' });
    expect(acilisDurumu(periyotlar, 6, 540)).toEqual({ durum: 'kapali_saat', sonrakiAcilis: '10:00' });
    expect(acilisDurumu(periyotlar, 6, 900)).toEqual({ durum: 'kapali_saat', sonrakiAcilis: null });
    expect(acilisDurumu(null, 1, 600)).toEqual({ durum: 'bilinmiyor' });
    expect(acilisDurumu([], 1, 600)).toEqual({ durum: 'acik' });
  });
  it('gece sarkan periyot ertesi güne sayılır', () => {
    const bar = [{ gun: 5, ac: '20:00', kapaGun: 6, kapa: '02:00' }];
    expect(acilisDurumu(bar, 6, 60)).toEqual({ durum: 'acik' });
    expect(acilisDurumu(bar, 5, 1300)).toEqual({ durum: 'acik' });
  });
  it('kapalı günler', () => {
    expect(kapaliGunler(periyotlar)).toEqual([0]);
  });
});

describe('miniCubuk', () => {
  const duraklar = [d('d1', 60), d('d2', 30), d('d3', 30)];
  const plan = programHesapla({ baslangic: '09:00', duraklar, otel, yuruyus: sabit, simdiDk: null });

  it('uzun kalma: 10 dk payı aşılınca', () => {
    const canli = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 60, { varildiDk: 550 }), d('d2', 30), d('d3', 30)], otel, yuruyus: sabit, simdiDk: 635 });
    const m = miniCubuk(plan, canli, 635);
    expect(m).toEqual({ tur: 'uzun', durakId: 'd1', uzunDk: 25, eskiBitisDk: plan.bitisDk, yeniBitisDk: canli.bitisDk + 25 });
    expect(miniCubuk(plan, programHesapla({ baslangic: '09:00', duraklar: [d('d1', 60, { varildiDk: 550 })], otel, yuruyus: sabit, simdiDk: 615 }), 615)).toBeNull();
  });

  it('yürüyüş: önceki geçildi, sıradakine kalan dk ve gecikme', () => {
    // d1'e 09:30 varıldı (plan 09:10) → 20 dk geç; 10:30'da çıkıldı, şimdi 10:33.
    const canli = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 60, { varildiDk: 570 }), d('d2', 30), d('d3', 30)], otel, yuruyus: sabit, simdiDk: 633 });
    const m = miniCubuk(plan, canli, 633);
    expect(m).toEqual({ tur: 'yuruyus', hedefId: 'd2', kalanDk: 7, gecikmeDk: 20 });
  });

  it('kaydirSuresi 15 dk adımına yukarı yuvarlar', () => {
    expect(kaydirSuresi(550, 635)).toBe(90);
    expect(kaydirSuresi(550, 556)).toBe(15);
  });
});
