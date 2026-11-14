import { useLocalSearchParams } from 'expo-router';

import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { YerOnizleme } from '@/components/yonetim/yer/YerOnizleme';
import { ty } from '@/features/yonetim/metin';
import { gecerliPlaceId } from '@/features/yonetim/yer';
import { useYonetimYer } from '@/features/yonetim/yerSorgulari';
import { useHafifYerler } from '@/features/yerler/api';

// #108 "Önizle" (yeni sekme): kaydedilmiş yer, taslak da olsa (admin okur); mekan paneli Rehber sekmesi gerçek boyutta.
export default function YerOnizlemeSayfasi() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const yer = useYonetimYer(id);
  const placeId = yer.data && gecerliPlaceId(yer.data.place_id) ? yer.data.place_id! : null;
  // #172: BO yer önizlemesi Google'ın canlı ★ puanını ve yorum sayısını gösterir (tek kimlik, önbellekten).
  const canli = useHafifYerler(placeId ? [placeId] : [], { puan: true });
  return (
    <YonetimSayfasi baslik={ty('yer.baslik', { ad: yer.data?.ad ?? '' })}>
      {yer.data ? <YerOnizleme yer={yer.data} canli={placeId ? canli.data?.[placeId] : undefined} /> : yer.isError ? <Aciklama>{ty('yer.yuklenemedi')}</Aciklama> : null}
    </YonetimSayfasi>
  );
}
