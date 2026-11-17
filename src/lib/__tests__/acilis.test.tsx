// #276 KK-ek1: "‹ Keşfet" her yoldan ana ekrana döner; Profil › Gezilerim yolundan gelinse de yığında Profil kalmaz.
import { describe, expect, it, jest } from '@jest/globals';
import { Stack, router } from 'expo-router';
import { act } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { acilisKarariAl, acilisKarariniKapat, acilisKarariniSifirla, kesfeteDon } from '../acilis';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);

const kur = () =>
  renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/index': () => <Text>kesfet</Text>,
      '(tabs)/profil': () => <Text>profil</Text>,
      'seyahat/[id]': () => <Text>seyahat</Text>,
    },
    { initialUrl: '/' },
  );

const icYigin = (e: ReturnType<typeof kur>) => {
  type Durum = { routes: { name: string; state?: Durum }[] };
  const kok = e.getRouterState() as unknown as Durum;
  const sekmeler = kok.routes[0].state!.routes.find((r) => r.name === '(tabs)')!;
  return { kok: kok.routes[0].state!.routes.map((r) => r.name), ic: sekmeler.state!.routes.map((r) => r.name) };
};

describe('kesfeteDon (#276 KK-ek1)', () => {
  it('Keşfet → Profil → Gezilerim satırı → kapakta "‹ Keşfet": ana ekran, altta Profil yok', () => {
    const e = kur();
    act(() => router.push('/(tabs)/profil' as never));
    act(() => router.push({ pathname: '/seyahat/[id]', params: { id: 'a' } } as never));
    expect(e.getPathname()).toBe('/seyahat/a');
    act(() => kesfeteDon(e.getRouterState() as never));
    expect(e.getPathname()).toBe('/');
    expect(icYigin(e)).toEqual({ kok: ['(tabs)'], ic: ['index'] });
  });

  it('Keşfet → seyahat → "‹ Keşfet": ana ekran', () => {
    const e = kur();
    act(() => router.push({ pathname: '/seyahat/[id]', params: { id: 'a' } } as never));
    act(() => kesfeteDon(e.getRouterState() as never));
    expect(e.getPathname()).toBe('/');
    expect(icYigin(e)).toEqual({ kok: ['(tabs)'], ic: ['index'] });
  });
});

describe('açılış kararı (#276 KK2)', () => {
  it('oturumda bir kez verilir', () => {
    acilisKarariniSifirla();
    expect(acilisKarariAl()).toBe(true);
    expect(acilisKarariAl()).toBe(false);
    acilisKarariniSifirla();
    acilisKarariniKapat();
    expect(acilisKarariAl()).toBe(false);
  });
});
