import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Genel } from '@/features/yonetim/genelBakis';

import { GoogleKarti, GostergeKarti, IcerikSagligi } from '../genel/GenelKartlar';

jest.mock('expo-router', () => ({ Link: ({ children }: { children: ReactNode }) => children }));

const google: Genel['google'] = { mekan: 120, foto: 300, rota: 200, yorum: 96, butce: 10, fiyat: { mekan: 17, foto: 7, rota: 5, yorum: 20 }, yorum_sinir: 300 };

// #157 KK7: olay yoksa "veri bekleniyor" (sıfır gösterilmez); KK4 Google kartı; KK6 içerik sağlığı.
describe('Genel bakış kartları (#157)', () => {
  it('olay yoksa değer yerine "veri bekleniyor"', () => {
    const { getByText, queryByText } = render(<GostergeKarti baslik="Kurulan plan" deger="0" bekleniyor />);
    expect(getByText('veri bekleniyor')).toBeTruthy();
    expect(queryByText('0')).toBeNull();
    expect(getByText('KURULAN PLAN')).toBeTruthy();
  });

  it('Google kartı: tahmini harcama / bütçe, kalemler, yorum n / sınır; sınır ayarı yoksa veri bekleniyor', () => {
    const { getByText, rerender } = render(<GoogleKarti google={google} />);
    expect(getByText('$7,06')).toBeTruthy();
    expect(getByText('/ günlük bütçe $10')).toBeTruthy();
    expect(getByText('Mekan bilgisi')).toBeTruthy();
    expect(getByText('96 / 300 · günlük sınır')).toBeTruthy();
    expect(getByText('Sınırları düzenle ›')).toBeTruthy();
    rerender(<GoogleKarti google={{ ...google, yorum_sinir: null }} />);
    expect(getByText('veri bekleniyor')).toBeTruthy();
  });

  it('içerik sağlığı: tamam özeti ve ilk eksik', () => {
    const { getByText } = render(
      <IcerikSagligi
        sehirler={[
          { id: 'a', ad: 'Eskişehir', kapak: true, genis_kapak: true, bolum: 5, bos_bolum: 0, mekan: 8, gezi: 2 },
          { id: 'b', ad: 'Bursa', kapak: true, genis_kapak: true, bolum: 4, bos_bolum: 2, mekan: 3, gezi: 1 },
          { id: 'c', ad: 'Kapadokya', kapak: true, genis_kapak: false, bolum: 3, bos_bolum: 0, mekan: 2, gezi: 1 },
        ]}
      />,
    );
    expect(getByText('Rehber 5 bölüm · 8 mekan · 2 hazır gezi')).toBeTruthy();
    expect(getByText('Rehberde 2 bölüm boş')).toBeTruthy();
    expect(getByText('Geniş kapak fotoğrafı yok')).toBeTruthy();
  });
});
