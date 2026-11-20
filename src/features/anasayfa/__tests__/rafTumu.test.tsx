// #428 inceleme 3: rafın "Tümü" ekranı (`/geziler?raf=…`) — yükleniyor, hata + Tekrar dene ve boş raf halleri.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import GezilerEkrani from '@/app/geziler';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ raf: 'r1' }) }));
jest.mock('@/components/icerik/GeziKarti', () => ({
  GeziKarti: ({ gezi }: { gezi: { baslik: string } }) => {
    const { Text: T } = jest.requireActual<{ Text: typeof Text }>('react-native');
    return <T>{gezi.baslik}</T>;
  },
}));
jest.mock('@/features/icerik/sorgular', () => ({ useGeziler: () => ({ data: [] }), useSehirler: () => ({ data: [] }) }));

type Sorgu = { data: unknown[] | undefined; isPending: boolean; isError: boolean; refetch: jest.Mock };
const sorgu = (): Sorgu => ({ data: undefined, isPending: false, isError: false, refetch: jest.fn() });
let mockBolumler = sorgu();
let mockAkis = sorgu();
jest.mock('@/lib/anaSayfa', () => ({ useAnaSayfaBolumleri: () => mockBolumler }));
jest.mock('@/features/icerik/kesfetAkisi', () => ({ useKesfetAkisi: () => mockAkis }));

const gezi = (id: string) => ({ id, slug: id, baslik: `Gezi ${id}`, sehir_id: 's1', amaclar: ['lezzet'] });
const raf = (gezi_idler: string[]) => ({ id: 'r1', tur: 'raf', baslik: 'Hafta sonu kaçamakları', icerik: { raf_turu: 'elle', gezi_idler } });

beforeEach(() => {
  mockBolumler = sorgu();
  mockAkis = sorgu();
});

describe('#428 inceleme 3: raf "Tümü" ekranı', () => {
  it('bölümler yüklenirken gösterge; "Önerilen geziler" başlığı ve boş metin bir an bile görünmez', () => {
    mockBolumler.isPending = true;
    mockAkis.data = [gezi('a')];
    const e = render(<GezilerEkrani />);
    expect(e.getByLabelText('Yükleniyor…')).toBeTruthy();
    expect(e.queryByText('Önerilen geziler')).toBeNull();
    expect(e.queryByText('Bu filtreyle gezi yok')).toBeNull();
    expect(e.queryByText('Bu rafta şu an gezi yok')).toBeNull();
  });

  it('okunamazsa hata satırı ve Tekrar dene; yalnız hata veren sorgu yenilenir', () => {
    mockBolumler.isError = true;
    mockAkis.data = [gezi('a')];
    const e = render(<GezilerEkrani />);
    expect(e.getByText('Geziler yüklenemedi. Bağlantın düzelince tekrar dene.')).toBeTruthy();
    fireEvent.press(e.getByRole('button', { name: 'Tekrar dene' }));
    expect(mockBolumler.refetch).toHaveBeenCalledTimes(1);
    expect(mockAkis.refetch).not.toHaveBeenCalled();
  });

  it('raf bulunur: başlık rafın adı, bütün geziler', () => {
    mockBolumler.data = [raf(['a', 'b', 'c'])];
    mockAkis.data = [gezi('a'), gezi('b'), gezi('c')];
    const e = render(<GezilerEkrani />);
    expect(e.getByRole('header', { name: 'Hafta sonu kaçamakları' })).toBeTruthy();
    expect(e.getAllByText(/^Gezi /)).toHaveLength(3);
    expect(e.queryByText('Bu rafta şu an gezi yok')).toBeNull();
  });

  it('raf bulunamaz ya da boşsa "Bu rafta şu an gezi yok"', () => {
    mockBolumler.data = [raf(['a'])];
    mockAkis.data = [gezi('a')];
    const e = render(<GezilerEkrani />);
    expect(e.getByText('Bu rafta şu an gezi yok')).toBeTruthy();
    expect(e.queryByText('Bu filtreyle gezi yok')).toBeNull();
  });
});
