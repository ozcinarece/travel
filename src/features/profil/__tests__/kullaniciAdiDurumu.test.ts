import { describe, expect, it, jest } from '@jest/globals';

import { kullaniciAdiDurumu } from '../kullaniciAdiDurumu';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const g = { guncel: true, gecerli: true, musait: undefined as boolean | undefined, kontrolEdiliyor: false, hata: false };

describe('kullaniciAdiDurumu (#138 Profil › Düzenle)', () => {
  it('mevcut kullanıcı adı değişmediyse kontrol yok ("ayni")', () => {
    expect(kullaniciAdiDurumu({ ...g, kullaniciAdi: 'ece.ozcinar', mevcut: 'ece.ozcinar' }).tur).toBe('ayni');
  });
  it('boş, kural dışı, müsait, alınmış, hata', () => {
    expect(kullaniciAdiDurumu({ ...g, kullaniciAdi: '' }).tur).toBe('bos');
    expect(kullaniciAdiDurumu({ ...g, kullaniciAdi: 'ab', gecerli: false }).tur).toBe('gecersiz');
    expect(kullaniciAdiDurumu({ ...g, kullaniciAdi: 'ece2', musait: true }).tur).toBe('musait');
    expect(kullaniciAdiDurumu({ ...g, kullaniciAdi: 'ece2', musait: false }).tur).toBe('alinmis');
    expect(kullaniciAdiDurumu({ ...g, kullaniciAdi: 'ece2', hata: true }).tur).toBe('hata');
    expect(kullaniciAdiDurumu({ ...g, kullaniciAdi: 'ece2', guncel: false }).tur).toBe('kontrol');
  });
});
