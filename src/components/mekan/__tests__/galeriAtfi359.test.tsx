// #359: Google foto atfı bağlantısı galeride ve kaydırmalı panelde de (#351 ile aynı davranış).
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { FotoSayfasi } from '@/components/yerler/FotoGalerisi';
import type { TamYer } from '@/features/yerler/api';

import { fotoListesi } from '../../../../supabase/functions/_shared/fotoAtfi';
import { FotoKaydirma } from '../MekanPaneli';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })) }));
jest.mock('@/features/yerler/api', () => ({
  ...(jest.requireActual('@/features/yerler/api') as object),
  usePlaceFoto: () => ({ data: null, isPending: false, isError: false }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn(), hataBildir: jest.fn() }));

const URI = 'https://maps.google.com/maps/contrib/123';

function yer(fotolar: TamYer['fotolar']): TamYer {
  return {
    place_id: 'p1', ad: 'Mekan', lat: 0, lng: 0, primary_type: 'cafe', puan: null, puan_sayisi: null, acik: null, kapanis: null,
    acilis: null, saatler: [], bugun: null, adres: null, ozet: null, foto_uri: 'https://ornek/ilk.jpg', fotolar, google_maps_uri: null,
  };
}

describe('KK1 fotoListesi (places-full)', () => {
  it('her fotoğrafta yazar ve yalnız https bağlantı; ad yoksa bağlantı yok; en çok 10', () => {
    const liste = fotoListesi([
      { name: 'a', authorAttributions: [{ displayName: 'Ali', uri: URI }] },
      { name: 'b', authorAttributions: [{ displayName: 'Ayşe', uri: 'http://duz.example' }] },
      { name: 'c', authorAttributions: [{ uri: URI }] },
      { name: 'd' },
      ...Array.from({ length: 10 }, (_, i) => ({ name: `x${i}` })),
    ]);
    expect(liste).toHaveLength(10);
    expect(liste.slice(0, 4)).toEqual([
      { ad: 'a', yazar: 'Ali', yazar_uri: URI },
      { ad: 'b', yazar: 'Ayşe', yazar_uri: null },
      { ad: 'c', yazar: null, yazar_uri: null },
      { ad: 'd', yazar: null, yazar_uri: null },
    ]);
    expect(fotoListesi(undefined)).toEqual([]);
  });
});

describe('KK2/KK4 FotoGalerisi sayfası', () => {
  it('bağlantı varsa kutu link; dokununca yazarın sayfası açılır', () => {
    render(<FotoSayfasi foto={{ ad: 'a', yazar: 'Ali', yazar_uri: URI }} hazirUri="https://ornek/1.jpg" yukle={false} />);
    const kutu = screen.getByTestId('google-foto-atfi');
    expect(kutu.props.accessibilityRole).toBe('link');
    fireEvent.press(kutu);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(URI);
  });
  it('bağlantı yoksa ya da https değilse kutu dokunulmaz', () => {
    const { rerender } = render(<FotoSayfasi foto={{ ad: 'a', yazar: 'Ali', yazar_uri: null }} hazirUri={null} yukle={false} />);
    expect(screen.queryByTestId('google-foto-atfi')).toBeNull();
    rerender(<FotoSayfasi foto={{ ad: 'a', yazar: 'Ali', yazar_uri: 'http://duz.example' }} hazirUri={null} yukle={false} />);
    expect(screen.queryByTestId('google-foto-atfi')).toBeNull();
  });
});

describe('KK3 kaydırmalı panel', () => {
  it('kutunun içi yazarın sayfasını açar, fotoğraf galeriyi açar', () => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
    const onAc = jest.fn();
    render(<FotoKaydirma yer={yer([{ ad: 'a', yazar: 'Ali', yazar_uri: URI }])} genislik={390} onAc={onAc} />);
    fireEvent.press(screen.getByTestId('google-foto-atfi'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(URI);
    expect(onAc).not.toHaveBeenCalled();
    fireEvent.press(screen.getAllByRole('imagebutton')[0]);
    expect(onAc).toHaveBeenCalledTimes(1);
  });
  it('bağlantı yoksa kutu dokunulmaz (bugünkü gibi)', () => {
    render(<FotoKaydirma yer={yer([{ ad: 'a', yazar: 'Ali', yazar_uri: null }])} genislik={390} onAc={jest.fn()} />);
    expect(screen.queryByTestId('google-foto-atfi')).toBeNull();
  });
});
