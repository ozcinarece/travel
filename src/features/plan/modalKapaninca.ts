import { useCallback, useEffect, useRef } from 'react';

/** #570 KK8: `onDismiss` bu süre içinde gelmezse ikinci Modal yine açılır. */
export const MODAL_KAPANMA_YEDEK_MS = 500;

/**
 * iOS'ta kapanmakta olan bir Modal'ın üstüne ikinci Modal açılmayabilir (#570 KK8). `iste(deger)` isteği bekletir;
 * ilk Modal'ın `onDismiss`'i (`kapandi`) ya da `yedekMs` sonra yedek zamanlayıcı — hangisi önce gelirse — `ac(deger)`'i
 * bir kez çağırır. Tek bayrak: ikisi birden açmaz.
 */
export function useModalKapaninca<T>(ac: (deger: T) => void, yedekMs = MODAL_KAPANMA_YEDEK_MS) {
  const bekleyen = useRef<{ deger: T } | null>(null);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kapandi = useCallback(() => {
    if (zaman.current) clearTimeout(zaman.current);
    zaman.current = null;
    const b = bekleyen.current;
    bekleyen.current = null;
    if (b) ac(b.deger);
  }, [ac]);

  const iste = useCallback(
    (deger: T) => {
      if (zaman.current) clearTimeout(zaman.current);
      bekleyen.current = { deger };
      zaman.current = setTimeout(kapandi, yedekMs);
    },
    [kapandi, yedekMs],
  );

  useEffect(
    () => () => {
      if (zaman.current) clearTimeout(zaman.current);
    },
    [],
  );

  return { iste, kapandi };
}
