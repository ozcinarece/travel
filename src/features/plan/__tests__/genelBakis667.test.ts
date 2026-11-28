// #667 KK3 · KK4: Plan v13 genel bakış ve gün detayının saf hesapları.
import { describe, expect, it } from '@jest/globals';

import type { HaritaCizgisi } from '@/components/harita/tipler';
import {
  bacakMetniV13,
  ekleyenYuzu,
  genelHaritaVerisi,
  GUN_KAPASITE_SA,
  gunBasligiV13,
  gunDetayOzeti,
  gunHaritasiCizgileri,
  gunKartiAlt,
  gunKartiOzeti,
  saatSayisi,
  yuzRengiV13,
} from '@/features/plan/genelBakis';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { gunRengi, planV13, rotaRengi } from '@/theme';

const gun = (index: number, date: string | null = null): Gun =>
  ({ id: `g${index}`, trip_id: 't', index, date, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null }) as Gun;
const mekan = (id: string, lat: number | null = 38.4, lng: number | null = 27.1): Mekan => ({
  id,
  trip_id: 't',
  place_id: `p-${id}`,
  primary_type: 'museum',
  lat,
  lng,
  google_fetched_at: '',
  default_minutes: 60,
  added_by: null,
  note: null,
  created_at: '',
});
const durak = (id: string, day_id: string, place_ref: string, order_key: string, skipped = false): Durak =>
  ({ id, trip_id: 't', day_id, place_ref, order_key, minutes: 60, arrived_at: null, arrived_by: null, completed_at: null, completed_by: null, auto_completed: false, skipped }) as Durak;

describe('#667 KK3: gün kartı — "K durak · X / 8 sa" ve dolgu', () => {
  it('kanvas örneği: 09:30–14:25 → 5 sa, çubuk 5/8; 3,5 sa → %44', () => {
    const o = gunKartiOzeti(gun(1), { durakSayisi: 4, baslangic: '09:30', bitis: '14:25' });
    expect(o).toEqual({ gunId: 'g1', index: 1, durak: 4, saat: 5, oran: 5 / 8, bos: false });
    expect(gunKartiAlt(o)).toBe('4 durak · 5 / 8 sa');
    const o2 = gunKartiOzeti(gun(2), { durakSayisi: 3, baslangic: '10:00', bitis: '13:35' });
    expect(o2.saat).toBe(3.5);
    expect(Math.round(o2.oran * 100)).toBe(44);
    expect(gunKartiAlt(o2)).toBe('3 durak · 3,5 / 8 sa');
  });

  it('süre yarım saate yuvarlanır; 8 saati aşan gün dolu (oran 1)', () => {
    expect(gunKartiOzeti(gun(1), { durakSayisi: 1, baslangic: '09:00', bitis: '09:44' }).saat).toBe(0.5);
    expect(gunKartiOzeti(gun(1), { durakSayisi: 1, baslangic: '09:00', bitis: '09:46' }).saat).toBe(1);
    const uzun = gunKartiOzeti(gun(1), { durakSayisi: 9, baslangic: '08:00', bitis: '19:10' });
    expect(uzun.saat).toBe(11);
    expect(uzun.oran).toBe(1);
    expect(GUN_KAPASITE_SA).toBe(8);
  });

  it('boş gün: tempo yok ya da durak 0 → bos, oran 0', () => {
    expect(gunKartiOzeti(gun(3), undefined)).toMatchObject({ bos: true, durak: 0, oran: 0 });
    expect(gunKartiOzeti(gun(3), { durakSayisi: 0, baslangic: '09:00', bitis: '09:00' })).toMatchObject({ bos: true });
  });

  it('saat sayısı Türkçe ondalık', () => {
    expect(saatSayisi(5)).toBe('5');
    expect(saatSayisi(3.5)).toBe('3,5');
  });
});

describe('#667 KK3 · KK4: gün başlığı', () => {
  it('"1. gün · Per 7 Ocak"; tarihsiz "1. gün"', () => {
    expect(gunBasligiV13({ index: 1, date: '2027-01-07' })).toBe('1. gün · Per 7 Ocak');
    expect(gunBasligiV13({ index: 3, date: '2027-01-09' })).toBe('3. gün · Cmt 9 Ocak');
    expect(gunBasligiV13({ index: 2, date: null })).toBe('2. gün');
  });
});

