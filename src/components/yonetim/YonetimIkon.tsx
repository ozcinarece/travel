import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { MenuAnahtari } from '@/features/yonetim/menu';

// Kanvastaki sol menü ikonları birebir: 24'lük kutu, 2 px çizgi, yuvarlak uç ve birleşim.
const CIZIM: Record<MenuAnahtari, React.ReactNode> = {
  genel: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  geziler: (
    <>
      <Path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2z" />
      <Path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z" />
    </>
  ),
  yerler: (
    <>
      <Path d="M4 8h3l1.5-2.5h7L17 8h3v11H4V8z" />
      <Circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  sehirler: <Path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />,
  anaSayfa: (
    <>
      <Rect x="3" y="4" width="18" height="6" rx="1.5" />
      <Rect x="3" y="14" width="8" height="6" rx="1.5" />
      <Rect x="13" y="14" width="8" height="6" rx="1.5" />
    </>
  ),
  kullanicilar: (
    <>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" />
    </>
  ),
  ayarlar: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
};

export function YonetimIkon({ ad, renk, boyut = 17 }: { ad: MenuAnahtari; renk: string; boyut?: number }) {
  return (
    <Svg
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke={renk}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden>
      {CIZIM[ad]}
    </Svg>
  );
}
