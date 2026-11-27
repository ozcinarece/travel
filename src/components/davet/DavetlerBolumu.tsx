// #573 KK3 (UX önerileri kanvası `Davet_v1_Gezilerim`): Gezilerim'in en üstünde DAVETLER bölümü. Başlık 13/700 ikincil
// (üstten 14, alttan 8). Her davet açık turuncu kutu (#FFF3EA, köşe 18, iç boşluk 14, öğeler arası 12): 44 pt yuvarlak yüz
// (davet eden, Gece zemin, 14/800 beyaz harf), iki satır metin (16/800 başlıkta gezinin tam adı; 13 ikincil "tarih · gün · Mert
// de geliyor"), altında yarı yarıya "Hayır" (beyaz, 1,5 px #D5DAE5 kenar) ve "Katıl" (Mandalina), ikisi de 44 pt. Davet yoksa
// bölüm hiç çizilmez. KK8: başlık ekran okuyucuya "Davet: {Ad} seni {şehir}'e çağırıyor" diye okunur.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { davetEtiketi, gezilerimAlt, gezilerimBasligi, type GelenDavet } from '@/features/davet/uygulamaIci';
import { t } from '@/i18n';
import { anaV5, renk, yazi } from '@/theme';

/** Kanvas `Davet_v1_Gezilerim`: kutu zemini ve Hayır kenarı. */
export const DAVET_KUTU_ZEMIN = '#FFF3EA';
export const DAVET_HAYIR_KENAR = '#D5DAE5';

type Props = {
  davetler: GelenDavet[];
  onHayir: (d: GelenDavet) => void;
  onKatil: (d: GelenDavet) => void;
  katilan?: string | null;
};

export function DavetlerBolumu({ davetler, onHayir, onKatil, katilan }: Props) {
  if (davetler.length === 0) return null;
  return (
    <View style={s.bolum} testID="davetler-bolumu">
      <Text accessibilityRole="header" style={s.bolumBaslik}>
        {t('davet.kutu.bolum')}
      </Text>
      <View style={s.liste}>
        {davetler.map((d) => {
          const mesgul = katilan === d.id;
          const alt = gezilerimAlt(d);
          return (
            <View key={d.id} style={s.kutu} testID={`davet-satiri-${d.id}`}>
              <View style={s.ust}>
                <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Avatar ad={d.davet_eden_ad ?? '?'} url={d.davet_eden_foto} boyut={44} arkaPlan={renk.ana} yuvarlak harfBoyutu={14} />
                </View>
                <View style={s.metinler}>
                  <Text style={s.baslik} accessibilityLabel={davetEtiketi(d)}>
                    {gezilerimBasligi(d)}
                  </Text>
                  {alt ? <Text style={s.alt}>{alt}</Text> : null}
                </View>
              </View>
              <View style={s.dugmeler}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('davet.kutu.hayir')} onPress={() => onHayir(d)} disabled={mesgul} style={({ pressed }) => [s.hayir, pressed && s.basili]} testID="davet-hayir">
                  <Text style={s.hayirMetin}>{t('davet.kutu.hayir')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('davet.kutu.katil')}
                  accessibilityState={{ busy: mesgul, disabled: mesgul }}
                  onPress={() => onKatil(d)}
                  disabled={mesgul}
                  style={({ pressed }) => [s.katil, (pressed || mesgul) && s.basili]}
                  testID="davet-katil"
                >
                  <Text style={s.katilMetin}>{t('davet.kutu.katil')}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Kanvas: sonraki YAKLAŞAN başlığı kutudan 22 aşağıda; listenin kendi üst boşluğu 14, kalan 8 burada.
  bolum: { paddingBottom: 8 },
  bolumBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.ikincil, paddingTop: 14, paddingBottom: 8 },
  liste: { gap: 12 },
  kutu: { gap: 12, padding: 14, borderRadius: 18, backgroundColor: DAVET_KUTU_ZEMIN },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metinler: { flex: 1, minWidth: 0, gap: 1 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 16, lineHeight: 20, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  dugmeler: { flexDirection: 'row', gap: 8 },
  basili: { opacity: 0.85 },
  hayir: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: DAVET_HAYIR_KENAR, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  hayirMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  katil: { flex: 1, height: 44, borderRadius: 22, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  katilMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
});
