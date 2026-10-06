import { describe, expect, it } from '@jest/globals';
import { router, Tabs } from 'expo-router';
import { fireEvent, renderRouter } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

// #49: Keşfet → "Programa geç" Program'ı açar. Seyahat içi sekme yapısı (#45) birebir kurulur; ekranlar
// veri katmanı olmadan sahte bileşenlerdir — burada yalnız yönlendirme (pathname + params) sınanır.
const SekmeDuzeni = () => (
  <Tabs initialRouteName="kesfet" screenOptions={{ headerShown: false }} tabBar={() => null}>
    <Tabs.Screen name="kesfet" />
    <Tabs.Screen name="program" />
    <Tabs.Screen name="grup" />
  </Tabs>
);

function Kesfet() {
  return (
    <Pressable onPress={() => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: 's1' } })}>
      <Text>Programa geç</Text>
    </Pressable>
  );
}

const Program = () => <Text>program ekranı</Text>;
const Grup = () => <Text>grup ekranı</Text>;

const rotalar = {
  'seyahat/[id]/(sekmeler)/_layout': SekmeDuzeni,
  'seyahat/[id]/(sekmeler)/kesfet': Kesfet,
  'seyahat/[id]/(sekmeler)/program': Program,
  'seyahat/[id]/(sekmeler)/grup': Grup,
};

describe('Programa geç (#49)', () => {
  it("Keşfet'ten Program'a gider", () => {
    const ekran = renderRouter(rotalar, { initialUrl: '/seyahat/s1/kesfet' });
    expect(ekran.getPathname()).toBe('/seyahat/s1/kesfet');
    fireEvent.press(ekran.getByText('Programa geç'));
    expect(ekran.getPathname()).toBe('/seyahat/s1/program');
    expect(ekran.getByText('program ekranı')).toBeTruthy();
  });

  it('seyahat listesinden doğrudan Program açılır', () => {
    const ekran = renderRouter(rotalar, { initialUrl: '/seyahat/s1/program' });
    expect(ekran.getPathname()).toBe('/seyahat/s1/program');
    expect(ekran.getByText('program ekranı')).toBeTruthy();
  });
});
