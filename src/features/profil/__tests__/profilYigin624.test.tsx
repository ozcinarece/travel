// #624 (kanvas `Profil_v12_Kendi`): profil `(tabs)` yığınında. Üç girişten açılıp geri dönüş (KK2 · KK5), alt menü yok (KK3),
// doğrudan profilde açılışta geri oku Keşfet'e götürür (KK4). Gezgin yapısı `src/app` ile aynı: kök yığın › `(tabs)` yığını ›
// `(menu)` sekmeleri; profil `(tabs)/profil`.
import { describe, expect, it, jest } from '@jest/globals';
import { Stack, router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, fireEvent } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { profilGeri } from '@/components/profil/ProfilV12';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const Menu = () => <Text testID="alt-menu">menu</Text>;
const Profil = () => (
  <View>
    <Text>profil</Text>
    <Pressable testID="profil-geri" onPress={profilGeri} />
  </View>
);

const kur = (initialUrl = '/') =>
  renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/(menu)/_layout': () => <Tabs screenOptions={{ headerShown: false }} backBehavior="initialRoute" tabBar={() => <Menu />} />,
      '(tabs)/(menu)/index': () => <Text>kesfet</Text>,
      '(tabs)/(menu)/seyahatler': () => <Text>gezilerim</Text>,
      '(tabs)/profil': Profil,
      'seyahat/[id]': () => <Text>seyahat</Text>,
    },
    { initialUrl },
  );

describe('#624 profil yığında', () => {
  it('KK2 · KK3 · KK5: sağ üstteki yuvarlak (Keşfet) → profil, alt menü yok; geri Keşfet', () => {
    const e = kur();
    expect(screen.getByTestId('alt-menu')).toBeTruthy();
    act(() => router.navigate('/(tabs)/profil'));
    expect(e.getPathname()).toBe('/profil');
    expect(screen.queryByTestId('alt-menu')).toBeNull();
    act(() => router.back());
    expect(e.getPathname()).toBe('/');
    expect(screen.getByText('kesfet')).toBeTruthy();
  });

  it('KK2 · KK5: seyahatin içinden (grup penceresi, profil onayı) → profil; geri seyahate döner', () => {
    const e = kur();
    act(() => router.push({ pathname: '/seyahat/[id]', params: { id: 'a' } } as never));
    act(() => router.navigate('/(tabs)/profil'));
    expect(e.getPathname()).toBe('/profil');
    expect(screen.queryByTestId('alt-menu')).toBeNull();
    act(() => router.back());
    expect(e.getPathname()).toBe('/seyahat/a');
  });

  it('KK2: profildeki geri oku da açıldığı ekrana döner', () => {
    const e = kur();
    act(() => router.push({ pathname: '/seyahat/[id]', params: { id: 'a' } } as never));
    act(() => router.navigate('/(tabs)/profil'));
    fireEvent.press(screen.getByTestId('profil-geri'));
    expect(e.getPathname()).toBe('/seyahat/a');
  });

  it('KK4: doğrudan profilde açılış: geri oku boş ekrana değil Keşfet\'e götürür', () => {
    const e = kur('/profil');
    expect(screen.getByText('profil')).toBeTruthy();
    expect(router.canGoBack()).toBe(false);
    fireEvent.press(screen.getByTestId('profil-geri'));
    expect(e.getPathname()).toBe('/');
    expect(screen.getByText('kesfet')).toBeTruthy();
  });
});
