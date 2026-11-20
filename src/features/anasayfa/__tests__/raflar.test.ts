// #406 (kanvas `Ana_v6_Kesfet`): raf kuralları (KK3, KK5) ve tek banner (KK2).
import { describe, expect, it } from '@jest/globals';

import { aktifBanner, kesfetRaflari, rafBul, rafGezileri, rafKartAltSatiri } from '../raflar';

const g = (id: string, amaclar: string[] = [], sehir_id = 's1', kapak_url: string | null = null) => ({ id, slug: id, sehir_id, amaclar, kapak_url, kapak_atif: kapak_url ? { yazar: 'Ayşe K.', lisans: 'CC BY 4.0' } : null });
type B = { id: string; tur: 'raf' | 'banner' | 'serit'; baslik: string; icerik: Record<string, unknown> };
const raf = (id: string, icerik: object): B => ({ id, tur: 'raf', baslik: id, icerik: icerik as Record<string, unknown> });
const banner = (icerik: object, id = 'b1'): B => ({ id, tur: 'banner', baslik: 'Bu kış Kapadokya', icerik: icerik as Record<string, unknown> });

describe('#406 KK3 rafGezileri', () => {
  const geziler = [g('a', ['lezzet']), g('b', ['doga'], 's2'), g('c', ['lezzet'], 's2')];
  it('amaç, şehir ve elle (verilen sıra, yayında olmayan düşer, tekrar tek)', () => {
    expect(rafGezileri({ raf_turu: 'amac', amac: 'lezzet' }, geziler).map((x) => x.id)).toEqual(['a', 'c']);
    expect(rafGezileri({ raf_turu: 'sehir', sehir_id: 's2' }, geziler).map((x) => x.id)).toEqual(['b', 'c']);
    expect(rafGezileri({ raf_turu: 'elle', gezi_idler: ['c', 'yok', 'a', 'c'] }, geziler).map((x) => x.id)).toEqual(['c', 'a']);
  });
  it('KK5: arkadaşlardan rafı şimdilik boş', () => {
    expect(rafGezileri({ raf_turu: 'arkadaslardan' }, geziler)).toEqual([]);
  });
});

describe('#406 KK3 kesfetRaflari', () => {
  const geziler = [g('a', ['lezzet', 'doga']), g('b', ['lezzet']), g('c', ['lezzet', 'doga']), g('d', ['doga'])];
  it('yayında raf varsa yalnız onlar, sırayla; 3 gezisi olmayan düşer; banner ve eski türler raf değil', () => {
    const r = kesfetRaflari([banner({}), raf('x', { raf_turu: 'amac', amac: 'doga' }), { id: 's', tur: 'serit', baslik: 'Eski', icerik: {} }, raf('y', { raf_turu: 'elle', gezi_idler: ['a', 'b'] })], geziler);
    expect(r.map((x) => [x.id, x.geziler.length])).toEqual([['x', 3]]);
  });
  it('#428 inceleme 1: yayındaki rafların hiçbiri uygun değilse (3\'ten az gezi, yalnız arkadaşlardan) amaç raflarına, o da yoksa "Hazır geziler"e düşülür', () => {
    const uygunsuz = [raf('y', { raf_turu: 'elle', gezi_idler: ['a', 'b'] }), raf('k', { raf_turu: 'arkadaslardan' })];
    expect(kesfetRaflari(uygunsuz, geziler).map((x) => x.id)).toEqual(['amac:lezzet', 'amac:doga']);
    expect(kesfetRaflari(uygunsuz, [g('a'), g('b')]).map((x) => x.id)).toEqual(['hepsi']);
  });
  it('yayında raf yoksa (ya da bölümler okunamadıysa) amaç rafları, sabit amaç sırasıyla', () => {
    expect(kesfetRaflari(undefined, geziler).map((x) => [x.id, x.baslik])).toEqual([
      ['amac:lezzet', 'Lezzet için'],
      ['amac:doga', 'Doğa için'],
    ]);
  });
  it('amaç rafı da çıkmazsa tek raf: bütün hazır geziler; gezi yoksa raf yok', () => {
    expect(kesfetRaflari([], [g('a'), g('b')]).map((x) => [x.id, x.baslik, x.geziler.length])).toEqual([['hepsi', 'Hazır geziler', 2]]);
    expect(kesfetRaflari([], [])).toEqual([]);
  });
  it('rafBul "Tümü" için aynı kuralı kullanır', () => {
    expect(rafBul('amac:doga', null, geziler)?.geziler.map((x) => x.id)).toEqual(['a', 'c', 'd']);
    expect(rafBul('yok', null, geziler)).toBeNull();
  });
});

