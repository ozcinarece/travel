import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { OtelSayfasi } from '@/components/program/OtelSayfasi';
import { takmaAdDegeri } from '@/features/konaklama/plan';
import { t } from '@/i18n';
import type { Seyahat } from '@/lib/tipler';
import { renk } from '@/theme';

const mockAdYaz = jest.fn<(g: { stayId: string; takmaAd: string }) => Promise<void>>();

jest.mock('@/components/ui/AltPencere', () => ({ AltPencere: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/sayfaCekme', () => {
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SayfaMetinAlani: TextInput };
});
jest.mock('@/features/konaklama/sorgular', () => ({ useOtelTakmaAdi: () => ({ mutateAsync: mockAdYaz }) }));
jest.mock('@/features/yerler/api', () => ({
  useOtelOnerileri: () => ({ data: [{ place_id: 'ChIJ-otel', ana: 'Grand Otel', ikincil: 'Odunpazarı, Eskişehir', tipler: ['lodging'] }], isFetching: false }),
  hafifYerler: async () => [{ place_id: 'ChIJ-otel', ad: 'Grand Otel', lat: 39.77, lng: 30.52, puan: 4.6 }],
  yeniOturumJetonu: () => 'oturum',
  placesHatasi: (_: unknown, yedek: string) => yedek,
}));

const seyahat = { id: 's1', start_date: null, end_date: null, city_lat: 39.77, city_lng: 30.52 } as unknown as Seyahat;

function kur(onKaydet = jest.fn(async () => 'stay-1' as string | null), konaklamalar?: Parameters<typeof OtelSayfasi>[0]['konaklamalar']) {
  const onKapat = jest.fn();
  const ekran = render(<OtelSayfasi acik seyahat={seyahat} geceSayisi={3} konaklamalar={konaklamalar} onKapat={onKapat} onSimdiDegil={jest.fn()} onKaydet={onKaydet} onAyriSec={jest.fn()} />);
  return { ...ekran, onKaydet, onKapat };
}

async function oteliSec(e: ReturnType<typeof kur>) {
  fireEvent.changeText(e.getByLabelText(t('program.otelSayfa.ara')), 'grand');
  await act(async () => {
    fireEvent.press(e.getByText('Grand Otel'));
  });
}

