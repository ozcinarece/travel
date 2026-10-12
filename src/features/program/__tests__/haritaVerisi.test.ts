import { describe, expect, it, jest } from '@jest/globals';

import type { Gun } from '@/lib/tipler';
import type { TempoSonucu } from '@/schedule/tempo';

import type { GunUcNoktalari, Konaklama } from '@/features/konaklama/plan';

import { bolgeHesapla } from '@/components/harita/geo';
import { cizgiAnahtari, yonOklari } from '@/components/harita/rota';

import { otelPinleri, programCizgileri, rotaNoktalari } from '../haritaVerisi';
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
  return programCizgileri({ gunler: [gun], tempolar, seciliGunId: 'g1', seciliNoktalar: noktalar, rotalar, bacak, gecilenBacak: 0 });
}

describe('programCizgileri (#51)', () => {
  it('bacak kimliği sıradan değil uçlardan türer', () => {
    const once = cizgiler([H, A, B, C, H], {}).map((c) => c.id);
    const sonra = cizgiler([H, A, C, B, H], {}).map((c) => c.id);
    // #77: kimlik rota gelsin gelmesin aynı (':kus' / ':yol' eki yok) — aynı Polyline yerinde güncellenir.
    expect(once).toEqual(['rota:g1:hotel>A', 'rota:g1:A>B', 'rota:g1:B>C', 'rota:g1:C>hotel']);
    expect(sonra).toEqual(['rota:g1:hotel>A', 'rota:g1:A>C', 'rota:g1:C>B', 'rota:g1:B>hotel']);
  });

  it('önbellekteki bacak gerçek yol, eksik bacak kuş uçuşu kesikli; etiket kendi bacağında', () => {
    const rotalar: RotaHaritasi = { 'A>B': rota('A', 'B') };
    const c = cizgiler([H, A, C, B, H], rotalar);
    // Yeni sırada A>B yok: eski bacağın polyline'ı kullanılmaz.
    expect(c.every((x) => x.kesik && x.ince)).toBe(true);
    expect(c[1].noktalar).toEqual([{ lat: A.lat, lng: A.lng }, { lat: C.lat, lng: C.lng }]);

    const d = cizgiler([H, A, B, C, H], rotalar);
    expect(d[1].id).toBe('rota:g1:A>B');
    // Kuş uçuşundan gerçek yola geçişte kimlik değişmez (#77).
    expect(d[1].id).toBe(c.find((x) => x.id === 'rota:g1:A>B')?.id ?? cizgiler([H, A, B, C, H], {})[1].id);
    expect(d[1].kesik).toBeFalsy();
    // #95 (docs/05 v1.9): yürüyüş bacağında da hap — "33 dk" + yuru glifi, rota tonunda hap rengi.
    expect(d[1].etiket).toBe('33 dk');
    expect(d[1].etiketIkon).toBe('yuru');
    expect(d[1].etiketRenk).toBe('#1f4fc2');
    const taksili: RotaHaritasi = { 'A>B': { ...rota('A', 'B'), mode: 'DRIVE', drive_seconds: 14 * 60 } };
    const e = cizgiler([H, A, B, C, H], taksili);
    // #65: araba bacağı düz (kesik değil), oksuz (arac), hap ikonu araba.
    expect(e[1].kesik).toBeFalsy();
    expect(e[1].arac).toBe(true);
    expect(e[1].etiket).toBe('14 dk');
    expect(e[1].etiketIkon).toBe('araba');
    // Kuş uçuşu bacağında da hap ("~" kestirim), geçilen bacakta yok.
    expect(c[0].etiket).toMatch(/^~\d+ dk$/);
    expect(c[0].etiketIkon).toBe('yuru');
    const gecilmis = programCizgileri({ gunler: [gun], tempolar, seciliGunId: 'g1', seciliNoktalar: [H, A, B, C, H], rotalar, bacak, gecilenBacak: 2 });
    expect(gecilmis.slice(0, 2).every((x) => x.etiket === undefined)).toBe(true);
    expect(gecilmis.slice(2).every((x) => !!x.etiket)).toBe(true);
    // #61 §5: örnek polyline pinlerden çok uzakta (Kaliforniya) → sapma kontrolü düz çizgiye düşürür; yol kimliği kalır.
    expect(d[1].noktalar).toEqual([{ lat: A.lat, lng: A.lng }, { lat: B.lat, lng: B.lng }]);
  });
});

describe('#88: rota gelmiş bacakta oklar + ayrı Polyline anahtarı', () => {
  it('kuş uçuşunda ok yok ve anahtar |kus; rota gelince anahtar |yol ve ok sayısı > 0', () => {
    const noktalar = [H, A, B];
    const bolge = bolgeHesapla({ lat: 41.9, lng: 12.49 }, 0.02, 0.01, 15);
    const ekran = { genislik: 400, yukseklik: 800 };
    const kus = cizgiler(noktalar, {});
    expect(kus.every((x) => x.kesik)).toBe(true);
    expect(yonOklari(kus, [], bolge, ekran)).toHaveLength(0);
    // Pinlere yakın gerçek yol (uçlar pinlerde; tek ara nokta).
    const yol = kodla([{ lat: A.lat, lng: A.lng }, { lat: 41.903, lng: 12.49 }, { lat: B.lat, lng: B.lng }]);
    const rotali = cizgiler(noktalar, { 'A>B': { ...rota('A', 'B'), polyline: yol } });
    const ab = rotali.find((x) => x.id === 'rota:g1:A>B')!;
    expect(ab.kesik).toBeFalsy();
    expect(ab.ince).toBeFalsy();
    expect(cizgiAnahtari(ab)).toBe('rota:g1:A>B|yol');
    expect(cizgiAnahtari(kus.find((x) => x.id === 'rota:g1:A>B')!)).toBe('rota:g1:A>B|kus');
    expect(yonOklari([ab], [], bolge, ekran).length).toBeGreaterThan(0);
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
      ['otel:stay:y', 0.45],
    ]);
    // Taşınma günü iki otel de tam renk.
    expect(otelPinleri(gunlerIki, uclar, 'g2').map((p) => p.opaklik)).toEqual([1, 1]);
  });

  it('otelsiz seyahatte pin yok', () => {
    expect(otelPinleri(gunlerIki, new Map(), 'g1')).toEqual([]);
  });
});

