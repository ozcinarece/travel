import { describe, expect, it } from '@jest/globals';

import { bilinenKategori, kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';

describe('kategori ve süre (PRD §6)', () => {
  it('varsayılan dakika tabloya göre, bilinmeyen 45', () => {
    expect(varsayilanDakika('museum')).toBe(90);
    expect(varsayilanDakika('restaurant')).toBe(75);
    expect(varsayilanDakika('amusement_park')).toBe(240);
    expect(varsayilanDakika('night_club')).toBe(45);
    expect(varsayilanDakika(null)).toBe(45);
  });

  it('etiketler', () => {
    expect(kategoriEtiketi('historical_landmark')).toBe('Tarihî yer');
    expect(kategoriEtiketi(undefined)).toBe('Mekan');
    expect(bilinenKategori('historical_landmark')).toBe('Tarihî yer');
    expect(bilinenKategori('train_station')).toBeNull();
    expect(bilinenKategori(null)).toBeNull();
  });

  it('#189 KK4: Nearby turistik tipleri Türkçe', () => {
    expect(kategoriEtiketi('cultural_landmark')).toBe('Kültürel yer');
    expect(kategoriEtiketi('monument')).toBe('Anıt');
    expect(kategoriEtiketi('sculpture')).toBe('Heykel');
    expect(kategoriEtiketi('observation_deck')).toBe('Manzara');
    expect(kategoriEtiketi('art_gallery')).toBe('Galeri');
    expect(kategoriEtiketi('historical_place')).toBe('Tarihî yer');
  });

  it('#189 KK4: etiketsiz tip ham İngilizce ad döndürmez — kategorinin genel adı ya da "Mekan"', () => {
    expect(kategoriEtiketi('ramen_restaurant')).toBe('Yemek');
    expect(kategoriEtiketi('vegan_restaurant')).toBe('Yemek');
    expect(kategoriEtiketi('heritage_site')).toBe('Gezilecek yer');
    expect(kategoriEtiketi('history_museum')).toBe('Müze');
    expect(kategoriEtiketi('city_park')).toBe('Park');
    expect(kategoriEtiketi('buddhist_temple')).toBe('İbadet yeri');
    expect(kategoriEtiketi('guest_house')).toBe('Konaklama');
    expect(kategoriEtiketi('hair_salon')).toBe('Mekan');
    expect(kategoriEtiketi('train_station')).toBe('Mekan');
    for (const tip of ['hair_salon', 'electronics_store', 'car_repair', 'ramen_restaurant', 'heritage_site', 'night_club', 'event_venue', 'brand_new_type']) {
      const etiket = kategoriEtiketi(tip);
      expect(etiket).not.toMatch(/_/);
      expect(etiket).not.toBe(tip.replace(/_/g, ' '));
    }
  });

  it('süre metni', () => {
    expect(sureMetni(45)).toBe('45 dk');
    expect(sureMetni(60)).toBe('1 sa');
    expect(sureMetni(75)).toBe('1 sa 15 dk');
    expect(sureMetni(90)).toBe('1 sa 30 dk');
    // #51: "3,75 sa" → "3 sa 45 dk"; "1,58 sa" → "1 sa 35 dk".
    expect(sureMetni(225)).toBe('3 sa 45 dk');
    expect(sureMetni(95)).toBe('1 sa 35 dk');
    expect(sureMetni(120)).toBe('2 sa');
  });
});
