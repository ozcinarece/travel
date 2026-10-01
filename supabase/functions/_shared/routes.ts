// Google Routes API — computeRouteMatrix (WALK). Anahtar yalnızca burada (GOOGLE_SERVER_KEY); PRD §5.1, §7.
import { GoogleHatasi } from './google.ts';

export type Nokta = { key: string; lat: number; lng: number };
export type Bacak = { from_key: string; to_key: string; seconds: number; meters: number };

type MatrisEleman = {
  originIndex?: number;
  destinationIndex?: number;
  condition?: string;
  distanceMeters?: number;
  duration?: string; // "734s"
};

/** Verilen origin×destination çiftleri için yürüyüş süre/mesafe. Aynı nokta çifti (origin=destination) atlanır. */
export async function yuruyusMatrisi(kaynaklar: Nokta[], hedefler: Nokta[]): Promise<Bacak[]> {
  if (kaynaklar.length === 0 || hedefler.length === 0) return [];
  const anahtar = Deno.env.get('GOOGLE_SERVER_KEY');
  if (!anahtar) throw new Error('GOOGLE_SERVER_KEY tanımlı değil');
  const waypoint = (n: Nokta) => ({ waypoint: { location: { latLng: { latitude: n.lat, longitude: n.lng } } } });
  const cevap = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': anahtar,
      'x-goog-fieldmask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
    },
    body: JSON.stringify({ origins: kaynaklar.map(waypoint), destinations: hedefler.map(waypoint), travelMode: 'WALK' }),
  });
  if (!cevap.ok) throw new GoogleHatasi(cevap.status, (await cevap.text()).slice(0, 300));
  const elemanlar = (await cevap.json()) as MatrisEleman[];
  const sonuc: Bacak[] = [];
  for (const e of elemanlar) {
    if (e.originIndex === undefined || e.destinationIndex === undefined) continue;
    const a = kaynaklar[e.originIndex];
    const b = hedefler[e.destinationIndex];
    if (!a || !b || a.key === b.key) continue;
    if (e.condition && e.condition !== 'ROUTE_EXISTS') continue;
    const sn = Math.round(Number((e.duration ?? '0s').replace('s', '')));
    if (!Number.isFinite(sn) || sn <= 0) continue;
    sonuc.push({ from_key: a.key, to_key: b.key, seconds: sn, meters: Math.round(e.distanceMeters ?? 0) });
  }
  return sonuc;
}
