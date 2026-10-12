import { Redirect, type Href } from 'expo-router';

import { Hap } from '@/components/yonetim/Hap';
import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { useYonetimDurumu, yonetimCikis } from '@/features/yonetim/admin';
import { YETKIN_YOK, yonetimYonu } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';
import { useOturum } from '@/lib/oturum';

// #106 KK2: e-posta `admin_kullanicilar`da değil. Tasarım bekliyor (kanvasta yok): kanvas parçalarıyla.
export default function YetkinYokSayfasi() {
  const { session } = useOturum();
  const yon = yonetimYonu(useYonetimDurumu(), YETKIN_YOK);
  if (yon) return <Redirect href={yon as Href} />;
  return (
    <YonetimSayfasi
      baslik={ty('yetkinYok.baslik')}
      eylemler={<Hap baslik={ty('yetkinYok.cikis')} onPress={yonetimCikis} />}>
      <Aciklama>{ty('yetkinYok.aciklama', { eposta: session?.user.email ?? '' })}</Aciklama>
    </YonetimSayfasi>
  );
}
