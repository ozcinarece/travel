import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { minDokunma, renk, yazi } from '@/theme';

type Props = {
  /** donus: bitiş = başlangıç (aynı otele dönüş) — tek satır sade. */
  tur: 'baslangic' | 'bitis' | 'donus';
  /** Otel adı; null = otel yok. */
  ad: string | null;
  saat: string;
  onPress: () => void;
};

/**
 * #56 §1: listenin ilk / son satırı. Otel varsa siyah ev · ad · "Başlangıç · 09:00" · Değiştir; yoksa kesikli çerçeve,
 * gri ev, "Başlangıç: otel yok" + alt metin, siyah "+ Otel ekle". Bitiş başlangıçla aynıysa "Otele dönüş · 13:44".
 */
export function OtelUcSatiri({ tur, ad, saat, onPress }: Props) {
  if (tur === 'donus') {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.donus, pressed && { opacity: 0.6 }]}>
        <Ikon ad="ev" boyut={14} renk={renk.ikincil} kalinlik={2.2} />
        <Text style={s.donusMetin}>{t('gunOteli.donus', { saat })}</Text>
      </Pressable>
    );
  }
  const bas = tur === 'baslangic';
  if (!ad) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.satir, s.yok, pressed && { opacity: 0.6 }]}>
        <Ikon ad="ev" boyut={18} renk={renk.soluk} kalinlik={2.2} />
        <View style={s.metinler}>
          <Text style={s.ad} numberOfLines={1}>
            {t(bas ? 'gunOteli.baslangicYok' : 'gunOteli.bitisYok')}
          </Text>
          <Text style={s.alt} numberOfLines={1}>
            {t(bas ? 'gunOteli.baslangicYokAlt' : 'gunOteli.bitisYokAlt')}
          </Text>
        </View>
        <Text style={s.ekle}>{t('gunOteli.ekle')}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.satir, pressed && { opacity: 0.6 }]}>
      <Ikon ad="ev" boyut={18} renk={renk.metin} kalinlik={2.2} />
      <View style={s.metinler}>
        <Text style={s.ad} numberOfLines={1}>
          {ad}
        </Text>
        <Text style={s.alt} numberOfLines={1}>
          {t(bas ? 'gunOteli.baslangic' : 'gunOteli.bitis', { saat })}
        </Text>
      </View>
      <Text style={s.degistir}>{t('gunOteli.degistir')}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minDokunma, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12 },
  yok: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#c4c4c4' },
  metinler: { flex: 1, gap: 1 },
  ad: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  degistir: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  ekle: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  donus: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32, paddingLeft: 10 },
  donusMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
});
