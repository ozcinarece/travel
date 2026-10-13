import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold, useFonts } from '@expo-google-fonts/figtree';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HataSiniri } from '@/components/ui/HataSiniri';
import { Buton } from '@/components/ui/Buton';
import { useProfil, useProfilHazirla } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';
import { hataRaporunuBaslat, hataRaporuyla } from '@/lib/hataRaporu';
import { OturumSaglayici, useOturum } from '@/lib/oturum';

hataRaporunuBaslat();
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function Kok() {
  // #136: Figtree (metin) + Archivo SemiExpanded 850 (başlık; Google Fonts değişken dosyasından üretilmiş statik örnek,
  // assets/fonts). İkisi de JS varlığı — OTA ile gider, yerel derleme gerekmez.
  const [fontlar, fontHatasi] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    ArchivoSemiExpanded_850: require('../../assets/fonts/ArchivoSemiExpanded-ExtraBold.ttf'),
  });
  const { hazir, hesapli, session } = useOturum();
  const profil = useProfil();
  // #138 KK1: "Profilini kur" ekranı yok — hesap var, profil yoksa sunucu kendiliğinden oluşturur (ad/foto sağlayıcıdan).
  const hazirla = useProfilHazirla();
  const profilYok = hesapli && profil.isSuccess && profil.data === null;
  const [denenen, setDenenen] = useState<string | null>(null);
  const uid = session?.user.id ?? null;
  if (profilYok && uid && denenen !== uid) {
    setDenenen(uid);
    hazirla.mutate();
  }

  // Açılış ekranı fontlar, oturum ve (hesaplıysa) profil hazır olana kadar durur.
  const profilBekleniyor = hesapli && (profil.isPending || (profilYok && !hazirla.isError));
  const yuklendi = (fontlar || !!fontHatasi) && hazir && !profilBekleniyor;
  useEffect(() => {
    if (yuklendi) SplashScreen.hideAsync();
  }, [yuklendi]);
  if (!yuklendi) return null;
  if (profilYok && hazirla.isError) {
    return (
      <View style={k.hata}>
        {hazirla.isPending ? <ActivityIndicator color={renk.ana} /> : <Text style={k.hataMetin}>{t('giris.profilHata')}</Text>}
        <Buton baslik={t('genel.yenidenDene')} onPress={() => hazirla.mutate()} yukleniyor={hazirla.isPending} />
      </View>
    );
  }

  // Hesap + profil tamamsa uygulama; değilse giriş.
  const girisTamam = hesapli && !!profil.data;
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
        <Stack.Screen name="seyahat/[id]" />
        {/* #97: ana sayfa içerik rotaları. */}
        <Stack.Screen name="ara" />
        <Stack.Screen name="geziler" />
        <Stack.Screen name="gezi/[slug]" />
        <Stack.Screen name="yerler" />
        {/* #100: şehir rehberi (Kaydettiklerim #138'de sekme). #138: Profil › Düzenle. */}
        <Stack.Screen name="profil-duzenle" />
        <Stack.Screen name="rehber/[slug]/index" />
        <Stack.Screen name="rehber/[slug]/[bolum]" />
      </Stack.Protected>
      <Stack.Screen name="r/[token]" />
    </Stack>
  );
}

// #85 KK3: hata sınırı en dışta — yakalanmamış render hatasında gri ekran yerine "Yeniden dene" kartı; hata Sentry'ye gider.
function KokLayout() {
  return (
    <HataSiniri>
      <QueryClientProvider client={queryClient}>
        <OturumSaglayici>
          <Kok />
        </OturumSaglayici>
      </QueryClientProvider>
    </HataSiniri>
  );
}

export default hataRaporuyla(KokLayout);

const k = StyleSheet.create({
  hata: { flex: 1, backgroundColor: renk.zemin, justifyContent: 'center', padding: 24, gap: 16 },
  hataMetin: { fontFamily: yazi.yari, fontSize: 15, lineHeight: 22, textAlign: 'center', color: renk.metin },
});
