import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { SehirEditoru } from '@/components/yonetim/sehir/SehirEditoru';
import { SehirListesi } from '@/components/yonetim/sehir/SehirListesi';
import { ty } from '@/features/yonetim/metin';
import { SEHIR_LISTESI, SEHIR_SECICI, sehirOlustur, useYonetimSehir, useYonetimSehirListesi } from '@/features/yonetim/sehirSorgulari';
import type { HafifYer } from '@/features/yerler/api';

type Sekme = 'genel' | 'rehber' | 'fotolar';

// #111 şehir editörü: /yonetim/sehirler?id=<şehir>&sekme=<genel|rehber|fotolar>. Liste solda; seçili şehir editörde.
export default function SehirlerSayfasi() {
  const { id, sekme } = useLocalSearchParams<{ id?: string; sekme?: Sekme }>();
  const qc = useQueryClient();
  const sehirler = useYonetimSehirListesi();
  const sehir = useYonetimSehir(id);
  const [hata, setHata] = useState(false);

  const yeni = async (y: HafifYer) => {
    try {
      const yeniId = await sehirOlustur(y);
      await Promise.all([qc.invalidateQueries({ queryKey: SEHIR_LISTESI }), qc.invalidateQueries({ queryKey: SEHIR_SECICI })]);
      router.setParams({ id: yeniId, sekme: 'genel' });
    } catch {
      setHata(true);
    }
  };

  const liste = <SehirListesi sehirler={sehirler.data ?? []} seciliId={id} onSec={(sid) => router.setParams({ id: sid })} onYeni={yeni} />;

  if (id && sehir.data) {
    return (
      <SehirEditoru
        key={sehir.data.id}
        sehir={sehir.data}
        sehirler={sehirler.data ?? []}
        liste={liste}
        sekme={sekme === 'genel' || sekme === 'rehber' ? sekme : 'fotolar'}
        onSekme={(s) => router.setParams({ sekme: s })}
      />
    );
  }
  return (
    <YonetimSayfasi sutunlu baslik={ty('menu.sehirler')}>
      {liste}
      <View style={s.bos}>
        <Aciklama>{ty(hata ? 'sehir.eklenemedi' : sehir.isError ? 'sehir.yuklenemedi' : 'sehir.bos')}</Aciklama>
      </View>
    </YonetimSayfasi>
  );
}

const s = StyleSheet.create({
  bos: { flex: 1, paddingVertical: 20, paddingHorizontal: 24 },
});
