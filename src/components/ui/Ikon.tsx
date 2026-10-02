import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IkonAdi = 'kesfet' | 'gunler' | 'program' | 'grup' | 'seyahatler' | 'yeni' | 'profil';

type Props = { ad: IkonAdi; boyut?: number; renk: ColorValue };

/**
 * Kanvastaki çizgi ikonlar (#26): yazı tipi bağımlılığı yok, SVG olarak çizilir.
 * Yollar kanvas HTML'inden birebir (24×24 görünüm alanı, 2 px çizgi, yuvarlak uçlar).
 */
export function Ikon({ ad, boyut = 24, renk }: Props) {
  const ortak = { stroke: renk, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={boyut} height={boyut} viewBox="0 0 24 24">
      {ad === 'kesfet' ? (
        <>
          <Path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" {...ortak} />
          <Circle cx={12} cy={10} r={2.5} {...ortak} />
        </>
      ) : ad === 'gunler' ? (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={2} {...ortak} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...ortak} />
        </>
      ) : ad === 'program' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...ortak} />
          <Path d="M12 7v5l3 2" {...ortak} />
        </>
      ) : ad === 'grup' ? (
        <>
          <Circle cx={9} cy={8} r={3.5} {...ortak} />
          <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" {...ortak} />
          <Circle cx={17} cy={9} r={3} {...ortak} />
          <Path d="M16 15.5a5 5 0 0 1 5.5 4.5" {...ortak} />
        </>
      ) : ad === 'seyahatler' ? (
        <>
          <Rect x={3} y={7} width={18} height={13} rx={2} {...ortak} />
          <Path d="M9 7V4h6v3M3 12h18" {...ortak} />
        </>
      ) : ad === 'yeni' ? (
        <>
          <Circle cx={12} cy={12} r={10} {...ortak} />
          <Path d="M12 7v10M7 12h10" {...ortak} strokeWidth={2.4} />
        </>
      ) : (
        <>
          <Circle cx={12} cy={8} r={4} {...ortak} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...ortak} />
        </>
      )}
    </Svg>
  );
}
