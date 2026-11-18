// #316: Yer ekle oturumunun ücretli Google istekleri — KK1 (çekmece fotoğrafı Nearby'nin `photos` alanından, ayrıca Details
// yok) ve KK2 (Autocomplete oturumunu panelin places-full isteği kapatır, aynı yer için ikinci Details yok). Sahte uçlar
// sunucudaki kuralları taklit eder: places-light (Details + fotoğraflı maskede Photo), places-photo (ad başına Photo),
// places-full (Details + ilk fotoğraf için Photo). Google içeriği yok; yalnız sayılar.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';

import { aramaSecimi, hafifOnbellek, type HafifYer } from '../api';

type Govde = Record<string, unknown>;
type Sayac = { details: number; foto: number; full: number; fotoCagri: number; lightCagri: number };
const sayac: Sayac = { details: 0, foto: 0, full: 0, fotoCagri: 0, lightCagri: 0 };
const fullGovdeleri: Govde[] = [];

const mockInvoke = jest.fn(async (ad: string, { body }: { body: Govde }) => {
  if (ad === 'places-light') {
    sayac.lightCagri++;
    const ids = body.ids as string[];
    sayac.details += ids.length;
    if (body.foto) sayac.foto += ids.length;
    return {
      data: {
        yerler: ids.map((id) => ({ place_id: id, ad: '', lat: 0, lng: 0, primary_type: null, tz: null, puan: null, puan_sayisi: null, acik: null, ulke_kodu: null, foto_uri: body.foto ? `u:${id}` : undefined })),
      },
      error: null,
    };
  }
  if (ad === 'places-photo') {
    sayac.fotoCagri++;
    const adlar = body.adlar as string[];
    sayac.foto += adlar.length;
    return { data: { uriler: adlar.map((a) => `u:${a}`) }, error: null };
  }
  if (ad === 'places-full') {
    fullGovdeleri.push(body);
    sayac.full++;
    sayac.details++;
    sayac.foto++;
    const id = body.id as string;
    return {
      data: { yer: { place_id: id, ad: 'Seçilen', lat: 39.7, lng: 30.5, primary_type: 'museum', puan: 4.5, puan_sayisi: 10, acik: true, kapanis: null, acilis: null, saatler: [], bugun: null, adres: null, ozet: null, foto_uri: null, fotolar: [], google_maps_uri: null } },
      error: null,
    };
  }
  throw new Error(`beklenmeyen uç ${ad}`);
});

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (ad: string, o: { body: Govde }) => mockInvoke(ad, o) } } }));

const nearby = (n: number, fotolu: boolean): HafifYer[] =>
  Array.from({ length: n }, (_, i) => ({
    place_id: `p${i}`,
    ad: `Ad ${i}`,
    lat: 0,
    lng: 0,
    primary_type: 'museum',
    tz: null,
    puan: 4.5,
    puan_sayisi: 100,
    acik: true,
    ulke_kodu: null,
    // Sunucu #316 sonrası: ilk fotoğrafın adı ya da (fotoğrafsız yer) null. Öncesi: alan yok.
    ...(fotolu ? { foto_ad: i % 5 === 4 ? null : `places/p${i}/photos/f${i}` } : {}),
  }));

beforeEach(() => {
  hafifOnbellek.temizle();
  Object.assign(sayac, { details: 0, foto: 0, full: 0, fotoCagri: 0, lightCagri: 0 });
  fullGovdeleri.length = 0;
});

