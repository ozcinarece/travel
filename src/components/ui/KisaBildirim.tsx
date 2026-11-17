import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

/** Ekranın altında 3 sn görünen kısa bildirim ("Seyahat silindi"); dokunmayı engellemez, ekran okuyucu okur. */
export function KisaBildirim({ metin, alt = 24 }: { metin: string | null; alt?: number }) {
  if (!metin) return null;
  return (
    <View style={[s.kap, { bottom: alt }]} pointerEvents="none" accessibilityLiveRegion="polite">
      <Text style={s.metin}>{metin}</Text>
    </View>
  );
}

/** Ekranın kendi bildirimi: `goster(metin)` 3 sn gösterir. */
export function useKisaBildirim() {
  const [metin, setMetin] = useState<string | null>(null);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goster = useCallback((m: string) => {
    setMetin(m);
    if (zaman.current) clearTimeout(zaman.current);
    zaman.current = setTimeout(() => setMetin(null), 3000);
  }, []);
  useEffect(
    () => () => {
      if (zaman.current) clearTimeout(zaman.current);
    },
    [],
  );
  return { metin, goster };
}

/**
 * Seyahat içinden silince (sahip) ya da açık seyahat başkası tarafından silinince ekran `bildirim` parametresiyle açılır;
 * parametre 3 sn sonra temizlenir.
 */
export function useGelenBildirim(): string | null {
  const parametre = useLocalSearchParams<{ bildirim?: string }>();
  const metin = parametre.bildirim === 'silindi' ? t('seyahatler.silindi') : parametre.bildirim === 'silinmis' ? t('seyahatler.silinmis') : null;
  useEffect(() => {
    if (!metin) return;
    const z = setTimeout(() => router.setParams({ bildirim: undefined }), 3000);
    return () => clearTimeout(z);
  }, [metin]);
  return metin;
}

const s = StyleSheet.create({
  kap: {
    position: 'absolute',
    left: bosluk.kenar,
    right: bosluk.kenar,
    alignItems: 'center',
  },
  metin: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: renk.metin,
    color: renk.zemin,
    fontFamily: yazi.ekstra,
    fontSize: 13,
  },
});
