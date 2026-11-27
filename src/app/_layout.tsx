import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold, useFonts } from '@expo-google-fonts/figtree';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HataKarti, HataSiniri } from '@/components/ui/HataSiniri';
import { Buton } from '@/components/ui/Buton';
import { useProfil, useProfilHazirla } from '@/features/profil/sorgular';
import { GunlukSinir } from '@/features/yerler/api';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';
import { acilisGecisi } from '@/lib/acilis';
import { baglantiyiIzle } from '@/lib/baglanti';
import { hataRaporunuBaslat, hataRaporuyla } from '@/lib/hataRaporu';
import { kaliciSecenekler, profilKilitli, saklananlariAyarla } from '@/lib/kaliciOnbellek';
import { OturumSaglayici, useOturum } from '@/lib/oturum';
import { webAcilisiKaldir } from '@/lib/webAcilis';

hataRaporunuBaslat();
SplashScreen.preventAutoHideAsync();

// #226 KK4: günlük Places sınırı (429) yeniden denenmez; diğer hatalarda varsayılan (3 deneme).
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (n, e) => !(e instanceof GunlukSinir) && n < 3 } } });
// #243 KK1: profil, seyahatler, günler, duraklar ve kendi içeriğimiz cihazda 7 gün tutulur (`src/lib/kaliciOnbellek.ts`).
saklananlariAyarla(queryClient);
// #243 KK3: bağlantı durumu sorgu sonuçlarından (NetInfo yok); geri gelince sorgular yenilenir.
baglantiyiIzle(queryClient);

function Kok() {
  // #307: tek aile Figtree (metin 400–600, düğme 700, başlık 800). JS varlığı — OTA ile gider, yerel derleme gerekmez.
  // Logo yazısı "tripmate" font değil, SVG yolu (Logo.tsx).
  const [fontlar, fontHatasi] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const { hazir, hesapli, session } = useOturum();
  const profil = useProfil();
  // #138 KK1: "Profilini kur" ekranı yok — hesap var, profil yoksa sunucu kendiliğinden oluşturur (ad/foto sağlayıcıdan).
  const hazirla = useProfilHazirla();
  const hazirlaMutate = hazirla.mutate;
  const profilYok = hesapli && profil.isSuccess && profil.data === null;
  const uid = session?.user.id ?? null;
  const denenen = useRef<string | null>(null);
  useEffect(() => {
    if (!profilYok || !uid || denenen.current === uid) return;
    denenen.current = uid;
    hazirlaMutate();
  }, [profilYok, uid, hazirlaMutate]);

  // Profil okunamadı (ör. açılışta çevrimdışı) ya da oluşturulamadı: oturumu olan kullanıcıya giriş ekranı açılamaz →
  // "Tekrar dene". Hata ekranı deneme sürerken de (yükleniyor halinde) kalır; boş ekran yok.
  // Profil hiç okunamadıysa; arka plan yenilemesi düşerse (veri korunur) kullanıcı bulunduğu ekrandan atılmaz.
  // #243 KK2: cihazdaki önbellekte profil varsa (bağlantısız açılış) okuma hatası uygulamayı kilitlemez.
  const hataVar = hesapli && profilKilitli({ hata: profil.isError, profil: profil.data, olusturulamadi: profilYok && hazirla.isError });
  const deneniyor = profil.isFetching || hazirla.isPending;
  const [hataModu, setHataModu] = useState(false);
  if (hataVar && !hataModu) setHataModu(true);
  if (hataModu && !hataVar && !deneniyor) setHataModu(false);
  const hataEkrani = hataVar || hataModu;

  // Açılış ekranı fontlar, oturum ve (hesaplıysa) profil hazır olana kadar durur.
  const profilBekleniyor = hesapli && (profil.isPending || (profilYok && !hazirla.isError));
  const yuklendi = (fontlar || !!fontHatasi) && hazir && (!profilBekleniyor || hataEkrani);
  useEffect(() => {
    if (!yuklendi) return;
    SplashScreen.hideAsync();
    webAcilisiKaldir();
  }, [yuklendi]);
  if (!yuklendi) return null;
  if (hataEkrani) {
    const tekrarDene = () => (profil.isError ? profil.refetch() : hazirlaMutate());
    return (
      <View style={k.hata}>
        {deneniyor ? <ActivityIndicator color={renk.ana} /> : <Text style={k.hataMetin}>{t('giris.profilHata')}</Text>}
        <Buton baslik={t('genel.yenidenDene')} onPress={tekrarDene} yukleniyor={deneniyor} />
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
      <HataSiniri>
        <PersistQueryClientProvider client={queryClient} persistOptions={kaliciSecenekler}>
          <OturumSaglayici>
            <Kok />
          </OturumSaglayici>
        </PersistQueryClientProvider>
      </HataSiniri>
    </GestureHandlerRootView>
  );
}

export default hataRaporuyla(KokLayout);

// #552: kök düzenin kendisi (sağlayıcılar, HataSiniri'nin dışı) çökerse Expo Router bunu gösterir. Web davet
// katmanı (#549) kaldırılır; yoksa "Sayfayı kapatma" notu hata kartının üstünde sonsuza dek kalır.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    webAcilisiKaldir();
  }, []);
  return <HataKarti hata={error} onYenidenDene={() => void retry()} />;
}

const k = StyleSheet.create({
  kok: { flex: 1 },
  hata: { flex: 1, backgroundColor: renk.zemin, justifyContent: 'center', padding: 24, gap: 16 },
  hataMetin: { fontFamily: yazi.yari, fontSize: 15, lineHeight: 22, textAlign: 'center', color: renk.metin },
});
