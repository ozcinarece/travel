// #390 (PRD §7): Google fotoğrafı cihaz diskine yazılmaz. KK1 · KK2 · KK3: sarmalayıcının önbellek politikası; KK4: arama testi.
import { afterEach, describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { adresPolitikasi, Foto, fotoOnbellekPolitikasi, GoogleFoto } from '../Foto';

const GOOGLE = 'https://lh3.googleusercontent.com/place-photos/ornek=s400';
const onceki = process.env.EXPO_PUBLIC_SUPABASE_URL;
afterEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = onceki;
});

describe('Foto önbellek politikası (#390)', () => {
  it('KK1: Google adresleri ve tanınmayan alan adları memory', () => {
    expect(adresPolitikasi(GOOGLE)).toBe('memory');
    expect(adresPolitikasi('https://places.googleapis.com/v1/places/x/photos/y/media?maxWidthPx=400')).toBe('memory');
    expect(adresPolitikasi('https://maps.googleapis.com/maps/api/place/photo?x=1')).toBe('memory');
    expect(adresPolitikasi('https://ornek.com/a.jpg')).toBe('memory');
    // Supabase alan adına benzeyen başka bir alan izinli sayılmaz.
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proje.supabase.co';
    expect(adresPolitikasi('https://proje.supabase.co.kotu.com/a.jpg')).toBe('memory');
  });

  it('KK2: kendi depomuz (Supabase Storage), Commons ve yerel dosyalar disk', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proje.supabase.co';
    expect(adresPolitikasi('https://proje.supabase.co/storage/v1/object/public/icerik/kapak/commons/a.jpg')).toBe('disk');
    expect(adresPolitikasi('https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg')).toBe('disk');
    expect(adresPolitikasi('file:///tmp/fis.jpg')).toBe('disk');
    expect(fotoOnbellekPolitikasi(12)).toBe('disk');
    expect(fotoOnbellekPolitikasi([{ uri: 'https://proje.supabase.co/a.jpg' }, { uri: GOOGLE }])).toBe('memory');
  });

  it('KK3: Google adresi verilen sarmalayıcı expo-image\'a memory geçer; GoogleFoto her zaman memory', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proje.supabase.co';
    const google = render(<Foto source={{ uri: GOOGLE }} />);
    expect(google.UNSAFE_getByType(Image).props.cachePolicy).toBe('memory');
    const kapak = render(<Foto source={{ uri: 'https://proje.supabase.co/storage/v1/object/public/icerik/a.jpg' }} />);
    expect(kapak.UNSAFE_getByType(Image).props.cachePolicy).toBe('disk');
    const galeri = render(<GoogleFoto source={{ uri: 'https://proje.supabase.co/a.jpg' }} />);
    expect(galeri.UNSAFE_getByType(Image).props.cachePolicy).toBe('memory');
  });

  it('KK4: src içinde expo-image yalnız Foto sarmalayıcısında içe aktarılır', () => {
    const kok = join(__dirname, '../../..');
    const dosyalar: string[] = [];
    const gez = (d: string) => {
      for (const ad of readdirSync(d)) {
        const yol = join(d, ad);
        if (statSync(yol).isDirectory()) {
          if (ad !== '__tests__' && ad !== 'node_modules') gez(yol);
        } else if (/\.(ts|tsx)$/.test(ad)) dosyalar.push(yol);
      }
    };
    gez(kok);
    const ihlal = dosyalar
      .filter((f) => /from ['"]expo-image['"]/.test(readFileSync(f, 'utf8').replace(/import type [^;]+;/g, '')))
      .map((f) => relative(kok, f))
      .filter((f) => f !== join('components', 'ui', 'Foto.tsx'));
    expect(dosyalar.length).toBeGreaterThan(100);
    expect(ihlal).toEqual([]);
  });
});