describe('#406 KK2 aktifBanner', () => {
  const geziler = [g('a', ['lezzet'], 's1', 'https://ornek/a.jpg'), g('b', ['lezzet']), g('c', ['lezzet'], 's2')];
  const sehirler = [{ id: 's1', kapak_url: 'https://ornek/s1.jpg', kapak_atif: { yazar: 'Mehmet' } }, { id: 's3', kapak_url: null }];
  const raflar = kesfetRaflari(null, geziler);
  it('aynı anda tek banner: hedefi olan ilk banner', () => {
    const b = aktifBanner([banner({}, 'hedefsiz'), banner({ ust_yazi: ' Bu kış ', hedef: { tur: 'raf', id: 'amac:lezzet' } }), banner({ hedef: { tur: 'gezi', id: 'a' } }, 'b2')], geziler, sehirler, raflar);
    expect(b).toMatchObject({ id: 'b1', ustYazi: 'Bu kış', geziSayisi: 3, kapak: null, atif: null, slug: null });
  });
  it('kendi görseli önce; yoksa hedef gezinin ya da şehrin kapağı ve atfı', () => {
    expect(aktifBanner([banner({ kapak_url: 'https://ornek/k.jpg', kapak_atif: { yazar: 'Tripmate' }, hedef: { tur: 'gezi', id: 'a' } })], geziler, sehirler, raflar)).toMatchObject({
      kapak: 'https://ornek/k.jpg',
      atif: { yazar: 'Tripmate' },
      geziSayisi: 1,
      slug: 'a',
    });
    expect(aktifBanner([banner({ hedef: { tur: 'gezi', id: 'a' } })], geziler, sehirler, raflar)).toMatchObject({ kapak: 'https://ornek/a.jpg', atif: { yazar: 'Ayşe K.', lisans: 'CC BY 4.0' } });
    expect(aktifBanner([banner({ hedef: { tur: 'sehir', id: 's1' } })], geziler, sehirler, raflar)).toMatchObject({ kapak: 'https://ornek/s1.jpg', atif: { yazar: 'Mehmet' }, geziSayisi: 2 });
  });
  it('hedef yayında değilse ya da gezisi yoksa banner yok', () => {
    expect(aktifBanner([banner({ hedef: { tur: 'gezi', id: 'yok' } })], geziler, sehirler, raflar)).toBeNull();
    expect(aktifBanner([banner({ hedef: { tur: 'sehir', id: 's3' } })], geziler, sehirler, raflar)).toBeNull();
    expect(aktifBanner([banner({ hedef: { tur: 'raf', id: 'amac:doga' } })], geziler, sehirler, raflar)).toBeNull();
    expect(aktifBanner(undefined, geziler, sehirler, raflar)).toBeNull();
  });
});

describe('#406 KK3 rafKartAltSatiri', () => {
  it('durak günlerden, yer şehir adı; şehir yoksa yalnız durak', () => {
    expect(rafKartAltSatiri({ mekan_sayisi: 99, gunDuraklari: [6, 5], sehirler: { ad: 'Bursa' } })).toBe('11 durak · Bursa');
    expect(rafKartAltSatiri({ mekan_sayisi: 9, sehirler: null })).toBe('9 durak');
    // Şehir rafında başlık şehri söylüyor: yalnız "N durak".
    expect(rafKartAltSatiri({ mekan_sayisi: 99, gunDuraklari: [6, 5], sehirler: { ad: 'Bursa' } }, 'sehir')).toBe('11 durak');
  });
});
