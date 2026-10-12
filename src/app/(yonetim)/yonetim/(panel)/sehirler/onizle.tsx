import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { RehberOnizleme } from '@/components/yonetim/sehir/RehberOnizleme';
import { NeredeGorunur } from '@/components/yonetim/sehir/NeredeGorunur';
import { ty } from '@/features/yonetim/metin';
import { sehirAlanlari, useRehberBolumleri, useYonetimSehir } from '@/features/yonetim/sehirSorgulari';

// #111 "Önizle" (yeni sekme): kayıtlı taslakla uygulama rehber sekmesi gerçek boyutta + görsellerin göründüğü yerler.
export default function SehirOnizlemeSayfasi() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sehir = useYonetimSehir(id);
  const bolumler = useRehberBolumleri(id);
  if (!sehir.data) {
    return (
      <YonetimSayfasi baslik={ty('sehir.onizleme')}>
        <Aciklama>{ty(sehir.isError ? 'sehir.yuklenemedi' : 'genel.yukleniyor')}</Aciklama>
      </YonetimSayfasi>
    );
  }
  return (
    <YonetimSayfasi baslik={ty('sehir.onizlemeBaslik', { ad: sehir.data.ad })}>
      <View style={s.satir}>
        <RehberOnizleme sehirAdi={sehir.data.ad} bolumler={bolumler.data ?? []} seciliId={bolumler.data?.[0]?.id} />
        <NeredeGorunur id={sehir.data.id} taslak={sehirAlanlari(sehir.data)} gezi={sehir.data.geziler?.[0]?.count ?? 0} komsu={undefined} />
      </View>
    </YonetimSayfasi>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
});
