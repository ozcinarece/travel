// #550 (KK1): web davet girişinin kök düzeni. Yalnız /r/{token} ve /r/g/{token} bu girişle derlenir
// (`WEB_GIRIS=davet npx expo export -p web`, bkz. app.config.ts ve scripts/web-derle.sh). Uygulamanın kök düzeniyle
// aynı sağlayıcılar ve açılış kapısı (`KokKabugu`); gesture-handler, Reanimated, gezinme yığını, harita ve çekmeceler yok.
// Bu girişte olmayan bir yola gidilince (seyahat, giriş, ana sayfa) `+not-found` sayfayı tam uygulamayla yeniden açar.
import { Slot, useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { AcilisKapisi, KokHataEkrani, KokSaglayicilari, kokuBaslat } from '@/components/kok/KokKabugu';
import { useDavetOzeti } from '@/features/davet/sorgular';
import { usePaylasimOzeti } from '@/features/paylasim/alici';
import { uygulamayiOnYukle } from '@/lib/davetWebGirisi';
import { useOturum } from '@/lib/oturum';

kokuBaslat();

export default function DavetWebKoku() {
  return (
    <KokSaglayicilari>
      <OzetOnYukleme />
      <AcilisKapisi>
        {() => (
          <>
            <Slot />
            <UygulamaOnYukleme />
          </>
        )}
      </AcilisKapisi>
    </KokSaglayicilari>
  );
}

/**
 * KK2: özet isteği açılış kapısı (fontlar) beklenmeden, oturum okunur okunmaz başlar. Ekranın kendi sorgu kancası ve
 * anahtarıyla: ekran açılınca sonuç hazırdır, ikinci istek gitmez. Hiçbir şey çizmez.
 */
function useDavetToken(): { token: string | undefined; paylasim: boolean } {
  const yol = usePathname();
  const { token: ham } = useGlobalSearchParams<{ token?: string | string[] }>();
  return { token: Array.isArray(ham) ? ham[0] : ham, paylasim: yol.startsWith('/r/g/') };
}

function OzetOnYukleme() {
  const { hazir } = useOturum();
  const { token, paylasim } = useDavetToken();
  if (!hazir || !token) return null;
  return paylasim ? <PaylasimOnYukleme token={token} /> : <DavetOnYukleme token={token} />;
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

/**
 * Öz-inceleme 1: özet (ya da geçersiz/ağ ekranı) çizildikten sonra tam uygulamanın giriş JS'i boşta önden iner; giriş,
 * seyahat ya da ana sayfaya geçişteki tam yeniden yükleme onu beklemez. Açılış kapısının içinde: fontlar hazır, özet
 * sorgusu sonuçlanmış olmalı; ilk açılışın JS bütçesine ve özetin görünme süresine girmez.
 */
function UygulamaOnYukleme() {
  const { token, paylasim } = useDavetToken();
  return token ? paylasim ? <PaylasimSonrasi token={token} /> : <DavetSonrasi token={token} /> : <OnYukle hazir />;
}

function DavetSonrasi({ token }: { token: string }) {
  return <OnYukle hazir={!useDavetOzeti(token).isPending} />;
}

function PaylasimSonrasi({ token }: { token: string }) {
  const { hesapli, hazir } = useOturum();
  return <OnYukle hazir={!usePaylasimOzeti(token, hesapli, hazir).isPending} />;
}

function OnYukle({ hazir }: { hazir: boolean }) {
  useEffect(() => {
    if (!hazir || typeof window === 'undefined') return;
    // Özetin çizildiği kareden sonra, tarayıcı boştayken.
    let bosta: number | undefined;
    const kare = window.requestAnimationFrame(() => {
      const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      bosta = ric ? ric(() => uygulamayiOnYukle(), { timeout: 2000 }) : window.setTimeout(() => uygulamayiOnYukle(), 200);
    });
    return () => {
      window.cancelAnimationFrame(kare);
      if (bosta !== undefined) {
        const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
        if (cic) cic(bosta);
        window.clearTimeout(bosta);
      }
    };
  }, [hazir]);
  return null;
}

export const ErrorBoundary = KokHataEkrani;
