// #307 / #643: uygulamanın tek font ailesi Figtree; yalnız kullanılan 5 ağırlık (src/theme.ts `yazi`). Native (iOS/Android)
// paketin TTF'lerini kullanır; web'de bu dosyanın yerine `fontlar.web.ts` (woff2 alt kümeler) gelir.
// Ağırlıklar alt yollardan: paketin kökü kullanılmayan 9 ağırlığı ve meta verisini de pakete katar (#550).
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';

export const FIGTREE = {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
};
