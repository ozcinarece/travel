import Svg, { Circle, Path } from 'react-native-svg';

import type { MenuAnahtari } from '@/features/yonetim/menu';

// #155 kanvas BO-0 sol menü ikonları birebir: 24'lük kutu, 2,2 px çizgi, yuvarlak uç ve birleşim.
const CIZIM: Record<MenuAnahtari, React.ReactNode> = {
  genel: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  anaSayfa: <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  geziler: (
    <>
      <Path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <Path d="M9 4v14M15 6v14" />
    </>
  ),
  sehirler: (
    <>
      <Path d="M3 21h18M5 21V8l5-3v16M10 21V3l9 5v13" />
      <Path d="M13 10h3M13 14h3" />
    </>
  ),
  yerler: (
    <>
      <Path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
      <Circle cx="12" cy="10" r="2.5" />
    </>
  ),
  kullanicilar: (
    <>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <Circle cx="17" cy="9" r="2.5" />
      <Path d="M16 14.2a5 5 0 0 1 5.5 5.8" />
    </>
  ),
  ayarlar: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
};

export function YonetimIkon({ ad, renk, boyut = 18 }: { ad: MenuAnahtari; renk: string; boyut?: number }) {
  return (
    <Svg
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke={renk}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden>
      {CIZIM[ad]}
    </Svg>
  );
}
