// #143 KK2 (kanvas 17): önerilen gezinin "Rota & plan" hesapları — duraklar arası yürüyüş ve gün özeti ("5 sa 40 dk · 3,4 km
// yürüyüş"). #192: gerçek yol varsa (gezi_rota_onbellek) süre ve mesafe ondan; yoksa kestirim (kuş uçuşu × 1,3 ÷ 4,5 km/sa) ve özet
// "~" ile.
import { mesafeM } from '@/components/harita/geo';
import type { HaritaCizgisi } from '@/components/harita/tipler';
import { rotaNoktalari } from '@/features/program/haritaVerisi';
import type { GeziDuragi } from '@/lib/tipler';
import { kestirimYuruyusSn } from '@/schedule/tempo';
import { gunRengi, rotaRengi } from '@/theme';

import { bacakAnahtari, type GeziRotalari } from './geziRota';

export type GeziGunOzeti = {
  /** Durak süreleri + bacaklar (dakika, yuvarlamasız toplam). */
  toplamDk: number;
  /** Toplam yürüyüş mesafesi (m; gerçek yol ya da dolambaç payıyla kestirim). */
  yuruyusM: number;
  /** i. durağa gelen bacak, dakika (ilk durak için yok). */
  bacakDk: number[];
  /** i. durağa gelen bacağın modu (yürüyüşü 40 dk'yı aşan bacak araçla — mevcut bacak modu kuralı). */
  bacakMod: ('WALK' | 'DRIVE')[];
  /** En az bir bacak kestirim (gerçek yolu henüz yok) → özet "~" ile. */
  kestirim: boolean;
};

type OzetDuragi = Pick<GeziDuragi, 'lat' | 'lng' | 'sure_dk'> & { id?: string };

export function geziGunOzeti(duraklar: OzetDuragi[], rotalar?: GeziRotalari): GeziGunOzeti {
  const bacakDk: number[] = [];
  const bacakMod: ('WALK' | 'DRIVE')[] = [];
  let yuruyusM = 0;
  let kestirim = false;
  for (let i = 1; i < duraklar.length; i++) {
    const a = duraklar[i - 1];
    const b = duraklar[i];
    const r = a.id && b.id ? rotalar?.get(bacakAnahtari(a.id, b.id)) : undefined;
    if (r) {
      const araba = r.mod === 'DRIVE' && !!r.arac_saniye;
      bacakDk.push(Math.max(1, Math.round((araba ? r.arac_saniye! : r.saniye) / 60)));
      bacakMod.push(araba ? 'DRIVE' : 'WALK');
      if (!araba) yuruyusM += r.metre;
      continue;
    }
    kestirim = true;
    const ka = { lat: a.lat, lng: a.lng };
    const kb = { lat: b.lat, lng: b.lng };
    bacakDk.push(Math.max(1, Math.round(kestirimYuruyusSn(ka, kb) / 60)));
    bacakMod.push('WALK');
    yuruyusM += mesafeM(ka, kb) * 1.3;
  }
  const toplamDk = duraklar.reduce((n, d) => n + d.sure_dk, 0) + bacakDk.reduce((n, d) => n + d, 0);
  return { toplamDk, yuruyusM, bacakDk, bacakMod, kestirim };
}

/**
 * #192 KK3: mini haritanın çizgileri. Gerçek yürüyüş yolu rota tonunda düz çizgi (Program'la aynı dil); araç bacağı kuş uçuşu
 * kesik (#136); yolu henüz gelmemiş ya da hesaplanamamış bacak bugünkü gibi gün renginde ince kesik kuş uçuşu. Kimlik bacak
 * bazlı ve rota gelsin gelmesin aynı (#77: çizgi yeniden kurulmaz, güncellenir).
 */
export function geziGunCizgileri(duraklar: Pick<GeziDuragi, 'id' | 'lat' | 'lng'>[], gunIndex: number, rotalar?: GeziRotalari): HaritaCizgisi[] {
  return duraklar.slice(1).map((d, i): HaritaCizgisi => {
    const onceki = duraklar[i];
    const a = { lat: onceki.lat, lng: onceki.lng };
    const z = { lat: d.lat, lng: d.lng };
    const id = `gc:${onceki.id}>${d.id}`;
    const r = rotalar?.get(bacakAnahtari(onceki.id, d.id));
    if (r && r.mod === 'DRIVE' && r.arac_saniye) return { id, noktalar: [a, z], renk: rotaRengi(gunIndex), opaklik: 0.9, kesik: true, arac: true };
    if (r) return { id, noktalar: rotaNoktalari(r.polyline, a, z), renk: rotaRengi(gunIndex), opaklik: 0.9 };
    return { id, noktalar: [a, z], renk: gunRengi(gunIndex), opaklik: 0.9, kesik: true, ince: true };
  });
}
