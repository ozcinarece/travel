import { describe, expect, it } from '@jest/globals';

import {
  blokEkle,
  durumAlanlari,
  istanbuldanIso,
  istanbulParcalari,
  tarihGosterimi,
  fotoDenetle,
  fotoDosyaAdi,
  fotoYolu,
  geziDurumu,
  gorselSatiri,
  kayitFarki,
  mdArac,
  mekanBaglantisi,
  satirIciEkle,
  slugUret,
  tasi,
  yayinlaAlanlari,
  yerelTarihGirdisi,
  yerelTarihtenIso,
  type GeziAlanlari,
} from '../gezi';

const SIMDI = new Date('2026-10-12T12:00:00Z');

describe('slug ve yayın durumu (#107 KK2, KK7)', () => {
  it('Türkçe başlıktan slug; DB kısıtına uyar', () => {
    expect(slugUret("Odunpazarı'ndan Porsuk'a iki gün")).toBe('odunpazarindan-porsuka-iki-gun');
    expect(slugUret('İZMİR · Kıyı & Çeşme!')).toBe('izmir-kiyi-cesme');
    expect(slugUret('?')).toBe('gezi');
    expect(slugUret('a'.repeat(100))).toHaveLength(80);
  });

  it('durum: taslak / planlı / yayında', () => {
    expect(geziDurumu({ yayin: false, yayin_at: null }, SIMDI)).toBe('taslak');
    expect(geziDurumu({ yayin: true, yayin_at: '2026-10-13T09:00:00Z' }, SIMDI)).toBe('planli');
    expect(geziDurumu({ yayin: true, yayin_at: '2026-10-01T09:00:00Z' }, SIMDI)).toBe('yayinda');
    expect(geziDurumu({ yayin: true, yayin_at: null }, SIMDI)).toBe('yayinda');
  });

  it('durum seçimi alanlara çevrilir; planlı tarihsiz ya da geçmişse yarın 09:00', () => {
    expect(durumAlanlari('taslak', '2026-10-20T09:00:00Z', SIMDI)).toEqual({ yayin: false, yayin_at: '2026-10-20T09:00:00Z' });
    expect(durumAlanlari('yayinda', '2026-10-20T09:00:00Z', SIMDI)).toEqual({ yayin: true, yayin_at: SIMDI.toISOString() });
    expect(durumAlanlari('yayinda', '2026-10-01T09:00:00Z', SIMDI)).toEqual({ yayin: true, yayin_at: '2026-10-01T09:00:00Z' });
    expect(durumAlanlari('planli', '2026-10-20T09:00:00Z', SIMDI)).toEqual({ yayin: true, yayin_at: '2026-10-20T09:00:00Z' });
    const yarin = durumAlanlari('planli', null, SIMDI);
    expect(yarin.yayin).toBe(true);
    expect(yarin.yayin_at).toBe('2026-10-13T06:00:00.000Z');
    expect(new Date(yarin.yayin_at!).getTime()).toBeGreaterThan(SIMDI.getTime());
    expect(geziDurumu(yarin, SIMDI)).toBe('planli');
  });

  it('Yayınla: gelecekteki planlı tarihi korur, aksi şimdi', () => {
    expect(yayinlaAlanlari({ yayin_at: '2026-10-20T09:00:00Z' }, SIMDI)).toEqual({ yayin: true, yayin_at: '2026-10-20T09:00:00Z' });
    expect(yayinlaAlanlari({ yayin_at: null }, SIMDI)).toEqual({ yayin: true, yayin_at: SIMDI.toISOString() });
  });

  it('datetime-local girdisi gidiş-dönüş', () => {
    const iso = yerelTarihtenIso('2026-10-16T09:30')!;
    expect(yerelTarihGirdisi(iso)).toBe('2026-10-16T09:30');
    expect(yerelTarihtenIso('')).toBeNull();
    expect(yerelTarihGirdisi(null)).toBe('');
  });
});

