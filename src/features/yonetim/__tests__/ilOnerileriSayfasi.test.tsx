import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import IlOnerileriSayfasi from '@/app/(yonetim)/yonetim/(panel)/il-onerileri';

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
    MekanArama: ({ onKimlik }: { onKimlik: (y: { place_id: string; ad: string; tip: string | null }) => void }) => (
      <Pressable accessibilityRole="button" onPress={() => onKimlik({ place_id: 'ChIJ-test', ad: 'GOOGLE ADI', tip: 'park' })}>
        <Text>öneri</Text>
      </Pressable>
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
    const qc = new QueryClient();
    const { getByRole, getByLabelText, queryByRole, queryByDisplayValue } = render(
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
  });
});
