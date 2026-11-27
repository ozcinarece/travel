// #569 KK8 (kanvas `Ana_v9_GeziOncesi` · `_GeziSirasi` · `_GeziYok`): ana sayfa rafları. Konu çipi ve emoji yok.
// - "Arkadaşlarının rotaları": başlık 19/800 + "Tümü" (14/700 Gece); 200 pt kartlar (aralık 12): 130 pt kapak (köşe 14), altında
//   26 pt yüz, şehir (14/700) ve "Ad · N gün" (12, ikincil). Veri #533'ün açık paylaşım akışı; boşsa raf yok.
// - BO rafları: kategori başlığı 21/800; 150×186 kartlar (köşe 16, aralık 10), tam kapak, alttan koyulaşan geçiş (%45'ten
//   sonra #0E1430 %60), başlık kapağın üstünde 16/800 beyaz (12 içeride).
// Kapaksız kartta kanvastaki yer tutucu (`SeyahatKapagi`). Google fotoğrafı yok.
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Avatar } from '@/components/ui/Avatar';
import { Foto } from '@/components/ui/Foto';
import { RAF_EN_COK, type Raf as RafVerisi } from '@/features/anasayfa/raflar';
import type { ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import type { AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { ilkAd } from '@/features/paylasim/baslik';
import { t } from '@/i18n';
import { anaV5, arkadasRenkleri, minDokunma, renk, yazi } from '@/theme';

const ARKADAS_KART = 200;
const ARKADAS_KAPAK = 130;
const BO_KART_GENISLIK = 150;
const BO_KART_YUKSEKLIK = 186;

/** KK8: ilk raf. Paylaşım yoksa çağıran çizmez. */
export function ArkadasRotalari({ paylasimlar, onTumu }: { paylasimlar: ArkadasPaylasimi[]; onTumu: () => void }) {
  // Yüz rengi paylaşan kişiye göre sabit (aynı kişinin kartları aynı renkte).
  const sira = new Map<string, number>();
  for (const p of paylasimlar) if (!sira.has(p.paylasan)) sira.set(p.paylasan, sira.size);
  const baslik = t('anasayfa.v9.arkadasRotalari');
  return (
    <View style={s.raf} testID="raf-arkadaslar">
      <View style={s.ust}>
        <Text accessibilityRole="header" style={s.arkadasBaslik} numberOfLines={1}>
          {baslik}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v6.tumuEtiket', { baslik })} onPress={onTumu} hitSlop={8} style={s.tumu}>
          <Text style={s.tumuMetin}>{t('anasayfa.tumu')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.arkadasKartlar} decelerationRate="fast" snapToInterval={ARKADAS_KART + 12}>
        {paylasimlar.slice(0, RAF_EN_COK).map((p) => {
          const ad = ilkAd(p.paylasan_ad) ?? t('seyahatV7.adsiz');
          const alt = t('anasayfa.v9.arkadasAlt', { ad, n: p.gun_sayisi });
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={t('anasayfa.v9.arkadasEtiket', { sehir: p.sehir, ad, n: p.gun_sayisi })}
              onPress={() => router.push({ pathname: '/r/g/[token]', params: { token: p.id } })}
              style={({ pressed }) => [s.arkadasKart, pressed && s.basili]}
              testID={`arkadas-rota-${p.id}`}
            >
              <SeyahatKapagi kimlik={p.id} yukseklik={ARKADAS_KAPAK} kose={14} />
              <View style={s.arkadasSatir}>
                <Avatar ad={ad} url={p.foto} boyut={26} arkaPlan={arkadasRenkleri[(sira.get(p.paylasan) ?? 0) % arkadasRenkleri.length]} yuvarlak harfBoyutu={11} />
                <View style={s.arkadasMetin}>
                  <Text style={s.arkadasSehir} numberOfLines={1}>
                    {p.sehir}
                  </Text>
                  <Text style={s.arkadasAlt} numberOfLines={1}>
                    {alt}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** KK8: BO rafı — kategori başlığı ve kapak üstü başlıklı kartlar. */
export function RafV9({ raf, onKart }: { raf: RafVerisi<AkisGezisi>; onKart: (g: AkisGezisi) => void }) {
  return (
    <View style={s.raf} testID={`raf-${raf.id}`}>
      <View style={s.ust}>
        <Text accessibilityRole="header" style={s.boBaslik} numberOfLines={1}>
          {raf.baslik}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.boKartlar} decelerationRate="fast" snapToInterval={BO_KART_GENISLIK + 10}>
        {raf.geziler.slice(0, RAF_EN_COK).map((g) => (
          <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={g.baslik} onPress={() => onKart(g)} style={({ pressed }) => [s.boKart, pressed && s.basili]} testID={`raf-kart-${g.id}`}>
            {g.kapak_url ? (
              <Foto source={{ uri: g.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
            ) : (
              <SeyahatKapagi kimlik={g.id} yukseklik={BO_KART_YUKSEKLIK} kose={16} />
            )}
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden pointerEvents="none">
              <Defs>
                <LinearGradient id="v9RafGecis" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.45" stopColor="#0E1430" stopOpacity={0} />
                  <Stop offset="1" stopColor="#0E1430" stopOpacity={0.6} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="1" height="1" fill="url(#v9RafGecis)" />
            </Svg>
            <Text style={s.boKartBaslik} numberOfLines={3}>
              {g.baslik}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  raf: { gap: 12 },
  basili: { opacity: 0.9 },
  ust: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  arkadasBaslik: { flex: 1, fontFamily: yazi.ekstra, fontSize: 19, color: renk.metin },
  boBaslik: { flex: 1, fontFamily: yazi.ekstra, fontSize: 21, color: renk.metin },
  // 44 pt dokunma: yazı sağda kalır, alan yukarı-aşağı büyür.
  tumu: { minHeight: minDokunma, justifyContent: 'center', marginVertical: -12 },
  tumuMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.ana },
  arkadasKartlar: { paddingHorizontal: 16, gap: 12 },
  arkadasKart: { width: ARKADAS_KART, gap: 8 },
  arkadasSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arkadasMetin: { flex: 1 },
  arkadasSehir: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  arkadasAlt: { fontFamily: yazi.normal, fontSize: 12, color: anaV5.ikincil },
  boKartlar: { paddingHorizontal: 16, gap: 10 },
  boKart: { width: BO_KART_GENISLIK, height: BO_KART_YUKSEKLIK, borderRadius: 16, overflow: 'hidden', backgroundColor: renk.yuzey },
  boKartBaslik: { position: 'absolute', left: 12, right: 12, bottom: 12, fontFamily: yazi.ekstra, fontSize: 16, lineHeight: 19, color: renk.zemin },
});
