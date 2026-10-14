// #189 KK3: görünür alanda az öneri kaldıysa çekmece yönlendirme satırını gösterir (listenin altında; boşsa yerinde).
import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

import type { HafifYer } from '@/features/yerler/api';

import { CekmeceSatirlari, type CekmeceOgesi } from '../OneriCekmecesi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const AZ = 'Bu bölgede öne çıkan yer az. Aramayla bulabilir ya da şehir rehberine bakabilirsin.';
const oge = (id: string): CekmeceOgesi => ({
  place_id: id,
  ad: `Yer ${id}`,
  primary_type: 'museum',
  puan: 4.6,
  foto_uri: null,
  oneCikan: false,
  dakika: 90,
  yer: { place_id: id } as HafifYer,
});
const ortak = { havuz: new Set<string>(), mesgulId: null, onEkle: () => undefined, onCikar: () => undefined, onAc: () => undefined };

describe('#189 KK3 çekmece "öne çıkan yer az" satırı', () => {
  it('iki öneri: satırlar ve altında yönlendirme', () => {
    const { getByText } = render(<CekmeceSatirlari liste={[oge('a'), oge('b')]} yukseklik={400} {...ortak} azMetni={AZ} />);
    expect(getByText('Yer a')).toBeTruthy();
    expect(getByText(AZ)).toBeTruthy();
  });

  it('hiç öneri yok: boş metin yerine yönlendirme', () => {
    const { getByText, queryByText } = render(<CekmeceSatirlari liste={[]} yukseklik={400} {...ortak} azMetni={AZ} />);
    expect(getByText(AZ)).toBeTruthy();
    expect(queryByText(/Bu bölgede öneri yok/)).toBeNull();
  });

  it('yeterli öneri (azMetni yok): satır çıkmaz; boşken eski metin', () => {
    expect(render(<CekmeceSatirlari liste={[oge('a'), oge('b'), oge('c')]} yukseklik={400} {...ortak} azMetni={null} />).queryByText(AZ)).toBeNull();
    expect(render(<CekmeceSatirlari liste={[]} yukseklik={400} {...ortak} />).getByText(/Bu bölgede öneri yok/)).toBeTruthy();
  });
});
