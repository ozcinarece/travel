import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { Kabuk, YonetimSayfasi } from '../Kabuk';

let mockYol = '/yonetim/geziler';
jest.mock('expo-router', () => ({
  usePathname: () => mockYol,
  Link: ({ children }: { children: ReactNode }) => children,
}));

let mockGenislik = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockGenislik, height: 900, scale: 1, fontScale: 1 }),
}));

function genislik(width: number) {
  mockGenislik = width;
}

const MENU = ['Genel bakış', 'Geziler', 'Yerler', 'Şehirler', 'Ana sayfa düzeni', 'Kullanıcılar', 'Ayarlar'];

// #106 KK4: kabuk render — sol menü, seçili öğe, kullanıcı satırı, üst çubuk; dar ekranda açılır-kapanır menü.
describe('Kabuk (#106)', () => {

  it('geniş ekranda 7 menü öğesi, bulunulan sayfa seçili, admin satırı ve üst çubuk', () => {
    genislik(1440);
    mockYol = '/yonetim/geziler';
    const { getByText, getByRole } = render(
      <Kabuk kullanici={{ ad: 'Ece', harf: 'E' }}>
        <YonetimSayfasi baslik="Geziler" />
      </Kabuk>,
    );
    for (const ad of MENU) expect(getByRole('link', { name: ad })).toBeTruthy();
    expect(getByRole('link', { name: 'Geziler' }).props.accessibilityState).toEqual({ selected: true });
    expect(getByRole('link', { name: 'Genel bakış' }).props.accessibilityState).toEqual({ selected: false });
    expect(getByText('Ece · admin')).toBeTruthy();
    expect(getByRole('header', { name: 'Geziler' })).toBeTruthy();
  });

  it('dar ekranda menü kapalı başlar, "Yönetim"e basınca açılır ve kapanır', () => {
    genislik(800);
    const { getByRole, queryByRole, getByText } = render(
      <Kabuk kullanici={null}>
        <Text>gövde</Text>
      </Kabuk>,
    );
    expect(queryByRole('link', { name: 'Yerler' })).toBeNull();
    expect(getByText('gövde')).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Menüyü aç' }));
    expect(getByRole('link', { name: 'Yerler' })).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Menüyü kapat' }));
    expect(queryByRole('link', { name: 'Yerler' })).toBeNull();
  });

  it('oturumsuz/admin olmayanda kullanıcı satırı yok', () => {
    genislik(1440);
    const { queryByText } = render(<Kabuk kullanici={null}>{null}</Kabuk>);
    expect(queryByText(/· admin/)).toBeNull();
  });
});
