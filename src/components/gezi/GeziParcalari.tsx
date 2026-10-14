// #181 (kanvas 23): Gezi sayfasının ortak parçaları — bölüm başlığı ("Plan" + "Planı aç ›"), sessiz "Sıradaki adım" satırı,
// küçük Buz düğme ve fotoğraf kutusu (bizim fotoğrafımız ya da oturum önbelleği; yoksa kategori renginde boş kutu).
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { pinKategorisi, type PinKategorisi } from '@/lib/pinIkonu';
import { renk, yazi } from '@/theme';

/** Fotoğrafı olmayan mekanın kutusu: kategoriye göre açık ton (kanvas 23). */
const KUTU_RENGI: Record<PinKategorisi, string> = {
  gezilecek: '#ffd9bf',
  muze: '#e6e0fa',
  ibadet: '#dcefe4',
  yemek: '#ffe2cc',
  kafe: '#ffe2cc',
  park: '#d7f0e6',
  manzara: '#dce6ff',
  alisveris: '#eef2ff',
};

/** Fotoğrafı olmayan mekanın pastel zemini (kategoriye göre). */
export function kutuRengi(tip: string | null | undefined): string {
  return KUTU_RENGI[pinKategorisi(tip)];
}

export function FotoKutusu({ uri, tip, boyut, kose, stil }: { uri: string | null; tip: string | null | undefined; boyut?: number; kose: number; stil?: StyleProp<ViewStyle> }) {
  const olcu = boyut ? { width: boyut, height: boyut } : null;
  return (
    <View style={[{ borderRadius: kose, overflow: 'hidden', backgroundColor: KUTU_RENGI[pinKategorisi(tip)] }, olcu, stil]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
    </View>
  );
}

export function BolumBasligi({ baslik, baglanti, onBaglanti }: { baslik: string; baglanti?: string; onBaglanti?: () => void }) {
  return (
    <View style={s.baslikSatiri}>
      <Text accessibilityRole="header" style={s.baslik}>
        {baslik}
      </Text>
      {baglanti && onBaglanti ? (
        <Pressable accessibilityRole="link" onPress={onBaglanti} hitSlop={10} style={({ pressed }) => [s.baglanti, pressed && { opacity: 0.6 }]}>
          <Text style={s.baglantiMetin}>{baglanti}</Text>
          <Ikon ad="ileri" boyut={14} renk={renk.ana} kalinlik={3} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Küçük Buz düğme (Dağıt, Seç, Mesaj at). */
export function BuzDugme({ metin, onPress, kucuk }: { metin: string; onPress: () => void; kucuk?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [s.buz, kucuk && s.buzKucuk, pressed && { opacity: 0.8 }]}>
      <Text style={[s.buzMetin, kucuk && { fontSize: 12 }]}>{metin}</Text>
    </Pressable>
  );
}

/** KK5: kapağın altındaki tek, sessiz satır — beyaz, solda 3 px Mandalina çizgi, sağda küçük Buz düğme. */
export function SiradakiAdimSatiri({ baslik, alt, dugme, mesgul, onPress }: { baslik: string; alt: string | null; dugme: string; /** İş sürüyor (Planı kur): düğme beklemede, dokunulmaz. */ mesgul?: boolean; onPress: () => void }) {
  return (
    <View style={s.siradaki}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.siradakiBaslik}>{baslik}</Text>
        {alt ? (
          <Text style={s.siradakiAlt} numberOfLines={1}>
            {alt}
          </Text>
        ) : null}
      </View>
      {mesgul ? (
        <View style={[s.buz, { minWidth: 56, alignItems: 'center' }]} accessibilityLabel={dugme} accessibilityState={{ busy: true }}>
          <ActivityIndicator size="small" color={renk.ana} />
        </View>
      ) : (
        <BuzDugme metin={dugme} onPress={onPress} />
      )}
    </View>
  );
}

/** Beyaz kart (r20). */
export function Kart({ children, stil }: { children: ReactNode; stil?: StyleProp<ViewStyle> }) {
  return <View style={[s.kart, stil]}>{children}</View>;
}

export const geziStil = StyleSheet.create({
  /** Kart içi birincil (Gece) / ikincil (Buz) düğme: 38 px, r12. */
  dugme: { height: 38, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 16 },
  meta: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});

const s = StyleSheet.create({
  baslikSatiri: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  baslik: { fontFamily: yazi.baslik, fontSize: 18, letterSpacing: -0.36, color: renk.metin },
  baglanti: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  baglantiMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  buz: { height: 32, paddingHorizontal: 12, borderRadius: 10, backgroundColor: renk.yuzey, justifyContent: 'center', flexShrink: 0 },
  buzKucuk: { height: 30, paddingHorizontal: 10, borderRadius: 9 },
  buzMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  siradaki: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 14,
    borderRadius: 14,
    backgroundColor: renk.zemin,
    borderLeftWidth: 3,
    borderLeftColor: renk.vurgu,
  },
  siradakiBaslik: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 17, color: renk.metin },
  siradakiAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, marginTop: 2 },
  kart: { padding: 14, borderRadius: 20, backgroundColor: renk.zemin, gap: 10 },
});
