import { describe, expect, it, jest } from '@jest/globals';

import type { Gun, Mekan } from '@/lib/tipler';
import type { TempoSonucu } from '@/schedule/tempo';

import type { GunUcNoktalari, Konaklama } from '@/features/konaklama/plan';

import { otelPinleri, programCizgileri } from '../haritaVerisi';
import type { MatrisNoktasi, RotaHaritasi } from '../sorgular';

// sorgular.ts → supabase istemcisi (AsyncStorage); saf fonksiyon testinde gerekmez (jest.mock yukarı taşınır).
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({}) }));


// #51: sıra değişince bacaklar yeni sıranın from→to çiftlerinden çizilir; önbellekte olmayan bacak kuş uçuşu kesikli.
const otel = { lat: 41.9, lng: 12.49 };
const A: MatrisNoktasi = { key: 'A', lat: 41.901, lng: 12.48 };
const B: MatrisNoktasi = { key: 'B', lat: 41.905, lng: 12.5 };
const C: MatrisNoktasi = { key: 'C', lat: 41.89, lng: 12.47 };
const H: MatrisNoktasi = { key: 'hotel', ...otel };
const gun = { id: 'g1', index: 1 } as unknown as Gun;
const tempolar = new Map<string, TempoSonucu>([['g1', { sira: ['a', 'b', 'c'] } as unknown as TempoSonucu]]);
const bacak = () => ({ yuruyusSn: 600, taksiSn: null, kestirim: true });
// Google örnek polyline'ı (3 nokta).
const POLY = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const rota = (from: string, to: string) => ({ from_key: from, to_key: to, seconds: 1980, meters: 2400, mode: 'WALK' as const, polyline: POLY, drive_seconds: null, drive_meters: null });

function cizgiler(noktalar: MatrisNoktasi[], rotalar: RotaHaritasi) {
  return programCizgileri({ gunUclari: new Map(), mekanIle: new Map<string, Mekan>(), gunler: [gun], tempolar, seciliGunId: 'g1', seciliNoktalar: noktalar, rotalar, bacak, gecilenBacak: 0 });
}

describe('programCizgileri (#51)', () => {
  it('bacak kimliği sıradan değil uçlardan türer', () => {
    const once = cizgiler([H, A, B, C, H], {}).map((c) => c.id);
    const sonra = cizgiler([H, A, C, B, H], {}).map((c) => c.id);
    expect(once).toEqual(['rota:g1:hotel>A:kus', 'rota:g1:A>B:kus', 'rota:g1:B>C:kus', 'rota:g1:C>hotel:kus']);
    expect(sonra).toEqual(['rota:g1:hotel>A:kus', 'rota:g1:A>C:kus', 'rota:g1:C>B:kus', 'rota:g1:B>hotel:kus']);
  });

  it('önbellekteki bacak gerçek yol, eksik bacak kuş uçuşu kesikli; etiket kendi bacağında', () => {
    const rotalar: RotaHaritasi = { 'A>B': rota('A', 'B') };
    const c = cizgiler([H, A, C, B, H], rotalar);
    // Yeni sırada A>B yok: eski bacağın polyline'ı kullanılmaz.
    expect(c.every((x) => x.id.endsWith(':kus'))).toBe(true);
    expect(c.every((x) => x.kesik)).toBe(true);
    expect(c[1].noktalar).toEqual([{ lat: A.lat, lng: A.lng }, { lat: C.lat, lng: C.lng }]);

    const d = cizgiler([H, A, B, C, H], rotalar);
    expect(d[1].id).toBe('rota:g1:A>B:yol');
    expect(d[1].kesik).toBe(false);
    // #59 §C: yürüyüş bacağında hap yok; taksi bacağında "33 dk".
    expect(d[1].etiket).toBeUndefined();
    const taksili: RotaHaritasi = { 'A>B': { ...rota('A', 'B'), mode: 'DRIVE', drive_seconds: 14 * 60 } };
    const e = cizgiler([H, A, B, C, H], taksili);
    expect(e[1].kesik).toBe(true);
    expect(e[1].etiket).toBe('14 dk');
    expect(e[1].etiketIkon).toBe('taksi');
    expect(d[1].noktalar.length).toBe(3);
  });
});

// #56: gün bazlı otel — pinler ve diğer günlerin rotası.
const kon = (id: string, lat: number, lng: number): Konaklama => ({ id, trip_id: 't', place_id: null, lat, lng, label: null });
const uc = (k: Konaklama | null) => (k ? { key: `stay:${k.id}`, lat: k.lat, lng: k.lng, konaklama: k } : null);
const X = kon('x', 41.9, 12.49);
const Y = kon('y', 41.8, 12.3);
const gunlerIki = [{ id: 'g1', index: 1 }, { id: 'g2', index: 2 }, { id: 'g3', index: 3 }] as unknown as Gun[];
const uclar = new Map<string, GunUcNoktalari>([
  ['g1', { baslangic: uc(X), bitis: uc(X) }],
  ['g2', { baslangic: uc(X), bitis: uc(Y) }],
  ['g3', { baslangic: uc(Y), bitis: uc(Y) }],
]);

describe('otelPinleri (#56)', () => {
  it('aynı otel tek pin; seçili günün otelleri tam, diğerleri soluk', () => {
    const p1 = otelPinleri(gunlerIki, uclar, 'g1');
    expect(p1.map((p) => [p.id, p.opaklik])).toEqual([
      ['otel:stay:x', 1],
      ['otel:stay:y', 0.4],
    ]);
    // Taşınma günü iki otel de tam renk.
    expect(otelPinleri(gunlerIki, uclar, 'g2').map((p) => p.opaklik)).toEqual([1, 1]);
  });

  it('otelsiz seyahatte pin yok', () => {
    expect(otelPinleri(gunlerIki, new Map(), 'g1')).toEqual([]);
  });
});

describe('programCizgileri diğer günler (#56)', () => {
  it('rota günün kendi başlangıç ve bitiş otelini kullanır', () => {
    const mekanIle = new Map<string, Mekan>([['a', { id: 'a', lat: 41.85, lng: 12.4 } as unknown as Mekan]]);
    const tp = new Map<string, TempoSonucu>([['g2', { sira: ['a'] } as unknown as TempoSonucu]]);
    const c = programCizgileri({ gunUclari: uclar, mekanIle, gunler: gunlerIki, tempolar: tp, seciliGunId: 'g1', seciliNoktalar: [], rotalar: {}, bacak, gecilenBacak: 0 });
    expect(c).toHaveLength(1);
    expect(c[0].ince).toBe(true);
    expect(c[0].renk).toBe('#cf5a22');
    expect(c[0].noktalar).toEqual([{ lat: X.lat, lng: X.lng }, { lat: 41.85, lng: 12.4 }, { lat: Y.lat, lng: Y.lng }]);
  });
});
