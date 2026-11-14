// Google Routes API — computeRouteMatrix (WALK). Anahtar yalnızca burada (GOOGLE_SERVER_KEY); PRD §5.1, §7.
import { GoogleHatasi } from './google.ts';
import { googleSay } from './sayac.ts';

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
  // Google matrisi eleman başına faturalar (kaynak × hedef); #157 bütçe kartı istek değil eleman sayar.
  googleSay(kaynaklar.length * hedefler.length);
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

// ---------------------------------------------------------------- #33 gerçek rota (computeRoutes)

export type RotaModu = 'WALK' | 'DRIVE';
export type RotaBacagi = { seconds: number; meters: number; polyline: string };

type RotaCevabi = { routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[] };

/** Tek bacak için gerçek yol: süre, mesafe ve kodlu polyline. Rota yoksa null. */
export async function rotaBacagi(a: Nokta, b: Nokta, mod: RotaModu): Promise<RotaBacagi | null> {
  const anahtar = Deno.env.get('GOOGLE_SERVER_KEY');
  if (!anahtar) throw new Error('GOOGLE_SERVER_KEY tanımlı değil');
  const nokta = (n: Nokta) => ({ location: { latLng: { latitude: n.lat, longitude: n.lng } } });
  googleSay();
  const cevap = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': anahtar,
      'x-goog-fieldmask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: nokta(a),
      destination: nokta(b),
      travelMode: mod,
      ...(mod === 'DRIVE' ? { routingPreference: 'TRAFFIC_UNAWARE' } : {}),
      polylineQuality: 'OVERVIEW',
    }),
  });
  if (!cevap.ok) throw new GoogleHatasi(cevap.status, (await cevap.text()).slice(0, 300));
  const r = ((await cevap.json()) as RotaCevabi).routes?.[0];
  if (!r?.polyline?.encodedPolyline) return null;
  const sn = Math.round(Number((r.duration ?? '0s').replace('s', '')));
  if (!Number.isFinite(sn) || sn <= 0) return null;
  return { seconds: sn, meters: Math.round(r.distanceMeters ?? 0), polyline: r.polyline.encodedPolyline };
}

// ---------------------------------------------------------------- #192 önerilen gezi günü (tek istekte ara noktalı rota)

/** Essentials SKU'da kalmak için istek başına en çok 10 ara nokta (12 nokta = 11 bacak); daha uzun gün parçalara bölünür. */
export const GUN_PARCA_BACAK = 11;

type GunRotasiCevabi = { routes?: { legs?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[] }[] };

/**
 * #192: bir günün ardışık noktaları için gerçek yol — tek computeRoutes isteği (origin → intermediates → destination); her bacağın
 * süresi, mesafesi ve kodlu polyline'ı. 11'den çok bacak parçalara bölünür (parça başına bir istek). Bacak sırası noktalarla
 * aynı; rotası çıkmayan parçanın bacakları null.
 */
export async function gunRotasi(noktalar: Nokta[], mod: RotaModu = 'WALK'): Promise<(RotaBacagi | null)[]> {
  const anahtar = Deno.env.get('GOOGLE_SERVER_KEY');
  if (!anahtar) throw new Error('GOOGLE_SERVER_KEY tanımlı değil');
  const nokta = (n: Nokta) => ({ location: { latLng: { latitude: n.lat, longitude: n.lng } } });
  const sonuc: (RotaBacagi | null)[] = [];
  for (let bas = 0; bas < noktalar.length - 1; bas += GUN_PARCA_BACAK) {
    const parca = noktalar.slice(bas, bas + GUN_PARCA_BACAK + 1);
    googleSay();
    const cevap = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': anahtar,
        'x-goog-fieldmask': 'routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: nokta(parca[0]),
        destination: nokta(parca[parca.length - 1]),
        intermediates: parca.slice(1, -1).map(nokta),
        travelMode: mod,
        ...(mod === 'DRIVE' ? { routingPreference: 'TRAFFIC_UNAWARE' } : {}),
        polylineQuality: 'OVERVIEW',
      }),
    });
    if (!cevap.ok) throw new GoogleHatasi(cevap.status, (await cevap.text()).slice(0, 300));
    // Rota çıktıysa her bacak gelir; aynı noktadaki ardışık duraklarda Google süre / mesafe / polyline'ı boş bırakabilir (0 değer
    // JSON'da yazılmaz) → 1 sn, 0 m, boş polyline (çizgi düz kalır). Rota çıkmadıysa parçanın bacakları null.
    const bacaklar = ((await cevap.json()) as GunRotasiCevabi).routes?.[0]?.legs ?? [];
    const tam = bacaklar.length === parca.length - 1;
    for (let i = 0; i < parca.length - 1; i++) {
      const b = bacaklar[i];
      const sn = Math.round(Number((b?.duration ?? '0s').replace('s', '')));
      sonuc.push(tam && b && Number.isFinite(sn) ? { seconds: Math.max(1, sn), meters: Math.round(b.distanceMeters ?? 0), polyline: b.polyline?.encodedPolyline ?? '' } : null);
    }
  }
  return sonuc;
}
