// #98 KK1 → #139 (kanvas 4 · 5 · 7): her adımın kabuğu — üstte 44 px Buz kare (1. adımda Kapat ×, sonra geri), 3 ilerleme
// noktası (aktif uzun Mandalina, geçilen Gece) ve "n/3"; başlık (Archivo 30) / üst satır; içerik; altta "Devam" + bağlantı.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { ADIMLAR, adimIndeksi, type Adim } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { bosluk, kose, minDokunma, renk, yazi } from '@/theme';

type Props = {
  adim: Adim;
  baslik: string;
  alt?: string;
  /** Başlığın üstünde küçük satır (2. adımda seyahat adı). */
  ust?: string;
  onGeri: () => void;
  children: ReactNode;
  /** Alt düğme; `devam` yoksa alt alan yalnız `altIcerik`ten oluşur. */
  devam?: { baslik?: string; onPress: () => void; pasif?: boolean; yukleniyor?: boolean };
  atla?: { baslik: string; onPress: () => void };
  /** #117: Devam'ın altında düğme yerine bilgi satırı (ör. "Tarihler kaydedildi; Program'dan değiştir"). */
  altNot?: string;
  /** Alt alanın üstünde özel satır (6. adımda "Listede N mekan" çubuğu). */
  altIcerik?: ReactNode;
  hata?: string | null;
  /** İçerik kaydırmasız (adım 6'da kartlar kendi listesinde). */
  kaydirmasiz?: boolean;
};

export function AdimKabugu({ adim, baslik, alt, ust, onGeri, children, devam, atla, altIcerik, hata, kaydirmasiz, altNot }: Props) {
  const aktif = adimIndeksi(adim);
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.ust}>
          <Pressable accessibilityRole="button" accessibilityLabel={aktif === 0 ? t('sihirbaz.kapat') : t('sihirbaz.geri')} onPress={onGeri} hitSlop={8} style={s.geri}>
            {aktif === 0 ? <Text style={s.kapat}>×</Text> : <Ikon ad="geri" boyut={20} renk={renk.ana} kalinlik={2.6} />}
          </Pressable>
          <View style={s.noktalar} accessibilityLabel={t('sihirbaz.adim', { n: aktif + 1 })}>
            {ADIMLAR.map((a, i) => (
              <View key={a} style={[s.nokta, i === aktif && s.noktaAktif, i < aktif && s.noktaGecildi]} />
            ))}
          </View>
          <Text style={s.sayac}>{t('sihirbaz.sayac', { n: aktif + 1, toplam: ADIMLAR.length })}</Text>
        </View>
        <View style={s.basliklar}>
          {ust ? <Text style={s.ustSatir}>{ust}</Text> : null}
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
          {devam ? <Buton baslik={devam.baslik ?? t('sihirbaz.devam')} onPress={devam.onPress} pasif={devam.pasif} yukleniyor={devam.yukleniyor} boy="buyuk" /> : null}
          {atla ? (
            <Pressable accessibilityRole="button" onPress={atla.onPress} hitSlop={10} style={s.atla}>
              <Text style={s.atlaMetin}>{atla.baslik}</Text>
            </Pressable>
          ) : altNot ? (
            <Text style={s.altNot}>{altNot}</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: bosluk.kenar, paddingTop: 8 },
  geri: { width: minDokunma, height: minDokunma, borderRadius: kose.dugme, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  kapat: { fontFamily: yazi.ekstra, fontSize: 24, lineHeight: 26, color: renk.ana },
  noktalar: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' },
  nokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: renk.ayrac },
  noktaGecildi: { backgroundColor: renk.ana },
  noktaAktif: { width: 34, backgroundColor: renk.vurgu },
  sayac: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
  basliklar: { paddingHorizontal: bosluk.kenar, paddingTop: 20, paddingBottom: 6, gap: 4 },
  ustSatir: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ikincil },
  baslik: { fontFamily: yazi.baslik, fontSize: 30, lineHeight: 32, letterSpacing: -0.9, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: renk.ikincil },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 10, paddingBottom: 16, gap: 12 },
  altAlan: { paddingHorizontal: bosluk.kenar, paddingTop: 8, paddingBottom: 10, gap: 8 },
  atla: { alignSelf: 'center', paddingVertical: 8, minHeight: minDokunma, justifyContent: 'center' },
  // #117 KK2/KK4: bağlantı okunur — 14 px, siyah, altı çizili (soluk gri metin okunmuyordu).
  atlaMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  altNot: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, textAlign: 'center', paddingVertical: 8 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
