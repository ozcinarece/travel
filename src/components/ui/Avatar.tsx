import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { renk, yazi } from '@/theme';

type Props = { ad: string; url?: string | null; boyut?: number; arkaPlan?: string };

/** Açık zeminlerde (Mandalina, Buz, açık mavi) baş harf Lacivert; koyularda beyaz. */
const ACIK_ZEMINLER = new Set<string>([renk.vurgu, renk.yuzey, renk.anaAcik, renk.zemin, renk.basariZemin, '#f5a524']);

/** #136 (kanvas): köşeli yuvarlak kare avatar (köşe ≈ %32), Archivo baş harf; fotoğraf varsa o. Varsayılan zemin Gece. */
export function Avatar({ ad, url, boyut = 30, arkaPlan = renk.ana }: Props) {
  const kutu = { width: boyut, height: boyut, borderRadius: Math.round(boyut * 0.32) };
  if (url) {
    return <Image source={{ uri: url }} style={kutu} contentFit="cover" accessibilityLabel={ad} />;
  }
  const harf = ad.trim().charAt(0).toLocaleUpperCase('tr') || '?';
  const metin = ACIK_ZEMINLER.has(arkaPlan.toLowerCase()) ? renk.metin : renk.zemin;
  return (
    <View style={[s.kap, kutu, { backgroundColor: arkaPlan }]} accessibilityLabel={ad}>
      <Text style={[s.harf, { fontSize: boyut * 0.4, color: metin }]}>{harf}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { alignItems: 'center', justifyContent: 'center' },
  harf: { fontFamily: yazi.baslik },
});
