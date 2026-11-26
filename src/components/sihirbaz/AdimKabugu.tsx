// Sihirbaz adım kabuğu (kanvas `Ekran04Nereye` · `Ekran05NeZaman` · `Ekran07cIlOnerileri` A–B üst bölüm; #444, #448):
// üstte zeminsiz geri/kapat düğmesi (44 pt, -10 sol pay, 22 px ok; 1. adımda Kapat ×), 3 ilerleme noktası (aktif uzun
// Mandalina, geçilen Gece) ve "n/3" sayacı (13/700 #5B6178); başlık 28/800; altında alt başlık 15 px #5B6178 (2. adımda
// seyahat adı, 3. adımda "Bolu · …"); içerik; altta "Devam" + bağlantı. Üç adımda aynı. Kenar payı 20 (`bosluk.kenar`).
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { ADIMLAR, adimIndeksi, type Adim } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { anaV5, baslikStili, bosluk, minDokunma, renk, yazi } from '@/theme';

type Props = {
  adim: Adim;
  baslik: string;
  /** Başlığın altındaki satır (2. adımda seyahat adı, 3. adımda "Bolu · …"). */
  alt?: string;
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

export function AdimKabugu({ adim, baslik, alt, onGeri, children, devam, atla, altIcerik, hata, kaydirmasiz, altNot }: Props) {
  const aktif = adimIndeksi(adim);
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.ust}>
          <Pressable accessibilityRole="button" accessibilityLabel={aktif === 0 ? t('sihirbaz.kapat') : t('sihirbaz.geri')} onPress={onGeri} hitSlop={8} style={s.geri}>
            {aktif === 0 ? <Text style={s.kapat}>×</Text> : <Ikon ad="geri" boyut={22} renk={renk.metin} kalinlik={2.4} />}
          </Pressable>
          <View style={s.noktalar} accessibilityLabel={t('sihirbaz.adim', { n: aktif + 1 })}>
            {ADIMLAR.map((a, i) => (
              <View key={a} style={[s.nokta, i === aktif && s.noktaAktif, i < aktif && s.noktaGecildi]} />
            ))}
          </View>
          <Text style={s.sayac}>{t('sihirbaz.sayac', { n: aktif + 1, toplam: ADIMLAR.length })}</Text>
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
  geri: { width: minDokunma, height: minDokunma, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  kapat: { fontFamily: yazi.ekstra, fontSize: 24, lineHeight: 26, color: renk.metin },
  noktalar: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' },
  nokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: renk.ayrac },
  noktaGecildi: { backgroundColor: renk.ana },
  noktaAktif: { width: 34, backgroundColor: renk.vurgu },
  // #448 KK1: 13/700, alt başlıkla aynı renk.
  sayac: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.ikincil },
  basliklar: { paddingHorizontal: bosluk.kenar, paddingTop: 10, paddingBottom: 8, gap: 4 },
  // KK2/KK4: 28 px, harf aralığı -0.01em, satır 1.1; numberOfLines yok, iki satıra inen başlık kesilmez.
  baslik: { ...baslikStili(28), letterSpacing: -0.28, lineHeight: 31, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 20, color: anaV5.ikincil },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 10, paddingBottom: 16, gap: 12 },
  altAlan: { paddingHorizontal: bosluk.kenar, paddingTop: 8, paddingBottom: 10, gap: 8 },
  atla: { alignSelf: 'center', paddingVertical: 8, minHeight: minDokunma, justifyContent: 'center' },
  // #117 KK2/KK4: bağlantı okunur — 14 px, siyah, altı çizili (soluk gri metin okunmuyordu).
  atlaMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  altNot: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, textAlign: 'center', paddingVertical: 8 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
