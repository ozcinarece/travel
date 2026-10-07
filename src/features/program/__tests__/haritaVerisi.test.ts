import { describe, expect, it, jest } from '@jest/globals';

import type { Gun, Mekan } from '@/lib/tipler';
import type { TempoSonucu } from '@/schedule/tempo';

import { programCizgileri } from '../haritaVerisi';
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
  return programCizgileri({ otel, mekanIle: new Map<string, Mekan>(), gunler: [gun], tempolar, seciliGunId: 'g1', seciliNoktalar: noktalar, rotalar, bacak, gecilenBacak: 0 });
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
    expect(d[1].etiket).toBe('33 dk');
    expect(d[1].noktalar.length).toBe(3);
  });
});
