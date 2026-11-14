// #200 KK8: listedeki mekanın ikizi (60 m'den yakın + benzer ad) Keşfet önerisi olarak gösterilmez.
import { describe, expect, it } from '@jest/globals';

import { adBenzer, adSozcukleri, BENZER_YER_M, listedekiBenzerler } from '../benzerYer';

describe('#200 KK8 benzer yer', () => {
  it('ad sözcükleri: küçük harf, aksansız, "tarihi / müzesi" gibi ekler atılır (hepsi ekse kalır)', () => {
    expect(adSozcukleri('Tarihi Odunpazarı Evleri')).toEqual(['odunpazari']);
    expect(adSozcukleri('Odunpazarı Modern Müze (OMM)')).toEqual(['odunpazari', 'modern', 'omm']);
    expect(adSozcukleri('İSTANBUL Şehir Müzesi')).toEqual(['istanbul', 'sehir']);
    expect(adSozcukleri('Müze')).toEqual(['muze']);
  });

  it('ad benzerliği: kapsama ya da yarıdan fazla ortak sözcük; farklı müzeler benzemez', () => {
    expect(adBenzer('Tarihi Odunpazarı Evleri', 'Odunpazarı Evleri')).toBe(true);
    expect(adBenzer('OMM - Odunpazarı Modern Müze', 'Odunpazarı Modern Müze (OMM)')).toBe(true);
    expect(adBenzer('Eskişehir Büyükşehir Belediyesi Hayvanat Bahçesi', 'Sazova Hayvanat Bahçesi')).toBe(false);
    expect(adBenzer('Hayvanat Bahçesi', 'Sazova Hayvanat Bahçesi')).toBe(true);
    expect(adBenzer('Kurtuluş Müzesi', 'Cumhuriyet Tarihi Müzesi')).toBe(false);
    expect(adBenzer('Balmumu Heykeller Müzesi', 'Yılmaz Büyükerşen Balmumu Heykeller Müzesi')).toBe(true);
  });

  it('listede sayılan öneri: 60 m içinde ve adı benzer; uzak ya da adı farklı ya da kimliği aynı değil', () => {
    const liste = [{ place_id: 'P-liste', lat: 39.7826, lng: 30.5196, ad: 'Tarihi Odunpazarı Evleri' }];
    // ~0,0003° enlem ≈ 33 m; ~0,001° ≈ 111 m.
    const oneriler = [
      { place_id: 'P-ikiz', lat: 39.7829, lng: 30.5196, ad: 'Odunpazarı Evleri' },
      { place_id: 'P-uzak', lat: 39.7836, lng: 30.5196, ad: 'Odunpazarı Evleri' },
      { place_id: 'P-komsu', lat: 39.7828, lng: 30.5197, ad: 'Atlıhan El Sanatları Çarşısı' },
      { place_id: 'P-liste', lat: 39.7826, lng: 30.5196, ad: 'Tarihi Odunpazarı Evleri' },
    ];
    expect([...listedekiBenzerler(oneriler, liste)]).toEqual(['P-ikiz']);
    expect(BENZER_YER_M).toBe(60);
    // Listedeki mekanın adı bilinmiyorsa yalnız kimlik süzer.
    expect(listedekiBenzerler(oneriler, [{ ...liste[0], ad: null }]).size).toBe(0);
  });
});
