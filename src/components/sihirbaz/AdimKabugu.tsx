// #98 KK1 (kanvas TripWizard14): her adımın kabuğu — üstte geri + 5 ilerleme noktası (aktif uzun), başlık / alt başlık,
// kaydırılabilir içerik, altta "Devam" + atlama bağlantısı.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { ADIMLAR, adimIndeksi, type Adim } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

type Props = {
  adim: Adim;
  baslik: string;
  alt?: string;
  onGeri: () => void;
  children: ReactNode;
  /** Alt düğme; `devam` yoksa alt alan yalnız `altIcerik`ten oluşur. */
  devam?: { baslik?: string; onPress: () => void; pasif?: boolean; yukleniyor?: boolean };
  atla?: { baslik: string; onPress: () => void };
  /** Alt alanın üstünde özel satır (6. adımda "Listede N mekan" çubuğu). */
  altIcerik?: ReactNode;
  hata?: string | null;
  /** İçerik kaydırmasız (adım 6'da kartlar kendi listesinde). */
  kaydirmasiz?: boolean;
};

export function AdimKabugu({ adim, baslik, alt, onGeri, children, devam, atla, altIcerik, hata, kaydirmasiz }: Props) {
  const aktif = adimIndeksi(adim);
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.ust}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('sihirbaz.geri')} onPress={onGeri} hitSlop={8} style={s.geri}>
            <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.4} />
          </Pressable>
          <View style={s.noktalar} accessibilityLabel={t('sihirbaz.adim', { n: aktif + 1 })}>
            {ADIMLAR.map((a, i) => (
              <View key={a} style={[s.nokta, i === aktif && s.noktaAktif, i < aktif && s.noktaGecildi]} />
            ))}
          </View>
          <View style={s.geri} />
        </View>
        <View style={s.basliklar}>
          <Text accessibilityRole="header" style={s.baslik}>
            {baslik}
          </Text>
          {alt ? <Text style={s.alt}>{alt}</Text> : null}
        </View>
        {kaydirmasiz ? (
          <View style={{ flex: 1 }}>{children}</View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        )}
        <View style={s.altAlan}>
          {altIcerik}
          {hata ? <Text style={s.hata}>{hata}</Text> : null}
          {devam ? <Buton baslik={devam.baslik ?? t('sihirbaz.devam')} onPress={devam.onPress} pasif={devam.pasif} yukleniyor={devam.yukleniyor} /> : null}
          {atla ? (
            <Pressable accessibilityRole="button" onPress={atla.onPress} hitSlop={10} style={s.atla}>
              <Text style={s.atlaMetin}>{atla.baslik}</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, height: 52 },
  geri: { width: minDokunma, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  noktalar: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  nokta: { width: 6, height: 6, borderRadius: 3, backgroundColor: renk.ayrac },
  noktaGecildi: { backgroundColor: renk.soluk },
  noktaAktif: { width: 22, backgroundColor: renk.metin },
  basliklar: { paddingHorizontal: bosluk.kenar, paddingTop: 8, paddingBottom: 6, gap: 4 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 24, letterSpacing: -0.6, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 10, paddingBottom: 16, gap: 12 },
  altAlan: { paddingHorizontal: bosluk.kenar, paddingTop: 8, paddingBottom: 10, gap: 8 },
  atla: { alignSelf: 'center', paddingVertical: 8, minHeight: minDokunma, justifyContent: 'center' },
  atlaMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
