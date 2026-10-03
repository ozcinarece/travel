// Google "encoded polyline" (hassasiyet 1e-5) kod çözücü — Routes API `polyline.encodedPolyline` (#33).
import type { Konum } from '@/components/harita/tipler';

export function polylineCoz(kodlu: string): Konum[] {
  const noktalar: Konum[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < kodlu.length) {
    let sonuc = 0;
    let kaydir = 0;
    let b: number;
    do {
      b = kodlu.charCodeAt(i++) - 63;
      sonuc |= (b & 0x1f) << kaydir;
      kaydir += 5;
    } while (b >= 0x20 && i <= kodlu.length);
    lat += sonuc & 1 ? ~(sonuc >> 1) : sonuc >> 1;
    sonuc = 0;
    kaydir = 0;
    do {
      b = kodlu.charCodeAt(i++) - 63;
      sonuc |= (b & 0x1f) << kaydir;
      kaydir += 5;
    } while (b >= 0x20 && i <= kodlu.length);
    lng += sonuc & 1 ? ~(sonuc >> 1) : sonuc >> 1;
    noktalar.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return noktalar;
}

/** Çizginin orta noktası (uzunluğa göre, bacak etiketi için). */
export function cizgiOrtasi(noktalar: Konum[]): Konum | null {
  if (noktalar.length === 0) return null;
  if (noktalar.length === 1) return noktalar[0];
  const uz = (a: Konum, b: Konum) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180));
  let toplam = 0;
  for (let i = 1; i < noktalar.length; i++) toplam += uz(noktalar[i - 1], noktalar[i]);
  let hedef = toplam / 2;
  for (let i = 1; i < noktalar.length; i++) {
    const p = uz(noktalar[i - 1], noktalar[i]);
    if (hedef <= p) {
      const t = p === 0 ? 0 : hedef / p;
      return { lat: noktalar[i - 1].lat + (noktalar[i].lat - noktalar[i - 1].lat) * t, lng: noktalar[i - 1].lng + (noktalar[i].lng - noktalar[i - 1].lng) * t };
    }
    hedef -= p;
  }
  return noktalar[noktalar.length - 1];
}