describe('planlı yayın İstanbul saatiyle (BekleyenTasarim21 ekran 4)', () => {
  it('İstanbul parçaları ⇄ ISO, gösterim', () => {
    expect(istanbuldanIso('2026-10-20', '09:00')).toBe('2026-10-20T06:00:00.000Z');
    expect(istanbulParcalari('2026-10-20T06:00:00.000Z')).toEqual({ tarih: '2026-10-20', saat: '09:00' });
    expect(istanbulParcalari('2026-10-20T22:30:00Z')).toEqual({ tarih: '2026-10-21', saat: '01:30' });
    expect(istanbuldanIso('2026-10-20', '')).toBeNull();
    expect(tarihGosterimi('2026-10-20')).toBe('20 Eki 2026');
  });
});

describe('otomatik kayıt farkı ve sıra (#107 KK4, KK7)', () => {
  const sunucu: GeziAlanlari = { baslik: 'A', slug: 'a-1', sehir_id: 's', ozet: null, yazar_ad: 'Ece', yazi_md: '', kapak_url: null, yayin: false, yayin_at: null };

  it('yalnız değişen alanlar; fark yoksa null', () => {
    expect(kayitFarki(sunucu, { ...sunucu })).toBeNull();
    expect(kayitFarki(sunucu, { ...sunucu, baslik: 'B', yazi_md: 'x' })).toEqual({ baslik: 'B', yazi_md: 'x' });
  });

  it('sürükle-bırak taşıma', () => {
    expect(tasi(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(tasi(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(tasi(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});

describe('markdown araç çubuğu (#107 KK3)', () => {
  it('B / I seçimi sarar; seçim yoksa yer tutucu', () => {
    expect(mdArac('bir iki üç', { start: 4, end: 7 }, 'kalin')).toEqual({ metin: 'bir **iki** üç', secim: { start: 6, end: 9 } });
    expect(mdArac('x', { start: 1, end: 1 }, 'italik').metin).toBe('x*italik*');
  });

  it('H2 / alıntı / liste seçili satırların başına; mevcut işareti değiştirir', () => {
    expect(mdArac('a\nb\nc', { start: 2, end: 5 }, 'liste').metin).toBe('a\n- b\n- c');
    expect(mdArac('> eski', { start: 3, end: 3 }, 'h2').metin).toBe('## eski');
    expect(mdArac('satır', { start: 0, end: 0 }, 'alinti').metin).toBe('> satır');
  });

  it('görsel ayrı paragraf, mekan bağlantısı satır içi', () => {
    const g = blokEkle('Önce.\nSonra.', { start: 5, end: 5 }, gorselSatiri('Porsuk [1]', 'geziler/g/a.jpg'));
    expect(g.metin).toBe('Önce.\n\n![Porsuk 1](foto:geziler/g/a.jpg)\n\nSonra.');
    const m = satirIciEkle("Hayri Usta'ya git", { start: 0, end: 10 }, (secili) => mekanBaglantisi(secili || 'Hayri', 'ChIJ1'));
    expect(m.metin).toBe("[Hayri Usta](mekan:ChIJ1)'ya git");
    expect(m.secim.start).toBe(25);
  });
});

describe('fotoğraf yükleme kuralları (#107 KK5)', () => {
  it('yol biçimi ve kova sınırları', () => {
    expect(fotoYolu('geziler', 'g1', 'Porsuk.JPEG', 'r1')).toBe('geziler/g1/r1-porsuk.jpg');
    expect(fotoYolu('geziler', 'g1', 'Odunpazarı 01.webp', 'a1b2c3d4-ffff')).toBe('geziler/g1/a1b2c3d4-odunpazari-01.webp');
    expect(fotoYolu('geziler', 'g1', '.jpg', 'r2')).toBe('geziler/g1/r2.jpg');
    expect(fotoDosyaAdi('geziler/g1/a1b2c3d4-odunpazari-01.webp')).toBe('odunpazari-01.webp');
    expect(fotoDosyaAdi('geziler/g1/a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab.jpg')).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab.jpg');
    expect(fotoDenetle({ type: 'image/png', size: 1000 })).toBeNull();
    expect(fotoDenetle({ type: 'image/gif', size: 1000 })).toBe('tur');
    expect(fotoDenetle({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBe('boyut');
  });
});
