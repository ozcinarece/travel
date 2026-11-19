// #388: ekleme hatalarının kullanıcı metni (KK1–KK3) ve ham hata metninin ekrana girmemesi (KK2).
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

import { EklemeDurumSatiri } from '@/components/ui/EklemeDurumSatiri';
import { anaV5, renk } from '@/theme';

import { eklemeHatasi, hepsiListedeBilgisi } from '../eklemeDurumu';

const mockHataBildir = jest.fn();
jest.mock('@/lib/hataRaporu', () => ({ hataBildir: (...a: unknown[]) => mockHataBildir(...a) }));

describe('#388 eklemeHatasi', () => {
  it('KK1: ağ hatası → "Bağlantı yok…" ve tekrar', () => {
    const tekrar = jest.fn();
    const d = eklemeHatasi(new TypeError('Network request failed'), 'x', tekrar);
    expect(d).toEqual({ metin: 'Bağlantı yok. Hiçbir şey eklenmedi; bağlanınca tekrar dene.', tur: 'hata', tekrar });
  });

  it('KK2: diğer hatalar → "Eklenemedi. Tekrar dener misin?"; ham metin yalnız Sentry\'ye', () => {
    const e = { message: 'duplicate key value violates unique constraint', code: '23505' };
    const d = eklemeHatasi(e, 'baglam', () => undefined);
    expect(d).toEqual({ metin: 'Eklenemedi. Tekrar dener misin?', tur: 'hata' });
    expect(d.metin).not.toContain('duplicate');
    expect(mockHataBildir).toHaveBeenCalledWith(e, 'baglam');
    expect(eklemeHatasi('[object Object]', 'b').metin).toBe('Eklenemedi. Tekrar dener misin?');
  });

  it('KK3: hepsi listede bilgi; ikincil renkte, hata renginde değil', () => {
    render(<EklemeDurumSatiri durum={hepsiListedeBilgisi()} />);
    const m = screen.getByText('Bu mekanların hepsi zaten listende.');
    const stil = Object.assign({}, ...[m.props.style].flat(Infinity).filter(Boolean));
    expect(stil.color).toBe(anaV5.ikincil);
    expect(stil.color).not.toBe(renk.uyari);
  });

  it('KK1: satırdaki "Tekrar dene" son denemeyi çağırır', () => {
    const tekrar = jest.fn();
    render(<EklemeDurumSatiri durum={{ metin: 'Bağlantı yok', tur: 'hata', tekrar }} />);
    fireEvent.press(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(tekrar).toHaveBeenCalledTimes(1);
  });
});

describe('#388 KK2: üç ekranda kullanıcı metnine e.message girmez', () => {
  it.each(['src/components/icerik/GeziAl.tsx', 'src/app/gezi/[slug].tsx', 'src/app/(tabs)/kaydettiklerim.tsx'])('%s', (dosya) => {
    const kod = readFileSync(join(__dirname, '../../../..', dosya), 'utf8');
    // Ekleme hatası t(…, { sebep }) ile ham metne bağlanmaz (sayfanın yüklenme hatası kodu bu işin dışında).
    expect(kod).not.toMatch(/sebep:\s*e\b/);
    expect(kod).not.toMatch(/e instanceof Error \? e\.message/);
    expect(kod).not.toMatch(/(alHata|mekanEkleHata|eklemeHata|ekleHataSebep)'/);
  });
});
