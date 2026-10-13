// #143 KK2 (kanvas 17): önerilen gezinin "Rota & plan" hesapları — duraklar arası yürüyüş (kuş uçuşu × 1,3 ÷ 4,5 km/sa;
// gezinin günleri seyahate ait değil, Google rota isteği atılmaz) ve gün özeti ("~5 sa 40 dk · 3,4 km yürüyüş").
import { mesafeM } from '@/components/harita/geo';
import type { GeziDuragi } from '@/lib/tipler';
import { kestirimYuruyusSn } from '@/schedule/tempo';

export type GeziGunOzeti = {
  /** Durak süreleri + yürüyüş (dakika, yuvarlamasız toplam). */
  toplamDk: number;
  /** Toplam yürüyüş mesafesi (m, dolambaç payıyla). */
  yuruyusM: number;
  /** i. durağa gelen yürüyüş, dakika (ilk durak için yok). */
  bacakDk: number[];
};

export function geziGunOzeti(duraklar: Pick<GeziDuragi, 'lat' | 'lng' | 'sure_dk'>[]): GeziGunOzeti {
  const bacakDk: number[] = [];
  let yuruyusM = 0;
  for (let i = 1; i < duraklar.length; i++) {
    const a = { lat: duraklar[i - 1].lat, lng: duraklar[i - 1].lng };
    const b = { lat: duraklar[i].lat, lng: duraklar[i].lng };
    bacakDk.push(Math.max(1, Math.round(kestirimYuruyusSn(a, b) / 60)));
    yuruyusM += mesafeM(a, b) * 1.3;
  }
  const toplamDk = duraklar.reduce((n, d) => n + d.sure_dk, 0) + bacakDk.reduce((n, d) => n + d, 0);
  return { toplamDk, yuruyusM, bacakDk };
}
