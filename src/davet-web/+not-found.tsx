// #550: davet girişinde olmayan bir yola (seyahat, giriş, ana sayfa, hazır geziler) geçiş: o adres tam uygulamayla yeniden
// yüklenir. Yönlendirme ekranların kendi `router.replace/push` çağrılarından gelir; ekranlar değişmez.
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { tamUygulamaAdresi } from '@/lib/davetWebGirisi';
import { renk } from '@/theme';

export default function TamUygulamaya() {
  const yol = usePathname();
  const parametreler = useGlobalSearchParams();
  const hedef = tamUygulamaAdresi(yol, parametreler);
  useEffect(() => {
    if (hedef && typeof window !== 'undefined') window.location.replace(hedef);
  }, [hedef]);
  return <View style={s.zemin} />;
}

const s = StyleSheet.create({ zemin: { flex: 1, backgroundColor: renk.zemin } });
