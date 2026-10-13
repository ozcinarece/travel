import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { kose, minDokunma, renk, yazi } from '@/theme';

type Props = {
  /** donus: bitiş = başlangıç (aynı otele dönüş). */
  tur: 'baslangic' | 'bitis' | 'donus';
  /** Otel adı; null = otel yok. */
  ad: string | null;
  saat: string;
  onPress: () => void;
  /** #140: başlangıç satırında saate dokununca başlangıç saati seçimi. */
  onSaat?: () => void;
};

/**
 * #56 §1 → #140 (kanvas 11): listenin ilk / son satırı — saat sütunu (44 px) · Gece kare ev · "[Otel adı] · çıkış"
 * (bitişte "· varış", aynı otele dönüşte "· dönüş"). Otel yoksa kesikli kare, "Başlangıç: otel yok" + "Otel ekle".
 */
export function OtelUcSatiri({ tur, ad, saat, onPress, onSaat }: Props) {
  const bas = tur === 'baslangic';
  const saatSutunu = onSaat ? (
    <Pressable accessibilityRole="button" accessibilityLabel={t('program.liste.baslangic')} onPress={onSaat} hitSlop={8} style={s.saatKutu}>
      <Text style={[s.saat, s.saatDokun]}>{saat}</Text>
    </Pressable>
  ) : (
    <View style={s.saatKutu}>
      <Text style={s.saat}>{saat}</Text>
    </View>
  );
  if (!ad) {
    return (
      <View style={s.satir}>
        {saatSutunu}
        <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.icerik, pressed && { opacity: 0.6 }]}>
          <View style={[s.kare, s.kareYok]}>
            <Ikon ad="ev" boyut={14} renk={renk.soluk} kalinlik={2.4} />
          </View>
          <Text style={[s.ad, { color: renk.ikincil }]} numberOfLines={1}>
            {t(bas ? 'gunOteli.baslangicYok' : 'gunOteli.bitisYok')}
          </Text>
          <Text style={s.ekle}>{t('gunOteli.ekle')}</Text>
        </Pressable>
      </View>
    );
  }
  const metin = t(bas ? 'program.liste.otelCikis' : tur === 'donus' ? 'program.liste.otelDonus' : 'program.liste.otelVaris', { ad });
  return (
    <View style={s.satir}>
      {saatSutunu}
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.icerik, pressed && { opacity: 0.6 }]}>
        <View style={s.kare}>
          <Ikon ad="ev" boyut={14} renk={renk.zemin} kalinlik={2.4} />
        </View>
        <Text style={s.ad} numberOfLines={1}>
          {metin}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minDokunma },
  saatKutu: { width: 44 },
  saat: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
  saatDokun: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  icerik: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minDokunma },
  kare: { width: 30, height: 30, borderRadius: 9, backgroundColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  kareYok: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#b4bbd3' },
  ad: { flex: 1, fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  ekle: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana, paddingHorizontal: 4, borderRadius: kose.rozet },
});
