// #550: kök düzenin rota ağacından bağımsız parçaları. Uygulamanın kök düzeni (`src/app/_layout.tsx`) ve web davet
// girişi (`src/davet-web/_layout.tsx`, yalnız /r/{token} ve /r/g/{token}) aynı sağlayıcıları, aynı açılış kapısını ve aynı
// hata ekranını buradan alır; iki girişte görünen hiçbir şey ayrışmaz. Gesture-handler, Reanimated ve gezinme yığını
// burada değil, uygulamanın kendi kök düzeninde kalır (davet girişine girmesinler).
import { useFonts } from '@expo-google-fonts/figtree/useFonts';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HataKarti, HataSiniri } from '@/components/ui/HataSiniri';
import { Buton } from '@/components/ui/Buton';
import { useProfil, useProfilHazirla } from '@/features/profil/sorgular';
import { GunlukSinir } from '@/features/yerler/api';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';
import { baglantiyiIzle } from '@/lib/baglanti';
import { kaliciSecenekler, profilKilitli, saklananlariAyarla } from '@/lib/kaliciOnbellek';
import { OturumSaglayici, useOturum } from '@/lib/oturum';
import { webAcilisiKaldir } from '@/lib/webAcilis';

import { FIGTREE } from './fontlar';

let queryClient: QueryClient | null = null;

/**
 * Sorgu istemcisini kurar (bir kez). Kök düzen modül düzeyinde, main'deki sırayla çağırır: hata raporu ve açılış ekranı
 * hazırlandıktan sonra (#550 öz-inceleme 3).
 */
export function kokuBaslat(): QueryClient {
  if (queryClient) return queryClient;
  // #226 KK4: günlük Places sınırı (429) yeniden denenmez; diğer hatalarda varsayılan (3 deneme).
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: (n, e) => !(e instanceof GunlukSinir) && n < 3 } } });
  // #243 KK1: profil, seyahatler, günler, duraklar ve kendi içeriğimiz cihazda 7 gün tutulur (`src/lib/kaliciOnbellek.ts`).
  saklananlariAyarla(queryClient);
  // #243 KK3: bağlantı durumu sorgu sonuçlarından (NetInfo yok); geri gelince sorgular yenilenir.
  baglantiyiIzle(queryClient);
  return queryClient;
}

/** #85 KK3: hata sınırı en dışta — yakalanmamış render hatasında gri ekran yerine "Yeniden dene" kartı. */
export function KokSaglayicilari({ children }: { children: ReactNode }) {
  return (
    <HataSiniri>
      <PersistQueryClientProvider client={kokuBaslat()} persistOptions={kaliciSecenekler}>
        <OturumSaglayici>{children}</OturumSaglayici>
      </PersistQueryClientProvider>
    </HataSiniri>
  );
}

/**
 * Açılış kapısı: fontlar, oturum ve (hesaplıysa) profil hazır olana kadar hiçbir şey çizmez; sonra açılış ekranını ve web
 * davet katmanını (#549) kaldırır ve `children(girisTamam)`ı çizer. Profil okunamazsa "Tekrar dene".
 */
export function AcilisKapisi({ children }: { children: (girisTamam: boolean) => ReactNode }) {
  // #307: tek aile Figtree (metin 400–600, düğme 700, başlık 800). JS varlığı — OTA ile gider, yerel derleme gerekmez.
  // Logo yazısı "tripmate" font değil, SVG yolu (Logo.tsx).
  // #643: native paketin TTF'leri (`fontlar.ts`), web woff2 alt küme (`fontlar.web.ts`); aile adları aynı.
  const [fontlar, fontHatasi] = useFonts(FIGTREE);
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
  return <>{children(hesapli && !!profil.data)}</>;
}

// #552: kök düzenin kendisi (sağlayıcılar, HataSiniri'nin dışı) çökerse Expo Router bunu gösterir. Web davet
// katmanı (#549) kaldırılır; yoksa "Sayfayı kapatma" notu hata kartının üstünde sonsuza dek kalır.
export function KokHataEkrani({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    webAcilisiKaldir();
  }, []);
  return <HataKarti hata={error} onYenidenDene={() => void retry()} />;
}

const k = StyleSheet.create({
  hata: { flex: 1, backgroundColor: renk.zemin, justifyContent: 'center', padding: 24, gap: 16 },
  hataMetin: { fontFamily: yazi.yari, fontSize: 15, lineHeight: 22, textAlign: 'center', color: renk.metin },
});
