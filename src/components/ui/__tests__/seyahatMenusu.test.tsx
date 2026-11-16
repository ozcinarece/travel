// #274 (kanvas 29e): seyahat içi sekme "Keşfet" değil "Yer ekle"; rota adı `kesfet` kaldığı için eski derin bağlantı açılır.
import { describe, expect, it, jest } from '@jest/globals';
import { Tabs } from 'expo-router';
import { fireEvent, render } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { SeyahatMenusu, type SeyahatSekmesi } from '../SeyahatMenusu';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);

describe('#274 Yer ekle sekmesi', () => {
  it('KK1 · KK3: menüde "Yer ekle" yazar, "Keşfet" yazmaz; dokununca kesfet rotası seçilir', () => {
    const sec = jest.fn<(ad: SeyahatSekmesi) => void>();
    const ekran = render(<SeyahatMenusu aktif="kesfet" onSec={sec} />);
    expect(ekran.getByText('Yer ekle')).toBeTruthy();
    expect(ekran.queryByText('Keşfet')).toBeNull();
    expect(ekran.getAllByRole('tab').map((s) => s.props.accessibilityState?.selected)).toEqual([false, false, true, false, false]);
    fireEvent.press(ekran.getByText('Yer ekle'));
    expect(sec).toHaveBeenCalledWith('kesfet');
  });

  it('KK4: rota adı değişmedi — eski /seyahat/[id]/kesfet bağlantısı aynı ekranı açar', () => {
    const SekmeDuzeni = () => (
      <Tabs initialRouteName="gezi" screenOptions={{ headerShown: false }} tabBar={() => null}>
        <Tabs.Screen name="gezi" />
        <Tabs.Screen name="kesfet" />
      </Tabs>
    );
    const ekran = renderRouter(
      {
        'seyahat/[id]/(sekmeler)/_layout': SekmeDuzeni,
        'seyahat/[id]/(sekmeler)/gezi': () => <Text>gezi</Text>,
        'seyahat/[id]/(sekmeler)/kesfet': () => <Text>yer ekle ekranı</Text>,
      },
      { initialUrl: '/seyahat/s1/kesfet' },
    );
    expect(ekran.getPathname()).toBe('/seyahat/s1/kesfet');
    expect(ekran.getByText('yer ekle ekranı')).toBeTruthy();
  });
});
