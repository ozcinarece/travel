// #97 B KK1: gezi yazısı — markdown blokları: paragraf, başlık, alıntı kutusu, madde, 2'li foto satırı + altyazı.
// #142 KK4: satır içi biçim (kalın, italik) ve mekan bağlantısı (turuncu alt çizgi, dokununca mekan rehberi); `::mekan[id]`
// satırı paragraf altında mekan kartı (`mekanKarti` çizer); mekan rehberinde alıntı İPUCU kutusu olur (`ipucu`).
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { markdownAyristir, type MdParca } from '@/lib/markdown';
import { renk, yazi } from '@/theme';

type Props = {
  kaynak: string | null | undefined;
  /** Satır içi mekan bağlantısına dokunuldu. */
  onMekan?: (placeId: string) => void;
  /** `::mekan[id]` kart bloğu; verilmezse kart çizilmez. */
  mekanKarti?: (placeId: string) => ReactNode;
  /** Alıntı blokları İPUCU kutusu olarak (mekan rehberi, kanvas 14). */
  ipucu?: boolean;
  /** Yatay iç boşluk (varsayılan 20). */
  kenar?: number;
  /** Paragraf yazı boyu (şehir rehberi 16, kanvas 15). */
  buyuk?: boolean;
};

function Parcalar({ parcalar, metin, onMekan }: { parcalar?: MdParca[]; metin: string; onMekan?: (placeId: string) => void }) {
  if (!parcalar) return <>{metin}</>;
  return (
    <>
      {parcalar.map((p, i) =>
        p.place_id ? (
          <Text key={i} style={s.baglanti} onPress={onMekan ? () => onMekan(p.place_id!) : undefined} accessibilityRole={onMekan ? 'link' : undefined}>
            {p.metin}
          </Text>
        ) : p.kalin ? (
          <Text key={i} style={s.kalin}>
            {p.metin}
          </Text>
        ) : p.italik ? (
          <Text key={i} style={s.italik}>
            {p.metin}
          </Text>
        ) : (
          <Text key={i}>{p.metin}</Text>
        ),
      )}
    </>
  );
}

export function MdYazi({ kaynak, onMekan, mekanKarti, ipucu, kenar = 20, buyuk }: Props) {
  const bloklar = markdownAyristir(kaynak);
  const paragraf = [s.paragraf, buyuk && s.paragrafBuyuk];
  return (
    <View style={[s.kap, { paddingHorizontal: kenar }]}>
      {bloklar.map((b, i) => {
        switch (b.tur) {
          case 'baslik':
            return (
              <Text key={i} style={[s.baslik, b.seviye === 1 && s.baslik1]}>
                <Parcalar parcalar={b.parcalar} metin={b.metin} onMekan={onMekan} />
              </Text>
            );
          case 'paragraf':
            return (
              <Text key={i} style={paragraf}>
                <Parcalar parcalar={b.parcalar} metin={b.metin} onMekan={onMekan} />
              </Text>
            );
          case 'alinti':
            return ipucu ? (
              <View key={i} style={s.ipucu}>
                <Text style={s.ipucuBaslik}>{t('mekan.panel.ipucu')}</Text>
                <Text style={s.ipucuMetin}>
                  <Parcalar parcalar={b.parcalar} metin={b.metin} onMekan={onMekan} />
                </Text>
              </View>
            ) : (
              <View key={i} style={s.alinti}>
                <Text style={s.alintiMetin}>
                  “<Parcalar parcalar={b.parcalar} metin={b.metin} onMekan={onMekan} />”
                </Text>
              </View>
            );
          case 'madde':
            return (
              <View key={i} style={{ gap: 4 }}>
                {b.ogeler.map((o, j) => (
                  <Text key={j} style={paragraf}>
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
                    <Image key={f.url} source={{ uri: f.url }} style={[s.foto, b.fotolar.length === 1 && s.fotoTek]} contentFit="cover" transition={150} accessibilityLabel={f.alt} />
                  ))}
                </View>
                {b.altyazi ? <Text style={s.altyazi}>{b.altyazi}</Text> : null}
              </View>
            );
          case 'mekan':
            return mekanKarti ? <View key={i}>{mekanKarti(b.place_id)}</View> : null;
        }
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.4, color: renk.metin, paddingTop: 6 },
  baslik1: { fontSize: 22 },
  paragraf: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 24, color: '#232b48' },
  paragrafBuyuk: { fontSize: 16, lineHeight: 25.6 },
  kalin: { fontFamily: yazi.ekstra },
  italik: { fontStyle: 'italic' },
  // Kanvas 15: satır içi bağlantı — kalın, turuncu alt çizgi.
  baglanti: { fontFamily: yazi.ekstra, color: renk.metin, textDecorationLine: 'underline', textDecorationColor: renk.vurgu },
  alinti: { padding: 14, borderRadius: 14, backgroundColor: renk.yuzey, borderLeftWidth: 3, borderLeftColor: renk.vurgu },
  alintiMetin: { fontFamily: yazi.yari, fontSize: 14, lineHeight: 21, color: renk.metin },
  ipucu: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#fff6e6', gap: 4 },
  ipucuBaslik: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: 0.66, color: '#8a5a00' },
  ipucuMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: renk.metin },
  fotoSatir: { flexDirection: 'row', gap: 8 },
  foto: { flex: 1, height: 150, borderRadius: 14, backgroundColor: renk.yuzey },
  fotoTek: { height: 170, borderRadius: 18 },
  altyazi: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});
