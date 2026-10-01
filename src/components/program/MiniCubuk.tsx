import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import type { MiniCubuk as MiniCubukVerisi } from '@/schedule/kaydir';
import { dakikaSaat } from '@/schedule/tempo';
import { renk, yazi } from '@/theme';

type Props = {
  cubuk: MiniCubukVerisi;
  /** Durak kimliği → mekan adı (canlı). */
  adi: (durakId: string) => string;
  onKaydir: () => void;
  onAtla: () => void;
  onKoru: () => void;
};

/** PRD §5.4 mini-çubuk: yalnız 3.1 ve 3.7'de, alt menünün hemen üstünde. */
export function MiniCubuk({ cubuk, adi, onKaydir, onAtla, onKoru }: Props) {
  const baslik =
    cubuk.tur === 'yuruyus'
      ? t('program.cubuk.yuruyus', { ad: adi(cubuk.hedefId), n: cubuk.kalanDk })
      : t('program.cubuk.uzun', { ad: adi(cubuk.durakId), n: cubuk.uzunDk });
  const alt =
    cubuk.tur === 'yuruyus'
      ? cubuk.gecikmeDk > 0
        ? t('program.cubuk.gec', { n: cubuk.gecikmeDk })
        : ''
      : t('program.cubuk.bitis', { eski: dakikaSaat(cubuk.eskiBitisDk), yeni: dakikaSaat(cubuk.yeniBitisDk) });
  return (
    <View style={s.kap} accessibilityRole="summary">
      <View style={s.ikon}>
        <Text style={s.ikonMetin}>🚶</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.baslik} numberOfLines={1}>
          {baslik}
        </Text>
        {alt ? (
          <Text style={s.alt} numberOfLines={1}>
            {alt}
          </Text>
        ) : null}
      </View>
      <View style={s.dugmeler}>
        <Pressable accessibilityRole="button" onPress={onKaydir} style={[s.dugme, s.dugmeSiyah]}>
          <Text style={[s.dugmeMetin, { color: renk.zemin }]}>{t('program.cubuk.kaydir')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAtla} style={s.dugme}>
          <Text style={s.dugmeMetin}>{t('program.cubuk.atla')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('program.cubuk.koru')} onPress={onKoru} hitSlop={8} style={s.kapat}>
          <Text style={s.kapatMetin}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { marginHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingLeft: 12, paddingRight: 6, borderRadius: 14, backgroundColor: renk.yuzey },
  ikon: { width: 34, height: 34, borderRadius: 10, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  ikonMetin: { fontSize: 16 },
  baslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  dugmeler: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dugme: { height: 34, paddingHorizontal: 10, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  dugmeSiyah: { backgroundColor: renk.metin, paddingHorizontal: 12 },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  kapat: { width: 28, height: 34, alignItems: 'center', justifyContent: 'center' },
  kapatMetin: { fontFamily: yazi.kalin, fontSize: 18, color: renk.ikincil },
});
