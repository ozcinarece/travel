// #348 inceleme 3–4 (kanvas 29i · C/D): rehberli yerde Google fotoğrafı yok; D hali çizgi glifle.
import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { KategoriGlifi, kategoriKoyuRengi } from '@/components/gezi/GeziParcalari';
import { KATEGORI_PIN } from '@/lib/pinIkonu';

import { fotoAlaniHali } from '../MekanPaneli';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn(), hataBildir: jest.fn() }));

const temel = { rehberKapak: false, rehberli: false, rehberBekliyor: false, googleFotolar: 0, hafifFoto: false };

describe('fotoAlaniHali', () => {
  it('rehberli yerin kendi kapağı varsa kapak', () => {
    expect(fotoAlaniHali({ ...temel, rehberKapak: true, rehberli: true, googleFotolar: 10, hafifFoto: true })).toBe('kapak');
  });
  it('rehberli yerin kapağı yoksa Google fotoğrafı değil, doğrudan D', () => {
    expect(fotoAlaniHali({ ...temel, rehberli: true, googleFotolar: 10, hafifFoto: true })).toBe('yok');
  });
  it('rehberli mi bilinmiyorken Google fotoğrafı gösterilmez', () => {
    expect(fotoAlaniHali({ ...temel, rehberBekliyor: true, googleFotolar: 10, hafifFoto: true })).toBe('bekliyor');
  });
  it('rehberli olmayan yer bugünkü gibi: kaydırma, hafif, yoksa D', () => {
    expect(fotoAlaniHali({ ...temel, googleFotolar: 3, hafifFoto: true })).toBe('kaydirma');
    expect(fotoAlaniHali({ ...temel, hafifFoto: true })).toBe('hafif');
    expect(fotoAlaniHali(temel)).toBe('yok');
  });
});

describe('KategoriGlifi (D)', () => {
  it('Müze: çizgi glif 44 px, 2 px, #5B34B8; PNG yok', () => {
    const { getByTestId, UNSAFE_root } = render(<KategoriGlifi tip="museum" boyut={44} />);
    expect(getByTestId('kategori-glifi')).toBeTruthy();
    expect(UNSAFE_root.findAll((n) => (n.type as unknown) === 'Image' || (n.props as { source?: unknown }).source !== undefined)).toHaveLength(0);
    const svg = UNSAFE_root.findAll((n) => (n.props as { stroke?: string }).stroke === '#5B34B8');
    expect(svg.length).toBeGreaterThan(0);
    expect((svg[0].props as { strokeWidth?: number }).strokeWidth).toBe(2);
  });
  it('koyu renk: Müze kanvastan; diğer kategoriler artık pin rengine düşmez (#352)', () => {
    expect(kategoriKoyuRengi('museum')).toBe('#5B34B8');
    expect(kategoriKoyuRengi('restaurant')).not.toBe(KATEGORI_PIN.yemek.renk);
  });
});
