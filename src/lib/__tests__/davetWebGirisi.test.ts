import { describe, expect, it } from '@jest/globals';
import { tamUygulamaAdresi } from '@/lib/davetWebGirisi';

describe('#550 davet girişinden tam uygulamaya', () => {
  it('rota grupları adresten düşer, sorgu korunur', () => {
    expect(tamUygulamaAdresi('/seyahat/abc/(sekmeler)/gezi', { katildin: '1' })).toBe('/seyahat/abc/gezi?katildin=1');
    expect(tamUygulamaAdresi('/seyahat/abc/%28sekmeler%29/gezi')).toBe('/seyahat/abc/gezi');
    expect(tamUygulamaAdresi('/(tabs)')).toBe('/');
    expect(tamUygulamaAdresi('/giris')).toBe('/giris');
    expect(tamUygulamaAdresi('/geziler', {})).toBe('/geziler');
  });

  it('/r/ yolları ve dış adresler yeniden yüklenmez (döngü yok)', () => {
    expect(tamUygulamaAdresi('/r/Ab3dE5gH')).toBeNull();
    expect(tamUygulamaAdresi('/r/g/x')).toBeNull();
    expect(tamUygulamaAdresi('//kotu.example/giris')).toBeNull();
    expect(tamUygulamaAdresi('https://kotu.example')).toBeNull();
    // Bozuk yüzde kodlaması hata fırlatmaz.
    expect(tamUygulamaAdresi('/giris%E0%A4%A')).toBeNull();
    expect(tamUygulamaAdresi('/%')).toBeNull();
  });

  it('bulunamayan yolun parçaları ve dizi parametreler sorguya girmez', () => {
    expect(tamUygulamaAdresi('/giris', { 'not-found': ['giris'] as unknown as string, x: ['a', 'b'] })).toBe('/giris');
  });
});
