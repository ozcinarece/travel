import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { renk, yazi } from '@/theme';

type Props = { ad: string; url?: string | null; boyut?: number; arkaPlan?: string };

/** Fotoğraf varsa o, yoksa adın baş harfi. */
export function Avatar({ ad, url, boyut = 30, arkaPlan = renk.metin }: Props) {
  const yuvarlak = { width: boyut, height: boyut, borderRadius: boyut / 2 };
  if (url) {
    return <Image source={{ uri: url }} style={yuvarlak} contentFit="cover" accessibilityLabel={ad} />;
  }
  const harf = ad.trim().charAt(0).toLocaleUpperCase('tr') || '?';
  return (
    <View style={[s.kap, yuvarlak, { backgroundColor: arkaPlan }]} accessibilityLabel={ad}>
      <Text style={[s.harf, { fontSize: boyut * 0.42 }]}>{harf}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { alignItems: 'center', justifyContent: 'center' },
  harf: { fontFamily: yazi.kalin, color: renk.zemin },
});
