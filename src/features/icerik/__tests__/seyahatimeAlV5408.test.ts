// #408 KK1 · KK6: hazır gezi v6 ve "Seyahatime al" v5 metinleri, sayı ekleri ve yeni gün renkleri.
import { describe, expect, it, jest } from '@jest/globals';

import { geziGunCizgileri, hazirGeziPinleri } from '@/features/icerik/gezi';
import { belirtmeSayi, dahiBaglaci, yonelmeSayi } from '@/lib/ek';
import type { GeziDetay, GeziDuragi } from '@/lib/tipler';
import { yeniGunRengi } from '@/theme';

import type { AktarmaPlani } from '../aktar';
import { durakAlDugmesi, eklenecekGunMetni, goreceklerSatiri, hedefGunMetni, zatenListendeSayisi } from '../seyahatimeAlV5';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('#408 sayı ekleri', () => {
  it('yönelme: son okunan sayıya göre', () => {
    expect([1, 2, 3, 6, 9, 10, 16, 17, 18, 20, 30, 40, 50, 60, 70, 80, 90, 100, 1000].map(yonelmeSayi)).toEqual([
      "1'e",
      "2'ye",
      "3'e",
      "6'ya",
      "9'a",
      "10'a",
      "16'ya",
      "17'ye",
      "18'e",
      "20'ye",
      "30'a",
      "40'a",
      "50'ye",
      "60'a",
      "70'e",
      "80'e",
      "90'a",
      "100'e",
      "1000'e",
    ]);
  });
  it('belirtme: son okunan sayıya göre', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18, 19, 20, 30, 31, 40, 100, 1000].map(belirtmeSayi)).toEqual([
      "1'i",
      "2'yi",
      "3'ü",
      "4'ü",
      "5'i",
      "6'yı",
      "7'yi",
      "8'i",
      "9'u",
      "10'u",
      "18'i",
      "19'u",
      "20'yi",
      "30'u",
      "31'i",
      "40'ı",
      "100'ü",
      "1000'i",
    ]);
  });
  it('"de / da" bağlacı son ünlüye göre', () => {
    expect(['Mert', 'Okan', 'Ayşe', 'bir arkadaşın', 'Burcu'].map(dahiBaglaci)).toEqual(['de', 'da', 'de', 'da', 'da']);
  });
});

describe('#408 KK6 çekmece metinleri', () => {
  it('gün satırı: "Cuma 16\'ya · 7 durak"; tarihsiz "1. güne"', () => {
    expect(hedefGunMetni({ index: 1, date: '2026-10-16' }, 7)).toBe("Cuma 16'ya · 7 durak");
    expect(hedefGunMetni({ index: 2, date: '2026-10-17' }, 6)).toBe("Cumartesi 17'ye · 6 durak");
    expect(hedefGunMetni({ index: 1, date: null }, 7)).toBe('1. güne · 7 durak');
  });
  it('seyahatte olmayan gün: "Seyahate pazar 18\'i ekler"; tarihsiz "3. günü"', () => {
    expect(eklenecekGunMetni({ index: 3, date: '2026-10-18' })).toBe("Seyahate pazar 18'i ekler");
    expect(eklenecekGunMetni({ index: 3, date: null })).toBe('Seyahate 3. günü ekler');
  });
  it('görecekler: benden başkaları, "de / da", ilk iki adlı yüz', () => {
    const uyeler = [
      { user_id: 'ben', display_name: 'Ece' },
      { user_id: 'a', display_name: 'Ayşe' },
      { user_id: 'm', display_name: 'Mert' },
    ];
    expect(goreceklerSatiri(uyeler, 'ben')).toEqual({ metin: 'Ayşe ve Mert de görecek', yuzler: ['A', 'M'] });
    expect(goreceklerSatiri([...uyeler, { user_id: 'o', display_name: 'Okan' }], 'ben')).toEqual({ metin: 'Ayşe, Mert ve Okan da görecek', yuzler: ['A', 'M'] });
    expect(goreceklerSatiri([{ user_id: 'ben', display_name: 'Ece' }, { user_id: 'x', display_name: ' ' }], 'ben')).toEqual({ metin: 'Bir arkadaşın da görecek', yuzler: [] });
    expect(goreceklerSatiri([{ user_id: 'ben', display_name: 'Ece' }], 'ben')).toBeNull();
  });
  it('zaten listende: yalnız seçili günlerden', () => {
    const gezi = { gezi_gunleri: [{ id: 'g1' }, { id: 'g2' }] } as unknown as GeziDetay;
    const ozet = { gunSatirlari: { g1: { mekan: 3, zatenListede: 1 }, g2: { mekan: 2, zatenListede: 2 } } };
    expect(zatenListendeSayisi(gezi, ozet, {})).toBe(3);
    expect(zatenListendeSayisi(gezi, ozet, { g2: false })).toBe(1);
  });
  it('tek düğme: "N durağı al"; seçim yoksa ya da hepsi programdaysa pasif', () => {
    const d = { id: 'x' } as GeziDuragi;
    const plan: AktarmaPlani = { duraklar: [d], atamalar: [{ gunId: 'd1', duraklar: [d] }], listeyeKalan: [] };
    expect(durakAlDugmesi(plan, { yeniDurak: 12, listeyeYeni: 0 })).toEqual({ metin: '12 durağı al', pasif: false });
    expect(durakAlDugmesi(plan, { yeniDurak: 0, listeyeYeni: 0 })).toEqual({ metin: 'Hepsi zaten programında', pasif: true });
    expect(durakAlDugmesi({ duraklar: [], atamalar: [], listeyeKalan: [] }, { yeniDurak: 0, listeyeYeni: 0 })).toEqual({ metin: 'Bir gün seç', pasif: true });
  });
});

describe('#408 KK1 harita: #310 yeni gün renkleri, seçili gün öne çıkar', () => {
  it('renkler sırayla, 7. günde döner', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(yeniGunRengi)).toEqual(['#2350c4', '#7a3fc0', '#b3305e', '#0e6a85', '#6b5a1e', '#3e4a63', '#2350c4']);
  });
  it('seçili gün numaralı, diğerleri %45 nokta; konumsuz durak girmez; çizgiler verilen renkte', () => {
    const durak = (id: string, lat: number | null): GeziDuragi => ({ id, gezi_gun_id: 'g', sira: 1, place_id: null, ad: id, kategori: null, sure_dk: 30, lat, lng: lat === null ? null : 30.5 });
    const gezi = {
      gezi_gunleri: [
        { id: 'g1', sira: 1, gezi_duraklari: [durak('a', 39.7), durak('b', null), durak('c', 39.71)] },
        { id: 'g2', sira: 2, gezi_duraklari: [durak('d', 39.72), durak('e', 39.73)] },
      ],
    } as unknown as GeziDetay;
    const pinler = hazirGeziPinleri(gezi, 1);
    expect(pinler.map((p) => [p.id, p.etiket ?? null, p.renk, p.opaklik ?? 1])).toEqual([
      ['gd:a', null, '#2350c4', 0.45],
      ['gd:c', null, '#2350c4', 0.45],
      ['gd:d', '1', '#7a3fc0', 1],
      ['gd:e', '2', '#7a3fc0', 1],
    ]);
    const cizgiler = geziGunCizgileri(gezi.gezi_gunleri[1].gezi_duraklari, 2, undefined, yeniGunRengi(2));
    expect(cizgiler.map((c) => c.renk)).toEqual(['#7a3fc0']);
  });
});
