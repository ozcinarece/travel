import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MdYazi } from '@/components/icerik/MdYazi';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { useSehirRehberi, useSehirler } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import { okumaSuresiDk } from '@/lib/markdown';
import type { RehberBolumu } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

/** #100 B KK2: rehber bölümü yazı sayfası — gezi 1. sayfa düzeni (kapak 300 px + başlık, okuma süresi, markdown). */
export default function RehberBolumuEkrani() {
  const { slug, bolum } = useLocalSearchParams<{ slug: string; bolum: RehberBolumu }>();
  const kenar = useSafeAreaInsets();
  const sehirler = useSehirler();
  const sehir = sehirler.data?.find((x) => x.slug === slug);
  const rehber = useSehirRehberi(sehir?.id);
  const b = rehber.data?.find((x) => x.bolum === bolum);
  if (sehirler.isPending || (sehir && rehber.isPending)) {
    return (
      <View style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.metin} />
      </View>
    );
  }
  if (!sehir || !b) {
    return (
      <View style={[s.ekran, s.ortala, { paddingTop: kenar.top }]}>
        <Text style={s.hata}>{t('rehber.hata')}</Text>
        <Buton baslik={t('genel.geri')} tur="ikincil" onPress={() => router.back()} />
      </View>
    );
  }
  // Yazının ilk başlığı kapakta zaten var; markdown'daki tekrarı düşür.
  const yazi_md = (b.yazi_md ?? '').replace(/^#\s+[^\n]*\n+/, '');
  return (
    <ScrollView style={s.ekran} contentContainerStyle={{ paddingBottom: Math.max(kenar.bottom, 16) + 8, gap: 16 }}>
      <View style={s.kapak}>
        {sehir.kapak_url ? <Image source={{ uri: sehir.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        <View style={s.kapakGolge} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={() => router.back()} style={[s.geri, { top: kenar.top + 10 }]}>
          <Ikon ad="geri" boyut={20} renk={renk.zemin} kalinlik={2.4} />
        </Pressable>
        <View style={s.kapakMetin}>
          <Text style={s.ustBaslik}>{`${t('rehber.ustBaslik')} · ${sehir.ad.toLocaleUpperCase('tr')}`}</Text>
          <Text style={s.baslik}>{b.baslik}</Text>
        </View>
      </View>
      <Text style={s.okuma}>{t('rehber.okuma', { n: okumaSuresiDk(b.yazi_md) })}</Text>
      <MdYazi kaynak={yazi_md} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  kapak: { height: 300, backgroundColor: '#e58a5a', justifyContent: 'flex-end' },
  kapakGolge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,15,15,0.35)' },
  geri: { position: 'absolute', left: bosluk.kenar, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(15,15,15,0.45)', alignItems: 'center', justifyContent: 'center' },
  kapakMetin: { padding: bosluk.kenar, gap: 6 },
  ustBaslik: { fontFamily: yazi.ekstra, fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.9)' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: renk.zemin },
  okuma: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, paddingHorizontal: bosluk.kenar },
  hata: { fontFamily: yazi.kalin, fontSize: 13, color: renk.uyari, textAlign: 'center' },
});
