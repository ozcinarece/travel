import { describe, expect, it } from '@jest/globals';

import { degisiklikGruplari } from '@/features/program/degisiklikMetni';
import type { Degisiklik } from '@/lib/tipler';
import { yerelAn } from '@/lib/zaman';

import { enYakinGun, kapanisSecenekleri, kapanisZamani, okunduMu, oylamaOzeti, sistemSatirlari, tarihEtiketi, zamanCizelgesi, type Mesaj, type Oylama } from '../sohbet';

const IST = 'Europe/Istanbul';
const d = (id: number, at: string, ek: Partial<Degisiklik> = {}): Degisiklik => ({ id, user_id: 'mert', entity: 'stops', entity_id: `s${id}`, field: 'day_id', old: 'g1', new: 'g2', at, ...ek });
const mesaj = (id: string, created_at: string, ek: Partial<Mesaj> = {}): Mesaj => ({ id, trip_id: 't', user_id: 'ayse', tur: 'metin', metin: id, place_id: null, oylama_id: null, foto_yolu: null, created_at, silindi_at: null, ...ek });

describe('#184 KK4 sistem satırı birleştirme', () => {
  it('aynı kişinin 2 dk içindeki değişiklikleri tek satır; başka kişi ya da 2 dk sonrası ayrı satır', () => {
    // Yeniden eskiye (changes sorgusu sırası).
    const gruplar = degisiklikGruplari([
      d(6, '2026-10-17T10:05:00Z'),
      d(5, '2026-10-17T10:04:30Z'),
      d(4, '2026-10-17T10:03:10Z'),
      d(3, '2026-10-17T10:03:00Z', { user_id: 'ayse' }),
      d(2, '2026-10-17T10:02:00Z'),
      d(1, '2026-10-17T09:00:00Z'),
    ]);
    const satirlar = sistemSatirlari(gruplar);
    expect(satirlar.map((s) => [s.kim, s.gruplar.map((g) => g.id)])).toEqual([
      ['mert', [6, 5, 4]],
      ['ayse', [3]],
      ['mert', [2]],
      ['mert', [1]],
    ]);
    expect(satirlar[0].at).toBe('2026-10-17T10:05:00Z');
  });

  it('pencere satırın en yenisinden ölçülür (zincirleme uzamaz)', () => {
    const gruplar = degisiklikGruplari([d(3, '2026-10-17T10:03:30Z'), d(2, '2026-10-17T10:02:00Z'), d(1, '2026-10-17T10:00:30Z')]);
    expect(sistemSatirlari(gruplar).map((s) => s.gruplar.length)).toEqual([2, 1]);
  });
});

describe('#184 KK1 zaman çizelgesi', () => {
  it('mesajlar ve sistem satırları eskiden yeniye; her yeni günden önce ayraç (seyahat saat dilimi)', () => {
    const sistem = sistemSatirlari(degisiklikGruplari([d(1, '2026-10-16T15:00:00Z')]));
    // 2026-10-16T21:30Z İstanbul'da 17 Ekim 00:30.
    const c = zamanCizelgesi([mesaj('b', '2026-10-16T21:30:00Z'), mesaj('a', '2026-10-16T15:40:00Z')], sistem, IST);
    expect(c.map((x) => (x.tur === 'ayrac' ? x.tarih : x.tur === 'mesaj' ? x.mesaj.id : 'sistem'))).toEqual(['2026-10-16', 'sistem', 'a', '2026-10-17', 'b']);
  });

  it('tarih etiketi: Bugün · Dün · "Cum 16 Eki"', () => {
    const m = { bugun: 'Bugün', dun: 'Dün' };
    expect(tarihEtiketi('2026-10-17', '2026-10-17', m)).toBe('Bugün');
    expect(tarihEtiketi('2026-10-16', '2026-10-17', m)).toBe('Dün');
    expect(tarihEtiketi('2026-10-16', '2026-10-20', m)).toBe('Cum 16 Eki');
  });
});

describe('#184 KK1 okundu', () => {
  const uyeler = ['ben', 'ayse', 'mert'];
  it('diğer herkes mesajdan sonra okuduysa okundu; biri okumadıysa değil; tek kişilik seyahatte hiç', () => {
    const m = { created_at: '2026-10-17T11:00:00Z' };
    expect(okunduMu(m, [{ user_id: 'ayse', son_okunan_at: '2026-10-17T11:05:00Z' }, { user_id: 'mert', son_okunan_at: '2026-10-17T11:00:00Z' }], uyeler, 'ben')).toBe(true);
    expect(okunduMu(m, [{ user_id: 'ayse', son_okunan_at: '2026-10-17T11:05:00Z' }], uyeler, 'ben')).toBe(false);
    expect(okunduMu(m, [{ user_id: 'ayse', son_okunan_at: '2026-10-17T10:59:00Z' }, { user_id: 'mert', son_okunan_at: '2026-10-17T12:00:00Z' }], uyeler, 'ben')).toBe(false);
    expect(okunduMu(m, [], ['ben'], 'ben')).toBe(false);
  });
});

