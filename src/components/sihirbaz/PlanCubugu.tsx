// #139 KK4 (kanvas 7): alt çubuk — "N mekan / K bölge · ~S saat" + Mandalina "Planı kur →". Hiç mekan yoksa "Haritaya geç".
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { gunEki } from '@/features/sihirbaz/planKur';
import { anaV5, baslikStili, gunRengi, kose, renk, yazi } from '@/theme';

type Props = {
  ozet: { mekan: number; bolge: number; saat: number };
  onPlaniKur: () => void;
  onHaritayaGec: () => void;
  yukleniyor?: boolean;
  /**
   * #401 (`Ekran07cIlOnerileri` A–B): il listesi olan şehirde "N yer · G günün X'i dolu" ve gün çubukları (gün renkleri,
   * sırayla dolar). Verilmezse bugünkü "N mekan / K bölge · ~S saat". #443 inceleme 3: 390 px'ten dar ekranda ya da büyük
   * yazıda doluluk metni "N yer"in altına iner (2 satır); 390 px ve üstünde kanvastaki gibi tek satır.
   * #445 (`Ekran07dDolulukTasma`): `sigmayan` = "Planı kur"un bugünkü kuralıyla hiçbir güne sığmayacak yer sayısı
   * (`planiHesapla(...).atanmamis`). ≥ 1 ise taşma hali: "G gün doldu · K yer sığmıyor" (her genişlikte alt satırda), gün
   * çubukları tam dolu ve arkalarında sabit 24 px kırmızı parça. Taşma yokken doluluk gün sayısına ulaştıysa "G gün dolu".
   */
  doluluk?: { gun: number; dolu: number; cubuklar: number[]; sigmayan?: number };
};

/** #443 inceleme 3: kanvas genişliği; altında ya da büyük yazıda doluluk metni ikinci satıra iner. */
export const DOLULUK_TEK_SATIR_GENISLIK = 390;

export function PlanCubugu({ ozet, onPlaniKur, onHaritayaGec, yukleniyor, doluluk }: Props) {
  const bos = ozet.mekan === 0;
  const { width, fontScale } = useWindowDimensions();
  const tasma = !!doluluk && (doluluk.sigmayan ?? 0) > 0;
  const tamDolu = !!doluluk && !tasma && doluluk.dolu >= doluluk.gun;
  // #445 KK4: taşmada metin her genişlikte "N yer"in altına iner.
  const dar = tasma || width < DOLULUK_TEK_SATIR_GENISLIK || fontScale > 1;
  const cubukEtiketi = !doluluk
    ? undefined
    : tasma
      ? t('sihirbaz.onerilenler.dolulukEtiketTasma', { gun: doluluk.gun, k: doluluk.sigmayan ?? 0 })
      : tamDolu
        ? t('sihirbaz.onerilenler.dolulukEtiketTam', { gun: doluluk.gun })
        : undefined;
  return (
    <View style={s.cubuk}>
      <View style={{ flex: 1, gap: doluluk && !bos ? 6 : 1 }}>
        {doluluk && !bos ? (
          <>
            <View style={dar ? s.satirDar : s.satir} testID={dar ? 'doluluk-dar' : 'doluluk-tek'}>
              <Text style={s.baslik}>{t('sihirbaz.onerilenler.ozetYer', { n: ozet.mekan })}</Text>
              <Text style={s.doluluk} numberOfLines={dar ? 2 : 1}>
                {tasma ? (
                  <>
                    {t('sihirbaz.onerilenler.ozetDoldu', { gun: doluluk.gun })}
                    <Text style={s.sigmiyor}>{t('sihirbaz.onerilenler.ozetSigmiyor', { k: doluluk.sigmayan ?? 0 })}</Text>
                  </>
                ) : tamDolu ? (
                  t('sihirbaz.onerilenler.ozetDolulukTam', { gun: doluluk.gun })
                ) : (
                  t('sihirbaz.onerilenler.ozetDoluluk', { gun: doluluk.gun, dolu: gunEki(doluluk.dolu) })
                )}
              </Text>
            </View>
            {/* #445 KK5: tam dolu ve taşmada çubuk grubu tek öğe ("2 gün doldu, 3 yer sığmıyor"); kısmi dolulukta metin yeterli. */}
            <View
              style={s.cubuklar}
              testID="gun-cubuklari"
              {...(cubukEtiketi
                ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: cubukEtiketi }
                : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}>
              {doluluk.cubuklar.map((o, i) => (
                <View key={i} style={s.gunCubugu}>
                  <View style={{ width: `${tasma ? 100 : Math.round(o * 100)}%`, backgroundColor: gunRengi(i + 1) }} />
                </View>
              ))}
              {tasma ? <View testID="tasma-parcasi" style={s.tasmaParcasi} /> : null}
            </View>
          </>
        ) : (
          <Text style={s.baslik}>{bos ? t('sihirbaz.onerilenler.ozetBos') : t('sihirbaz.onerilenler.ozetMekan', { n: ozet.mekan })}</Text>
        )}
        {doluluk && !bos ? null : bos ? (
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
  baslik: { ...baslikStili(18), color: renk.metin },
  satir: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  satirDar: { gap: 1 },
  doluluk: { flexShrink: 1, fontFamily: yazi.kalin, fontSize: 13, color: anaV5.ikincil },
  cubuklar: { flexDirection: 'row', gap: 4 },
  sigmiyor: { color: anaV5.tasma },
  // #445 KK3: gün çubuklarından 8 px sonra (gap 4 + 4), boyu K ile değişmeyen sabit parça.
  tasmaParcasi: { width: 24, height: 6, borderRadius: 3, marginLeft: 4, flexShrink: 0, backgroundColor: anaV5.tasma },
  gunCubugu: { flex: 1, height: 6, borderRadius: 3, backgroundColor: renk.ayrac, overflow: 'hidden', flexDirection: 'row' },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  baglanti: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  dugme: { height: 54, paddingHorizontal: 22, borderRadius: kose.dugme, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
});
