// #550 (KK1): web'de harita ayrı parça; davet girişinin ilk paketine girmez, "Haritada gör"e basınca iner.
// Parça inene kadar 220 px'lik harita kutusu kendi zemin rengiyle görünür (görünüm aynı).
import { Suspense, lazy } from 'react';

import type { HaritaProps } from '@/components/harita/tipler';

const Harita = lazy(() => import('@/components/harita/Harita').then((m) => ({ default: m.Harita })));

export function PaylasimHaritasi(props: HaritaProps) {
  return (
    <Suspense fallback={null}>
      <Harita {...props} />
    </Suspense>
  );
}