describe('#316 KK1: çekmece fotoğrafı için ayrıca Details yok', () => {
  it('önce (Nearby fotoğraf adı vermiyor): ilk 12 yer için 12 Details + 12 Photo', async () => {
    hafifOnbellek.yaz(nearby(20, false), 'hafif');
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const sonuc = await hafifOnbellek.getirHepsi(ids, ['foto']);
    expect(sayac).toMatchObject({ details: 12, foto: 12, lightCagri: 1, fotoCagri: 0 });
    expect(sonuc.p0.foto_uri).toBe('u:p0');
  });

  it('sonra: Details 0; yalnız fotoğrafı olan yerler için Photo, tek toplu çağrıda; fotoğrafsız yer istek atmaz', async () => {
    hafifOnbellek.yaz(nearby(20, true), 'hafif');
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const sonuc = await hafifOnbellek.getirHepsi(ids, ['foto']);
    // p4 ve p9 fotoğrafsız (null) → 10 Photo.
    expect(sayac).toMatchObject({ details: 0, foto: 10, lightCagri: 0, fotoCagri: 1 });
    expect(sonuc.p0.foto_uri).toBe('u:places/p0/photos/f0');
    expect(sonuc.p4.foto_uri).toBeNull();
    // Puan ve ad Nearby'den kalır (fotoğraf yazımı silmez).
    expect(sonuc.p0).toMatchObject({ ad: 'Ad 0', puan: 4.5 });
    // İkinci istekte yeni istek yok.
    await hafifOnbellek.getirHepsi(ids, ['foto']);
    expect(sayac.fotoCagri).toBe(1);
  });

  it('fotoğraf adı, adı taşımayan sonraki bir yazımla silinmez', async () => {
    hafifOnbellek.yaz(nearby(1, true), 'hafif');
    hafifOnbellek.yaz([{ ...nearby(1, false)[0], puan: 4.9 }], 'hafif');
    await hafifOnbellek.getirHepsi(['p0'], ['foto']);
    expect(sayac).toMatchObject({ details: 0, foto: 1 });
  });
});

describe('#316 KK2: arama seçimi oturumu places-full ile kapatır', () => {
  it('tek places-full (token ile), ayrı hafif Details yok; panel sorgusu ve ortak önbellek dolar', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const yer = await aramaSecimi(qc, 'secilen', 'jeton12345678', 'Europe/Istanbul');
    expect(fullGovdeleri).toEqual([{ id: 'secilen', tz: 'Europe/Istanbul', sessionToken: 'jeton12345678' }]);
    expect(sayac.lightCagri).toBe(0);
    expect(yer).toMatchObject({ place_id: 'secilen', ad: 'Seçilen', puan: 4.5 });
    // Panel (useTamYer) aynı anahtarı okur → ikinci places-full gitmez.
    expect(qc.getQueryData(['tam-yer', 'secilen', 'Europe/Istanbul'])).toMatchObject({ place_id: 'secilen' });
    expect(hafifOnbellek.oku('secilen', ['puan'])).toMatchObject({ puan: 4.5 });
  });
});

describe('#316 KK3: oturum başına ücretli istek (Maliyet-Güvenlik #313 varsayımının çekmece + arama kısmı)', () => {
  it('çekmecede 24 yer (2 × 12) + 2 arama seçimi + panel: önce 54, sonra 24 (hepsi fotoğraflıysa 26)', async () => {
    // Önce: çekmece 24 × (Details + Photo) = 48; her arama seçimi hafif Details + places-full (Details + Photo) = 3 → 54.
    // Sonra (bu test): çekmece yalnız Photo (fotoğrafı olan yerler); her arama seçimi places-full (Details + Photo) = 2.
    hafifOnbellek.yaz(nearby(24, true), 'hafif');
    const ids = Array.from({ length: 24 }, (_, i) => `p${i}`);
    await hafifOnbellek.getirHepsi(ids.slice(0, 12), ['foto']);
    await hafifOnbellek.getirHepsi(ids.slice(12), ['foto']);
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    await aramaSecimi(qc, 'a1', 'jetonAAAAAAAA', 'Europe/Istanbul');
    await aramaSecimi(qc, 'a2', 'jetonBBBBBBBB', 'Europe/Istanbul');
    // 24 yerden 4'ü fotoğrafsız (p4, p9, p14, p19) → 20 Photo; 2 × (Details + Photo) = 4.
    expect(sayac.details + sayac.foto).toBe(24);
    expect(sayac).toMatchObject({ details: 2, foto: 22 });
  });
});