describe('programCizgileri diğer günler (#91 A)', () => {
  it('seçili olmayan günler için HİÇBİR çizgi üretilmez (düz, ince ya da kuş uçuşu yok); seçili gün olduğu gibi', () => {
    const tp = new Map<string, TempoSonucu>([
      ['g1', { sira: ['a', 'b'] } as unknown as TempoSonucu],
      ['g2', { sira: ['c'] } as unknown as TempoSonucu],
      ['g3', { sira: ['d', 'e', 'f'] } as unknown as TempoSonucu],
    ]);
    // g1 seçili: yalnız g1'in bacakları (otel → A → B → otel), g2 ve g3'ten tek çizgi yok.
    const c = programCizgileri({ gunler: gunlerIki, tempolar: tp, seciliGunId: 'g1', seciliNoktalar: [H, A, B, H], rotalar: {}, bacak, gecilenBacak: 0 });
    expect(c.map((x) => x.id)).toEqual(['rota:g1:hotel>A', 'rota:g1:A>B', 'rota:g1:B>hotel']);
    expect(c.every((x) => x.id.startsWith('rota:g1:'))).toBe(true);
    // Boş gün seçili (g2'nin noktaları yok): hiç çizgi yok — diğer günlerin rotası da, kuş uçuşu da.
    const bos = programCizgileri({ gunler: gunlerIki, tempolar: tp, seciliGunId: 'g2', seciliNoktalar: [], rotalar: {}, bacak, gecilenBacak: 0 });
    expect(bos).toEqual([]);
    // Seçili gün yokken de çizgi yok.
    expect(programCizgileri({ gunler: gunlerIki, tempolar: tp, seciliGunId: undefined, seciliNoktalar: [], rotalar: {}, bacak, gecilenBacak: 0 })).toEqual([]);
  });
});

// #61 §5: Google yolu pinlere bağlanır; dolambaçlı / kopuk yolda düz çizgi.
describe('rotaNoktalari (#61)', () => {
  const a = { lat: 41.9, lng: 12.49 };
  const z = { lat: 41.901, lng: 12.491 };
  // Google örneği: (38.5,-120.2) → (40.7,-120.95) → (43.252,-126.453) — pinlerden çok uzak, 3 nokta.
  it('uçları pinlerden uzak / dolambaçlı yol → düz çizgi', () => {
    expect(rotaNoktalari(POLY, a, z)).toEqual([a, z]);
  });
  it('pinlere yakın yol: uçlara düz parça eklenir, yol korunur', () => {
    // a'dan 10 m, z'den 10 m uzakta başlayıp biten iki noktalı yol.
    const yol = kodla([
      { lat: a.lat + 0.00009, lng: a.lng },
      { lat: z.lat - 0.00009, lng: z.lng },
    ]);
    const n = rotaNoktalari(yol, a, z);
    expect(n).toHaveLength(4);
    expect(n[0]).toEqual(a);
    expect(n[3]).toEqual(z);
  });
  it('#88 KK2: 50 m bacakta 600 m dolambaç → düz; 140 m makul yol korunur', () => {
    const b = { lat: 41.9, lng: 12.49 };
    const c = { lat: 41.90045, lng: 12.49 }; // ~50 m kuzey
    // Dolambaç: doğuya 250 m, kuzeye 50 m, batıya 250 m (~550–600 m).
    const dolambac = kodla([b, { lat: 41.9, lng: 12.493 }, { lat: 41.90045, lng: 12.493 }, c]);
    expect(rotaNoktalari(dolambac, b, c)).toEqual([b, c]);
    // Makul: doğuya 45 m, kuzeye 50 m, batıya 45 m (~140 m ≤ 150 m).
    const makul = kodla([b, { lat: 41.9, lng: 12.49054 }, { lat: 41.90045, lng: 12.49054 }, c]);
    expect(rotaNoktalari(makul, b, c).length).toBeGreaterThan(2);
  });
  it('yol tam pinlerde başlıyorsa ek nokta yok; boş polyline → düz çizgi', () => {
    expect(rotaNoktalari(kodla([a, z]), a, z)).toHaveLength(2);
    expect(rotaNoktalari('', a, z)).toEqual([a, z]);
  });
});

/** Test yardımcısı: Google kodlu polyline (hassasiyet 1e-5). */
function kodla(noktalar: { lat: number; lng: number }[]): string {
  let s = '';
  let lat = 0;
  let lng = 0;
  const sayi = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let c = '';
    while (n >= 0x20) {
      c += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return c + String.fromCharCode(n + 63);
  };
  for (const p of noktalar) {
    const la = Math.round(p.lat * 1e5);
    const ln = Math.round(p.lng * 1e5);
    s += sayi(la - lat) + sayi(ln - lng);
    lat = la;
    lng = ln;
  }
  return s;
}
