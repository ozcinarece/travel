// #248 inceleme 2 (UX Ş3): seçenek adı — metin, canlı ad, yükleniyor "…", yedek kategori ve aynı kategoride numara.
import { describe, expect, it, jest } from '@jest/globals';

import { adiCanliYerler, secenekAdlari, yukleniyorMetni, yuklenenSecenekler, type AdBilgisi } from '../oylamaAdlari';
import type { Oylama, OylamaSecenegi } from '../sohbet';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const sc = (id: string, sira: number, metin: string, place_id: string | null): OylamaSecenegi => ({ id, oylama_id: 'o', sira, metin, place_id });
const bilgi = (adlar: Record<string, string>, yuklenen: string[] = [], tipler: Record<string, string> = {}): AdBilgisi => ({
  ad: (p) => adlar[p] ?? null,
  tip: (p) => tipler[p] ?? null,
  yukleniyor: (p) => yuklenen.includes(p),
});

describe('secenekAdlari', () => {
  it('kullanıcı metni olduğu gibi; boş mekan seçeneğinde canlı ad', () => {
    const m = secenekAdlari([sc('a', 1, 'Balık', null), sc('b', 2, '', 'P1')], bilgi({ P1: 'Lokanta' }));
    expect(m.get('a')).toBe('Balık');
    expect(m.get('b')).toBe('Lokanta');
  });
  it('ad yüklenirken kategori değil "…"', () => {
    const m = secenekAdlari([sc('b', 1, '', 'P1')], bilgi({}, ['P1'], { P1: 'restaurant' }));
    expect(m.get('b')).toBe(yukleniyorMetni());
  });
  it('ad gelmezse kategori; tek ise numarasız', () => {
    const m = secenekAdlari([sc('a', 1, '', 'P1'), sc('b', 2, '', 'P2')], bilgi({}, [], { P1: 'restaurant', P2: 'cafe' }));
    expect(m.get('a')).toBe('Restoran');
    expect(m.get('b')).not.toBe('Restoran');
    expect(m.get('b')).not.toMatch(/\d$/);
  });
  it('aynı kategori birden çok kez: sıraya göre "Restoran 1 / Restoran 2"', () => {
    const m = secenekAdlari([sc('b', 2, '', 'P2'), sc('a', 1, '', 'P1'), sc('c', 3, '', 'P3')], bilgi({ P3: 'Lokanta' }, [], { P1: 'restaurant', P2: 'restaurant', P3: 'restaurant' }));
    expect(m.get('a')).toBe('Restoran 1');
    expect(m.get('b')).toBe('Restoran 2');
    expect(m.get('c')).toBe('Lokanta');
  });
});

describe('yuklenenSecenekler', () => {
  it('yalnız adı yüklenen mekan seçenekleri (metinli ya da adı gelmiş olan değil)', () => {
    const y = yuklenenSecenekler([sc('a', 1, 'Balık', null), sc('b', 2, '', 'P1'), sc('c', 3, '', 'P2')], bilgi({ P2: 'Lokanta' }, ['P1', 'P2']));
    expect([...y]).toEqual(['b']);
  });
});

describe('adiCanliYerler', () => {
  it('yalnız metni boş mekan seçenekleri; tekil ve sıralı (Sohbet ve Gezi aynı anahtar)', () => {
    const o = (id: string, s: OylamaSecenegi[]): Oylama => ({ id, trip_id: 't', soru: '', kapanis_at: null, olusturan: null, created_at: '', oylama_secenekleri: s, oylama_oylari: [] });
    expect(adiCanliYerler([o('1', [sc('a', 1, '', 'P2'), sc('b', 2, 'Kendi adım', 'P9'), sc('c', 3, 'Balık', null)]), o('2', [sc('d', 1, '', 'P1'), sc('e', 2, '', 'P2')])])).toEqual(['P1', 'P2']);
  });
});
