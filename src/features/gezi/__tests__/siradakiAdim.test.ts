import { describe, expect, it } from '@jest/globals';

import type { Durak, Gun, Mekan } from '@/lib/tipler';

import { siradakiAdim, type SiradakiGirdi } from '../siradakiAdim';

const gun = (index: number, date: string | null = null): Gun => ({ id: `g${index}`, trip_id: 't', index, date, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null });
const mekan = (id: string, tip: string, created_at = `2026-10-0${id.length}T00:00:00Z`): Mekan => ({
  id,
  trip_id: 't',
  place_id: `p-${id}`,
  primary_type: tip,
  lat: 39.77,
  lng: 30.52,
  google_fetched_at: '',
  default_minutes: 45,
  added_by: null,
  note: null,
  created_at,
});
const durak = (id: string, gunId: string, mekanId: string, order = 'a0', skipped = false): Durak => ({
  id,
  trip_id: 't',
  day_id: gunId,
  place_ref: mekanId,
  order_key: order,
  minutes: 45,
  arrived_at: null,
  arrived_by: null,
  completed_at: null,
  completed_by: null,
  auto_completed: false,
  skipped,
});

/** Tüm adımları geçmiş bir plan: 2 gün, otel, 3 kişi, iki günde de yemek, gidiş 10 gün sonra. */
const tamam = (): SiradakiGirdi => ({
  mod: 'plan',
  gunler: [gun(1, '2026-10-24'), gun(2, '2026-10-25')],
  mekanlar: [mekan('m1', 'museum'), mekan('m2', 'restaurant'), mekan('m3', 'park'), mekan('m4', 'cafe'), mekan('m5', 'restaurant')],
  duraklar: [durak('d1', 'g1', 'm1', 'a0'), durak('d2', 'g1', 'm2', 'a1'), durak('d3', 'g2', 'm3', 'a0'), durak('d4', 'g2', 'm4', 'a1'), durak('d5', 'g2', 'm5', 'a2')],
  otelVar: true,
  uyeSayisi: 3,
  bugun: '2026-10-14',
  baslangic: '2026-10-24',
  ilkGunCikis: '09:30',
});

describe('#181 KK5 Sıradaki adım: öncelik sırası', () => {
  it('hiç koşul yoksa satır gizlenir', () => {
    expect(siradakiAdim(tamam())).toBeNull();
  });

  it('gezi modunda ve bitmiş gezide satır yok', () => {
    const plansiz = { ...tamam(), duraklar: [] };
    expect(siradakiAdim({ ...plansiz, mod: 'gezi' })).toBeNull();
    expect(siradakiAdim({ ...plansiz, mod: 'bitti' })).toBeNull();
  });

  it('1 · hiç durak yoksa Planı kur (listede kaç mekan var)', () => {
    expect(siradakiAdim({ ...tamam(), duraklar: [] })).toEqual({ tur: 'planKur', mekanSayisi: 5 });
    expect(siradakiAdim({ ...tamam(), duraklar: [], mekanlar: [] })).toEqual({ tur: 'planKur', mekanSayisi: 0 });
  });

  it('2 · güne atanmamış mekan → Dağıt (eklenme sırası; otel yoksa "otel de seçilmedi")', () => {
    const g = tamam();
    g.mekanlar.push(mekan('yeni2', 'park', '2026-10-09T00:00:00Z'), mekan('yeni1', 'museum', '2026-10-08T00:00:00Z'));
    expect(siradakiAdim(g)).toEqual({ tur: 'dagit', mekanIdleri: ['yeni1', 'yeni2'], otelYok: false });
    expect(siradakiAdim({ ...g, otelVar: false })).toEqual({ tur: 'dagit', mekanIdleri: ['yeni1', 'yeni2'], otelYok: true });
  });

  it('3 · otel yok → Otel seç; Plan\'daki otel şeridinde "Şimdi değil" dendiyse atlanır', () => {
    expect(siradakiAdim({ ...tamam(), otelVar: false })).toEqual({ tur: 'otel' });
    expect(siradakiAdim({ ...tamam(), otelVar: false, otelErtelendi: true })).toBeNull();
  });

  it('4 · tek kişi → Davet et (otelden sonra)', () => {
    expect(siradakiAdim({ ...tamam(), uyeSayisi: 1 })).toEqual({ tur: 'davet' });
    expect(siradakiAdim({ ...tamam(), uyeSayisi: 1, otelVar: false })).toEqual({ tur: 'otel' });
  });

  it('5 · durağı olan bir günde yemek durağı yok → o gün (boş gün ve atlanan yemek sayılmaz)', () => {
    const g = tamam();
    g.duraklar = g.duraklar.filter((d) => d.id !== 'd5');
    g.mekanlar = g.mekanlar.filter((m) => m.id !== 'm5');
    // 2. günde yalnız park + kafe kaldı (kafe yemek değil).
    expect(siradakiAdim(g)).toEqual({ tur: 'yemek', gun: g.gunler[1] });
    // 1. günün yemeği atlandıysa 1. gün önce gelir.
    g.duraklar = g.duraklar.map((d) => (d.id === 'd2' ? { ...d, skipped: true } : d));
    expect(siradakiAdim(g)).toEqual({ tur: 'yemek', gun: g.gunler[0] });
    // Boş gün yemek adımına sebep olmaz.
    const bos = tamam();
    bos.gunler.push(gun(3, '2026-10-26'));
    expect(siradakiAdim(bos)).toBeNull();
  });

  it('6 · yarın başlıyor → ilk günün ilk durağı ve çıkış saati', () => {
    expect(siradakiAdim({ ...tamam(), bugun: '2026-10-23' })).toEqual({ tur: 'yarin', ilkMekanId: 'm1', cikis: '09:30' });
    // Ay sonu: 31 Ekim → 1 Kasım.
    expect(siradakiAdim({ ...tamam(), bugun: '2026-10-31', baslangic: '2026-11-01' })?.tur).toBe('yarin');
    expect(siradakiAdim({ ...tamam(), bugun: '2026-10-22' })).toBeNull();
  });

  it('ilk doğru koşul gösterilir; biri bitince sıradaki gelir', () => {
    const g: SiradakiGirdi = { ...tamam(), otelVar: false, uyeSayisi: 1, bugun: '2026-10-23' };
    g.mekanlar.push(mekan('yeni', 'park'));
    expect(siradakiAdim(g)?.tur).toBe('dagit');
    g.mekanlar = g.mekanlar.filter((m) => m.id !== 'yeni');
    expect(siradakiAdim(g)?.tur).toBe('otel');
    g.otelVar = true;
    expect(siradakiAdim(g)?.tur).toBe('davet');
    g.uyeSayisi = 2;
    expect(siradakiAdim(g)?.tur).toBe('yarin');
  });
});
