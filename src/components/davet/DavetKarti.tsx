// #573 KK2 (UX önerileri kanvası `Davet_v1_AnaSayfa`): ana sayfanın seyahat şeridinde ilk kart. v9 seyahat kartının ölçüsünde
// (214 pt, köşe 20, şeritteki genişlik); tam fotoğraf ve alttan koyulaşan geçiş (#0E1430 %0 → %78, üst %15'ten sonra). Sol üstte
// turuncu "DAVET" (26 pt, köşe 13, 12/800); başlık tek satır 21/800, alt satır 14/600; sol altta davet eden ve diğer katılanların
// yüzleri (32, 2 px beyaz kenar, 9 binme); sağ altta "Hayır" (çerçeveli) ve "Katıl" (beyaz), ikisi de 44 pt. İçerik soldan ve
// sağdan 16, alttan 14. Kapak: şehrin BO kapağı (yoksa kanvastaki yer tutucu); atıf sağ üstte. Google fotoğrafı kullanılmaz.
// KK8: ekran okuyucu kartı "Davet: {Ad} seni {şehir}'e çağırıyor" diye okur.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { KapakAtfi } from '@/components/icerik/KapakAtfi';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Avatar } from '@/components/ui/Avatar';
import { Foto } from '@/components/ui/Foto';
import { KART_KOSE, KART_YUKSEKLIK, type Kapak } from '@/features/anasayfa/v9';
import { anaSayfaBasligi, davetAlt, davetEtiketi, type GelenDavet } from '@/features/davet/uygulamaIci';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/** Kanvastaki yüz sırası: davet eden Gece (beyaz harf), sonra açık mavi (Gece harf). */
const YUZ_RENKLERI = [renk.ana, renk.anaAcik] as const;
const YUZ_SAYISI = 3;

type Props = {
  davet: GelenDavet;
  kapak: Kapak | null;
  genislik: number;
  onHayir: () => void;
  onKatil: () => void;
  katiliyor?: boolean;
};

export function DavetKarti({ davet, kapak, genislik, onHayir, onKatil, katiliyor }: Props) {
  const alt = davetAlt(davet);
  const yuzler = davet.kisiler.slice(0, YUZ_SAYISI);
  return (
    <View style={[s.kart, { width: genislik }]} testID={`davet-karti-${davet.id}`}>
      {kapak ? (
        <Foto source={{ uri: kapak.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
      ) : (
        <SeyahatKapagi kimlik={davet.trip_id} yukseklik={KART_YUKSEKLIK} kose={KART_KOSE} stil={StyleSheet.absoluteFill} />
      )}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden pointerEvents="none">
        <Defs>
          <LinearGradient id="davetKartGecis" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.15" stopColor="#0E1430" stopOpacity={0} />
            <Stop offset="1" stopColor="#0E1430" stopOpacity={0.78} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#davetKartGecis)" />
      </Svg>
      <View style={s.rozet} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={s.rozetMetin}>{t('davet.kutu.rozet')}</Text>
      </View>
      <View style={s.icerik}>
        <View style={s.metinler}>
          <Text style={s.baslik} numberOfLines={1} accessibilityRole="header" accessibilityLabel={davetEtiketi(davet)}>
            {anaSayfaBasligi(davet)}
          </Text>
          {alt ? <Text style={s.alt} numberOfLines={1}>{alt}</Text> : null}
        </View>
        <View style={s.altSira}>
          <View style={s.yuzler} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {yuzler.map((k, i) => (
              <View key={k.id} style={[s.yuzKenar, i > 0 && s.yuzBinme]}>
                <Avatar ad={k.ad ?? '?'} url={k.foto} boyut={32} arkaPlan={YUZ_RENKLERI[i % YUZ_RENKLERI.length]} yuvarlak harfBoyutu={12} />
              </View>
            ))}
          </View>
          <View style={s.dugmeler}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('davet.kutu.hayir')} onPress={onHayir} disabled={katiliyor} style={({ pressed }) => [s.hayir, pressed && s.basili]} testID="davet-hayir">
              <Text style={s.hayirMetin}>{t('davet.kutu.hayir')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('davet.kutu.katil')}
              accessibilityState={{ busy: !!katiliyor, disabled: !!katiliyor }}
              onPress={onKatil}
              disabled={katiliyor}
              style={({ pressed }) => [s.katil, (pressed || katiliyor) && s.basili]}
              testID="davet-katil"
            >
              <Text style={s.katilMetin}>{t('davet.kutu.katil')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {kapak?.atif ? <KapakAtfi atif={kapak.atif} sade /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  kart: { height: KART_YUKSEKLIK, borderRadius: KART_KOSE, overflow: 'hidden', backgroundColor: renk.yuzey },
  basili: { opacity: 0.85 },
  rozet: { position: 'absolute', left: 14, top: 14, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: renk.vurgu, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.24, color: renk.metin },
  icerik: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 10 },
  metinler: { gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 21, lineHeight: 24, letterSpacing: -0.21, color: renk.zemin },
  alt: { fontFamily: yazi.yari, fontSize: 14, color: renk.zemin },
  altSira: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yuzler: { flexDirection: 'row' },
  yuzKenar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: renk.zemin, overflow: 'hidden' },
  yuzBinme: { marginLeft: -9 },
  dugmeler: { flexDirection: 'row', gap: 8 },
  hayir: { height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', justifyContent: 'center' },
  hayirMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.zemin },
  katil: { height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: renk.zemin, justifyContent: 'center' },
  katilMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
});
