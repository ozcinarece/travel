import { describe, expect, it } from '@jest/globals';

import { commonsMu, kapakAtfiOku, kapakVeAtif, lisansKisaAdi, tripmateMi } from '../kapakAtfi';

describe('#345 KK4 kapak atfı yardımcıları', () => {
  it('jsonb güvenle okunur; yazar yoksa ya da biçim bozuksa atıf yok', () => {
    expect(kapakAtfiOku(null)).toBeNull();
    expect(kapakAtfiOku('Ahmet')).toBeNull();
    expect(kapakAtfiOku([])).toBeNull();
    expect(kapakAtfiOku({ yazar: '  ' })).toBeNull();
    expect(kapakAtfiOku({ yazar: ' Ahmet Y. ', lisans: 'CC BY-SA 4.0', kaynak_url: 'https://commons.wikimedia.org/wiki/File:A.jpg' })).toEqual({
      yazar: 'Ahmet Y.',
      lisans: 'CC BY-SA 4.0',
      kaynak_url: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    });
    // https olmayan kaynak açılmaz.
    expect(kapakAtfiOku({ yazar: 'A', kaynak_url: 'javascript:alert(1)' })?.kaynak_url).toBeNull();
  });

  it('kısa lisans adı: sürüm kutuda görünmez', () => {
    expect(lisansKisaAdi('CC BY-SA 4.0')).toBe('CC BY-SA');
    expect(lisansKisaAdi('CC BY 2.0')).toBe('CC BY');
    expect(lisansKisaAdi('CC0')).toBe('CC0');
    expect(lisansKisaAdi('PD')).toBe('PD');
    expect(lisansKisaAdi('Public domain')).toBe('PD');
    expect(lisansKisaAdi(null)).toBeNull();
  });

  it('Tripmate fotoğrafı ve Commons kaynağı ayırt edilir', () => {
    expect(tripmateMi({ yazar: 'Tripmate' })).toBe(true);
    expect(tripmateMi({ yazar: 'Tripmate', kaynak_url: 'https://commons.wikimedia.org/wiki/File:A.jpg' })).toBe(false);
    expect(commonsMu({ yazar: 'A', kaynak_url: 'https://commons.wikimedia.org/wiki/File:A.jpg' })).toBe(true);
    expect(commonsMu({ yazar: 'A', kaynak_url: 'https://example.org/commons.wikimedia.org' })).toBe(false);
  });

  it('atıf kapağın geldiği satırdan alınır', () => {
    const sehir = { kapak_url: 'https://x/s.jpg', kapak_atif: { yazar: 'Tripmate' } };
    expect(kapakVeAtif([{ kapak_url: null, kapak_atif: { yazar: 'Eski' } }, sehir])).toEqual({ uri: 'https://x/s.jpg', atif: { yazar: 'Tripmate', lisans: null, kaynak_url: null } });
    expect(kapakVeAtif([{ kapak_url: 'https://x/g.jpg' }, sehir])).toEqual({ uri: 'https://x/g.jpg', atif: null });
    expect(kapakVeAtif([{}])).toEqual({ uri: null, atif: null });
  });
});
