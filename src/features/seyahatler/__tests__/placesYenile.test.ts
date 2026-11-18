import { describe, expect, it } from '@jest/globals';

import {
  ART_ARDA_HATA,
  AYLIK_SINIR,
  bosaltilanToplami,
  bosSonuc,
  KONUM_MASKESI,
  konumAyikla,
  ozetSatiri,
  placeIdGecerli,
  TUR_BASINA,
  turKesildi,
} from '../../../../supabase/functions/_shared/placesYenile';

describe('#262 places koordinat yenilemesi', () => {
  it('yalnız `location` istenir (Place Details Essentials; ad, puan, saat gelmez)', () => {
    expect(KONUM_MASKESI).toBe('location');
  });

  it('aylık sınır 8.000; günlük tur 30 günde sınırı aşamaz', () => {
    expect(AYLIK_SINIR).toBe(8000);
    expect(TUR_BASINA * 31).toBeLessThanOrEqual(AYLIK_SINIR);
  });

  it('place_id yol olarak kullanılacağı için yalnız harf, rakam, `_` ve `-` kabul edilir', () => {
    expect(placeIdGecerli('ChIJ_abc-123')).toBe(true);
    expect(placeIdGecerli('')).toBe(false);
    expect(placeIdGecerli('../x')).toBe(false);
    expect(placeIdGecerli('a/b')).toBe(false);
    expect(placeIdGecerli('a?fields=*')).toBe(false);
    expect(placeIdGecerli('x'.repeat(301))).toBe(false);
    expect(placeIdGecerli(null)).toBe(false);
    expect(placeIdGecerli(42)).toBe(false);
  });

  it('koordinat Google cevabından alınır; eksik ya da aralık dışıysa null', () => {
    expect(konumAyikla({ location: { latitude: 40.18, longitude: 29.06 } })).toEqual({ lat: 40.18, lng: 29.06 });
    expect(konumAyikla({})).toBeNull();
    expect(konumAyikla(null)).toBeNull();
    expect(konumAyikla({ location: { latitude: '40', longitude: 29 } })).toBeNull();
    expect(konumAyikla({ location: { latitude: 91, longitude: 29 } })).toBeNull();
    expect(konumAyikla({ location: { latitude: 40, longitude: -181 } })).toBeNull();
    expect(konumAyikla({ location: { latitude: Number.NaN, longitude: 29 } })).toBeNull();
  });

  it('özet satırında yalnız sayı var; sınır dolunca açıkça yazılır', () => {
    expect(ozetSatiri({ ...bosSonuc(), aday: 67, yenilenen: 66, satir: 67, bulunamadi: 1 })).toBe(
      'aday 67 · yenilenen 66 · satır 67 · bulunamadı 1 · boşaltılan 0 · hata 0',
    );
    expect(ozetSatiri({ ...bosSonuc(), aday: 250, durdu: true })).toContain('AYLIK SINIR DOLDU');
    expect(ozetSatiri({ aday: 'ChIJ' as unknown as number })).toContain('aday ?');
  });

  it('boşaltma cevabı: dört kaynağın toplamı; bozuk cevapta 0', () => {
    expect(bosaltilanToplami([{ yer: 3, seyahat: 1, otel: 0, konaklama: 2 }])).toBe(6);
    expect(bosaltilanToplami({ yer: 1 })).toBe(1);
    expect(bosaltilanToplami([{ yer: '3', seyahat: -1 }])).toBe(0);
    expect(bosaltilanToplami(null)).toBe(0);
  });

  it('#318 inceleme 2: Google hatalarıyla kesilen turda toplu boşaltma yapılmaz', () => {
    // Anahtar eksik ya da kota: art arda 5 hata, hiç sonuç yok → kesildi.
    expect(turKesildi({ artArda: ART_ARDA_HATA, googleHatasi: 5, yenilenen: 0, bulunamadi: 0 })).toBe(true);
    // Az aday, hepsi Google hatası → kesildi (5'e ulaşmasa da).
    expect(turKesildi({ artArda: 2, googleHatasi: 2, yenilenen: 0, bulunamadi: 0 })).toBe(true);
    // Arada başarılı yenileme var, sonda tek hata → kesilmedi.
    expect(turKesildi({ artArda: 1, googleHatasi: 1, yenilenen: 40, bulunamadi: 0 })).toBe(false);
    // Yalnız 404'ler → Google çalışıyor, kesilmedi.
    expect(turKesildi({ artArda: 0, googleHatasi: 0, yenilenen: 0, bulunamadi: 3 })).toBe(false);
    // Hiç hata yok → kesilmedi.
    expect(turKesildi({ artArda: 0, googleHatasi: 0, yenilenen: 10, bulunamadi: 0 })).toBe(false);
    // Başarılardan sonra art arda 5 hata → yine kesildi (anahtar tur ortasında düştü).
    expect(turKesildi({ artArda: ART_ARDA_HATA, googleHatasi: 5, yenilenen: 12, bulunamadi: 0 })).toBe(true);
  });

  it('#318 inceleme 2: kesilen tur özet satırında görünür', () => {
    expect(bosSonuc().kesildi).toBe(false);
    expect(ozetSatiri({ ...bosSonuc(), hatali: 5, kesildi: true })).toContain('KESİLDİ, toplu boşaltma ertelendi');
    expect(ozetSatiri(bosSonuc())).not.toContain('KESİLDİ');
  });
});
