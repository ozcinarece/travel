// #550 (KK1): web davet girişinin kök düzeni. Yalnız /r/{token} ve /r/g/{token} bu girişle derlenir
// (`WEB_GIRIS=davet npx expo export -p web`, bkz. app.config.ts ve scripts/web-derle.sh). Uygulamanın kök düzeniyle
// aynı sağlayıcılar ve açılış kapısı (`KokKabugu`); gesture-handler, Reanimated, gezinme yığını, harita ve çekmeceler yok.
// Bu girişte olmayan bir yola gidilince (seyahat, giriş, ana sayfa) `+not-found` sayfayı tam uygulamayla yeniden açar.
import { Slot, useGlobalSearchParams, usePathname } from 'expo-router';

import { AcilisKapisi, KokHataEkrani, KokSaglayicilari } from '@/components/kok/KokKabugu';
import { useDavetOzeti } from '@/features/davet/sorgular';
import { usePaylasimOzeti } from '@/features/paylasim/alici';
import { useOturum } from '@/lib/oturum';

export default function DavetWebKoku() {
  return (
    <KokSaglayicilari>
      <OzetOnYukleme />
      <AcilisKapisi>{() => <Slot />}</AcilisKapisi>
    </KokSaglayicilari>
  );
}

/**
 * KK2: özet isteği açılış kapısı (fontlar) beklenmeden, oturum okunur okunmaz başlar. Ekranın kendi sorgu kancası ve
 * anahtarıyla: ekran açılınca sonuç hazırdır, ikinci istek gitmez. Hiçbir şey çizmez.
 */
function OzetOnYukleme() {
  const { hazir } = useOturum();
  const yol = usePathname();
  const { token: ham } = useGlobalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(ham) ? ham[0] : ham;
  if (!hazir || !token) return null;
  return yol.startsWith('/r/g/') ? <PaylasimOnYukleme token={token} /> : <DavetOnYukleme token={token} />;
}

function DavetOnYukleme({ token }: { token: string }) {
  useDavetOzeti(token);
  return null;
}

function PaylasimOnYukleme({ token }: { token: string }) {
  const { hesapli, hazir } = useOturum();
  usePaylasimOzeti(token, hesapli, hazir);
  return null;
}

export const ErrorBoundary = KokHataEkrani;
