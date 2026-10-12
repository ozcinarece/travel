// #97 B KK1: gezi yazısı — markdown blokları: paragraf, başlık, alıntı kutusu, madde, 2'li foto satırı + altyazı.
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { markdownAyristir } from '@/lib/markdown';
import { renk, yazi } from '@/theme';

export function MdYazi({ kaynak }: { kaynak: string | null | undefined }) {
  const bloklar = markdownAyristir(kaynak);
  return (
    <View style={s.kap}>
      {bloklar.map((b, i) => {
        switch (b.tur) {
          case 'baslik':
            return (
              <Text key={i} style={[s.baslik, b.seviye === 1 && s.baslik1]}>
                {b.metin}
              </Text>
            );
          case 'paragraf':
            return (
              <Text key={i} style={s.paragraf}>
                {b.metin}
              </Text>
            );
          case 'alinti':
            return (
              <View key={i} style={s.alinti}>
                <Text style={s.alintiMetin}>“{b.metin}”</Text>
              </View>
            );
          case 'madde':
            return (
              <View key={i} style={{ gap: 4 }}>
                {b.ogeler.map((o, j) => (
                  <Text key={j} style={s.paragraf}>
                    {'•  '}
                    {o}
                  </Text>
                ))}
              </View>
            );
          case 'fotolar':
            return (
              <View key={i} style={{ gap: 6 }}>
                <View style={s.fotoSatir}>
                  {b.fotolar.map((f) => (
                    <Image key={f.url} source={{ uri: f.url }} style={s.foto} contentFit="cover" transition={150} accessibilityLabel={f.alt} />
                  ))}
                </View>
                {b.altyazi ? <Text style={s.altyazi}>{b.altyazi}</Text> : null}
              </View>
            );
        }
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14, paddingHorizontal: 20 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.4, color: renk.metin, paddingTop: 6 },
  baslik1: { fontSize: 22 },
  paragraf: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 24, color: renk.metin },
  alinti: { padding: 14, borderRadius: 14, backgroundColor: renk.yuzey, borderLeftWidth: 3, borderLeftColor: renk.vurgu },
  alintiMetin: { fontFamily: yazi.yari, fontSize: 14, lineHeight: 21, color: renk.metin },
  fotoSatir: { flexDirection: 'row', gap: 8 },
  foto: { flex: 1, height: 150, borderRadius: 14, backgroundColor: renk.yuzey },
  altyazi: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});
