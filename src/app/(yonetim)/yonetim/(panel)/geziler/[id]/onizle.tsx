import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { GeziOnizleme } from '@/components/yonetim/gezi/GeziOnizleme';
import { useYonetimGezi, useYonetimSehirleri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';

// #107 KK7 "Önizle" (yeni sekme): kaydedilmiş gezi, taslak da olsa (admin okur), iki sayfa gerçek boyutta yan yana.
export default function GeziOnizlemeSayfasi() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gezi = useYonetimGezi(id);
  const sehirler = useYonetimSehirleri();
  const sehirAdi = sehirler.data?.find((sh) => sh.id === gezi.data?.sehir_id)?.ad ?? '';
  return (
    <YonetimSayfasi baslik={ty('gezi.baslik', { baslik: gezi.data?.baslik ?? '' })}>
      {gezi.data ? (
        <View style={s.sayfalar}>
          <GeziOnizleme gezi={gezi.data} sehirAdi={sehirAdi} sayfa={0} />
          <GeziOnizleme gezi={gezi.data} sehirAdi={sehirAdi} sayfa={1} />
        </View>
      ) : gezi.isError ? (
        <Aciklama>{ty('gezi.yuklenemedi')}</Aciklama>
      ) : null}
    </YonetimSayfasi>
  );
}

const s = StyleSheet.create({
  sayfalar: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
});
