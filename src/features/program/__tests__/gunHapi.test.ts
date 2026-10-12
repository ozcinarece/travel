import { describe, expect, it, jest } from '@jest/globals';

import type { Durak, Gun } from '@/lib/tipler';

import { gunHapiVerisi, pinDokunusu } from '../gunHapi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({}) }));

const durak = (day_id: string): Durak => ({ id: `d-${day_id}`, day_id, place_ref: 'm1' } as unknown as Durak);
const gunler = [
  { id: 'g1', index: 1, date: '2026-10-16' },
  { id: 'g2', index: 2, date: '2026-10-18' },
  { id: 'g3', index: 3, date: null },
] as unknown as Gun[];

describe('pinDokunusu (#91 B KK1–3)', () => {
  it('atanmamış mekan: gün seçiliyse hızlı ekle, değilse panel', () => {
    expect(pinDokunusu({ durak: undefined, seciliGunId: 'g1', gunSecili: true, hapAcikMekanId: null, mekanId: 'm1' })).toEqual({ tur: 'hizliEkle' });
    expect(pinDokunusu({ durak: undefined, seciliGunId: undefined, gunSecili: false, hapAcikMekanId: null, mekanId: 'm1' })).toEqual({ tur: 'panel' });
  });
  it('seçili günün durağı: durak kartı (#99; hap açık olsa da)', () => {
    expect(pinDokunusu({ durak: durak('g1'), seciliGunId: 'g1', gunSecili: true, hapAcikMekanId: 'm1', mekanId: 'm1' })).toEqual({ tur: 'kart' });
  });
  it('diğer günün noktası: önce hap; hap açıkken aynı noktaya ikinci dokunuş "Güne git"; başka nokta yeni hap', () => {
    expect(pinDokunusu({ durak: durak('g2'), seciliGunId: 'g1', gunSecili: true, hapAcikMekanId: null, mekanId: 'm1' })).toEqual({ tur: 'hapAc' });
    expect(pinDokunusu({ durak: durak('g2'), seciliGunId: 'g1', gunSecili: true, hapAcikMekanId: 'm1', mekanId: 'm1' })).toEqual({ tur: 'guneGit', gunId: 'g2' });
    expect(pinDokunusu({ durak: durak('g2'), seciliGunId: 'g1', gunSecili: true, hapAcikMekanId: 'm9', mekanId: 'm1' })).toEqual({ tur: 'hapAc' });
  });
});

describe('gunHapiVerisi (#91 B KK1)', () => {
  const konum = { lat: 39.78, lng: 30.5 };
  it('"Cum 16 · Odunpazarı Evleri", gün rengi, pin kimliği m:<mekan>; tarihsiz günde "3. gün"', () => {
    const h = gunHapiVerisi({ mekanId: 'm1', durak: durak('g1'), konum, gunler, seciliGunId: 'g2', hafif: { ad: 'Odunpazarı Evleri' } as never, dugme: 'Güne git' });
    expect(h).toEqual({ pinId: 'm:m1', konum, renk: '#2f6fed', metin: 'Cum 16 · Odunpazarı Evleri', dugme: 'Güne git' });
    expect(gunHapiVerisi({ mekanId: 'm1', durak: durak('g3'), konum, gunler, seciliGunId: 'g1', hafif: undefined, dugme: 'Güne git' })?.metin).toBe('3. gün');
  });
  it('hap yok: mekan yok, durak seçili güne geçti, durak silindi, gün bulunamadı', () => {
    expect(gunHapiVerisi({ mekanId: null, durak: durak('g1'), konum, gunler, seciliGunId: 'g2', hafif: undefined, dugme: '' })).toBeNull();
    expect(gunHapiVerisi({ mekanId: 'm1', durak: durak('g2'), konum, gunler, seciliGunId: 'g2', hafif: undefined, dugme: '' })).toBeNull();
    expect(gunHapiVerisi({ mekanId: 'm1', durak: undefined, konum, gunler, seciliGunId: 'g2', hafif: undefined, dugme: '' })).toBeNull();
    expect(gunHapiVerisi({ mekanId: 'm1', durak: durak('gX'), konum, gunler, seciliGunId: 'g2', hafif: undefined, dugme: '' })).toBeNull();
  });
});
