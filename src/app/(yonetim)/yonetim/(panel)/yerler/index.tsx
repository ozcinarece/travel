import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { YerEditoru } from '@/components/yonetim/yer/YerEditoru';
import { YerListesi } from '@/components/yonetim/yer/YerListesi';
import { useYonetimSehirleri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import { useYonetimYer, useYonetimYerleri, YER_LISTESI, yerOlustur } from '@/features/yonetim/yerSorgulari';
import type { HafifYer } from '@/features/yerler/api';

// #108 yer editörü: /yonetim/yerler?id=<yer>&sehir=<şehir>. Liste solda; seçili yer editörde.
export default function YerlerSayfasi() {
  const { id, sehir } = useLocalSearchParams<{ id?: string; sehir?: string }>();
  const qc = useQueryClient();
  const yerler = useYonetimYerleri();
  const sehirler = useYonetimSehirleri();
  const yer = useYonetimYer(id);
  const [hata, setHata] = useState(false);
  const sehirId = sehir ?? '';

  const yeni = async (h: HafifYer) => {
    const hedefSehir = sehirId || yer.data?.sehir_id || sehirler.data?.[0]?.id;
    if (!hedefSehir) return;
    try {
      const yeniId = await yerOlustur(hedefSehir, h);
      await qc.invalidateQueries({ queryKey: YER_LISTESI });
      router.setParams({ id: yeniId });
    } catch {
      setHata(true);
    }
  };

  const liste = (
    <YerListesi
      yerler={yerler.data ?? []}
      sehirler={sehirler.data ?? []}
      sehirId={sehirId}
      onSehir={(s) => router.setParams({ sehir: s || undefined })}
      seciliId={id}
      onSec={(yid) => router.setParams({ id: yid })}
      onYeni={yeni}
    />
  );

  if (id && yer.data && sehirler.data) {
    return <YerEditoru key={yer.data.id} yer={yer.data} sehirler={sehirler.data} liste={liste} />;
  }
  return (
    <YonetimSayfasi sutunlu baslik={ty('menu.yerler')}>
      {liste}
      <View style={s.bos}>
        <Aciklama>{ty(hata ? 'yer.eklenemedi' : yer.isError ? 'yer.yuklenemedi' : 'yer.bos')}</Aciklama>
      </View>
    </YonetimSayfasi>
  );
}

const s = StyleSheet.create({
  bos: { flex: 1, paddingVertical: 20, paddingHorizontal: 24 },
});
