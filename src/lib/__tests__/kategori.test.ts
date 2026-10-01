import { describe, expect, it } from '@jest/globals';

import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';

describe('kategori ve süre (PRD §6)', () => {
  it('varsayılan dakika tabloya göre, bilinmeyen 45', () => {
    expect(varsayilanDakika('museum')).toBe(90);
    expect(varsayilanDakika('restaurant')).toBe(75);
    expect(varsayilanDakika('amusement_park')).toBe(240);
    expect(varsayilanDakika('night_club')).toBe(45);
    expect(varsayilanDakika(null)).toBe(45);
  });

  it('etiketler', () => {
    expect(kategoriEtiketi('historical_landmark')).toBe('Tarihi yer');
    expect(kategoriEtiketi('ramen_restaurant')).toBe('ramen restaurant');
    expect(kategoriEtiketi(undefined)).toBe('Mekan');
  });

  it('süre metni', () => {
    expect(sureMetni(45)).toBe('45 dk');
    expect(sureMetni(60)).toBe('1 sa');
    expect(sureMetni(75)).toBe('1,25 sa');
    expect(sureMetni(90)).toBe('1,5 sa');
  });
});
