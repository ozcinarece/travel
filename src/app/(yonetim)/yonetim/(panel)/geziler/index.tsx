import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { GeziEditoru } from '@/components/yonetim/gezi/GeziEditoru';
import { GeziListesi } from '@/components/yonetim/gezi/GeziListesi';
import { geziOlustur, useYonetimGezi, useYonetimGezileri, useYonetimSehirleri } from '@/features/yonetim/geziSorgulari';
import { kullaniciEtiketi } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';
import { useOturum } from '@/lib/oturum';

// #107 gezi editörü: /yonetim/geziler?id=<gezi>. Liste her zaman solda; seçili gezi editörde.
export default function GezilerSayfasi() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useOturum();
  const qc = useQueryClient();
  const geziler = useYonetimGezileri();
  const sehirler = useYonetimSehirleri();
  const gezi = useYonetimGezi(id);
  const [yeniMesgul, setYeniMesgul] = useState(false);
  const [hata, setHata] = useState(false);

  const yeni = async () => {
    const sehir = sehirler.data?.[0];
    if (!sehir) return;
    setYeniMesgul(true);
    try {
      const yazar = kullaniciEtiketi(session?.user.user_metadata?.full_name as string | undefined, session?.user.email).ad.split(' ')[0] || null;
      const yeniId = await geziOlustur(sehir.id, yazar);
      await qc.invalidateQueries({ queryKey: ['yonetim', 'geziler'] });
      router.setParams({ id: yeniId });
    } catch {
      setHata(true);
    } finally {
      setYeniMesgul(false);
    }
  };

  const liste = (
    <GeziListesi
      geziler={geziler.data ?? []}
      sehirler={sehirler.data ?? []}
      seciliId={id}
      onSec={(gid) => router.setParams({ id: gid })}
      onYeni={yeni}
      yeniMesgul={yeniMesgul}
    />
  );

  if (id && gezi.data && sehirler.data) {
    return <GeziEditoru key={gezi.data.id} gezi={gezi.data} sehirler={sehirler.data} liste={liste} />;
  }
  return (
    <YonetimSayfasi sutunlu baslik={ty('menu.geziler')}>
      {liste}
      <View style={s.bos}>
        <Aciklama>{ty(gezi.isError || hata ? 'gezi.yuklenemedi' : 'gezi.bos')}</Aciklama>
      </View>
    </YonetimSayfasi>
  );
}

const s = StyleSheet.create({
  bos: { flex: 1, paddingVertical: 20, paddingHorizontal: 24 },
});
