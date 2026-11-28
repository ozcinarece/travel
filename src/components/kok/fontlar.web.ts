// #643 KK2 (yalnız web): Figtree'nin aynı 5 ağırlığı, woff2 alt küme (Latin-1, Latin Genişletilmiş-A / Türkçe, noktalama;
// `scripts/font-altkume.py` üretir ve denetler). Aile adları native ile aynı (src/theme.ts `yazi`). Native: `fontlar.ts`.
/* eslint-disable @typescript-eslint/no-require-imports */
export const FIGTREE = {
  Figtree_400Regular: require('../../../assets/fonts/figtree/Figtree_400Regular.woff2'),
  Figtree_500Medium: require('../../../assets/fonts/figtree/Figtree_500Medium.woff2'),
  Figtree_600SemiBold: require('../../../assets/fonts/figtree/Figtree_600SemiBold.woff2'),
  Figtree_700Bold: require('../../../assets/fonts/figtree/Figtree_700Bold.woff2'),
  Figtree_800ExtraBold: require('../../../assets/fonts/figtree/Figtree_800ExtraBold.woff2'),
};
