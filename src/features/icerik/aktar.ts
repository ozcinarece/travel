// #97 C: "Geziyi seyahatime al" — saf planlama (ekrandan ve ağdan bağımsız; test edilir).
import type { Gun, GeziDetay, GeziDuragi, GeziGunu } from '@/lib/tipler';

import { gunHucresi } from '@/components/program/GunKartlari';

export type AktarmaSecimi =
  /** KK2: günler sırayla seyahatin günlerine; gün azsa fazlası listeye. */
  | { tur: 'tum' }
  /** KK2: her gezi günü için hedef gün (null = listeye). #118: `dahil[günId] === false` → o gün hiç alınmaz (listeye de değil). */
  | { tur: 'gunler'; eslesme: Record<string, string | null>; dahil?: Record<string, boolean> }
  /** KK2: yalnız mekanlar listeye. */
  | { tur: 'mekanlar' };

export type AktarmaPlani = {
  /** Havuza eklenecek mekanlar (tekil place_id ile; place_id çözülmeden önce durak kimliğiyle). */
  duraklar: GeziDuragi[];
  /** Hedef gün → o güne sırayla eklenecek duraklar (KK3: mevcutların sonuna). */
  atamalar: { gunId: string; duraklar: GeziDuragi[] }[];
  /** Yalnız listeye düşenler. */
  listeyeKalan: GeziDuragi[];
};

/** KK1 "Yeni seyahat" / KK2 varsayılan eşleşme: gezi günleri sırayla seyahatin günlerine. */
export function varsayilanEslesme(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunler: Gun[]): Record<string, string | null> {
  const sirali = [...gunler].sort((a, b) => a.index - b.index);
  const e: Record<string, string | null> = {};
  gezi.gezi_gunleri.forEach((g, i) => {
    e[g.id] = sirali[i]?.id ?? null;
  });
  return e;
}

export function aktarmaPlani(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunler: Gun[], secim: AktarmaSecimi): AktarmaPlani {
  // #118: kapalı günler (onay kutusu) planın tamamen dışında — mekanı havuza da, listeye de gitmez.
  const dahilMi = (g: GeziGunu) => secim.tur !== 'gunler' || secim.dahil?.[g.id] !== false;
  const gunler_ = gezi.gezi_gunleri.filter(dahilMi);
  const tum = gunler_.flatMap((g) => g.gezi_duraklari);
  const gorulen = new Set<string>();
  const duraklar = tum.filter((d) => {
    const k = d.place_id ?? d.id;
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    return true;
  });
  if (secim.tur === 'mekanlar') return { duraklar, atamalar: [], listeyeKalan: duraklar };
  const eslesme = secim.tur === 'tum' ? varsayilanEslesme(gezi, gunler) : secim.eslesme;
  const atamalar = new Map<string, GeziDuragi[]>();
  const listeyeKalan: GeziDuragi[] = [];
  const atanan = new Set<string>();
  for (const g of gunler_) {
    const hedef = eslesme[g.id] ?? null;
    for (const d of g.gezi_duraklari) {
      const k = d.place_id ?? d.id;
      if (atanan.has(k)) continue;
      if (hedef) {
        atanan.add(k);
        atamalar.set(hedef, [...(atamalar.get(hedef) ?? []), d]);
      } else listeyeKalan.push(d);
    }
  }
  return { duraklar, atamalar: [...atamalar].map(([gunId, ds]) => ({ gunId, duraklar: ds })), listeyeKalan: listeyeKalan.filter((d) => !atanan.has(d.place_id ?? d.id)) };
}

/** KK4: düğme metni — "2 günü al · Cum 16, Cmt 17" / "11 mekanı listeye ekle". */
export function aktarmaDugmesi(plan: AktarmaPlani, gunler: Gun[], secim: AktarmaSecimi): string {
  if (secim.tur === 'mekanlar' || plan.atamalar.length === 0) return `${plan.duraklar.length} mekanı listeye ekle`;
  const sirali = [...gunler].sort((a, b) => a.index - b.index);
  const adlar = plan.atamalar.map((a) => sirali.find((g) => g.id === a.gunId)).filter((g): g is Gun => !!g).sort((a, b) => a.index - b.index).map((g) => gunHucresi(g, 0).ust);
  return `${plan.atamalar.length} günü al · ${adlar.join(', ')}`;
}

/** Gezi günü satırı: "1. Gün · Odunpazarı · 6 mekan". */
export function geziGunuBasligi(g: GeziGunu): string {
  return `${g.sira}. Gün${g.baslik ? ` · ${g.baslik}` : ''}`;
}
