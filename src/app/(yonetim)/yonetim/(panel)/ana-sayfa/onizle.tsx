import { YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { AnaSayfaOnizleme } from '@/components/yonetim/anaSayfa/AnaSayfaOnizleme';
import { useEnCokAlinan, useTaslakBolumler } from '@/features/yonetim/anaSayfaSorgulari';
import { useYonetimGezileri, useYonetimSehirleri } from '@/features/yonetim/geziSorgulari';
import { kullaniciEtiketi } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';
import { useYonetimYerleri } from '@/features/yonetim/yerSorgulari';
import { useOturum } from '@/lib/oturum';

// #109 KK5 "Önizle" (yeni sekme): taslak düzen, uygulama ana sayfası gerçek boyutta (yayınlanmadan önce bakılır).
export default function AnaSayfaOnizlemeSayfasi() {
  const { session } = useOturum();
  const taslak = useTaslakBolumler();
  const geziler = useYonetimGezileri();
  const yerler = useYonetimYerleri();
  const sehirler = useYonetimSehirleri();
  const enCokAlinan = useEnCokAlinan();
  return (
    <YonetimSayfasi baslik={ty('anaSayfa.onizleme')}>
      <AnaSayfaOnizleme
        bolumler={taslak.data ?? []}
        geziler={geziler.data ?? []}
        yerler={yerler.data ?? []}
        sehirler={sehirler.data ?? []}
        enCokAlinan={enCokAlinan.data ?? null}
        ad={kullaniciEtiketi(session?.user.user_metadata?.full_name as string | undefined, session?.user.email).ad.split(' ')[0]}
      />
    </YonetimSayfasi>
  );
}
