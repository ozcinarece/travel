// #550: paylaşılan gezinin haritası. Yerelde doğrudan `Harita` (main'deki gibi); web'de `PaylasimHaritasi.web.tsx`
// haritayı ayrı parça olarak yalnız "Haritada gör"e basınca indirir.
import { Harita } from '@/components/harita/Harita';
import type { HaritaProps } from '@/components/harita/tipler';

export function PaylasimHaritasi(props: HaritaProps) {
  return <Harita {...props} />;
}
