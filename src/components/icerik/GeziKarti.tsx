// #97 A KK4 → #138 (kanvas 3 · 3b): önerilen gezi kartları — Çizgi kenarlı beyaz kart; üstte foto (büyük 170 px · küçük 112 px),
// sol üstte "N GÜNLÜK GEZİ" rozeti (büyükte Mandalina, küçükte Gece), büyükte sağ üstte kalp; altta başlık (Archivo) + "N mekan · şehir".
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Rozet } from '@/components/ui/Rozet';
import { t } from '@/i18n';
import type { Gezi } from '@/lib/tipler';
import { kose, renk, yazi } from '@/theme';

import { Kalp } from './Kalp';

/** Fotoğrafı olmayan gezide yer tutucu zeminler (kanvas: Buz mavisi, açık Mandalina, açık mavi, açık yeşil). */
const ZEMINLER = ['#c9d2f2', '#ffe2cc', '#dce6ff', '#e3f5ee'];

type Props = { gezi: Gezi; buyuk?: boolean; sira?: number; onPress: () => void; /** Büyük kartta kalp (kaydet); yönetim önizlemesinde kapalı. */ kalp?: boolean; genislik?: number };

export function GeziKarti({ gezi, buyuk, sira = 0, onPress, kalp, genislik }: Props) {
  const zemin = ZEMINLER[sira % ZEMINLER.length];
  const alt = [t('anasayfa.mekanSayisi', { n: gezi.mekan_sayisi }), gezi.sehirler?.ad].filter(Boolean).join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={gezi.baslik} onPress={onPress} style={({ pressed }) => [s.kart, buyuk ? null : { width: genislik ?? 232 }, pressed && { opacity: 0.9 }]}>
      <View style={[buyuk ? s.fotoBuyuk : s.fotoKucuk, { backgroundColor: zemin }]}>
        {gezi.kapak_url ? <Image source={{ uri: gezi.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        <Rozet metin={t('anasayfa.gunlukGezi', { n: gezi.gun_sayisi })} tur={buyuk ? 'vurgu' : 'gece'} stil={s.rozet} />
        {buyuk && kalp ? (
          <View style={s.kalp}>
            <Kalp tur="gezi" hedefId={gezi.id} boyut={40} arkaPlan={renk.zemin} />
          </View>
        ) : null}
      </View>
      <View style={buyuk ? s.govdeBuyuk : s.govdeKucuk}>
        <Text style={[s.baslik, buyuk && s.baslikBuyuk]} numberOfLines={2}>
          {gezi.baslik}
        </Text>
        <Text style={[s.alt, buyuk && { fontSize: 14 }]} numberOfLines={1}>
          {alt}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kart: { borderRadius: kose.kart, borderWidth: 1, borderColor: renk.ayrac, backgroundColor: renk.zemin, overflow: 'hidden' },
  fotoBuyuk: { height: 170 },
  fotoKucuk: { height: 112 },
  rozet: { position: 'absolute', left: 12, top: 12 },
  kalp: { position: 'absolute', right: 10, top: 10 },
  govdeBuyuk: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 4 },
  govdeKucuk: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 3 },
  baslik: { fontFamily: yazi.baslik, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: renk.metin },
  baslikBuyuk: { fontSize: 19, lineHeight: 23 },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
});
