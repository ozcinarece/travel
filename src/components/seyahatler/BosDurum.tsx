import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DavetLinkAlani } from '@/components/DavetLinkAlani';
import { Buton } from '@/components/ui/Buton';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

type Props = {
  /** PRD 0.3 KK2: "bu ay" cevabı verildiyse kart daha büyük gösterilir. */
  buyuk?: boolean;
};

// PRD 0.5: seyahati olmayan kullanıcı bunu görür. KK2: "İlk seyahatini planla" → 3.2, davet → link alanı.
export function BosDurum({ buyuk }: Props) {
  const [alanAcik, setAlanAcik] = useState(false);

  return (
    <View style={[s.kart, buyuk && s.kartBuyuk]}>
      <View style={{ gap: 6 }}>
        <Text style={[s.baslik, buyuk && s.baslikBuyuk]}>{t('seyahatler.bos.baslik')}</Text>
        <Text style={s.alt}>{t('seyahatler.bos.alt')}</Text>
      </View>
      <Buton
        baslik={t('seyahatler.bos.planla')}
        onPress={() => router.push('/(tabs)/yeni')}
        stil={buyuk ? s.butonBuyuk : undefined}
        ikon={
          <View style={s.arti}>
            <Text style={s.artiIsaret}>+</Text>
          </View>
        }
      />
      {alanAcik ? (
        <DavetLinkAlani onToken={(token) => router.push({ pathname: '/r/[token]', params: { token } })} />
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setAlanAcik(true)} hitSlop={8}>
          <Text style={s.davet}>{t('seyahatler.bos.davet')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kart: {
    marginHorizontal: bosluk.kenar,
    marginTop: 18,
    padding: 20,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: renk.yuzey,
    gap: 14,
  },
  kartBuyuk: { padding: 24, paddingVertical: 30, gap: 18 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.7, lineHeight: 25, color: renk.metin },
  baslikBuyuk: { fontSize: 28, lineHeight: 31, letterSpacing: -0.9 },
  butonBuyuk: { height: 58 },
  alt: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 20, color: renk.ikincil },
  arti: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: renk.zemin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artiIsaret: { fontFamily: yazi.kalin, fontSize: 16, lineHeight: 18, color: renk.zemin },
  davet: { fontFamily: yazi.kalin, fontSize: 13, textAlign: 'center', color: renk.metin, paddingVertical: 4 },
});
