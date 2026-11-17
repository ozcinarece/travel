// #248 KK2: oylamada mekan seçeneğinin Google'dan gelen adı kaydedilmez; kullanıcının yazdığı metin kaydedilir.
import { describe, expect, it } from '@jest/globals';

import { kayitMetni } from '../OylamaFormu';

describe('oylama seçenek metni (#248)', () => {
  it('mekan seçildi, ad otomatik geldi → boş metin', () => {
    expect(kayitMetni({ metin: 'Google adı', place_id: 'ChIJ-ciborek-hb1', otoAd: 'Google adı' })).toBe('');
  });
  it('kullanıcı yazıp sildi, ad aynı kaldı (trim sonrası) → boş metin', () => {
    expect(kayitMetni({ metin: ' Google adı ', place_id: 'ChIJ-ciborek-hb1', otoAd: 'Google adı' })).toBe('');
  });
  it('kullanıcı otomatik adı değiştirdi → kendi metni kaydedilir', () => {
    expect(kayitMetni({ metin: 'Google adı, akşam', place_id: 'ChIJ-ciborek-hb1', otoAd: 'Google adı' })).toBe('Google adı, akşam');
  });
  it('kullanıcı metni (ya da bizim içerik adı) → kırpılıp kaydedilir', () => {
    expect(kayitMetni({ metin: '  Çibörek  ', place_id: 'ChIJ-ciborek-hb1' })).toBe('Çibörek');
    expect(kayitMetni({ metin: 'Balık', place_id: null })).toBe('Balık');
    expect(kayitMetni({ metin: 'x'.repeat(90), place_id: null }).length).toBe(80);
  });
});
