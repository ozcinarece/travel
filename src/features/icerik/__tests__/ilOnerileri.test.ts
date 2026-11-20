// #401 KK5 (`Ekran07cIlOnerileri`): il önerilerinin uygulama kuralları — slug, dolu kategoriler, sekmeye göre süzme (sıra
// her zaman `sira`), alt satır (5 km ve altında km yok), eklenebilirlik, "Yakındaki diğer yerler" süzgeci.
import { describe, expect, it, jest } from '@jest/globals';

import { doluKategoriler, eklenebilir, googleAltSatiri, ilSlugu, ilYeriAltSatiri, ilYeriMekani, sekmeyeGore, YAKIN_CIP, yakindakiDigerleri, type IlYeri } from '../ilOnerileri';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const yer = (sira: number, kategori: IlYeri['kategori'], ek: Partial<IlYeri> = {}): IlYeri => ({
  id: `y${sira}`,
  sira,
  ad: `Yer ${sira}`,
  kategori,
  ilce: 'Merkez',
  merkeze_km: null,
  neden: null,
  place_id: `p${sira}`,
  primary_type: null,
  lat: 40.7,
  lng: 31.6,
  ...ek,
});

describe('#401 il önerileri (uygulama)', () => {
  it('il slug: rehber şehrinin slug’ı, yoksa şehir adından', () => {
    expect(ilSlugu({ slug: 'bolu' }, 'Bolu')).toBe('bolu');
    expect(ilSlugu(undefined, 'Çanakkale, Türkiye')).toBe('canakkale');
    expect(ilSlugu(undefined, 'Şanlıurfa')).toBe('sanliurfa');
    expect(ilSlugu(undefined, '')).toBeNull();
  });

  it('dolu kategoriler BO süzgeç sırasıyla (Doğa · Yemek · Tarih · Müze · Çarşı · Aktivite · Tatlı ve kahve · Manzara)', () => {
    const liste = [yer(1, 'manzara'), yer(2, 'tatli_kahve'), yer(3, 'muze'), yer(4, 'doga'), yer(5, 'tarih'), yer(6, 'doga')];
    expect(doluKategoriler(liste)).toEqual(['doga', 'tarih', 'muze', 'tatli_kahve', 'manzara']);
    expect(doluKategoriler([])).toEqual([]);
  });

  it('sekme listeyi süzer; sıra her zaman sira', () => {
    const liste = [yer(3, 'doga'), yer(1, 'doga'), yer(2, 'yemek')];
    expect(sekmeyeGore(liste, null).map((y) => y.sira)).toEqual([1, 2, 3]);
    expect(sekmeyeGore(liste, 'doga').map((y) => y.sira)).toEqual([1, 3]);
    expect(sekmeyeGore(liste, 'muze')).toEqual([]);
  });

  it('alt satır "Kategori · İlçe · N km"; 5 km ve altında km yazmaz; ilçe yoksa atlanır', () => {
    expect(ilYeriAltSatiri({ kategori: 'doga', ilce: 'Mudurnu', merkeze_km: 31.4 })).toBe('Doğa · Mudurnu · 31 km');
    expect(ilYeriAltSatiri({ kategori: 'doga', ilce: 'Merkez', merkeze_km: 5 })).toBe('Doğa · Merkez');
    expect(ilYeriAltSatiri({ kategori: 'tatli_kahve', ilce: null, merkeze_km: 12 })).toBe('Tatlı ve kahve · 12 km');
    expect(ilYeriAltSatiri({ kategori: 'carsi', ilce: 'Merkez', merkeze_km: null })).toBe('Çarşı · Merkez');
  });

  it('kimliği ya da konumu olmayan yer listeye eklenemez; eklenebilen puansız, rehber kaydı', () => {
    expect(eklenebilir(yer(1, 'doga', { place_id: null }))).toBe(false);
    expect(eklenebilir(yer(1, 'doga', { lat: null, lng: null }))).toBe(false);
    expect(ilYeriMekani(yer(1, 'doga', { place_id: null }), null)).toBeNull();
    const m = ilYeriMekani(yer(1, 'yemek', { primary_type: 'restaurant' }), 'https://foto');
    expect(m).toMatchObject({ place_id: 'p1', ad: 'Yer 1', puan: null, neden: 'rehber', foto_uri: 'https://foto', dakika: 75 });
  });

  it('Yakındaki diğer yerler: il listesindekiler ve konaklama çıkar, popülerlik sırası; sekmenin kümesi', () => {
    const g = (id: string, puan: number, sayi: number, tip = 'park') => ({ place_id: id, ad: id, lat: 40.7, lng: 31.6, primary_type: tip, tz: null, puan, puan_sayisi: sayi, acik: null, ulke_kodu: null });
    const sonuc = yakindakiDigerleri([g('p1', 5, 900), g('a', 4.2, 50), g('b', 4.6, 800), g('otel', 4.9, 999, 'hotel')], new Set(['p1']));
    expect(sonuc.map((y) => y.place_id)).toEqual(['b', 'a']);
    expect(YAKIN_CIP.hepsi).toBe('gormen');
    expect(YAKIN_CIP.tatli_kahve).toBe('kafe');
  });

  it('Google satırı "Kategori · ★ puan · N km" (merkeze kuş uçuşu)', () => {
    const y = { primary_type: 'park', puan: 4.5, lat: 40.7, lng: 31.6 };
    expect(googleAltSatiri(y, { lat: 40.7, lng: 31.6355 })).toMatch(/★ 4,5 · 3 km$/);
    expect(googleAltSatiri({ ...y, puan: null }, null)).not.toMatch(/★|km/);
  });
});
