import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render } from '@testing-library/react-native';

import { MekanArama } from '@/components/yonetim/gezi/MekanArama';
import { ty } from '@/features/yonetim/metin';

jest.mock('@/features/yerler/api', () => ({
  useOneriler: () => ({ data: [{ place_id: 'ChIJ-a', ana: 'Öneri A', ikincil: 'Bolu', tipler: ['park'] }], isFetching: false }),
  hafifYerler: jest.fn(),
  linkCoz: jest.fn(),
  linkGibiMi: () => false,
  yeniOturumJetonu: () => 'oturum',
}));

// #401: onKimlik kipinde seçimden sonra arama metni ve seçili satır, Kaydet/Vazgeç'e kadar ekranda kalır; Google adı dışarı verilmez.
describe('MekanArama onKimlik kipi (#401)', () => {
  it('seçim ekranda kalır, seciliKimlik boşalınca temizlenir', async () => {
    const onKimlik = jest.fn((_: unknown) => undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
    const ui = (secili: string | null) => (
      <QueryClientProvider client={qc}>
        <MekanArama merkez={undefined} onKimlik={onKimlik} seciliKimlik={secili} etiket="Ara" />
      </QueryClientProvider>
    );
    const { getByLabelText, getByRole, findByLabelText, queryByText, rerender } = render(ui(null));
    fireEvent.changeText(getByLabelText('Ara'), 'abant');
    fireEvent.press(getByRole('menuitem'));
    expect(onKimlik).toHaveBeenCalledWith({ place_id: 'ChIJ-a', tip: 'park' });
    rerender(ui('ChIJ-a'));
    expect(getByLabelText('Ara').props.value).toBe('abant');
    await findByLabelText(/^Öneri A/);
    expect(queryByText(ty('gezi.aramaEkle'))).toBeNull();
    rerender(ui(null));
    expect(getByLabelText('Ara').props.value).toBe('');
    expect(queryByText('Öneri A')).toBeNull();
  });

  it('seçimden sonra metin değişirse seçim bırakılır, yeni yazılan metin silinmez', async () => {
    const onKimlik = jest.fn((_: unknown) => undefined);
    const onKimlikBirak = jest.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
    const ui = (secili: string | null) => (
      <QueryClientProvider client={qc}>
        <MekanArama merkez={undefined} onKimlik={onKimlik} onKimlikBirak={onKimlikBirak} seciliKimlik={secili} etiket="Ara" />
      </QueryClientProvider>
    );
    const { getByLabelText, getByRole, rerender } = render(ui(null));
    fireEvent.changeText(getByLabelText('Ara'), 'abant');
    // Seçimden önce metin değişmesi seçim bırakmaz.
    expect(onKimlikBirak).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(getByRole('menuitem'));
    });
    rerender(ui('ChIJ-a'));
    fireEvent.changeText(getByLabelText('Ara'), 'abant gö');
    expect(onKimlikBirak).toHaveBeenCalledTimes(1);
    rerender(ui(null));
    expect(getByLabelText('Ara').props.value).toBe('abant gö');
  });
});
