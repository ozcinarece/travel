// #445 (`Ekran07dDolulukTasma` A–C): alt çubuğun tam dolu ve taşma hali. K, "Planı kur"un hesabından (`planiHesapla`).
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PlanCubugu } from '@/components/sihirbaz/PlanCubugu';
import { GUN_KAPASITESI_DK } from '@/features/sihirbaz/planKur';
import { planiHesapla } from '@/features/sihirbaz/planUygula';
import { t } from '@/i18n';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { anaV5 } from '@/theme';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
let mockGenislik = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockGenislik, height: 800, scale: 2, fontScale: mockFontScale }),
}));

const cubuk = (doluluk: { gun: number; dolu: number; cubuklar: number[]; sigmayan?: number }) => (
  <PlanCubugu ozet={{ mekan: 9, bolge: 2, saat: 20 }} doluluk={doluluk} onPlaniKur={jest.fn()} onHaritayaGec={jest.fn()} />
);

describe('#445 alt çubuk taşma hali', () => {
  it('KK1: doluluk gün sayısına eşitse "G gün dolu"; çubuk grubu tek öğe', () => {
    mockGenislik = 390;
    render(cubuk({ gun: 2, dolu: 2, cubuklar: [1, 1], sigmayan: 0 }));
    expect(screen.getByText(t('sihirbaz.onerilenler.ozetDolulukTam', { gun: 2 }))).toBeTruthy();
    expect(screen.getByTestId('doluluk-tek')).toBeTruthy();
    expect(screen.getByLabelText('2 gün dolu')).toBeTruthy();
    expect(screen.queryByTestId('tasma-parcasi')).toBeNull();
  });

  it('kısmi dolulukta bugünkü metin kalır, taşma parçası yok', () => {
    render(cubuk({ gun: 2, dolu: 1.2, cubuklar: [1, 0.2], sigmayan: 0 }));
    expect(screen.getByText("· 2 günün 1,2'si dolu")).toBeTruthy();
    expect(screen.queryByTestId('tasma-parcasi')).toBeNull();
  });

  it('KK2–KK5: taşmada "G gün doldu · K yer sığmıyor", çubuklar tam, sabit 24 px parça, tek erişilebilir öğe', () => {
    mockGenislik = 390;
    render(cubuk({ gun: 2, dolu: 2.6, cubuklar: [1, 0.6], sigmayan: 3 }));
    // Ondalıklı gün yok.
    expect(screen.queryByText(/2,6/)).toBeNull();
    const sigmiyor = screen.getByText('3 yer sığmıyor');
    expect(StyleSheet.flatten(sigmiyor.props.style)).toMatchObject({ color: anaV5.tasma }); // 13 px / 700 üst metinden (s.doluluk)
    expect(screen.getByText(/2 gün doldu ·/)).toBeTruthy();
    // KK4: 390 px'te de alt satırda.
    expect(screen.getByTestId('doluluk-dar')).toBeTruthy();
    // KK3: gün çubukları tam dolu, parça sabit.
    const grup = screen.getByTestId('gun-cubuklari');
    expect(grup.props.accessibilityLabel).toBe('2 gün doldu, 3 yer sığmıyor');
    expect(grup.props.accessible).toBe(true);
    expect(StyleSheet.flatten(screen.getByTestId('tasma-parcasi').props.style)).toMatchObject({ width: 24, height: 6, marginLeft: 4, backgroundColor: anaV5.tasma });
    // KK6: aynı Planı kur düğmesi.
    expect(screen.getByRole('button', { name: t('sihirbaz.onerilenler.planiKur') })).toBeTruthy();
  });

  it('KK7: 360 px taşmada da aynı yerleşim, parça boyu K ile değişmez', () => {
    mockGenislik = 360;
    const r = render(cubuk({ gun: 2, dolu: 4, cubuklar: [1, 1], sigmayan: 7 }));
    expect(r.getByTestId('doluluk-dar')).toBeTruthy();
    expect(r.getByText('7 yer sığmıyor')).toBeTruthy();
    expect(StyleSheet.flatten(r.getByTestId('tasma-parcasi').props.style).width).toBe(24);
    mockGenislik = 390;
  });

  it('#450 inceleme 1: 360 px + fontScale 2 taşmada satır sınırı yok, "sığmıyor" tam görünür', () => {
    mockGenislik = 360;
    mockFontScale = 2;
    render(cubuk({ gun: 2, dolu: 4, cubuklar: [1, 1], sigmayan: 13 }));
    expect(screen.getByTestId('doluluk-dar')).toBeTruthy();
    const sigmiyor = screen.getByText('13 yer sığmıyor');
    // Kırmızı parça üst metnin içinde; üst metinde satır sınırı (kesme) yok.
    const ust = screen.getByText(/2 gün doldu ·/);
    expect(ust.props.numberOfLines).toBeUndefined();
    expect(sigmiyor.props.numberOfLines).toBeUndefined();
    mockGenislik = 390;
    mockFontScale = 1;
  });

  it('taşma yokken büyük yazıda iki satır sınırı korunur', () => {
    mockFontScale = 2;
    render(cubuk({ gun: 2, dolu: 1.2, cubuklar: [1, 0.2], sigmayan: 0 }));
    expect(screen.getByText("· 2 günün 1,2'si dolu").props.numberOfLines).toBe(2);
    mockFontScale = 1;
  });

  it('KK2: K, Planı kur ile aynı hesaptan: hiçbir güne sığmayanlar', () => {
    const mekan = (id: string, lat: number, dk: number) => ({ id, lat, lng: 30.52, default_minutes: dk }) as unknown as Mekan;
    // Her biri ~günün yarısı; aynı bölgede 5 yer, 2 güne 4'ü sığar.
    const mekanlar = ['a', 'b', 'c', 'd', 'e'].map((id, i) => mekan(id, 39.76 + i * 0.0005, Math.floor(GUN_KAPASITESI_DK / 2) - 10));
    const gunler = [{ id: 'g1', index: 1 }, { id: 'g2', index: 2 }] as unknown as Gun[];
    const plan = planiHesapla({ mekanlar, gunler, duraklar: [] as Durak[] });
    expect(plan.atanmamis.length).toBe(1);
  });
});
