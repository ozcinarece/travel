import { describe, expect, it } from '@jest/globals';

import type { Durak, Gun, Mekan, Oy, Uye, Yer } from '@/lib/tipler';
import type { TempoSonucu } from '@/schedule/tempo';

import { durumCipi, geziModu, grupDurumlari, gunKartlari, listemOnizlemesi, mekanAdi, rehberOnerileri, tarihSatiri } from '../geziOzeti';

const IST = 'Europe/Istanbul';
// 14 Ekim 2026 12:00 İstanbul.
const AN = new Date('2026-10-14T09:00:00Z');
const seyahat = (start_date: string | null, end_date: string | null) => ({ start_date, end_date, tz: IST });

const gun = (index: number, date: string | null = null): Gun => ({ id: `g${index}`, trip_id: 't', index, date, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null });
const mekan = (id: string, tip: string, created_at = '2026-10-01T00:00:00Z'): Mekan => ({
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
const durak = (id: string, gunId: string, mekanId: string, order = 'a0', ek: Partial<Durak> = {}): Durak => ({
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
  skipped: false,
  ...ek,
});
const tempo = (baslangic: string, bitis: string, kestirim = false): TempoSonucu =>
  ({ doluluk: 0.5, etiket: 'rahat', durakSayisi: 2, geziDk: 90, yuruyusDk: 10, taksiDk: 0, kestirim, baslangic, bitis, sigar: 0, enUzun: null, sira: [] }) as TempoSonucu;

describe('#181 mod ve kapak', () => {
  it('gezi modu tarihler içinde, bitti dönüş geçince; tarihsiz plan', () => {
    expect(geziModu(seyahat('2026-10-14', '2026-10-16'), AN)).toBe('gezi');
    expect(geziModu(seyahat('2026-10-10', '2026-10-13'), AN)).toBe('bitti');
    expect(geziModu(seyahat('2026-10-26', '2026-10-28'), AN)).toBe('plan');
    expect(geziModu(seyahat(null, null), AN)).toBe('plan');
  });

  it('KK4 durum çipi: "N gün kaldı" / "Bugün · N. gün"; tarihsiz ve bitmiş gezide yok', () => {
    expect(durumCipi(seyahat('2026-10-26', '2026-10-28'), AN)).toEqual({ tur: 'kalan', metin: '12 gün kaldı' });
    expect(durumCipi(seyahat('2026-10-13', '2026-10-15'), AN)).toEqual({ tur: 'bugun', metin: 'Bugün · 2. gün' });
    expect(durumCipi(seyahat(null, null), AN)).toBeNull();
    expect(durumCipi(seyahat('2026-10-01', '2026-10-03'), AN)).toBeNull();
  });

  it('gece yarısı sınırı: mod ve çip cihazın değil seyahatin saat dilimine göre', () => {
    // 16 Ekim 21:30 UTC = İstanbul'da 17 Ekim 00:30, New York'ta 16 Ekim 17:30.
    const an = new Date('2026-10-16T21:30:00Z');
    const ist = { start_date: '2026-10-17', end_date: '2026-10-18', tz: IST };
    const ny = { ...ist, tz: 'America/New_York' };
    expect(geziModu(ist, an)).toBe('gezi');
    expect(durumCipi(ist, an)).toEqual({ tur: 'bugun', metin: 'Bugün · 1. gün' });
    expect(geziModu(ny, an)).toBe('plan');
    expect(durumCipi(ny, an)).toEqual({ tur: 'kalan', metin: '1 gün kaldı' });
    // Dönüş günü İstanbul'da bitti, New York'ta sürüyor.
    const donus = { start_date: '2026-10-15', end_date: '2026-10-16' };
    expect(geziModu({ ...donus, tz: IST }, an)).toBe('bitti');
    expect(durumCipi({ ...donus, tz: IST }, an)).toBeNull();
    expect(geziModu({ ...donus, tz: 'America/New_York' }, an)).toBe('gezi');
    expect(durumCipi({ ...donus, tz: 'America/New_York' }, an)).toEqual({ tur: 'bugun', metin: 'Bugün · 2. gün' });
  });

  it('tarih satırı: aralık · gün adları · gün sayısı', () => {
    expect(tarihSatiri(seyahat('2026-10-16', '2026-10-18'), 3)).toBe('16–18 Ekim · Cum–Paz · 3 gün');
    expect(tarihSatiri(seyahat('2026-10-16', '2026-10-16'), 1)).toBe('16 Ekim · Cum · 1 gün');
    expect(tarihSatiri(seyahat(null, null), 2)).toBe('2 gün · tarih belli değil');
  });
});

describe('#181 KK6 gün kartları', () => {
  const gunler = [gun(2, '2026-10-17'), gun(1, '2026-10-16'), gun(3, '2026-10-18')];
  const mekanlar = [mekan('m1', 'museum'), mekan('m2', 'restaurant'), mekan('m3', 'park')];
  const duraklar = [durak('d2', 'g1', 'm2', 'a1'), durak('d1', 'g1', 'm1', 'a0'), durak('d3', 'g2', 'm3', 'a0'), durak('d4', 'g2', 'm2', 'a1', { skipped: true })];
  const tempolar = new Map([
    ['g1', tempo('09:30', '18:10')],
    ['g2', tempo('10:00', '17:20', true)],
  ]);

  it('gün sırası, renk, etiket, tema (ilk durağın adı), durak sayısı (atlanan hariç), saat; boş gün', () => {
    const ad = (m: { place_id: string }) => (m.place_id === 'p-m1' ? 'Odunpazarı Evleri' : null);
    const k = gunKartlari({ gunler, duraklar, mekanlar, tempolar, ad });
    expect(k.map((x) => [x.gun.index, x.etiket, x.renk, x.tema, x.durakSayisi, x.saat])).toEqual([
      [1, 'Cum 16', '#2c64f5', 'Odunpazarı Evleri', 2, '09:30–18:10'],
      // Adı bilinmeyen günde tema kategorilerden (Google'a gidilmez); yürüyüşler kestirimse saat "~" ile.
      [2, 'Cmt 17', '#f5a524', 'Park', 1, '~10:00–17:20'],
      [3, 'Paz 18', '#16a06e', null, 0, null],
    ]);
  });

  it('adı bilinmeyen mekan kategoriyle anılır', () => {
    expect(mekanAdi(mekan('m1', 'museum'), () => null)).toBe('Müze');
    expect(mekanAdi(mekan('m1', 'museum'), () => 'Eti Müzesi')).toBe('Eti Müzesi');
  });
});

describe('#181 KK7 Listem önizlemesi', () => {
  it('en çok oy alan 3 mekan, eşitlikte önce eklenen; gün ve benim oyum', () => {
    const mekanlar = [mekan('a', 'park', '2026-10-01T00:00:00Z'), mekan('b', 'museum', '2026-10-02T00:00:00Z'), mekan('c', 'cafe', '2026-10-03T00:00:00Z'), mekan('d', 'park', '2026-10-04T00:00:00Z')];
    const oylar: Oy[] = [
      { mekan: 'd', kullanici: 'u1' },
      { mekan: 'd', kullanici: 'u2' },
      { mekan: 'c', kullanici: 'ben' },
      { mekan: 'b', kullanici: 'u1' },
    ];
    const satirlar = listemOnizlemesi({ mekanlar, duraklar: [durak('x', 'g1', 'b')], gunler: [gun(1)], oylar, benId: 'ben' });
    expect(satirlar.map((r) => [r.mekan.id, r.oy, r.benimOyum, r.gun?.index ?? null])).toEqual([
      ['d', 2, false, null],
      ['b', 1, false, 1],
      ['c', 1, true, null],
    ]);
  });
});

describe('#181 KK8 rehberden öneriler', () => {
  const yer = (id: string, place_id: string | null, one_cikan_sira: number | null): Yer => ({ id, sehir_id: 's', place_id, ad: id, kategori: 'museum', rehber_md: null, kapak_url: null, one_cikan_sira, lat: 0, lng: 0 });

  it('öne çıkanlar sırasıyla, listedekiler ve place_id\'siz olanlar hariç, en çok 6', () => {
    const yerler = [yer('c', 'pc', 3), yer('a', 'pa', 1), yer('liste', 'p-m1', 2), yer('kimliksiz', null, 0), yer('sirasiz', 'ps', null)];
    expect(rehberOnerileri(yerler, [mekan('m1', 'museum')]).map((y) => y.id)).toEqual(['a', 'c']);
    const cok = Array.from({ length: 9 }, (_, i) => yer(`y${i}`, `p${i}`, i));
    expect(rehberOnerileri(cok, [])).toHaveLength(6);
  });

  it('öne çıkan işaretli yer yoksa şehrin diğer yayınlı yerleri', () => {
    expect(rehberOnerileri([yer('a', 'pa', null), yer('b', 'pb', null)], []).map((y) => y.id)).toEqual(['a', 'b']);
  });
});

describe('#181 KK12 grup durumu', () => {
  const uye = (user_id: string): Uye => ({ trip_id: 't', user_id, guest: false, display_name: user_id, role: 'member', joined_at: '' });

  it('diğer üyelerin son 12 saatteki son varışı; yoksa konum paylaşmıyor', () => {
    const duraklar = [
      durak('d1', 'g1', 'm1', 'a0', { arrived_by: 'ayse', arrived_at: '2026-10-14T08:40:00Z' }),
      durak('d2', 'g1', 'm2', 'a1', { arrived_by: 'ayse', arrived_at: '2026-10-14T06:00:00Z' }),
      durak('d3', 'g1', 'm3', 'a2', { arrived_by: 'mert', arrived_at: '2026-10-13T18:00:00Z' }),
    ];
    const d = grupDurumlari([uye('ben'), uye('ayse'), uye('mert')], 'ben', duraklar, AN);
    expect(d.map((x) => [x.uye.user_id, x.varis?.mekanId ?? null])).toEqual([
      ['ayse', 'm1'],
      ['mert', null],
    ]);
  });
});
