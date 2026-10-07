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
  tamamlandiDk: null,
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

  it('#43 KK7: Tamamlandı anı ayrılış anıdır; sonrakiler oradan akar', () => {
    // d1 plan 09:10–10:10; 10:30'da tamamlandı → d2 varış 10:40.
    const p = programHesapla({
      baslangic: '09:00',
      duraklar: [d('d1', 60, { tamamlandiDk: 630 }), d('d2', 30), d('d3', 30)],
      otel,
      yuruyus: sabit,
      simdiDk: 633,
    });
    expect(p.satirlar[0].durum).toBe('gecildi');
    expect(p.satirlar[0].ayrilisDk).toBe(630);
    expect(p.satirlar[0].otomatik).toBe(false);
    expect(p.satirlar[1].durum).toBe('siradaki');
    expect(p.satirlar[1].varisDk).toBe(640);
    expect(p.satirlar[2].durum).toBe('bekliyor');
    expect(p.tamamlanan).toBe(1);
    expect(p.toplam).toBe(3);
  });

  it('#47 C8: art arda Bitti — saatler geriye gitmez, bitiş son durak + otele dönüş', () => {
    // d1 09:10 başlar, 09:05'te "tamamlandı" yazılmış (başlangıçtan önce) → ayrılış 09:10'a sabitlenir; d2 09:20.
    const p = programHesapla({
      baslangic: '09:00',
      duraklar: [d('d1', 60, { tamamlandiDk: 545 }), d('d2', 45, { tamamlandiDk: 548 }), d('d3', 30)],
      otel,
      yuruyus: sabit,
      simdiDk: 600,
    });
    const varislar = p.satirlar.map((x) => x.varisDk);
    expect(varislar).toEqual([...varislar].sort((a, b) => a - b));
    for (const x of p.satirlar) expect(x.ayrilisDk).toBeGreaterThanOrEqual(x.varisDk);
    expect(p.satirlar[1].varisDk).toBe(560);
    expect(p.bitisDk).toBe(p.satirlar[2].ayrilisDk + 10);
  });

  it('#43 KK8: planlanan bitiş + 10 dk geçince otomatik tamamlanır; pay içinde sıradaki kalır', () => {
    // d1 plan 09:10–09:40. 09:48: hâlâ sıradaki. 09:51: otomatik tamamlandı, d2 varış 09:50 planına göre akar.
    const payIcinde = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30), d('d2', 30)], otel, yuruyus: sabit, simdiDk: 588 });
    expect(payIcinde.satirlar[0].durum).toBe('siradaki');
    const sonra = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30), d('d2', 30)], otel, yuruyus: sabit, simdiDk: 591 });
    expect(sonra.satirlar[0].durum).toBe('gecildi');
    expect(sonra.satirlar[0].otomatik).toBe(true);
    expect(sonra.satirlar[0].ayrilisDk).toBe(580);
    expect(sonra.satirlar[1].durum).toBe('siradaki');
    expect(sonra.satirlar[1].varisDk).toBe(590);
  });

  it('#43 KK4: konum sıradaki durağın 60 m içindeyse "buradasin"', () => {
    const p = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30), d('d2', 30)], otel, yuruyus: sabit, simdiDk: 560, buradaId: 'd1' });
    expect(p.satirlar[0].durum).toBe('buradasin');
    expect(p.satirlar[1].durum).toBe('bekliyor');
  });

  it('seyahat günü değilse durumlar bekliyor', () => {
    const p = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30)], otel, yuruyus: sabit, simdiDk: null });
    expect(p.satirlar[0].durum).toBe('bekliyor');
  });

  it('#33: 40 dk üstü bacak taksi; araç süresi varsa gerçek, yoksa kestirim', () => {
    const uzak = d('d1', 30, { konum: { lat: 41.95, lng: 12.5 } });
    const gercek = programHesapla({ baslangic: '09:00', duraklar: [uzak], otel, yuruyus: () => ({ sn: 70 * 60, m: 5500, taksi: { sn: 9 * 60, m: 6000 } }), simdiDk: null });
    expect(gercek.satirlar[0].yuruyus).toEqual({ sn: 540, m: 6000, kestirim: false, mod: 'taksi' });
    expect(gercek.satirlar[0].varisDk).toBe(549);
    expect(gercek.taksiSn).toBe(540 * 2); // dönüş de taksi
    expect(gercek.yuruyusSn).toBe(0);
    const tahmin = programHesapla({ baslangic: '09:00', duraklar: [uzak], otel, yuruyus: () => ({ sn: 70 * 60, m: 5500 }), simdiDk: null });
    expect(tahmin.satirlar[0].yuruyus?.mod).toBe('taksi');
    expect(tahmin.satirlar[0].yuruyus?.kestirim).toBe(true);
    expect(tahmin.kestirimVar).toBe(true);
    const kisa = programHesapla({ baslangic: '09:00', duraklar: [d('d1', 30)], otel, yuruyus: sabit, simdiDk: null });
    expect(kisa.satirlar[0].yuruyus?.mod).toBe('yuruyus');
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

// #51: 7/24, gece yarısını geçen, haftada bir gün kapalı, saat bilgisi yok.
describe('acilisDurumu (#51)', () => {
  const p = (gun: number, ac: string, kapaGun: number, kapa: string) => ({ gun, ac, kapaGun, kapa });

  it('7/24 açık (tek periyot, kapanış yok) her gün her saatte açık', () => {
    const hep = [p(0, '00:00', 0, '24:00')];
    for (let g = 0; g < 7; g++) {
      expect(acilisDurumu(hep, g, 0)).toEqual({ durum: 'acik' });
      expect(acilisDurumu(hep, g, 23 * 60 + 30)).toEqual({ durum: 'acik' });
    }
    expect(kapaliGunler(hep)).toEqual([]);
  });

  it('7/24 açık (her gün 00:00 → ertesi gün 00:00) kapalı gün üretmez', () => {
    const hep = [0, 1, 2, 3, 4, 5, 6].map((g) => p(g, '00:00', (g + 1) % 7, '00:00'));
    expect(acilisDurumu(hep, 3, 720)).toEqual({ durum: 'acik' });
    expect(kapaliGunler(hep)).toEqual([]);
  });

  it('gece yarısını geçen periyot (Cuma 18:00 → Cumartesi 02:00)', () => {
    const bar = [p(5, '18:00', 6, '02:00')];
    expect(acilisDurumu(bar, 5, 23 * 60)).toEqual({ durum: 'acik' });
    expect(acilisDurumu(bar, 6, 60)).toEqual({ durum: 'acik' });
    expect(acilisDurumu(bar, 6, 3 * 60)).toEqual({ durum: 'kapali_saat', sonrakiAcilis: null });
    expect(acilisDurumu(bar, 5, 17 * 60)).toEqual({ durum: 'kapali_saat', sonrakiAcilis: '18:00' });
  });

  it('Cumartesi → Pazar sarkan periyot haftayı sarar', () => {
    const bar = [p(6, '20:00', 0, '03:00')];
    expect(acilisDurumu(bar, 0, 120)).toEqual({ durum: 'acik' });
  });

  it('haftada bir gün (Pazartesi) kapalı', () => {
    const muze = [0, 2, 3, 4, 5, 6].map((g) => p(g, '09:00', g, '19:00'));
    expect(acilisDurumu(muze, 1, 600)).toEqual({ durum: 'kapali_gun' });
    expect(acilisDurumu(muze, 2, 600)).toEqual({ durum: 'acik' });
    expect(kapaliGunler(muze)).toEqual([1]);
  });

  it('saat bilgisi yoksa kontrol yapılmaz', () => {
    expect(acilisDurumu(null, 2, 600)).toEqual({ durum: 'bilinmiyor' });
    expect(acilisDurumu(undefined, 2, 600)).toEqual({ durum: 'bilinmiyor' });
    expect(kapaliGunler(null)).toEqual([]);
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

  it('uzun kalma (#43 b): konum hâlâ otomatik tamamlanan durakta', () => {
    // d1 plan 09:10–10:10; şimdi 10:35, kullanıcı hâlâ d1'de → 25 dk uzun.
    const canli = programHesapla({ baslangic: '09:00', duraklar, otel, yuruyus: sabit, simdiDk: 635, buradaId: 'd1' });
    const m = miniCubuk(plan, canli, 635, 'd1');
    expect(m).toEqual({ tur: 'uzun', durakId: 'd1', uzunDk: 25, eskiBitisDk: plan.bitisDk, yeniBitisDk: canli.bitisDk + 25 });
    // Konum yoksa uzun kalma bilinemez; 10:25'te d1 otomatik tamamlandı (10:10), d2'ye yürüyüş 10 dk + pay 10 dk henüz dolmadı → çubuk yok.
    expect(miniCubuk(plan, programHesapla({ baslangic: '09:00', duraklar, otel, yuruyus: sabit, simdiDk: 625 }), 625)).toBeNull();
    // Pay içinde (10:15) çubuk yok.
    expect(miniCubuk(plan, programHesapla({ baslangic: '09:00', duraklar, otel, yuruyus: sabit, simdiDk: 615, buradaId: 'd1' }), 615, 'd1')).toBeNull();
  });

  it('yürüyüş gecikmesi (#43 a): önceki tamamlandı, sıradakine yürüyüş + 10 dk içinde varılmadı', () => {
    // d1 10:30'da tamamlandı (plan 10:10); d2'ye yürüyüş 10 dk → 10:40 varış; 10:51'de hâlâ yolda → çubuk.
    const duraklar2 = [d('d1', 60, { tamamlandiDk: 630 }), d('d2', 30), d('d3', 30)];
    expect(miniCubuk(plan, programHesapla({ baslangic: '09:00', duraklar: duraklar2, otel, yuruyus: sabit, simdiDk: 645 }), 645)).toBeNull();
    const canli = programHesapla({ baslangic: '09:00', duraklar: duraklar2, otel, yuruyus: sabit, simdiDk: 651 });
    const m = miniCubuk(plan, canli, 651);
    // Planlanan varış 10:20 (otel→d1 10 dk, d1 60 dk, d1→d2 10 dk) → 31 dk gecikme; kalan yürüyüş bilinmiyor → bacak süresi.
    expect(m).toEqual({ tur: 'yuruyus', hedefId: 'd2', kalanDk: 10, gecikmeDk: 31 });
  });

  it('kaydirSuresi 15 dk adımına yukarı yuvarlar', () => {
    expect(kaydirSuresi(550, 635)).toBe(90);
    expect(kaydirSuresi(550, 556)).toBe(15);
  });
});
