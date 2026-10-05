// #42 KK7 / #43 KK4: kullanıcı konumu (ön plan izni; arka plan izni v1'de istenmez). Yalnız seyahat gününde Program ekranında.
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { Konum } from '@/components/harita/tipler';
import { mesafeM } from '@/components/harita/geo';

export type KonumIzni = 'bekliyor' | 'verildi' | 'reddedildi';

/** "Bir durağın içinde" sayılan yarıçap (metre). */
export const DURAK_YARICAPI_M = 60;

export function useKonum(aktif: boolean): { konum: Konum | null; izin: KonumIzni } {
  const [konum, setKonum] = useState<Konum | null>(null);
  const [izin, setIzin] = useState<KonumIzni>('bekliyor');
  useEffect(() => {
    if (!aktif) return;
    let abonelik: Location.LocationSubscription | null = null;
    let iptal = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (iptal) return;
        if (status !== 'granted') {
          setIzin('reddedildi');
          return;
        }
        setIzin('verildi');
        abonelik = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 10_000 }, (p) =>
          setKonum({ lat: p.coords.latitude, lng: p.coords.longitude }),
        );
      } catch {
        if (!iptal) setIzin('reddedildi');
      }
    })();
    return () => {
      iptal = true;
      abonelik?.remove();
    };
  }, [aktif]);
  return { konum: aktif ? konum : null, izin };
}

/** Kullanıcının 60 m içinde olduğu ilk durak (kimlik); yoksa null. */
export function yakinDurakId(konum: Konum | null, duraklar: { id: string; konum: Konum }[]): string | null {
  if (!konum) return null;
  for (const d of duraklar) if (mesafeM(konum, d.konum) <= DURAK_YARICAPI_M) return d.id;
  return null;
}
