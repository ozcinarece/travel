import { describe, expect, it } from '@jest/globals';

import { bannerAdresiGecerli, bannerIcerigi, bolumOzeti, eskiTurMu, icerikYaz, planliSatirlar, rafIcerigi, seciliIdler, yayindanFarkli, yeniBolum, type TaslakBolum } from '../anaSayfa';
import { ty } from '../metin';

const b = (alan: Partial<TaslakBolum>): TaslakBolum => ({
  id: 'b1',
  tur: 'serit',
  baslik: 'Önerilen geziler',
  sira: 1,
  acik: true,
  kaynak: 'elle',
  icerik: {},
  baslangic_at: null,
  bitis_at: null,
  ...alan,
});

const adlar = {
  geziler: ['Bursa', 'Kapadokya', 'İzmir', 'Antalya', 'Mardin'].map((ad, i) => ({ id: `g${i}`, baslik: ad })),
  yerler: [{ id: 'y1', ad: 'Sazova Parkı' }],
  sehirler: [{ id: 's1', ad: 'Eskişehir' }],
};

// #109 KK3 / KK4: kanvastaki satır alt yazısı, planlı yayın kutusu, yeni bölüm, taslak ↔ yayın farkı.
describe('ana sayfa düzeni — panel kuralları (#109)', () => {
  it('satır özeti: elle (ilk 3 + N), otomatik, tek kart', () => {
    expect(bolumOzeti(b({ icerik: { gezi_idler: ['g0', 'g1', 'g2', 'g3', 'g4'] } }), adlar, ty)).toBe('Bursa · Kapadokya · İzmir · + 2 (sıra: elle)');
    expect(bolumOzeti(b({ tur: 'mozaik', kaynak: 'otomatik' }), adlar, ty)).toBe('otomatik (sıra: öne çıkan sırası)');
    expect(bolumOzeti(b({ tur: 'tek_kart', kaynak: 'otomatik' }), adlar, ty)).toBe('otomatik: en çok alınan (son 30 gün)');
    expect(bolumOzeti(b({ tur: 'tek_kart', icerik: { gezi_id: 'g1' } }), adlar, ty)).toBe('Kapadokya · elle sabitlendi');
    expect(bolumOzeti(b({ icerik: { gezi_idler: [] } }), adlar, ty)).toBe('içerik seçilmedi');
  });

  it('#406: banner ve raf satırının özeti', () => {
    expect(bolumOzeti(b({ tur: 'banner', icerik: { ust_yazi: 'Bu kış', hedef: { tur: 'raf', id: 'r1' } } }), adlar, ty)).toBe('Bu kış · hedef: raf');
    expect(bolumOzeti(b({ tur: 'banner', icerik: {} }), adlar, ty)).toBe('hedef seçilmedi');
    expect(bolumOzeti(b({ tur: 'raf', icerik: { raf_turu: 'amac', amac: 'lezzet' } }), adlar, ty)).toBe('amaç: lezzet');
    expect(bolumOzeti(b({ tur: 'raf', icerik: { raf_turu: 'sehir', sehir_id: 's1' } }), adlar, ty)).toBe('şehir: Eskişehir');
    expect(bolumOzeti(b({ tur: 'raf', icerik: { raf_turu: 'elle', gezi_idler: ['g0', 'g1'] } }), adlar, ty)).toBe('elle seçilmiş 2 gezi');
  });

  it('planlı bölüm: özet ve kutu açılış/kapanış taşır', () => {
    const p = b({ baslik: 'Mevsim seçkisi', baslangic_at: '2026-10-20T06:00:00Z', bitis_at: '2026-11-01T06:00:00Z', icerik: { gezi_idler: ['g0'] } });
    expect(bolumOzeti(p, adlar, ty)).toMatch(/^Bursa \(sıra: elle\) · açılış 20 Eki \d\d:00 · kapanış 1 Kas \d\d:00$/);
    expect(planliSatirlar([b({}), p], ty)).toHaveLength(1);
    expect(planliSatirlar([p], ty)[0]).toMatch(/^"Mevsim seçkisi" · açılış 20 Eki/);
  });

  it('içerik yazımı ve okuması türe göre', () => {
    expect(icerikYaz('tek_kart', ['g1', 'g2'])).toEqual({ gezi_id: 'g1' });
    expect(icerikYaz('mozaik', ['y1'])).toEqual({ yer_idler: ['y1'] });
    expect(seciliIdler(b({ tur: 'sehir_seckisi', icerik: { sehir_idler: ['s1'] } }))).toEqual(['s1']);
    expect(seciliIdler(b({ tur: 'tek_kart', icerik: { gezi_id: null } }))).toEqual([]);
  });

  it('yeni bölüm sona, kapalı, elle seçimli boş raf (#406 2/2)', () => {
    expect(yeniBolum([{ sira: 1 }, { sira: 4 }], 'Yeni bölüm')).toMatchObject({ sira: 5, acik: false, kaynak: 'elle', tur: 'raf', icerik: { raf_turu: 'elle', gezi_idler: [] } });
    expect(yeniBolum([], 'x').sira).toBe(1);
  });

  it('taslak ↔ son yayın farkı (zaman biçimi farkı sayılmaz)', () => {
    const t = [b({ baslangic_at: '2026-10-20T06:00:00+00:00' })];
    const yayin = [{ ...t[0], baslangic_at: '2026-10-20T06:00:00.000Z' }];
    expect(yayindanFarkli(t, yayin)).toBe(false);
    expect(yayindanFarkli([{ ...t[0], acik: false }], yayin)).toBe(true);
    expect(yayindanFarkli(t, null)).toBe(true);
    expect(yayindanFarkli([...t, b({ id: 'b2', sira: 2 })], yayin)).toBe(true);
  });

  describe('#406 2/2 v6 düzenleyici', () => {
    it('eski türler v6\'da görünmez', () => {
      expect(eskiTurMu('serit')).toBe(true);
      expect(eskiTurMu('sehir_seckisi')).toBe(true);
      expect(eskiTurMu('raf')).toBe(false);
      expect(eskiTurMu('banner')).toBe(false);
    });

    it('raf türü değişince yalnız o türün alanı kalır', () => {
      expect(rafIcerigi('amac', { amac: 'lezzet', gezi_idler: ['x'] })).toEqual({ raf_turu: 'amac', amac: 'lezzet' });
      expect(rafIcerigi('sehir')).toEqual({ raf_turu: 'sehir' });
      expect(rafIcerigi('elle', { amac: 'lezzet' })).toEqual({ raf_turu: 'elle', gezi_idler: [] });
    });

    it('banner içeriği: boş metin ve null alan silinir, metin kırpılır', () => {
      const eski = { ust_yazi: 'Bu kış', hedef: { tur: 'raf' as const, id: 'r1' } };
      expect(bannerIcerigi(eski, { ust_yazi: '  ' })).toEqual({ hedef: { tur: 'raf', id: 'r1' } });
      expect(bannerIcerigi(eski, { hedef: null as never })).toEqual({ ust_yazi: 'Bu kış' });
      expect(bannerIcerigi({}, { kapak_url: ' https://upload.wikimedia.org/a.jpg ', kapak_atif: { yazar: 'X' } })).toEqual({ kapak_url: 'https://upload.wikimedia.org/a.jpg', kapak_atif: { yazar: 'X' } });
    });

    it('banner görsel adresi: DB kuralıyla aynı (KK-ek1)', () => {
      const kova = 'https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/';
      expect(bannerAdresiGecerli('https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa.jpg')).toBe(true);
      expect(bannerAdresiGecerli(`${kova}banner/kis.jpg`)).toBe(true);
      for (const kotu of [
        `${kova}.\t./avatars/u1/a.jpg`,
        `${kova}.\n./avatars/u1/a.jpg`,
        `${kova}../avatars/u1/a.jpg`,
        `${kova}%2E%2e/avatars/a.jpg`,
        `${kova}%252e/a.jpg`,
        'https://upload.wikimedia.org/a b.jpg',
        'https://upload.wikimedia.org/a.jpg?x=1',
        'https://lh3.googleusercontent.com/places/a.jpg',
        'http://upload.wikimedia.org/a.jpg',
        'https://upload.wikimedia.org.evil.com/a.jpg',
      ]) {
        expect([kotu, bannerAdresiGecerli(kotu)]).toEqual([kotu, false]);
      }
    });
  });
});
