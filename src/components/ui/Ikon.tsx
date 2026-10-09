import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IkonAdi =
  | 'kesfet'
  | 'gunler'
  | 'program'
  | 'grup'
  | 'seyahatler'
  | 'yeni'
  | 'profil'
  // #30 pin kategori ikonları (16 px çizgi)
  | 'agac'
  | 'catal'
  | 'fincan'
  | 'muze'
  | 'anit'
  | 'goz'
  | 'kare'
  | 'pin'
  | 'tik'
  | 'ev'
  // #39 görünüm anahtarı
  | 'dunya'
  // #47 B5: emoji yerine çizgi ikonlar
  | 'harita'
  | 'yurume'
  | 'araba'
  | 'yukari'
  | 'asagi'
  | 'daha'
  | 'genislet'
  | 'daralt'
  // #53 pin kategori ikonları (20 px) + sürükle tutamacı + geri
  | 'kamera'
  | 'ibadet'
  | 'dag'
  | 'canta'
  | 'tutamac'
  | 'geri';

type Props = { ad: IkonAdi; boyut?: number; renk: ColorValue; kalinlik?: number };

/**
 * Kanvastaki çizgi ikonlar (#26): yazı tipi bağımlılığı yok, SVG olarak çizilir.
 * Yollar kanvas HTML'inden birebir (24×24 görünüm alanı, 2 px çizgi, yuvarlak uçlar).
 * #30: pin kategori ikonları aynı sette; 16 px'te çizilir (kalınlık 2,2).
 */
export function Ikon({ ad, boyut = 24, renk, kalinlik = 2 }: Props) {
  const ortak = { stroke: renk, strokeWidth: kalinlik, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
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
      ) : ad === 'agac' ? (
        <>
          <Path d="M12 3l5 7h-3l4 5H6l4-5H7l5-7z" {...ortak} />
          <Path d="M12 15v6" {...ortak} />
        </>
      ) : ad === 'catal' ? (
        <>
          <Path d="M7 3v6a2.5 2.5 0 0 0 5 0V3M9.5 3v18" {...ortak} />
          <Path d="M17 3c-1.7 1.2-2.5 3.5-2.5 6.5V13H17v8M17 3v10" {...ortak} />
        </>
      ) : ad === 'fincan' ? (
        <>
          <Path d="M4 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8z" {...ortak} />
          <Path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M7 4.5v2M10 4.5v2M13 4.5v2" {...ortak} />
        </>
      ) : ad === 'muze' ? (
        <>
          <Path d="M3 9l9-5 9 5H3zM5 9v8M9.5 9v8M14.5 9v8M19 9v8M3 20h18" {...ortak} />
        </>
      ) : ad === 'anit' ? (
        <>
          <Path d="M12 2l3 4v9H9V6l3-4z" {...ortak} />
          <Path d="M7 15h10M6 21h12M8 15v6M16 15v6" {...ortak} />
        </>
      ) : ad === 'goz' ? (
        <>
          <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" {...ortak} />
          <Circle cx={12} cy={12} r={3} {...ortak} />
        </>
      ) : ad === 'kare' ? (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={2} {...ortak} />
          <Path d="M4 12h16M12 4v16" {...ortak} />
        </>
      ) : ad === 'pin' ? (
        <>
          <Path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" {...ortak} />
          <Circle cx={12} cy={10} r={2.5} {...ortak} />
        </>
      ) : ad === 'tik' ? (
        <Path d="M5 12.5l4.5 4.5L19 7.5" {...ortak} strokeWidth={kalinlik + 0.6} />
      ) : ad === 'dunya' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...ortak} />
          <Path d="M3 12h18M12 3c2.8 3 4 6 4 9s-1.2 6-4 9c-2.8-3-4-6-4-9s1.2-6 4-9z" {...ortak} />
        </>
      ) : ad === 'harita' ? (
        // Katlanmış harita.
        <Path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20" {...ortak} />
      ) : ad === 'yurume' ? (
        <>
          <Circle cx={13} cy={4.5} r={1.8} {...ortak} />
          <Path d="M10 21l2-6 2.5 2.5V21M12 15l-1-5 3-1.5 2 3.5h2.5M11 10l-3 2v3" {...ortak} />
        </>
      ) : ad === 'araba' ? (
        // #65: uzun bacak modu "araba" (taksi glifinin çatı ışığı olmayan hali; docs/05 §4).
        <>
          <Path d="M5 16V12l2-5h10l2 5v4M3.5 16h17v3h-17z" {...ortak} />
          <Circle cx={7.5} cy={19} r={1} {...ortak} />
          <Circle cx={16.5} cy={19} r={1} {...ortak} />
        </>
      ) : ad === 'yukari' ? (
        <Path d="M6 15l6-6 6 6" {...ortak} />
      ) : ad === 'asagi' ? (
        <Path d="M6 9l6 6 6-6" {...ortak} />
      ) : ad === 'daha' ? (
        <>
          <Circle cx={5.5} cy={12} r={1.3} {...ortak} fill={renk} />
          <Circle cx={12} cy={12} r={1.3} {...ortak} fill={renk} />
          <Circle cx={18.5} cy={12} r={1.3} {...ortak} fill={renk} />
        </>
      ) : ad === 'genislet' ? (
        <Path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" {...ortak} />
      ) : ad === 'daralt' ? (
        <Path d="M20 10h-6V4M14 10l7-7M4 14h6v6M10 14l-7 7" {...ortak} />
      ) : ad === 'kamera' ? (
        <>
          <Path d="M4 8h3l1.5-2.5h7L17 8h3v11H4V8z" {...ortak} />
          <Circle cx={12} cy={13.5} r={3.5} {...ortak} />
        </>
      ) : ad === 'ibadet' ? (
        // Kubbeli yapı + kule.
        <>
          <Path d="M5 20v-6a5 5 0 0 1 10 0v6M3 20h18M10 9V7M19 20V8l-1.5-3L16 8v12" {...ortak} />
        </>
      ) : ad === 'dag' ? (
        <>
          <Path d="M3 19l6.5-11 4 6.5 2-3L21 19H3z" {...ortak} />
          <Circle cx={17.5} cy={6} r={1.5} {...ortak} />
        </>
      ) : ad === 'canta' ? (
        <>
          <Path d="M5 8h14l-1 12H6L5 8z" {...ortak} />
          <Path d="M9 10V7a3 3 0 0 1 6 0v3" {...ortak} />
        </>
      ) : ad === 'tutamac' ? (
        <Path d="M5 8h14M5 12h14M5 16h14" {...ortak} />
      ) : ad === 'geri' ? (
        <Path d="M15 5l-7 7 7 7" {...ortak} />
      ) : ad === 'ev' ? (
        <>
          <Path d="M3.5 11L12 4l8.5 7" {...ortak} />
          <Path d="M6 10v10h12V10M10 20v-6h4v6" {...ortak} />
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
