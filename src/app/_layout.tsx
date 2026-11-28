import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AcilisKapisi, KokHataEkrani, KokSaglayicilari } from '@/components/kok/KokKabugu';
import { acilisGecisi } from '@/lib/acilis';
import { hataRaporunuBaslat, hataRaporuyla } from '@/lib/hataRaporu';

hataRaporunuBaslat();
SplashScreen.preventAutoHideAsync();

// #550: sağlayıcılar, açılış kapısı ve kök hata ekranı `KokKabugu`'nda; web davet girişi (`src/davet-web`) de onları kullanır.
function Kok() {
  return <AcilisKapisi>{(girisTamam) => <Yigin girisTamam={girisTamam} />}</AcilisKapisi>;
}

function Yigin({ girisTamam }: { girisTamam: boolean }) {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!girisTamam}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={girisTamam}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="hesap-sil" />
        {/* #98: yalnız sihirbaz / günün oteli "Haritadan" seçimi (secim=1); 3.3 tek başına akış kalktı. */}
        <Stack.Screen name="yeni/otel" />
        {/* #283 inceleme 2 · 2: açılış kuralının Gezi'ye geçişi (`acilis=1`) animasyonsuz. */}
        <Stack.Screen name="seyahat/[id]" options={({ route }) => ({ animation: acilisGecisi(route.params) ? 'none' : 'default' })} />
        {/* #97: ana sayfa içerik rotaları. */}
        <Stack.Screen name="ara" />
        <Stack.Screen name="geziler" />
        <Stack.Screen name="gezi/[slug]" />
        <Stack.Screen name="yerler" />
        {/* #138: Profil › Düzenle. */}
        <Stack.Screen name="profil-duzenle" />
        {/* #578: arkadaşın profili (Profil v12), Profil › Düzenle (ayarlar) ve Lisanslar. */}
        <Stack.Screen name="kisi/[id]" />
        <Stack.Screen name="ayarlar" />
        <Stack.Screen name="lisanslar" />
      </Stack.Protected>
      <Stack.Screen name="r/[token]" />
      {/* #432 2/3b: paylaşılan gezi (girişsiz de açılır). */}
      <Stack.Screen name="r/g/[token]" />
    </Stack>
  );
}

// #85 KK3: hata sınırı en dışta — yakalanmamış render hatasında gri ekran yerine "Yeniden dene" kartı; hata Sentry'ye gider.
// #164: alt sayfaların içerikten çekilmesi gesture-handler jestleriyle; kök görünüm onları etkinleştirir.
function KokLayout() {
  return (
    <GestureHandlerRootView style={k.kok}>
      <KokSaglayicilari>
        <Kok />
      </KokSaglayicilari>
    </GestureHandlerRootView>
  );
}

export default hataRaporuyla(KokLayout);

// #552: kök düzenin kendisi çökerse Expo Router bunu gösterir (web davet katmanını da kaldırır).
export const ErrorBoundary = KokHataEkrani;

const k = StyleSheet.create({
  kok: { flex: 1 },
});
