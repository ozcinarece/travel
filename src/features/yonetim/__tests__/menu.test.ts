import { describe, expect, it } from '@jest/globals';

import { aktifMenu, GIRIS, KOK, kullaniciEtiketi, MENU, YETKIN_YOK, yonetimYonu } from '../menu';
import { ty } from '../metin';

// #106 KK2 (admin kapısı) ve KK4 (menü) — saf kurallar.
describe('yonetimYonu (#106 KK2)', () => {
  const hazir = true;

  it('oturum okunmadan karar vermez', () => {
    expect(yonetimYonu({ hazir: false, hesapli: false, admin: null }, '/yonetim/geziler')).toBeNull();
  });

  it('oturumsuz (ya da misafir) her yoldan girişe; giriş sayfasında kalır', () => {
    expect(yonetimYonu({ hazir, hesapli: false, admin: null }, KOK)).toBe(GIRIS);
    expect(yonetimYonu({ hazir, hesapli: false, admin: null }, YETKIN_YOK)).toBe(GIRIS);
    expect(yonetimYonu({ hazir, hesapli: false, admin: null }, GIRIS)).toBeNull();
  });

  it('admin sonucu beklenirken yönlendirmez', () => {
    expect(yonetimYonu({ hazir, hesapli: true, admin: null }, '/yonetim/ayarlar')).toBeNull();
  });

  it('admin olmayan her yoldan "Yetkin yok"a', () => {
    expect(yonetimYonu({ hazir, hesapli: true, admin: false }, KOK)).toBe(YETKIN_YOK);
    expect(yonetimYonu({ hazir, hesapli: true, admin: false }, GIRIS)).toBe(YETKIN_YOK);
    expect(yonetimYonu({ hazir, hesapli: true, admin: false }, YETKIN_YOK)).toBeNull();
  });

  it('admin giriş / yetkin yok sayfasından köke, diğer sayfalarda kalır', () => {
    expect(yonetimYonu({ hazir, hesapli: true, admin: true }, GIRIS)).toBe(KOK);
    expect(yonetimYonu({ hazir, hesapli: true, admin: true }, YETKIN_YOK)).toBe(KOK);
    expect(yonetimYonu({ hazir, hesapli: true, admin: true }, '/yonetim/geziler')).toBeNull();
  });
});

describe('menü (#106 KK4)', () => {
  it('kanvastaki sıra', () => {
    expect(MENU.map((m) => ty(`menu.${m.anahtar}`))).toEqual([
      'Genel bakış',
      'Geziler',
      'Yerler',
      'Şehirler',
      'Ana sayfa düzeni',
      'Kullanıcılar',
      'Ayarlar',
    ]);
  });

  it('aktif öğe: kök yalnız Genel bakış, alt yollar kendi öğesi', () => {
    expect(aktifMenu('/yonetim')).toBe('genel');
    expect(aktifMenu('/yonetim/')).toBe('genel');
    expect(aktifMenu('/yonetim/geziler')).toBe('geziler');
    expect(aktifMenu('/yonetim/geziler/abc')).toBe('geziler');
    expect(aktifMenu('/yonetim/ana-sayfa')).toBe('anaSayfa');
    expect(aktifMenu('/yonetim/giris')).toBeNull();
    expect(aktifMenu('/yonetim/gezilerx')).toBeNull();
  });

  it('kullanıcı satırı: ad yoksa e-postanın @ öncesi; Türkçe büyük harf', () => {
    expect(kullaniciEtiketi('Ece Özçınar', 'x@y.com')).toEqual({ ad: 'Ece Özçınar', harf: 'E' });
    expect(kullaniciEtiketi(undefined, 'ilknur@ornek.com')).toEqual({ ad: 'ilknur', harf: 'İ' });
    expect(kullaniciEtiketi('  ', undefined)).toEqual({ ad: '', harf: '' });
  });

  it('metinler yonetim.json\'dan, yer tutucu doldurulur', () => {
    expect(ty('rol', { ad: 'Ece' })).toBe('Ece · admin');
    expect(ty('yok.anahtar')).toBe('yok.anahtar');
  });
});
