// #406 KK3 (UX önerileri kanvası, `Ana_v6_Kesfet`): raf — başlık (19/800) + "Tümü" (14/700 Gece), altında yana kayan kartlar.
// Kart 236 px: 160 px kapak (köşe 14), sağ üstte 30 px ♥ dairesi; altında başlık (15/700) ve "N durak · yer" (13, ikincil;
// şehir rafında yalnız "N durak").
// Kapaksız gezide kanvastaki yer tutucu (gökyüzü + toprak, ortada kamera; ton gezi kimliğinden). Google fotoğrafı yok.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { KartKalbi } from '@/components/ortak/AnaGeziKarti';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Foto } from '@/components/ui/Foto';
import { rafKartAltSatiri, RAF_EN_COK, type Raf as RafVerisi } from '@/features/anasayfa/raflar';
import type { AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { t } from '@/i18n';
import { anaV5, minDokunma, renk, yazi } from '@/theme';

export const RAF_KART_GENISLIK = 236;
export const RAF_KAPAK_YUKSEKLIK = 160;

type Props = {
  raf: RafVerisi<AkisGezisi>;
  onKart: (g: AkisGezisi) => void;
  onTumu: () => void;
};

export function Raf({ raf, onKart, onTumu }: Props) {
  return (
    <View style={s.raf} testID={`raf-${raf.id}`}>
      <View style={s.ust}>
        <Text accessibilityRole="header" style={s.baslik} numberOfLines={1}>
          {raf.baslik}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v6.tumuEtiket', { baslik: raf.baslik })} onPress={onTumu} hitSlop={8} style={s.tumu}>
          <Text style={s.tumuMetin}>{t('anasayfa.tumu')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kartlar} decelerationRate="fast" snapToInterval={RAF_KART_GENISLIK + 12}>
        {raf.geziler.slice(0, RAF_EN_COK).map((g) => (
          <RafKarti key={g.id} gezi={g} rafTuru={raf.tur} onAc={() => onKart(g)} />
        ))}
      </ScrollView>
    </View>
  );
}

export function RafKarti({ gezi, rafTuru, onAc }: { gezi: AkisGezisi; rafTuru?: RafVerisi<AkisGezisi>['tur']; onAc: () => void }) {
  const alt = rafKartAltSatiri(gezi, rafTuru);
  return (
    <View style={s.kart}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${gezi.baslik}, ${alt}`} onPress={onAc} style={({ pressed }) => [s.govde, pressed && s.basili]}>
        <View style={s.kapak}>
          {gezi.kapak_url ? (
            <Foto source={{ uri: gezi.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
          ) : (
            <SeyahatKapagi kimlik={gezi.id} yukseklik={RAF_KAPAK_YUKSEKLIK} kose={14} />
          )}
        </View>
        <View style={s.metinler}>
          <Text style={s.kartBaslik} numberOfLines={1}>
            {gezi.baslik}
          </Text>
          <Text style={s.alt} numberOfLines={1}>
            {alt}
          </Text>
        </View>
      </Pressable>
      <KartKalbi geziId={gezi.id} kucuk />
    </View>
  );
}

const s = StyleSheet.create({
  raf: { gap: 10 },
  ust: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  baslik: { flex: 1, fontFamily: yazi.ekstra, fontSize: 19, color: renk.metin },
  // 44 pt dokunma: yazı sağda kalır, alan yukarı-aşağı büyür.
  tumu: { minHeight: minDokunma, justifyContent: 'center', marginVertical: -12 },
  tumuMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.ana },
  kartlar: { paddingHorizontal: 16, gap: 12 },
  kart: { width: RAF_KART_GENISLIK, position: 'relative' },
  govde: { gap: 8 },
  basili: { opacity: 0.9 },
  kapak: { height: RAF_KAPAK_YUKSEKLIK, borderRadius: 14, overflow: 'hidden', backgroundColor: renk.yuzey },
  metinler: { gap: 1 },
  kartBaslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
});
