// #139 KK4 (kanvas 7): alt çubuk — "N mekan / K bölge · ~S saat" + Mandalina "Planı kur →". Hiç mekan yoksa "Haritaya geç".
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { kose, renk, yazi } from '@/theme';

type Props = { ozet: { mekan: number; bolge: number; saat: number }; onPlaniKur: () => void; onHaritayaGec: () => void; yukleniyor?: boolean };

export function PlanCubugu({ ozet, onPlaniKur, onHaritayaGec, yukleniyor }: Props) {
  const bos = ozet.mekan === 0;
  return (
    <View style={s.cubuk}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={s.baslik}>{bos ? t('sihirbaz.onerilenler.ozetBos') : t('sihirbaz.onerilenler.ozetMekan', { n: ozet.mekan })}</Text>
        {bos ? (
          <Text onPress={onHaritayaGec} accessibilityRole="button" style={s.baglanti}>
            {t('sihirbaz.onerilenler.haritayaGec')}
          </Text>
        ) : (
          <Text style={s.alt}>{t('sihirbaz.onerilenler.ozetAlt', { bolge: ozet.bolge, saat: ozet.saat })}</Text>
        )}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: bos || !!yukleniyor, busy: !!yukleniyor }} disabled={bos || !!yukleniyor} onPress={onPlaniKur} style={({ pressed }) => [s.dugme, bos && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}>
        {yukleniyor ? (
          <ActivityIndicator color={renk.metin} />
        ) : (
          <>
            <Text style={s.dugmeMetin}>{t('sihirbaz.onerilenler.planiKur')}</Text>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Ikon ad="geri" boyut={16} renk={renk.metin} kalinlik={2.8} />
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  cubuk: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: renk.ayrac },
  baslik: { fontFamily: yazi.baslik, fontSize: 18, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  baglanti: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  dugme: { height: 54, paddingHorizontal: 22, borderRadius: kose.dugme, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
});
