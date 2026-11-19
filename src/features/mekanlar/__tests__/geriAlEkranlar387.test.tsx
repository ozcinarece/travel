// #387 KK5: Hazır gezi, Yerler ve şehir rehberi ekranlarında ✓ → "Geri al" bandı → Geri al: silme isteği hiç gitmez (mekan, durak ve oy
// cascade ile silinmediği için durur); ✓ → 5 sn → mekan bir kez silinir. Veri kancaları taklit edilir; ortak kanca gerçek.
// Keşfet (Yer ekle): kesfetGeriAl387.test.tsx · kanca: geriAlinabilirSil.test.tsx.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { SehirRehberi } from '@/components/icerik/SehirRehberi';
import { t } from '@/i18n';

import GeziEkrani from '../../../app/gezi/[slug]';
import YerlerEkrani from '../../../app/yerler';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ slug: 'eskisehirde-bir-gun' }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));

const mockSil = jest.fn<(id: string, o?: unknown) => void>();
const mockEkle = jest.fn(async () => undefined);
const MEKAN = { id: 'm1', place_id: 'p1', primary_type: 'museum', lat: 39.7, lng: 30.5, default_minutes: 60, added_by: 'ben' };
jest.mock('@/features/mekanlar/sorgular', () => ({
  useMekanlar: (id?: string) => ({ data: id ? [MEKAN] : undefined }),
  useMekanSil: () => ({ mutate: mockSil, mutateAsync: mockSil, isPending: false }),
  useMekanEkle: () => ({ mutateAsync: mockEkle }),
  useMekanGuncelle: () => ({ mutate: jest.fn() }),
}));
let mockDuraklar: { place_ref: string; day_id: string }[] = [];
jest.mock('@/features/gunler/sorgular', () => ({
  useGunler: () => ({ data: [{ id: 'g1', index: 1 }, { id: 'g2', index: 2 }] }),
  useDuraklar: () => ({ data: mockDuraklar }),
}));

// Yerler ekranı verisi.
const HEDEF = { id: 't1', name: null, city_label: 'Eskişehir', start_date: null, end_date: null, tz: 'Europe/Istanbul', members: [], places: [] };
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahatler: () => ({ data: [HEDEF] }) }));
jest.mock('@/features/icerik/yerEkle', () => ({
  hedefSeyahatler: (l: unknown[] | undefined) => l ?? [],
  useYereEkle: () => ({ mutateAsync: mockEkle }),
  varsayilanHedef: (l: unknown[]) => l[0] ?? null,
}));
// Hazır gezi: tek gün, tek durak (Atlıhan); yazı yok (yalnız Rota & plan).
const GEZI = {
  id: 'gz1',
  slug: 'eskisehirde-bir-gun',
  baslik: 'Eskişehir’de bir gün',
  yazi_md: '',
  kapak_url: null,
  gun_sayisi: 1,
  mekan_sayisi: 1,
  created_at: '2026-10-14T17:00:00Z',
  sehirler: { ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null },
  gezi_gunleri: [{ id: 'G1', sira: 1, baslik: 'Odunpazarı', gezi_duraklari: [{ id: 'd1', sira: 1, place_id: 'p1', ad: 'Atlıhan', kategori: 'museum', sure_dk: 45, lat: 39.7, lng: 30.5 }] }],
};
type MockDurak = { id: string };
jest.mock('@/components/icerik/GeziPlani', () => {
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const { EkleDugmesi } = jest.requireActual<typeof import('@/components/ui/EkleDugmesi')>('@/components/ui/EkleDugmesi');
  return {
    GeziPlani: ({ gezi, listede, onDurakEkle, onDurak }: { gezi: { gezi_gunleri: { gezi_duraklari: MockDurak[] }[] }; listede: (d: MockDurak) => boolean; onDurakEkle: (d: MockDurak) => void; onDurak: (d: MockDurak) => void }) => (
      <View>
        {gezi.gezi_gunleri[0].gezi_duraklari.map((d) => (
          <View key={d.id}>
            <EkleDugmesi listede={listede(d)} onPress={() => onDurakEkle(d)} />
            <Pressable accessibilityLabel="durak-ac" onPress={() => onDurak(d)} />
          </View>
        ))}
      </View>
    ),
  };
});
jest.mock('@/components/icerik/Kalp', () => ({ Kalp: () => null }));
const YER = { id: 'y1', ad: 'Atlıhan', sehir_id: 's1', kategori: 'museum', lat: 39.7, lng: 30.5, kapak_url: null, sehirler: { ad: 'Eskişehir' } };
jest.mock('@/features/icerik/sorgular', () => ({
  useSehirler: () => ({ data: [] }),
  useTumYerler: () => ({ data: [YER], isPending: false }),
  // Şehir rehberi verisi: tek bölüm, yazıda tek mekan kartı.
  useSehirRehberi: () => ({ data: [{ id: 'b1', baslik: 'Odunpazarı', yazi_md: 'Atlıhan.\n\n[[kart:p1]]', sira: 1 }], isPending: false, isError: false }),
  useGeziler: () => ({ data: [] }),
  useGezi: () => ({ data: GEZI, isPending: false, isError: false }),
  useGeziAlinma: () => ({ data: 0 }),
  cozumSebebi: () => null,
  olayYaz: () => undefined,
  useSehirYerleri: () => ({ data: [] }),
}));
jest.mock('@/features/icerik/fotolar', () => ({
  ...jest.requireActual<object>('@/features/icerik/fotolar'),
  useIcerikCanli: () => ({ data: new Map([['y1', { place_id: 'p1', foto_uri: null }]]) }),
}));
jest.mock('@/features/icerik/mekanBilgileri', () => ({
  useIcerikMekanlari: () => ({ mekan: (id: string) => (id === 'p1' ? { ad: 'Atlıhan', kategori: 'museum', lat: 39.7, lng: 30.5 } : undefined), foto: () => null }),
}));
jest.mock('@/components/icerik/MdYazi', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { MdYazi: ({ mekanKarti }: { mekanKarti: (id: string) => unknown }) => <View>{mekanKarti('p1') as never}</View> };
});
// Panel: yalnız sabit bir kimlik ve CTA (✓); bandın panelin üstünde çizildiğini sıradan kontrol etmek için.
jest.mock('@/components/mekan/MekanPaneli', () => {
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MekanPaneli: ({ onCta }: { onCta: () => void }) => (
      <View testID="mekan-paneli">
        <Pressable accessibilityLabel="panel-cta" onPress={onCta} />
      </View>
    ),
  };
});
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));

