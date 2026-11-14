// #200 KK6: "Günlere dağıt" sığmayan mekanlar — saf hesap: taban, yemek istisnası, kısmi sığma, 22:00 sınırı, varsayılan seçenek.
import { describe, expect, it } from '@jest/globals';

import type { Durak, Gun, Mekan } from '@/lib/tipler';

import { dagitimSecenekleri, dagitimYazimi, kisalt, kisaltmaTabani, ortakPencere, type DagitimGirdisi } from '../sigmayanlar';

// Hepsi aynı noktada: yol 0 dk, hesap yalnız sürelerden (okunur aritmetik).
const mekan = (id: string, dk: number, tip = 'museum'): Mekan => ({
  id,
  trip_id: 't',
  place_id: `p-${id}`,
  primary_type: tip,
  lat: 39.77,
  lng: 30.52,
  google_fetched_at: '',
  default_minutes: dk,
  added_by: null,
  note: null,
  created_at: '2026-10-01T00:00:00Z',
});
const gun = (index: number, start_time: string | null = null, end_time: string | null = null): Gun => ({ id: `g${index}`, trip_id: 't', index, date: null, start_time, end_time, order_manual: false, start_stay_id: null, end_stay_id: null });
const durak = (id: string, gunId: string, mekanId: string, minutes: number, order = 'a0', ek: Partial<Durak> = {}): Durak => ({
  id,
  trip_id: 't',
  day_id: gunId,
  place_ref: mekanId,
  order_key: order,
  minutes,
  arrived_at: null,
  arrived_by: null,
  completed_at: null,
  completed_by: null,
  auto_completed: false,
  skipped: false,
  ...ek,
});
const girdi = (mekanlar: Mekan[], gunler: Gun[], duraklar: Durak[] = []): DagitimGirdisi => ({ mekanlar, gunler, duraklar, gunBasi: '09:00:00', gunSonu: '20:00:00' });
const coklu = (n: number, dk: number, tip = 'museum') => Array.from({ length: n }, (_, i) => mekan(`m${i + 1}`, dk, tip));

describe('#200 KK3 kısaltma tabanı', () => {
  it('kendi süresinin %75\'i ya da 20 dk (hangisi büyükse), süreden uzun değil; yemek kısalmaz', () => {
    expect(kisaltmaTabani(80)).toBe(60);
    expect(kisaltmaTabani(24)).toBe(20);
    expect(kisaltmaTabani(15)).toBe(15);
    expect(kisalt(80, 0.5, false)).toBe(60);
    expect(kisalt(80, 0.9, false)).toBe(72);
    expect(kisalt(80, 0.5, true)).toBe(80);
  });
});

