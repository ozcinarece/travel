import { describe, expect, it } from '@jest/globals';

import { icerikFotoUrl } from '@/lib/markdown';
import { AYLAR_KISA } from '@/lib/takvim';

import {
  boyutYolu,
  dosyaAdi,
  eksikBolum,
  fotoBilgisi,
  fotoRolu,
  kartSayisi,
  kaynakIzleri,
  mekanBaglari,
  olcekle,
  rehberGovdesi,
  rehberYazisi,
  rolAta,
  sehirFotoDenetle,
  sehirFotoYolu,
  yayinEngeli,
  yonelme,
} from '../sehir';
import { kartEkle, rehberBloklari, rehberMd, rehberSayaclari } from '../yer';

const ID = '11111111-1111-4111-8111-000000000001';

describe('rehber bölümleri (#111 KK1)', () => {
  it('eksik bölüm uygulama sekme sırasıyla', () => {
    expect(eksikBolum([{ bolum: 'ulasim' }, { bolum: 'mahalle' }])).toBe('yemek');
    expect(eksikBolum(['ulasim', 'yemek', 'mahalle', 'ipucu'].map((b) => ({ bolum: b as 'ulasim' })))).toBeNull();
  });
  it('yazı = # Başlık + gövde (uygulama ilk başlığı atar)', () => {
    expect(rehberGovdesi('# Ne yenir\n\nÇibörek.\n\n- Balaban')).toBe('Çibörek.\n\n- Balaban');
    expect(rehberGovdesi(null)).toBe('');
    expect(rehberYazisi('Ne yenir', 'Çibörek.')).toBe('# Ne yenir\n\nÇibörek.');
    expect(rehberYazisi('Ne yenir', '  ')).toBe('# Ne yenir');
  });
  it('yazıdaki mekanlar sırayla: satır içi (ad = metin) ve kart; sayılar ve kaynak görünümü', () => {
    const md = 'Tatlı için [Met Helvacısı](mekan:ChIJmethelva01h3) uğrayın.\n\n::mekan[ChIJhayriusta001]\n\n[kısa](mekan:x)';
    expect(mekanBaglari(md)).toEqual([
      { place_id: 'ChIJmethelva01h3', bicim: 'satir', ad: 'Met Helvacısı' },
      { place_id: 'ChIJhayriusta001', bicim: 'kart' },
    ]);
    expect(kartSayisi(md)).toBe(1);
    expect(kaynakIzleri(md)).toEqual(['[Met Helvacısı](mekan:ChIJ…h3)', '::mekan[ChIJ…01]']);
  });
  it('kart bloğu: markdown ⇄ blok, imlecin paragrafının altına eklenir, sayaç', () => {
    let n = 0;
    const kimlik = () => `b${n++}`;
    const b = rehberBloklari('Paragraf bir.\n\nParagraf iki.', kimlik);
    const yeni = kartEkle(b, b[0].id, 'ChIJhayriusta001', kimlik);
    expect(rehberMd(yeni)).toBe('Paragraf bir.\n\n::mekan[ChIJhayriusta001]\n\nParagraf iki.');
    expect(rehberBloklari(rehberMd(yeni), kimlik).map((x) => x.tur)).toEqual(['paragraf', 'mekan', 'paragraf']);
    expect(rehberSayaclari(rehberMd(yeni)).kart).toBe(1);
    expect(rehberMd(kartEkle(b, null, 'ChIJhayriusta001', kimlik)).endsWith('::mekan[ChIJhayriusta001]')).toBe(true);
  });
});

describe('fotoğraflar (#111 Sehir19)', () => {
  const yol = `sehirler/${ID}/a1b2c3d4-eskisehir-01.webp`;
  it('roller: karo / geniş sütunu; boşa almak yalnız o fotoyu düşürür', () => {
    const url = icerikFotoUrl(yol);
    expect(fotoRolu(yol, { kapak_url: url, genis_kapak_url: null })).toBe('karo');
    expect(fotoRolu(yol, { kapak_url: null, genis_kapak_url: url })).toBe('genis');
    expect(rolAta('genis', yol, { kapak_url: null, genis_kapak_url: null })).toEqual({ genis_kapak_url: url });
    expect(rolAta(null, yol, { kapak_url: url, genis_kapak_url: 'baska' })).toEqual({ kapak_url: null });
    expect(yayinEngeli({ kapak_url: null })).toBe('kapak');
    expect(yayinEngeli({ kapak_url: url })).toBeNull();
  });
  it('yükleme kuralı, yol, boyut kopyaları, ölçek', () => {
    expect(sehirFotoDenetle({ type: 'image/gif', size: 10 })).toBe('tur');
    expect(sehirFotoDenetle({ type: 'image/jpeg', size: 9 * 1024 * 1024 })).toBe('boyut');
    expect(sehirFotoDenetle({ type: 'image/webp', size: 1000 })).toBeNull();
    expect(sehirFotoYolu(ID, 'Eskişehir 01.JPG', 'a1b2c3d4-ffff')).toBe(yol);
    expect(boyutYolu(yol, 2400)).toBe(yol);
    expect(boyutYolu(yol, 400)).toBe(`sehirler/${ID}/a1b2c3d4-eskisehir-01@400.webp`);
    expect(olcekle(3000, 2000, 2400)).toEqual({ genislik: 2400, yukseklik: 1600 });
    expect(olcekle(1800, 1200, 2400)).toEqual({ genislik: 1800, yukseklik: 1200 });
    expect(dosyaAdi(yol)).toBe('eskisehir-01.webp');
  });
  it('seçili foto bilgisi: "2400×1600 · 1,1 MB · Ece · 12 Eki"', () => {
    expect(fotoBilgisi({ genislik: 2400, yukseklik: 1600, bayt: 1_153_434, yukleyen: 'Ece', created_at: '2026-10-12T10:00:00' }, AYLAR_KISA)).toBe('2400×1600 · 1,1 MB · Ece · 12 Eki');
    expect(fotoBilgisi({ genislik: null, yukseklik: null, bayt: null, yukleyen: 'ece.ozcinar@ornek.com', created_at: undefined }, AYLAR_KISA)).toBe('Ece');
    expect(fotoBilgisi({ genislik: null, yukseklik: null, bayt: null, yukleyen: null, created_at: undefined }, AYLAR_KISA)).toBe('');
  });
  it('yönelme hâli: "Eskişehir’e git"', () => {
    expect(yonelme('Eskişehir')).toBe('Eskişehir’e');
    expect(yonelme('Bursa')).toBe('Bursa’ya');
    expect(yonelme('Van')).toBe('Van’a');
    expect(yonelme('İzmir')).toBe('İzmir’e');
    expect(yonelme('Rize')).toBe('Rize’ye');
  });
});