beforeEach(() => {
  mockSil.mockReset();
  mockEkle.mockClear();
  mockDuraklar = [];
});
afterEach(() => {
  jest.useRealTimers();
});

const SEHIR = { id: 's1', ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null } as never;
const EKRANLAR: [string, () => React.ReactElement][] = [
  ['Hazır gezi', () => <GeziEkrani />],
  ['Yerler', () => <YerlerEkrani />],
  ['Şehir rehberi', () => <SehirRehberi sehir={SEHIR} sehirlerYukleniyor={false} onGeri={() => undefined} seyahat={HEDEF as never} />],
];

describe.each(EKRANLAR)('#387 %s: ✓ geri alınabilir', (_ad, ekran) => {
  it('✓ → bant → Geri al: silme isteği gitmez, ✓ geri gelir', () => {
    jest.useFakeTimers();
    render(ekran());
    fireEvent.press(screen.getByLabelText(t('ui.ekle.listede')));
    const bant = within(screen.getByTestId('geri-al-bandi'));
    expect(bant.getByText('Atlıhan listeden çıktı')).toBeTruthy();
    // Bant açıkken düğme + olur (listede sayılmaz).
    expect(screen.queryByLabelText(t('ui.ekle.listede'))).toBeNull();
    fireEvent.press(bant.getByRole('button', { name: t('listem.geriAl') }));
    act(() => jest.advanceTimersByTime(10_000));
    expect(mockSil).not.toHaveBeenCalled();
    expect(screen.queryByTestId('geri-al-bandi')).toBeNull();
    expect(screen.getByLabelText(t('ui.ekle.listede'))).toBeTruthy();
  });

  it('✓ → 5 sn → mekan bir kez silinir', () => {
    jest.useFakeTimers();
    render(ekran());
    fireEvent.press(screen.getByLabelText(t('ui.ekle.listede')));
    act(() => jest.advanceTimersByTime(4999));
    expect(mockSil).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockSil).toHaveBeenCalledTimes(1);
    expect(mockSil.mock.calls[0][0]).toBe('m1');
  });

  it('KK2: güne atanmış mekanda bant günü söyler', () => {
    mockDuraklar = [{ place_ref: 'm1', day_id: 'g2' }];
    render(ekran());
    fireEvent.press(screen.getByLabelText(t('ui.ekle.listede')));
    expect(screen.getByText('Atlıhan 2. günden de çıktı')).toBeTruthy();
  });

  it('bant açıkken + basılırsa çıkarma geri alınır; ekleme isteği gitmez', () => {
    render(ekran());
    fireEvent.press(screen.getByLabelText(t('ui.ekle.listede')));
    fireEvent.press(screen.getByLabelText(t('ui.ekle.ekle')));
    expect(screen.queryByTestId('geri-al-bandi')).toBeNull();
    expect(mockEkle).not.toHaveBeenCalled();
    expect(mockSil).not.toHaveBeenCalled();
  });
});

describe('#387 inceleme', () => {
  it('Hazır gezi: paneldeki ✓ sonrası bant panelden sonra çizilir (panelin üstünde görünür)', () => {
    render(<GeziEkrani />);
    fireEvent.press(screen.getByLabelText('durak-ac'));
    fireEvent.press(screen.getByLabelText('panel-cta'));
    const agac = JSON.stringify(screen.toJSON());
    expect(agac.indexOf('"geri-al-bandi"')).toBeGreaterThan(agac.indexOf('"mekan-paneli"'));
    expect(agac.indexOf('"mekan-paneli"')).toBeGreaterThan(-1);
  });

  it('Şehir rehberi: silme hatası bilgi bandında "listem.hata" olarak görünür', () => {
    jest.useFakeTimers();
    mockSil.mockImplementation((_id, o) => (o as { onError?: () => void } | undefined)?.onError?.());
    render(<SehirRehberi sehir={SEHIR} sehirlerYukleniyor={false} onGeri={() => undefined} seyahat={HEDEF as never} />);
    fireEvent.press(screen.getByLabelText(t('ui.ekle.listede')));
    act(() => jest.advanceTimersByTime(5000));
    expect(mockSil).toHaveBeenCalledTimes(1);
    expect(within(screen.getByTestId('geri-al-bandi')).getByText(t('listem.hata'))).toBeTruthy();
  });
});
