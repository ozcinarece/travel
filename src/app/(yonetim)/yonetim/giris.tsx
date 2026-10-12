import { Redirect, type Href } from 'expo-router';
import { useState } from 'react';

import { Hap } from '@/components/yonetim/Hap';
import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { useYonetimDurumu, yonetimGiris } from '@/features/yonetim/admin';
import { GIRIS, yonetimYonu } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';

// #106 KK2: Google ile giriş. Dönüşte oturum URL'deki koddan kurulur; admin köke, admin olmayan "Yetkin yok"a gider.
// Tasarım bekliyor: kanvasta giriş ekranı yok; yalnız kanvas parçaları (üst çubuk + hap + açıklama) kullanıldı.
export default function YonetimGirisSayfasi() {
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState(false);
  const yon = yonetimYonu(useYonetimDurumu(), GIRIS);
  if (yon) return <Redirect href={yon as Href} />;

  const gir = async () => {
    setHata(false);
    setMesgul(true);
    try {
      await yonetimGiris();
    } catch {
      setHata(true);
      setMesgul(false);
    }
  };

  return (
    <YonetimSayfasi
      baslik={ty('giris.baslik')}
      eylemler={<Hap tur="birincil" baslik={ty('giris.google')} onPress={gir} yukleniyor={mesgul} />}>
      <Aciklama>{ty('giris.aciklama')}</Aciklama>
      {hata ? <Aciklama>{ty('giris.hata')}</Aciklama> : null}
    </YonetimSayfasi>
  );
}
