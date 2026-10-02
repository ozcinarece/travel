import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Buton } from '@/components/ui/Buton';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

type Sorgu = { isPending: boolean; isError: boolean; refetch: () => unknown };

const ZAMAN_ASIMI_MS = 8000;

/**
 * Seyahat içi ekranların yükleme bekçisi (#25): sorgular bitene kadar gösterge; hata ya da 8 sn'yi aşan
 * bekleme → açıklama + "Tekrar dene". Sonsuz dönme yok. Kimlik yoksa doğrudan hata.
 */
export function SeyahatYukleme({ sorgular, kimlikYok }: { sorgular: Sorgu[]; kimlikYok?: boolean }) {
  const [gecikti, setGecikti] = useState(false);
  useEffect(() => {
    const z = setTimeout(() => setGecikti(true), ZAMAN_ASIMI_MS);
    return () => clearTimeout(z);
  }, []);
  const hata = kimlikYok || sorgular.some((s) => s.isError) || gecikti;
  return (
    <View style={s.ekran}>
      {hata ? (
        <>
          <Text style={s.metin}>{kimlikYok ? t('seyahat.bulunamadi') : t('seyahat.yuklenemedi')}</Text>
          {!kimlikYok ? <Buton baslik={t('seyahat.tekrarDene')} tur="ikincil" onPress={() => sorgular.forEach((q) => q.refetch())} stil={s.buton} /> : null}
        </>
      ) : (
        <ActivityIndicator color={renk.metin} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: bosluk.kenar, backgroundColor: renk.yuzey },
  metin: { fontFamily: yazi.yari, fontSize: 14, color: renk.ikincil, textAlign: 'center' },
  buton: { height: 44, paddingHorizontal: 22 },
});
