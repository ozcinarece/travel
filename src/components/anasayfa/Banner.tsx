// #406 KK2 (UX önerileri kanvası, `Ana_v6_Kesfet`): ana sayfa banner'ı — 150 px, köşe 18, kenarlardan 16. Görsel (Ece'nin ya da
// hedefin Commons kapağı); yoksa kanvastaki sıcak zemin. Altta 90 px koyu geçiş; üstünde beyaz küçük üst yazı (12/700, %90),
// başlık (21/800) ve "N hazır gezi ›" ya da tek gezi hedefinde "Geziyi gör ›" (13/600). Atıf sağ üstte. Tek dokunma alanı: hedefi açar.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { KapakAtfi } from '@/components/icerik/KapakAtfi';
import { Foto } from '@/components/ui/Foto';
import type { Banner as BannerVerisi } from '@/features/anasayfa/raflar';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

export const BANNER_YUKSEKLIK = 150;

/** Kanvastaki görselsiz zemin (yukarıdan aşağı). */
const ZEMIN = ['#F2C9A5', '#E8A36F', '#B9693C'] as const;
/** Kanvas: koyu geçiş #0E1430 %0 → %55. */
const GECIS = '#0E1430';

export function Banner({ banner, onAc }: { banner: BannerVerisi; onAc: () => void }) {
  // Kanvas #406 notu: hedef tek gezi ise "Geziyi gör ›", şehir ya da raf hedefinde "N hazır gezi ›".
  const tekGezi = banner.hedef.tur === 'gezi';
  const etiket = tekGezi
    ? t('anasayfa.v6.bannerGeziyiGorEtiket', { baslik: banner.baslik })
    : t('anasayfa.v6.bannerEtiket', { baslik: banner.baslik, n: banner.geziSayisi });
  const altSatir = tekGezi ? t('anasayfa.v6.bannerGeziyiGor') : t('anasayfa.v6.bannerSayi', { n: banner.geziSayisi });
  return (
    <View style={s.kap} testID="ana-banner">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[banner.ustYazi, etiket].filter(Boolean).join(', ')}
        onPress={onAc}
        style={({ pressed }) => [StyleSheet.absoluteFill, pressed && s.basili]}
      >
        {banner.kapak ? (
          <Foto source={{ uri: banner.kapak }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
        ) : (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <Defs>
              <LinearGradient id="bannerZemin" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ZEMIN[0]} />
                <Stop offset="0.55" stopColor={ZEMIN[1]} />
                <Stop offset="1" stopColor={ZEMIN[2]} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#bannerZemin)" />
          </Svg>
        )}
        <Svg style={s.gecis} width="100%" height={90} viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden>
          <Defs>
            <LinearGradient id="bannerGecis" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={GECIS} stopOpacity={0} />
              <Stop offset="1" stopColor={GECIS} stopOpacity={0.55} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="90" fill="url(#bannerGecis)" />
        </Svg>
        <View style={s.metinler} pointerEvents="none">
          {banner.ustYazi ? (
            <Text style={s.ustYazi} numberOfLines={1}>
              {banner.ustYazi}
            </Text>
          ) : null}
          <Text style={s.baslik} numberOfLines={1}>
            {banner.baslik}
          </Text>
          <Text style={s.sayi}>{altSatir}</Text>
        </View>
      </Pressable>
      {banner.atif ? <KapakAtfi atif={banner.atif} stil={s.atif} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { marginHorizontal: 16, height: BANNER_YUKSEKLIK, borderRadius: 18, overflow: 'hidden', backgroundColor: ZEMIN[1] },
  basili: { opacity: 0.9 },
  gecis: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  metinler: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 2 },
  ustYazi: { fontFamily: yazi.kalin, fontSize: 12, color: renk.zemin, opacity: 0.9 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 21, letterSpacing: -0.21, color: renk.zemin },
  sayi: { fontFamily: yazi.yari, fontSize: 13, color: renk.zemin },
  // Kanvas: sağdan 12, üstten 10.
  atif: { top: 10, right: 12, bottom: undefined },
});
