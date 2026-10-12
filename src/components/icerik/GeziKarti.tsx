// #97 A KK4 (kanvas Home13): önerilen gezi kartları — ilk gezi tam genişlik 230 px foto kartı ("N GÜNLÜK GEZİ" rozeti,
// başlık ve alt satır fotonun üstünde), gerisi 150×190 yatay şerit.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import type { Gezi } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

const ZEMINLER = ['#2f6fed', '#f2783f', '#12a37a', '#8a4fd6', '#e0457b', '#0ea5e9'];

export function GeziKarti({ gezi, buyuk, sira = 0, onPress }: { gezi: Gezi; buyuk?: boolean; sira?: number; onPress: () => void }) {
  const zemin = ZEMINLER[sira % ZEMINLER.length];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={gezi.baslik} onPress={onPress} style={({ pressed }) => [buyuk ? s.buyuk : s.kucuk, { backgroundColor: zemin }, pressed && { opacity: 0.9 }]}>
      {gezi.kapak_url ? <Image source={{ uri: gezi.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <View style={s.golgelik} />
      <View style={s.rozet}>
        <Text style={s.rozetMetin}>{buyuk ? t('anasayfa.gunlukGezi', { n: gezi.gun_sayisi }) : t('anasayfa.gunluk', { n: gezi.gun_sayisi })}</Text>
      </View>
      <View style={s.metinler}>
        <Text style={[s.baslik, buyuk && s.baslikBuyuk]} numberOfLines={2}>
          {gezi.baslik}
        </Text>
        {buyuk ? (
          <Text style={s.alt} numberOfLines={1}>
            {gezi.ozet ?? `${gezi.sehirler?.ad ?? ''} · ${t('anasayfa.mekanSayisi', { n: gezi.mekan_sayisi })}`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  buyuk: { height: 230, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  kucuk: { width: 150, height: 190, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  golgelik: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,15,15,0.28)' },
  rozet: { position: 'absolute', left: 12, top: 12, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 10, letterSpacing: 0.6, color: renk.metin },
  metinler: { padding: 14, gap: 4 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 15, lineHeight: 19, color: renk.zemin },
  baslikBuyuk: { fontSize: 22, lineHeight: 26, letterSpacing: -0.5 },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
});
