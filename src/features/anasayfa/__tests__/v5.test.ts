// #361 ana sayfa v5: sekme amaçları (KK6), kart alt satırı (KK7), üst satır (KK3 · KK4), ana arama (KK5).
import { describe, expect, it } from '@jest/globals';

import type { Siniflar } from '@/features/seyahatler/siniflandir';
import type { SeyahatOzet } from '@/lib/tipler';

import { AKIS_AMACLARI } from '@/features/icerik/amaclar';
import { amacTonlari } from '@/theme';

import { anaArama, kapakTonu, kartAltSatiri, sekmeAmaclari, ustSatir } from '../v5';

const g = (amaclar: string[]) => ({ amaclar });

describe('#361 KK6 sekmeAmaclari', () => {
  it('yalnız en az 2 gezisi olan amaçlar, sabit sırayla', () => {
    expect(sekmeAmaclari([g(['lezzet', 'doga']), g(['lezzet', 'kultur_tarih']), g(['kultur_tarih']), g(['doga'])])).toEqual(['kultur_tarih', 'lezzet', 'doga']);
  });
  it('en çok 4 amaç', () => {
    const hepsi = ['kultur_tarih', 'lezzet', 'doga', 'yavas', 'gece', 'cocuklu'];
    expect(sekmeAmaclari([g(hepsi), g(hepsi)])).toEqual(['kultur_tarih', 'lezzet', 'doga', 'yavas']);
  });
  it("2'den az dolu amaç varsa sekme yok", () => {
    expect(sekmeAmaclari([g(['lezzet']), g(['lezzet']), g(['doga'])])).toEqual([]);
    expect(sekmeAmaclari([])).toEqual([]);
  });
});

describe('#361 KK7 kartAltSatiri', () => {
  it('günlerden hesaplanır', () => {
    expect(kartAltSatiri({ gun_sayisi: 9, mekan_sayisi: 99, gunDuraklari: [7, 7, 6] })).toBe('3 gün · 20 durak · Tripmate rehberi');
  });
  it('gün verisi yoksa gezinin sayaçları', () => {
    expect(kartAltSatiri({ gun_sayisi: 1, mekan_sayisi: 7 })).toBe('1 gün · 7 durak · Tripmate rehberi');
  });
});

const sy = (id: string) => ({ id }) as unknown as SeyahatOzet;
const bos: Siniflar = { aktif: [], yaklasan: [], planlanan: [], yeniBiten: [], gecmis: [] };

describe('#361 KK3 · KK4 ustSatir', () => {
  it('gezi günü satır yok', () => {
    expect(ustSatir({ ...bos, aktif: [sy('a')], yaklasan: [sy('y')] }, true)).toBeNull();
  });
  it('en yakın bitmemiş seyahat: yaklaşan, sonra planlanan', () => {
    expect(ustSatir({ ...bos, yaklasan: [sy('y')], planlanan: [sy('p')] }, false)).toMatchObject({ tur: 'serit', seyahat: { id: 'y' } });
    expect(ustSatir({ ...bos, planlanan: [sy('p')] }, false)).toMatchObject({ tur: 'serit', seyahat: { id: 'p' } });
  });
  it('gezi bitti kartı yalnız açık borç varken; yoksa planlanan', () => {
    expect(ustSatir({ ...bos, yeniBiten: [sy('b')], planlanan: [sy('p')] }, true)).toMatchObject({ tur: 'geziBitti', seyahat: { id: 'b' } });
    expect(ustSatir({ ...bos, yeniBiten: [sy('b')], planlanan: [sy('p')] }, false)).toMatchObject({ tur: 'serit', seyahat: { id: 'p' } });
    expect(ustSatir(bos, true)).toBeNull();
  });
});

describe('#361 KK5 anaArama', () => {
  const geziler = [
    { baslik: "Eskişehir'de üç gün", ozet: 'Odunpazarı, Porsuk ve müzeler', sehirler: { ad: 'Eskişehir' } },
    { baslik: "İzmir'de lezzet günü", ozet: 'Kemeraltı, boyoz ve Kordon', sehirler: { ad: 'İzmir' } },
  ] as never[];
  const sehirler = [
    { id: 's1', ad: 'Eskişehir', gezi_sayisi: 3 },
    { id: 's2', ad: 'İzmir', gezi_sayisi: 1 },
    { id: 's3', ad: 'Ankara', gezi_sayisi: 0 },
  ];
  it("2 harften az: sonuç yok", () => {
    expect(anaArama('e', geziler, sehirler)).toBeNull();
  });
  it('önce eşleşen geziler; rehberli şehre denk gelirse o şehir (Türkçe küçük harf)', () => {
    const r = anaArama('izm', geziler, sehirler)!;
    expect(r.geziler).toHaveLength(1);
    expect(r.sehir).toEqual({ id: 's2', ad: 'İzmir' });
    expect(r.metin).toBeNull();
  });
  it('rehberli olmayan şehir ya da başka metin: metinle kur', () => {
    const r = anaArama(' Ankara ', geziler, sehirler)!;
    expect(r.sehir).toBeNull();
    expect(r.metin).toBe('Ankara');
    expect(r.geziler).toHaveLength(0);
  });
  it('özetten de eşleşir', () => {
    expect(anaArama('boyoz', geziler, sehirler)!.geziler).toHaveLength(1);
  });
});

describe('#361 KK7 kapakTonu (kanvas Ana_v5_Amaclar)', () => {
  it('seçili amaç sekmesi gezinin ilk amacından önce gelir', () => {
    expect(kapakTonu(['lezzet', 'doga'], 'doga')).toBe('doga');
  });
  it('"Hepsi"nde gezinin ilk amacı (BO sırası)', () => {
    expect(kapakTonu(['gece', 'lezzet'], null)).toBe('gece');
  });
  it('amacı yoksa ya da tanınmıyorsa gri (yok)', () => {
    expect(kapakTonu([], null)).toBe('yok');
    expect(kapakTonu(null, null)).toBe('yok');
    expect(kapakTonu(['bilinmeyen'], null)).toBe('yok');
  });
  it('ton tablosu amaç listesiyle birebir ve kanvastaki değerlerde', () => {
    expect(Object.keys(amacTonlari).sort()).toEqual([...AKIS_AMACLARI, 'yok'].sort());
    expect(amacTonlari.lezzet).toEqual({ zemin: '#FFE2CC', tepe: '#FF9A4D', daire: '#C25200' });
    expect(amacTonlari.yok).toEqual({ zemin: '#ECEEF2', tepe: '#C3C9D6', daire: '#4B5563' });
  });
});
