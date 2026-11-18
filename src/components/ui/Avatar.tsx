import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { renk, yazi } from '@/theme';

type Props = {
  ad: string;
  url?: string | null;
  boyut?: number;
  arkaPlan?: string;
  /** #290 KK8 (29c): baş harf Figtree 800, 12 px (kart içi küçük yüzler); verilmezse başlık fontu (Figtree 800), boyutun %40'ı. */
  kucukHarf?: boolean;
};

/** Açık zeminlerde (Mandalina, Buz, açık mavi) baş harf Gece; koyularda beyaz. */
const ACIK_ZEMINLER = new Set<string>([renk.vurgu, renk.yuzey, renk.anaAcik, renk.zemin, renk.basariZemin, '#f5a524']);

/** #136 (kanvas): köşeli yuvarlak kare avatar (köşe ≈ %32), Figtree 800 baş harf; fotoğraf varsa o. Varsayılan zemin Gece. */
export function Avatar({ ad, url, boyut = 30, arkaPlan = renk.ana, kucukHarf = false }: Props) {
  const kutu = { width: boyut, height: boyut, borderRadius: Math.round(boyut * 0.32) };
  if (url) {
    return <Image source={{ uri: url }} style={kutu} contentFit="cover" accessibilityLabel={ad} />;
  }
  const harf = ad.trim().charAt(0).toLocaleUpperCase('tr') || '?';
  const zemin = arkaPlan.toLowerCase();
  // #290 KK8 (25c · 29c): açık mavi (#C9D2F2) zeminde harf Lacivert (#152A6B).
  const metin = zemin === renk.anaAcik ? renk.ana : ACIK_ZEMINLER.has(zemin) ? renk.metin : renk.zemin;
  return (
    <View style={[s.kap, kutu, { backgroundColor: arkaPlan }]} accessibilityLabel={ad}>
      <Text style={[s.harf, kucukHarf ? s.kucukHarf : { fontSize: boyut * 0.4 }, { color: metin }]}>{harf}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { alignItems: 'center', justifyContent: 'center' },
  harf: { fontFamily: yazi.baslik },
  kucukHarf: { fontFamily: yazi.ekstra, fontSize: 12 },
});