describe('#667 KK4: özet satırı ve bacak metni', () => {
  it('"4 durak · 09:30–14:25 · 5,2 km"; bacak yoksa km yok; aralık yoksa yalnız durak', () => {
    expect(gunDetayOzeti({ durak: '4 durak', aralik: '09:30–14:25', metre: 900 + 600 + 3200 + 450 })).toBe('4 durak · 09:30–14:25 · 5,2 km');
    expect(gunDetayOzeti({ durak: '1 durak', aralik: '09:30–10:30', metre: 0 })).toBe('1 durak · 09:30–10:30');
    expect(gunDetayOzeti({ durak: 'Hepsi atlandı', aralik: null, metre: 0 })).toBe('Hepsi atlandı');
    expect(gunDetayOzeti({ durak: '2 durak', aralik: '09:30–11:00', metre: 640 })).toBe('2 durak · 09:30–11:00 · 640 m');
  });

  it('yürüyüşte "12 dk · 900 m", araçta "18 dk · 3,2 km araçla", kestirimde "~"', () => {
    expect(bacakMetniV13({ dk: 12, m: 900, araba: false, kestirim: false })).toBe('12 dk · 900 m');
    expect(bacakMetniV13({ dk: 18, m: 3200, araba: true, kestirim: false })).toBe('18 dk · 3,2 km araçla');
    expect(bacakMetniV13({ dk: 6, m: 450, araba: false, kestirim: true })).toBe('~6 dk · 450 m');
  });
});

describe('#667 KK3: genel bakış haritası', () => {
  const gunler = [gun(2), gun(1), gun(3)];
  const mekanlar = [mekan('a'), mekan('b', 38.41), mekan('c', 38.42), mekan('d', null, null), mekan('e', 38.43)];
  const duraklar = [durak('d1', 'g1', 'a', 'a1'), durak('d0', 'g1', 'b', 'a0'), durak('d2', 'g1', 'e', 'a2', true), durak('d3', 'g2', 'c', 'a0'), durak('d4', 'g2', 'd', 'a1')];

  it('her günün atlanmamış durakları gün renginde numarasız; çizgi sırayla, rota tonunda; atlanan ve koordinatsız yok', () => {
    const v = genelHaritaVerisi({ gunler, duraklar, mekanlar });
    expect(v.pinler.map((p) => p.id)).toEqual(['genel:d0', 'genel:d1', 'genel:d3']);
    expect(v.pinler.every((p) => p.etiket === '' && p.tur === 'durak')).toBe(true);
    expect(v.pinler[0].renk).toBe(gunRengi(1));
    expect(v.pinler[2].renk).toBe(gunRengi(2));
    // 1. gün iki nokta → çizgi (order_key sırası: b, a); 2. günde tek nokta → çizgi yok.
    expect(v.cizgiler).toHaveLength(1);
    expect(v.cizgiler[0]).toMatchObject({ id: 'genel:g1', renk: rotaRengi(1), ince: true });
    expect(v.cizgiler[0].noktalar).toEqual([{ lat: 38.41, lng: 27.1 }, { lat: 38.4, lng: 27.1 }]);
    expect(v.noktalar).toHaveLength(3);
  });

  it('lejant: yalnız haritada noktası olan günler, gün sırasıyla', () => {
    const v = genelHaritaVerisi({ gunler, duraklar, mekanlar });
    expect(v.lejant).toEqual([
      { gunId: 'g1', index: 1, renk: gunRengi(1), etiket: '1. gün' },
      { gunId: 'g2', index: 2, renk: gunRengi(2), etiket: '2. gün' },
    ]);
  });
});

describe('#667 KK4: gün haritası çizgileri ve ekleyenin yüzü', () => {
  it('otel bacakları ve bacak hapları çıkar', () => {
    const c = (id: string): HaritaCizgisi => ({ id, noktalar: [], renk: '#000', etiket: '5 dk', etiketIkon: 'yuru' });
    const sonuc = gunHaritasiCizgileri([c('rota:g1:stay:o1>p-a'), c('rota:g1:p-a>p-b'), c('rota:g1:p-b>stay:o1')]);
    expect(sonuc.map((x) => x.id)).toEqual(['rota:g1:p-a>p-b']);
    expect(sonuc[0].etiket).toBeUndefined();
    expect(sonuc[0].etiketIkon).toBeUndefined();
  });

  it('ekleyen üyenin sırası (yüz rengi üye sırasıyla); ekleyen yoksa ya da üye değilse yüz yok', () => {
    const uyeler = [{ user_id: 'ece' }, { user_id: 'mert' }, { user_id: 'ayse' }, { user_id: 'can' }];
    expect(ekleyenYuzu('mert', uyeler)).toEqual({ uye: { user_id: 'mert' }, sira: 1 });
    expect(ekleyenYuzu(null, uyeler)).toBeNull();
    expect(ekleyenYuzu('yabanci', uyeler)).toBeNull();
    expect(yuzRengiV13(0)).toEqual(planV13.yuzler[0]);
    expect(yuzRengiV13(2)).toEqual({ zemin: '#152A6B', harf: '#FFFFFF' });
    expect(yuzRengiV13(3)).toEqual(planV13.yuzler[0]);
  });
});
