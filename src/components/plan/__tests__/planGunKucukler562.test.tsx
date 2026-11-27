// #562 (#558 takibi): akşam geçince "akşam boş" yok, ekran okuyucu ayıracı ", ", "Haritaya dön" 44 pt, boş günde tek boşluk.
import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { gunAlti, gunSatiriEtiketi } from '@/components/listem/GuneEkleSayfasi';
import {
  durakEtiketi,
  HARITAYA_DON_ALAN,
  HARITAYA_DON_HAP,
  haritayaDonYerlesimi,
  KAYDEDILDI_SATIR,
  KAYDEDILDI_UST,
  KAYDEDILDI_YAZI_CARPANI,
  LISTE_BASLIK_UST_BOSLUK,
  LISTE_BASLIK_YUKSEKLIK,
  ListemBekliyorSatiri,
} from '@/components/plan/PlanListesi';
import { AKSAM_BITIS_DK, bugunDurumu, type GunSecenegi } from '@/features/listem/listem';
import { t } from '@/i18n';
import { okunurAyrac } from '@/lib/okunur';

jest.mock('@/components/ui/Foto', () => ({ Foto: () => null }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));

const satir = (durum: string, ayrilisDk: number) => ({ durum, ayrilisDk }) as never;

describe('Plan gün v7p küçükleri 2 (#562)', () => {
  it('KK1: seyahat saatiyle 21:00 ve sonrasında "akşam boş" yok; öncesinde 17:00 eşiği aynen', () => {
    const canli = { satirlar: [satir('gecildi', 600), satir('gecildi', 700)] };
    expect(AKSAM_BITIS_DK).toBe(21 * 60);
    expect(bugunDurumu(canli)).toEqual({ gezilen: 2, aksamBos: true });
    expect(bugunDurumu(canli, 20 * 60 + 59)).toEqual({ gezilen: 2, aksamBos: true });
    expect(bugunDurumu(canli, 21 * 60)).toEqual({ gezilen: 2, aksamBos: false });
    expect(bugunDurumu(canli, 23 * 60 + 30)).toEqual({ gezilen: 2, aksamBos: false });
    // Akşam doluysa saat ne olursa olsun boş değil (#532 eşiği).
    expect(bugunDurumu({ satirlar: [satir('gecildi', 600), satir('siradaki', 1140)] }, 18 * 60)).toEqual({ gezilen: 1, aksamBos: false });
    // 21:00 sonrası alt satır yalnız "N durak gezildi".
    const o = { gun: { id: 'g', index: 2, date: '2026-11-27' }, durakSayisi: 3, enYakinM: 400, sonGun: false } as unknown as GunSecenegi;
    expect(gunAlti(o, false, bugunDurumu(canli, 21 * 60 + 5))).toBe(t('listem.guneEkle.gezildi', { n: 2 }));
  });

  it('KK2: ekran okuyucu etiketlerinde " · " yok, ", " var; görünen alt satır değişmez', () => {
    expect(okunurAyrac('Müze · 1 sa · Pzt kapalı')).toBe('Müze, 1 sa, Pzt kapalı');
    expect(okunurAyrac('Paral·lel')).toBe('Paral·lel');
    expect(durakEtiketi({ saat: null, ad: 'Col·legi', alt: 'Müze · 1 sa', vurgulu: false })).toBe('Col·legi, Müze, 1 sa');
    const r = { saat: '10:42', ad: 'Pantheon', alt: 'Müze · 1 sa', vurgulu: false };
    expect(durakEtiketi(r)).toBe('10:42, Pantheon, Müze, 1 sa');
    expect(r.alt).toBe('Müze · 1 sa');

    const o = { gun: { id: 'g', index: 2, date: '2026-11-27' }, durakSayisi: 3, enYakinM: 400, sonGun: false } as unknown as GunSecenegi;
    const alt = gunAlti(o, false, { gezilen: 2, aksamBos: true });
    expect(alt).toContain(' · ');
    const etiket = gunSatiriEtiketi('Cum 27', alt, { gecti: false, enYakin: true });
    expect(etiket).not.toContain('·');
    expect(etiket).toBe(`Cum 27, ${t('listem.guneEkle.gezildi', { n: 2 })}, ${t('listem.guneEkle.aksamBos')}, ${t('listem.guneEkle.enYakinRozet')}`);
  });

  it('KK3: "Haritaya dön" dokunma alanı en az 44 pt', () => {
    expect(HARITAYA_DON_ALAN).toBeGreaterThanOrEqual(44);
    // Görünen hap kanvastaki gibi 36 pt ve dokunma alanının üstünde.
    expect(HARITAYA_DON_HAP).toBe(36);
    expect(HARITAYA_DON_HAP).toBeLessThan(HARITAYA_DON_ALAN);
  });

  it('KK3: "Kaydedildi" hapın alt kenarından 4 pt aşağıda ve başlık satırından taşmıyor', () => {
    expect(KAYDEDILDI_UST).toBe(HARITAYA_DON_HAP + 4);
    // "Kaydedildi" varken kap satırın, hap alanın üstüne yaslı → alt kenarı (büyük yazıda da) satırın içinde kalır.
    expect(haritayaDonYerlesimi(true).kap.alignSelf).toBe('flex-start');
    expect(haritayaDonYerlesimi(true).alan).toEqual({ height: HARITAYA_DON_ALAN, justifyContent: 'flex-start' });
    expect(LISTE_BASLIK_UST_BOSLUK + KAYDEDILDI_UST + KAYDEDILDI_SATIR * KAYDEDILDI_YAZI_CARPANI).toBeLessThanOrEqual(LISTE_BASLIK_YUKSEKLIK);
    // Yokken kanvastaki gibi ortalı: hap gün karesiyle aynı merkezde.
    expect(haritayaDonYerlesimi(false).kap.alignSelf).toBe('center');
    expect(haritayaDonYerlesimi(false).alan.justifyContent).toBe('center');
    // 44 pt dokunma alanı da satırın içinde.
    expect(LISTE_BASLIK_UST_BOSLUK + HARITAYA_DON_ALAN).toBeLessThanOrEqual(LISTE_BASLIK_YUKSEKLIK);
  });

  it('KK4: harita panelinin boş gün halinde Listem satırı kendi üst boşluğunu eklemez (tek boşluk, tek çizgi)', () => {
    const ust = (props: { bosGun?: boolean; kapBosluklu?: boolean }) => {
      const { getByTestId } = render(<ListemBekliyorSatiri n={2} onPress={() => undefined} {...props} />);
      const stil = getByTestId('listemBekliyor').props.style;
      return StyleSheet.flatten(typeof stil === 'function' ? stil({ pressed: false }) : stil);
    };
    expect(ust({ kapBosluklu: true }).marginTop).toBe(0);
    expect(ust({ kapBosluklu: true }).borderTopWidth).toBe(1);
    expect(ust({}).marginTop).toBe(10);
    expect(ust({ bosGun: true }).marginTop).toBe(22);
  });
});