describe('Otele ad ver (#631, kanvas 6b)', () => {
  it('KK1: "Ad ekle" otel seçilmeden görünmez, seçilince çıkar', async () => {
    const e = kur();
    expect(e.queryByText(t('program.otelSayfa.adEkle'))).toBeNull();
    await oteliSec(e);
    expect(e.getByText(t('program.otelSayfa.adEkle'))).toBeTruthy();
    expect(e.getByText('Odunpazarı · ★ 4,6')).toBeTruthy();
  });

  it('KK2: alan etiketli, 80 sınırlı; sayaç 80\'de kalın ve ana renkte', async () => {
    const e = kur();
    await oteliSec(e);
    fireEvent.press(e.getByText(t('program.otelSayfa.adEkle')));
    const girdi = e.getByLabelText(t('program.otelSayfa.adEtiket'));
    expect(girdi.props.maxLength).toBe(80);
    expect(e.getByText(t('program.otelSayfa.adIpucu'))).toBeTruthy();
    expect(e.queryByText(t('program.otelSayfa.adEkle'))).toBeNull();
    fireEvent.changeText(girdi, 'Bizim otel');
    expect(e.getByText('10/80')).toBeTruthy();
    fireEvent.changeText(girdi, 'x'.repeat(80));
    const sayac = e.getByText('80/80');
    expect(sayac.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: renk.ana })]));
  });

  it('KK3: Kaydet oteli yazar, sonra adı o otelin kaydına yazar', async () => {
    const e = kur();
    await oteliSec(e);
    fireEvent.press(e.getByText(t('program.otelSayfa.adEkle')));
    fireEvent.changeText(e.getByLabelText(t('program.otelSayfa.adEtiket')), 'Bizim otel');
    mockAdYaz.mockResolvedValueOnce(undefined);
    await act(async () => {
      fireEvent.press(e.getByText(t('program.otelSayfa.kaydet')));
    });
    expect(e.onKaydet).toHaveBeenCalledWith(expect.objectContaining({ place_id: 'ChIJ-otel' }));
    expect(mockAdYaz).toHaveBeenLastCalledWith({ stayId: 'stay-1', takmaAd: 'Bizim otel' });
    expect(e.onKapat).toHaveBeenCalled();
  });

  it('KK3: alan hiç açılmadıysa ad yazılmaz', async () => {
    mockAdYaz.mockClear();
    const e = kur();
    await oteliSec(e);
    await act(async () => {
      fireEvent.press(e.getByText(t('program.otelSayfa.kaydet')));
    });
    expect(mockAdYaz).not.toHaveBeenCalled();
    expect(e.onKapat).toHaveBeenCalled();
  });

  it('KK3: ad yazımı düşerse hata görünür, sayfa açık kalır, otel kaydı geri alınmaz', async () => {
    const e = kur();
    await oteliSec(e);
    fireEvent.press(e.getByText(t('program.otelSayfa.adEkle')));
    fireEvent.changeText(e.getByLabelText(t('program.otelSayfa.adEtiket')), '   ');
    mockAdYaz.mockRejectedValueOnce(new Error('ağ'));
    await act(async () => {
      fireEvent.press(e.getByText(t('program.otelSayfa.kaydet')));
    });
    // Yalnız boşluk da gönderilir; `useOtelTakmaAdi` bunu `takmaAdDegeri` ile null'a çevirir.
    expect(mockAdYaz).toHaveBeenLastCalledWith({ stayId: 'stay-1', takmaAd: '   ' });
    expect(e.onKaydet).toHaveBeenCalledTimes(1);
    expect(e.getByText(t('program.otelSayfa.hata'))).toBeTruthy();
    expect(e.onKapat).not.toHaveBeenCalled();
  });

  it('KK4: ad verilince kart takma adı ve "{Google adı} · {semt}" gösterir; "Adı değiştir" alanı dolu açar', async () => {
    const e = kur();
    await oteliSec(e);
    fireEvent.press(e.getByText(t('program.otelSayfa.adEkle')));
    const girdi = e.getByLabelText(t('program.otelSayfa.adEtiket'));
    fireEvent.changeText(girdi, 'Bizim otel');
    fireEvent(girdi, 'submitEditing');
    await waitFor(() => expect(e.getByText('Bizim otel')).toBeTruthy());
    expect(e.getByText('Grand Otel · Odunpazarı')).toBeTruthy();
    fireEvent.press(e.getByText(t('program.otelSayfa.adDegistir')));
    expect(e.getByLabelText(t('program.otelSayfa.adEtiket')).props.value).toBe('Bizim otel');
  });

  it('KK4: kayıtlı otel yeniden seçilince takma adıyla gelir', async () => {
    const e = kur(undefined, [{ id: 'stay-1', trip_id: 's1', place_id: 'ChIJ-otel', lat: 39.77, lng: 30.52, label: 'Eski ad', takma_ad: 'Eski ad' }]);
    await oteliSec(e);
    expect(e.getByText('Eski ad')).toBeTruthy();
    expect(e.getByText(t('program.otelSayfa.adDegistir'))).toBeTruthy();
  });

  it('"Her gece aynı otel" kapalıyken ad alanı gösterilmez (geceler ekranında ad kaybolmasın)', async () => {
    const e = kur();
    await oteliSec(e);
    fireEvent(e.getByRole('switch'), 'valueChange', false);
    expect(e.queryByText(t('program.otelSayfa.adEkle'))).toBeNull();
  });

  it('takma ad değeri: dolu kırpılır, boş → null, 80 sınırı', () => {
    expect(takmaAdDegeri('  Bizim otel ')).toBe('Bizim otel');
    expect(takmaAdDegeri('   ')).toBeNull();
    expect(takmaAdDegeri('')).toBeNull();
    expect(takmaAdDegeri('x'.repeat(90))).toHaveLength(80);
  });
});
