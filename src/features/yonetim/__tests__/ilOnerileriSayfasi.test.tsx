import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import IlOnerileriSayfasi from '@/app/(yonetim)/yonetim/(panel)/il-onerileri';
import { ty } from '@/features/yonetim/metin';

const mockEkle = jest.fn(async (..._: unknown[]) => undefined);

jest.mock('expo-router', () => ({
  router: { setParams: jest.fn() },
  useLocalSearchParams: () => ({ il: 'bolu' }),
  usePathname: () => '/yonetim/il-onerileri',
}));
jest.mock('@/components/yonetim/Kabuk', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    YonetimSayfasi: ({ eylemler, children }: { eylemler?: React.ReactNode; children?: React.ReactNode }) => (
      <View>
        {eylemler}
        {children}
      </View>
    ),
    Aciklama: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});
// Arama: Google önerisinin adı (Autocomplete) bu satırda gelir; sayfa onu saklamamalı.
jest.mock('@/components/yonetim/gezi/MekanArama', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MekanArama: ({ onKimlik, onKimlikBirak }: { onKimlik: (y: { place_id: string; tip: string | null }) => void; onKimlikBirak?: () => void }) => (
      <>
        <Pressable accessibilityRole="button" onPress={() => onKimlik({ place_id: 'ChIJ-test', tip: 'park' })}>
          <Text>öneri</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onKimlikBirak?.()}>
          <Text>metni değiştir</Text>
        </Pressable>
      </>
    ),
  };
});
jest.mock('@/features/yonetim/geziSorgulari', () => ({ useYonetimSehirleri: () => ({ data: [] }) }));
jest.mock('@/features/yonetim/ilOneriSorgulari', () => ({
  IL_LISTELERI: ['il-listeleri'],
  ilOnerileriAnahtari: (s: string) => ['il-oneriler', s],
  useIlListeleri: () => ({ data: [{ il_slug: 'bolu', il: 'Bolu', yayinda: false, degistiren: 'rehber', degisti_at: null }] }),
  useIlOnerileri: () => ({ data: [] }),
  ilOneriEkle: (...a: unknown[]) => mockEkle(...a),
  ilListesiYayinla: jest.fn(),
  ilOneriGuncelle: jest.fn(),
  ilOneriSil: jest.fn(),
  ilOneriSirala: jest.fn(),
}));

// #401 / PRD §7: "+ Yer ekle" Google adını DB'ye yazmaz; ad kutusu boş açılır, Ece'nin yazdığı ad kaydedilir.
describe('İl önerileri: + Yer ekle (#401)', () => {
  it('ad kutusu boş açılır; kaydedilen ad Ece’nin metni', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
    const { getByRole, getByLabelText, queryByLabelText, queryByRole, queryByDisplayValue } = render(
      <QueryClientProvider client={qc}>
        <IlOnerileriSayfasi />
      </QueryClientProvider>,
    );
    fireEvent.press(getByRole('button', { name: '+ Yer ekle' }));
    fireEvent.press(getByRole('button', { name: 'öneri' }));
    const kutu = getByLabelText('AD');
    expect(kutu.props.value).toBe('');
    expect(queryByDisplayValue('GOOGLE ADI')).toBeNull();
    expect(queryByRole('button', { name: 'Kaydet' })).toBeNull();
    fireEvent.changeText(kutu, ' Abant Gölü ');
    fireEvent.press(getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(mockEkle).toHaveBeenCalled());
    expect(mockEkle.mock.calls[0][1]).toEqual({ place_id: 'ChIJ-test', tip: 'park', ad: 'Abant Gölü' });
    await waitFor(() => expect(queryByLabelText('AD')).toBeNull());
  });

  it('kayıt hatasında yazılan ad kutuda kalır ve "kaydedilemedi" çıkar', async () => {
    mockEkle.mockClear();
    mockEkle.mockImplementationOnce(async () => {
      throw new Error('ag');
    });
    const { getByRole, getByLabelText, findByText } = sayfa();
    fireEvent.press(getByRole('button', { name: '+ Yer ekle' }));
    fireEvent.press(getByRole('button', { name: 'öneri' }));
    fireEvent.changeText(getByLabelText('AD'), 'Gölcük');
    fireEvent.press(getByRole('button', { name: 'Kaydet' }));
    await findByText(ty('ilOneri.kaydedilemedi'));
    expect(getByLabelText('AD').props.value).toBe('Gölcük');
  });

  it('arama "+ Yer ekle" ile kapanınca ad satırı da kapanır', () => {
    const { getByRole, getByLabelText, queryByLabelText } = sayfa();
    fireEvent.press(getByRole('button', { name: '+ Yer ekle' }));
    fireEvent.press(getByRole('button', { name: 'öneri' }));
    fireEvent.changeText(getByLabelText('AD'), 'Gölcük');
    fireEvent.press(getByRole('button', { name: '+ Yer ekle' }));
    expect(queryByLabelText('AD')).toBeNull();
    fireEvent.press(getByRole('button', { name: '+ Yer ekle' }));
    expect(queryByLabelText('AD')).toBeNull();
  });

  it('seçimden sonra arama metni değişince seçim bırakılır, ad satırı ve Kaydet kapanır', () => {
    mockEkle.mockClear();
    const { getByRole, getByLabelText, queryByLabelText, queryByRole } = sayfa();
    fireEvent.press(getByRole('button', { name: '+ Yer ekle' }));
    fireEvent.press(getByRole('button', { name: 'öneri' }));
    fireEvent.changeText(getByLabelText('AD'), 'Gölcük');
    fireEvent.press(getByRole('button', { name: 'metni değiştir' }));
    expect(queryByLabelText('AD')).toBeNull();
    expect(queryByRole('button', { name: 'Kaydet' })).toBeNull();
    expect(mockEkle).not.toHaveBeenCalled();
  });
});

function sayfa() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } })}>
      <IlOnerileriSayfasi />
    </QueryClientProvider>,
  );
}
