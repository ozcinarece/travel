import { YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { AnaSayfaOnizleme } from '@/components/yonetim/anaSayfa/AnaSayfaOnizleme';
import { useTaslakBolumler } from '@/features/yonetim/anaSayfaSorgulari';
import { ty } from '@/features/yonetim/metin';

// #109 KK5 "Önizle" (yeni sekme): taslak düzen, uygulamanın Keşfet'i gerçek boyutta (yayınlanmadan önce bakılır; #406 2/2 v6).
export default function AnaSayfaOnizlemeSayfasi() {
  const taslak = useTaslakBolumler();
  return (
    <YonetimSayfasi baslik={ty('anaSayfa.onizleme')}>
      <AnaSayfaOnizleme bolumler={taslak.data ?? []} />
    </YonetimSayfasi>
  );
}
