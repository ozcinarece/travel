import { describe, expect, it, jest } from '@jest/globals';

import { satirFotosu } from '../fotolar';
import { commonsMu, ilkFoto, kapakAtfiOku, kapakVeAtif, kapakYuksekligi, lisansKisaAdi, tripmateMi } from '../kapakAtfi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

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

describe('#348 inceleme 1–2', () => {
  it('gezi kapağı en az 260 px; üst boşluk büyükse 166 + üst', () => {
    expect(kapakYuksekligi(0)).toBe(260);
    expect(kapakYuksekligi(47)).toBe(260);
    expect(kapakYuksekligi(100)).toBe(266);
  });
  it('yedek kapak atfı fotoğrafın geldiği satırdan', () => {
    const commons = satirFotosu({ kapak_url: 'https://x/k.jpg', kapak_atif: { yazar: 'Ahmet Y.', lisans: 'CC BY-SA 4.0', kaynak_url: 'https://commons.wikimedia.org/wiki/File:K.jpg' } }, { foto_uri: 'https://g/1.jpg', foto_yazar: 'G' });
    expect(commons).toEqual({ foto_uri: 'https://x/k.jpg', foto_atif: { tur: 'kapak', atif: { yazar: 'Ahmet Y.', lisans: 'CC BY-SA 4.0', kaynak_url: 'https://commons.wikimedia.org/wiki/File:K.jpg' } } });
    expect(satirFotosu({}, { foto_uri: 'https://g/1.jpg', foto_yazar: ' Ayşe ' })).toEqual({ foto_uri: 'https://g/1.jpg', foto_atif: { tur: 'google', yazar: 'Ayşe' } });
    expect(satirFotosu({}, { foto_uri: 'https://g/1.jpg' })).toEqual({ foto_uri: 'https://g/1.jpg', foto_atif: { tur: 'google', yazar: null } });
    expect(satirFotosu({}, undefined)).toEqual({ foto_uri: null, foto_atif: null });
  });
  it('ilkFoto: fotoğrafı olan ilk durak ve onun atfı', () => {
    const canli = new Map([
      ['a', { foto_uri: null, foto_atif: null }],
      ['b', { foto_uri: 'https://g/b.jpg', foto_atif: { tur: 'google' as const, yazar: 'B' } }],
      ['c', { foto_uri: 'https://x/c.jpg', foto_atif: { tur: 'kapak' as const, atif: null } }],
    ]);
    expect(ilkFoto(['a', 'b', 'c'], (id) => canli.get(id))).toEqual({ uri: 'https://g/b.jpg', atif: { tur: 'google', yazar: 'B' } });
    expect(ilkFoto(['a'], (id) => canli.get(id))).toBeNull();
  });
});
