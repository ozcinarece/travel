import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { renk } from '@/theme';

import { LOGO_YAZISI_GENISLIK, LOGO_YAZISI_YOLU, LOGO_YAZISI_YUKSEKLIK } from './logoYazisiYolu';

/**
 * #136 KK7 (kanvas Tur 4 · 1): iki durak noktası (Mandalina + Gece) ve aralarında kesik çizgili gülümseme (rota).
 * Koyu zeminde ikinci nokta beyaz. 24 px altında çizgi kesiksiz (küçükte kesikler okunmaz); `kesik` verilirse
 * boyuttan bağımsız kesik çizgi (#287 KK2: kanvas 29a · 29b kart rozeti 20×12'de `stroke-dasharray 7 4.5`).
 */
export function Logo({ boyut = 36, koyuZemin = false, kesik = false }: { boyut?: number; koyuZemin?: boolean; kesik?: boolean }) {
  const h = (boyut * 48) / 80;
  const kesiksiz = !kesik && boyut < 24;
  return (
    <Svg width={boyut} height={h} viewBox="0 0 80 48" accessibilityLabel="Tripmate">
      <Circle cx={24} cy={14} r={7} fill={renk.vurgu} />
      <Circle cx={56} cy={14} r={7} fill={koyuZemin ? renk.zemin : renk.ana} />
      <Path d="M20 30 Q40 48 60 30" stroke={renk.vurgu} strokeWidth={7} fill="none" strokeDasharray={kesiksiz ? undefined : '7 4.5'} strokeLinecap={kesiksiz ? 'round' : 'butt'} />
    </Svg>
  );
}

/**
 * #307 KK7: "tripmate" logo yazısı — metin değil, sabit SVG yolu (Archivo 850 / 115 glifleri; font dosyası yok).
 * `boyut` = eski metnin font boyutu (px); kutu eski satır kutusuyla aynı (1,088 em yükseklik).
 */
export function LogoYazisi({ boyut, renk: dolgu }: { boyut: number; renk: string }) {
  const olcek = boyut / 1000;
  return (
    <Svg
      width={LOGO_YAZISI_GENISLIK * olcek}
      height={LOGO_YAZISI_YUKSEKLIK * olcek}
      viewBox={`0 0 ${LOGO_YAZISI_GENISLIK} ${LOGO_YAZISI_YUKSEKLIK}`}
      accessible={false}
      aria-hidden
    >
      <Path d={LOGO_YAZISI_YOLU} fill={dolgu} />
    </Svg>
  );
}

/** Logo + "tripmate" yazısı (Gece; koyu zeminde beyaz). */
export function LogoYazi({ boyut = 36, koyuZemin = false }: { boyut?: number; koyuZemin?: boolean }) {
  return (
    <View style={s.satir} accessible accessibilityRole="image" accessibilityLabel="Tripmate">
      <Logo boyut={boyut} koyuZemin={koyuZemin} />
      <LogoYazisi boyut={boyut * 0.6} renk={koyuZemin ? renk.zemin : renk.ana} />
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
