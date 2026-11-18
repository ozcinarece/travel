// #300 KK3 (kanvas 29h · B): gezi editöründe ve yer düzenlemede amaç çoklu seçimi. Değerler `public.amac_listesi()` sırasıyla;
// kayıt editörün otomatik kaydıyla, diğer alanlarla birlikte (yayındaki satırda da düzenlenebilir).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AKIS_AMACLARI, type Amac } from '@/features/icerik/amaclar';
import { amacDegistir } from '@/features/yonetim/amac';
import { ty } from '@/features/yonetim/metin';
import { t } from '@/i18n';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

type Props = {
  secili: readonly string[] | null | undefined;
  onDegis: (amaclar: Amac[]) => void;
  /** Gezide boş hal uyarısı ("yalnız Sana göre'de görünür"); kanvasta yalnız gezi için çizili. */
  bosUyari?: boolean;
};

export function AmacSecimi({ secili, onDegis, bosUyari = false }: Props) {
  const liste = secili ?? [];
  return (
    <View style={s.kap}>
      <View style={{ gap: 4 }}>
        <Text style={s.baslik}>{ty('amac.baslik')}</Text>
        <Text style={s.aciklama}>{ty('amac.aciklama')}</Text>
      </View>
      <View accessibilityRole="none" accessibilityLabel={ty('amac.baslik')} style={s.cipler}>
        {AKIS_AMACLARI.map((a) => {
          const acik = liste.includes(a);
          return (
            <Pressable
              key={a}
              accessibilityRole="button"
              accessibilityState={{ selected: acik }}
              aria-pressed={acik}
              onPress={() => onDegis(amacDegistir(liste, a))}
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [s.cip, acik ? s.cipSecili : s.cipBos, pressed && { opacity: 0.85 }]}
              testID={`amac-${a}`}>
              {acik ? (
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.zemin} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <Path d="M5 12.5l4.5 4.5L19 7.5" />
                </Svg>
              ) : null}
              <Text style={[s.cipMetin, { color: acik ? yRenk.zemin : yRenk.metin }]}>{t(`kesfetAkisi.amac.${a}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      {bosUyari && liste.length === 0 ? <Text style={s.uyari}>{ty('amac.bos')}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 12 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 15, color: yRenk.metin },
  aciklama: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cip: { height: 36, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cipSecili: { backgroundColor: yRenk.ana, paddingLeft: 10, paddingRight: 14 },
  cipBos: { backgroundColor: yRenk.zemin, borderWidth: 1.5, borderColor: yRenk.cerceve, paddingHorizontal: 14 },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 13 },
  uyari: { alignSelf: 'flex-start', fontFamily: yazi.normal, fontSize: 13, color: yRenk.amacUyariMetin, backgroundColor: yRenk.amacUyariZemin, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
});
