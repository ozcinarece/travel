// #573 KK5 (UX önerileri kanvası `Davet_v1_Gonderildi`): davet eden taraf, "Geziyi oluştur"dan sonra açılan çekmece.
// "{Gezi} hazır" (24/800), "{Adlar}'e davet gitti." (15, ikincil, satır 1,45), kişi listesi (satır en az 48, 40 pt yuvarlak yüz,
// 16/700 ad, sağda 14/600 durum: Bekliyor / Katıldı / Geri çevirdi), birincil "Geziye git" (Mandalina, 52 pt, köşe 26, 16/700)
// ve ikincil "Linki de paylaş" (48 pt, Gece yazı 15/700, 18 px bağlantı ikonu). Çekmece: perde Lacivert %38, köşe 22.
// Bileşen yalnız görünüş; #574 "Geziyi oluştur" sonrası bağlar: kişiler `arkadaslarim()` adları + `useGonderilenDavetler`
// durumları (`kisiDurumu`), "Linki de paylaş" mevcut davet linkiyle sistem paylaşım menüsü (`useDavetPaylas`).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AltPencere } from '@/components/ui/AltPencere';
import { Avatar } from '@/components/ui/Avatar';
import { durumMetni, gittiMetni, type GosterilenDurum } from '@/features/davet/uygulamaIci';
import { t } from '@/i18n';
import { anaV5, renk, yazi } from '@/theme';

/** Kanvastaki yüz sırası: açık mavi (Gece harf), açık yeşil (koyu yeşil harf). */
const YUZLER = [
  { zemin: renk.anaAcik, harf: renk.ana },
  { zemin: '#E3F4EC', harf: '#0E7A52' },
] as const;

export type GonderilenKisi = { id: string; ad: string; foto?: string | null; durum: GosterilenDurum };

type Props = {
  acik: boolean;
  /** Gezinin adı (yoksa şehir). */
  gezi: string;
  kisiler: GonderilenKisi[];
  onGeziyeGit: () => void;
  onLinkiPaylas: () => void;
  onKapat: () => void;
};

export function DavetGonderildi({ acik, gezi, kisiler, onGeziyeGit, onLinkiPaylas, onKapat }: Props) {
  return (
    <AltPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('davet.gonderildi.geziyeGit')} gorunus="davet">
      <Text accessibilityRole="header" style={s.baslik}>
        {t('davet.gonderildi.baslik', { gezi })}
      </Text>
      <Text style={s.metin}>{gittiMetni(kisiler.map((k) => k.ad))}</Text>
      <View style={s.liste}>
        {kisiler.map((k, i) => {
          const y = YUZLER[i % YUZLER.length];
          return (
            <View key={k.id} style={s.satir} accessible accessibilityLabel={`${k.ad}, ${durumMetni(k.durum)}`} testID={`gonderilen-${k.id}`}>
              {k.foto ? (
                <Avatar ad={k.ad} url={k.foto} boyut={40} yuvarlak />
              ) : (
                <View style={[s.yuz, { backgroundColor: y.zemin }]}>
                  <Text style={[s.yuzHarf, { color: y.harf }]}>{k.ad.trim().charAt(0).toLocaleUpperCase('tr') || '?'}</Text>
                </View>
              )}
              <Text style={s.ad} numberOfLines={1}>
                {k.ad}
              </Text>
              <Text style={s.durum}>{durumMetni(k.durum)}</Text>
            </View>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={onGeziyeGit} style={({ pressed }) => [s.birincil, pressed && s.basili]} testID="davet-geziye-git">
        <Text style={s.birincilMetin}>{t('davet.gonderildi.geziyeGit')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onLinkiPaylas} style={({ pressed }) => [s.ikincil, pressed && s.basili]} testID="davet-linki-paylas">
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={renk.ana} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </Svg>
        <Text style={s.ikincilMetin}>{t('davet.gonderildi.linkiPaylas')}</Text>
      </Pressable>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  baslik: { marginTop: 4, fontFamily: yazi.ekstra, fontSize: 24, letterSpacing: -0.24, color: renk.metin },
  metin: { paddingTop: 6, fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  liste: { paddingTop: 16, gap: 4 },
  satir: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  yuz: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  yuzHarf: { fontFamily: yazi.ekstra, fontSize: 14 },
  ad: { flex: 1, fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  durum: { fontFamily: yazi.yari, fontSize: 14, color: anaV5.ikincil },
  basili: { opacity: 0.85 },
  birincil: { marginTop: 20, height: 52, borderRadius: 26, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  birincilMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  ikincil: { marginTop: 8, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ikincilMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ana },
});