describe('#184 KK3 oylama', () => {
  const o = (oylar: { secenek_id: string; user_id: string }[], kapanis_at: string | null = null): Oylama => ({
    id: 'o',
    trip_id: 't',
    soru: 'Çibörek mi, balık mı?',
    kapanis_at,
    olusturan: 'ayse',
    created_at: '2026-10-17T11:00:00Z',
    oylama_secenekleri: [
      { id: 'b', oylama_id: 'o', sira: 2, metin: 'Balık', place_id: null },
      { id: 'c', oylama_id: 'o', sira: 1, metin: 'Çibörek', place_id: 'ChIJ-c' },
    ],
    oylama_oylari: oylar,
  });
  const an = new Date('2026-10-17T12:00:00Z');

  it('oran, oy verenler, oy vermeyenler, tek kazanan, benim oyum', () => {
    const oz = oylamaOzeti(o([{ secenek_id: 'c', user_id: 'ayse' }, { secenek_id: 'c', user_id: 'ben' }]), ['ben', 'ayse', 'mert'], 'ben', an);
    expect(oz.secenekler.map((x) => [x.secenek.metin, x.oy, x.oran, x.oyVerenler])).toEqual([
      ['Çibörek', 2, 1, ['ayse', 'ben']],
      ['Balık', 0, 0, []],
    ]);
    expect(oz.kazanan?.id).toBe('c');
    expect(oz.oyVermeyenler).toEqual(['mert']);
    expect(oz.benimOyum).toBe('c');
    expect(oz.kapali).toBe(false);
  });

  it('berabere ya da oy yoksa kazanan yok; kapanış geçtiyse kapalı', () => {
    expect(oylamaOzeti(o([{ secenek_id: 'c', user_id: 'ayse' }, { secenek_id: 'b', user_id: 'ben' }]), ['ben', 'ayse'], 'ben', an).kazanan).toBeNull();
    expect(oylamaOzeti(o([]), ['ben'], 'ben', an).kazanan).toBeNull();
    expect(oylamaOzeti(o([], '2026-10-17T11:59:00Z'), ['ben'], 'ben', an).kapali).toBe(true);
  });

  it('kapanış metni ve seçenekleri (seyahat saat dilimi)', () => {
    // İstanbul 15:00.
    expect(kapanisZamani('2026-10-18T09:00:00Z', an, IST)).toEqual({ gun: 'yarin', tarih: '2026-10-18', saat: "12:00'de" });
    expect(kapanisZamani('2026-10-17T17:00:00Z', an, IST)).toEqual({ gun: 'bugun', tarih: '2026-10-17', saat: "20:00'de" });
    expect(kapanisZamani('2026-10-17T11:00:00Z', an, IST)).toBeNull();
    const yerel = (t: string, dk: number) => yerelAn(t, dk, IST);
    expect(kapanisSecenekleri(an, IST, yerel).map((x) => [x.anahtar, x.an.toISOString()])).toEqual([
      ['saat', '2026-10-17T13:00:00.000Z'],
      ['aksam', '2026-10-17T17:00:00.000Z'],
      ['yarin', '2026-10-18T09:00:00.000Z'],
    ]);
    // 19:45'te "bu akşam" yok.
    expect(kapanisSecenekleri(new Date('2026-10-17T16:45:00Z'), IST, yerel).map((x) => x.anahtar)).toEqual(['saat', 'yarin']);
  });
});

describe('#184 KK2 mekan kartı: en yakın gün', () => {
  it('en yakın durağın günü ve yürüyüş dakikası; durak yoksa null', () => {
    const sn = (a: { lat: number }, b: { lat: number }) => Math.abs(a.lat - b.lat) * 100_000;
    expect(enYakinGun({ lat: 1, lng: 0 }, [{ gunIndex: 2, konum: { lat: 1.01, lng: 0 } }, { gunIndex: 1, konum: { lat: 1.0054, lng: 0 } }], sn)).toEqual({ gunIndex: 1, dk: 9 });
    expect(enYakinGun({ lat: 1, lng: 0 }, [], sn)).toBeNull();
  });
});
