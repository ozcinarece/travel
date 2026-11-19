import { GoogleFoto } from '@/components/ui/Foto';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GoogleFotoAtfi } from '@/components/icerik/KapakAtfi';
import { usePlaceFoto } from '@/features/yerler/api';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Foto = { ad: string; yazar: string | null; yazar_uri?: string | null };

type Props = { fotolar: Foto[]; ilkUri: string | null; yukseklik: number };

/**
 * #31, #55: yatay kaydırmalı galeri — en fazla 10 Google fotoğrafı, sayfa göstergesi ("3/10"), her fotoğrafın altında atıf.
 * Tembel: yalnız görünen ve komşu sayfaların URI'si istenir (fotoğraf başına fatura). İlk fotoğraf places-full'dan hazır gelir.
 */
export function FotoGalerisi({ fotolar, ilkUri, yukseklik }: Props) {
  const { width } = useWindowDimensions();
  const [sayfa, setSayfa] = useState(0);
  if (fotolar.length === 0) return null;
  return (
    <View style={{ height: yukseklik }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setSayfa(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ width }}>
        {fotolar.map((f, i) => (
          <View key={f.ad} style={{ width, height: yukseklik }}>
            <FotoSayfasi foto={f} hazirUri={i === 0 ? ilkUri : null} yukle={Math.abs(i - sayfa) <= 1} />
          </View>
        ))}
      </ScrollView>
      {fotolar.length > 1 ? (
        <View style={s.sayac} pointerEvents="none">
          <Text style={s.sayacMetin}>{t('mekan.fotoSayac', { i: sayfa + 1, n: fotolar.length })}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function FotoSayfasi({ foto, hazirUri, yukle }: { foto: Foto; hazirUri: string | null; yukle: boolean }) {
  const sorgu = usePlaceFoto(yukle && !hazirUri ? foto.ad : undefined);
  const uri = hazirUri ?? sorgu.data ?? null;
  return (
    <View style={s.sayfa}>
      {uri ? <GoogleFoto source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      {/* #359 KK2: yazarın Google sayfası varsa kutu bağlantı (#351 ile aynı davranış). */}
      <GoogleFotoAtfi yazar={foto.yazar} uri={foto.yazar_uri} />
    </View>
  );
}

const s = StyleSheet.create({
  sayfa: { flex: 1, backgroundColor: '#d9d9d6' },
  sayac: { position: 'absolute', left: 12, bottom: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(15,15,15,0.55)' },
  sayacMetin: { fontFamily: yazi.kalin, fontSize: 11, color: renk.zemin },
});
