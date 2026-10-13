import { router, useLocalSearchParams } from 'expo-router';

import { SehirRehberi } from '@/components/icerik/SehirRehberi';
import { useSehirler } from '@/features/icerik/sorgular';

/** #100 B KK2: şehir rehberi (ana sayfa / Kaydettiklerim'den); içerik `SehirRehberi` (seyahat içi Rehber sekmesiyle ortak). */
export default function RehberEkrani() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const sehirler = useSehirler();
  const sehir = sehirler.data?.find((x) => x.slug === slug);
  return (
    <SehirRehberi
      sehir={sehir}
      sehirlerYukleniyor={sehirler.isPending}
      onGeri={() => router.back()}
      onRehberMekanlari={sehir ? () => router.push({ pathname: '/yerler', params: { sehir: sehir.id } }) : undefined}
    />
  );
}