describe('#200 KK3–KK4 sığmayan mekanlar', () => {
  it('hepsi sığıyorsa pencere yok: tek seçenek (bugünkü dağıtım)', () => {
    const h = dagitimSecenekleri(girdi(coklu(8, 75), [gun(1)]));
    expect(h.taban.hepsi).toBe(true);
    expect(h.secenekler.map((s) => s.tur)).toEqual(['liste']);
  });

  it('kısalt: en az kısaltan oran; uzat: en küçük uzatma; liste: kalanlar; varsayılan hepsini sığdıran ilk seçenek', () => {
    // 3 gün × 09:00–20:00 (660 dk), 27 × 75 dk: günde 8 sığar → 3 kalır.
    const h = dagitimSecenekleri(girdi(coklu(27, 75), [gun(1), gun(2), gun(3)]));
    expect(h.taban.dagitilan).toBe(24);
    expect(h.taban.kalan).toHaveLength(3);
    expect(h.secenekler.map((s) => s.tur)).toEqual(['kisalt', 'uzat', 'liste']);
    const [k, u] = h.secenekler;
    // 9 × 73 = 657 ≤ 660 (oran %97); 9 × 74 = 666 sığmaz.
    expect(k.hepsi).toBe(true);
    expect(k.ortalama).toEqual({ once: 75, sonra: 73 });
    expect(k.onizleme.map((o) => [o.mekan, o.bas, o.bit])).toEqual([
      [9, 540, 540 + 657],
      [9, 540, 540 + 657],
      [9, 540, 540 + 657],
    ]);
    // Uzat: günde 9 × 75 = 675 → bitiş 20:00 → 20:15, süreler aynı.
    expect(u.hepsi).toBe(true);
    expect(u.bitisler).toEqual([
      { gunId: 'g1', index: 1, eski: 1200, yeni: 1215 },
      { gunId: 'g2', index: 2, eski: 1200, yeni: 1215 },
      { gunId: 'g3', index: 3, eski: 1200, yeni: 1215 },
    ]);
    expect(h.varsayilan).toBe('kisalt');
    expect(ortakPencere(h.pencereler)).toBe('09:00–20:00');
  });

  it('kısmi sığma: tabanda bile hepsi sığmıyorsa kaç tanesi daha sığdığı; varsayılan hepsini sığdıran (uzat)', () => {
    // 09:00–12:00 (180 dk), 5 × 60: taban 3; kısalt tabanı 45 → 4 (1 kalır); uzat → hepsi (12:00 → 14:00).
    const h = dagitimSecenekleri(girdi(coklu(5, 60), [gun(1, '09:00', '12:00')]));
    const k = h.secenekler.find((s) => s.tur === 'kisalt')!;
    expect(h.taban.dagitilan).toBe(3);
    expect(k.dagitilan).toBe(4);
    expect(k.hepsi).toBe(false);
    expect(k.kalan).toHaveLength(1);
    expect(h.secenekler.find((s) => s.tur === 'uzat')!.bitisler).toEqual([{ gunId: 'g1', index: 1, eski: 720, yeni: 840 }]);
    expect(h.varsayilan).toBe('uzat');
  });

  it('22:00 sınırı: uzatma 22:00\'yi geçmez; hiçbiri hepsini sığdıramazsa en çok sığdıran varsayılan', () => {
    // 09:00–20:00, 15 × 60 = 900: taban 11; uzat ≤ 22:00 (780 dk) → 13; kısalt (45) → 14.
    const h = dagitimSecenekleri(girdi(coklu(15, 60), [gun(1)]));
    const u = h.secenekler.find((s) => s.tur === 'uzat')!;
    expect(h.taban.dagitilan).toBe(11);
    expect(u.dagitilan).toBe(13);
    expect(u.bitisler).toEqual([{ gunId: 'g1', index: 1, eski: 1200, yeni: 1320 }]);
    expect(h.secenekler.find((s) => s.tur === 'kisalt')!.dagitilan).toBe(14);
    expect(h.varsayilan).toBe('kisalt');
    // Gün zaten 22:00'de bitiyorsa uzat seçeneği yok (uygulanamayan gösterilmez).
    expect(dagitimSecenekleri(girdi(coklu(15, 60), [gun(1, '09:00', '22:00')])).secenekler.map((s) => s.tur)).not.toContain('uzat');
  });

  it('yemek durakları kısalmaz; yalnız yemekse kısalt seçeneği yok', () => {
    // Mevcut iki durak (müze 90, restoran 90) + 7 yeni (müze 75, 1 restoran).
    const m = [mekan('a', 90), mekan('r', 90, 'restaurant'), ...coklu(6, 75), mekan('r2', 60, 'restaurant')];
    const d = [durak('da', 'g1', 'a', 90, 'a0'), durak('dr', 'g1', 'r', 90, 'a1')];
    const h = dagitimSecenekleri(girdi(m, [gun(1)], d));
    const k = h.secenekler.find((s) => s.tur === 'kisalt')!;
    expect(k.yemekVar).toBe(true);
    expect(k.durakSureleri?.has('dr')).toBe(false);
    expect(k.durakSureleri?.get('da')).toBeLessThan(90);
    expect(k.mekanSureleri?.has('r2')).toBe(false);
    const y = dagitimYazimi(k, m);
    expect(y.yeni.find((x) => x.mekanId === 'r2')?.dakika).toBe(60);
    expect(y.sureler.map((x) => x.durakId)).toEqual(['da']);
    // Yalnız yemek: kısaltma bir şey kazandırmaz → seçenek yok.
    const yemekler = dagitimSecenekleri(girdi(coklu(10, 75, 'restaurant'), [gun(1)]));
    expect(yemekler.secenekler.map((s) => s.tur)).toEqual(['uzat', 'liste']);
  });

  it('varılmış / tamamlanmış durak kısalmaz; atlanan durak kapasite tutmaz', () => {
    const m = [mekan('a', 120), mekan('b', 120), mekan('x', 120), ...coklu(5, 90)];
    const d = [durak('da', 'g1', 'a', 120, 'a0', { completed_at: '2026-10-14T10:00:00Z' }), durak('db', 'g1', 'b', 120, 'a1'), durak('dx', 'g1', 'x', 120, 'a2', { skipped: true })];
    const h = dagitimSecenekleri(girdi(m, [gun(1)], d));
    const k = h.secenekler.find((s) => s.tur === 'kisalt')!;
    expect(k.durakSureleri?.has('da')).toBe(false);
    expect(k.durakSureleri?.has('db')).toBe(true);
    // Atlanan durak (120 dk) günü doldurmaz: taban 660 − 240 = 420 → 4 × 90 sığar.
    expect(h.taban.dagitilan).toBe(4);
  });

  it('yazım: uzat seçeneği bitişleri "HH:MM" verir; liste seçeneği yalnız yeni durakları', () => {
    const h = dagitimSecenekleri(girdi(coklu(27, 75), [gun(1), gun(2), gun(3)]));
    const u = dagitimYazimi(h.secenekler.find((s) => s.tur === 'uzat')!, coklu(27, 75));
    expect(u.bitisler).toEqual([
      { gunId: 'g1', bitis: '20:15' },
      { gunId: 'g2', bitis: '20:15' },
      { gunId: 'g3', bitis: '20:15' },
    ]);
    expect(u.yeni).toHaveLength(27);
    expect(u.sureler).toEqual([]);
    const l = dagitimYazimi(h.taban, coklu(27, 75));
    expect(l.yeni).toHaveLength(24);
    expect(l.bitisler).toEqual([]);
  });
});
