// PRD §5.3 Tempo + 3.5 KK5 kestirim. 3.5 kuş uçuşu kestirimiyle, 3.7 gerçek matris süresiyle aynı fonksiyonu çağırır.
import { mesafeM } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';

import { toplamYol, varsayilanSira } from './siralama';

export type TempoDuragi = { id: string; konum: Konum; dakika: number };

export type TempoEtiketi = 'rahat' | 'normal' | 'yogun';

export type TempoSonucu = {
  /** Σ süre + Σ yürüyüş / gün uzunluğu. */
  doluluk: number;
  etiket: TempoEtiketi;
  durakSayisi: number;
  geziDk: number;
  yuruyusDk: number;
  /** "HH:MM" — gün başlangıcı. */
  baslangic: string;
  /** "HH:MM" — başlangıç + gezi + yürüyüş (gün bitişini aşabilir). */
  bitis: string;
  /** Rahat: kaç durak daha sığar (§5.3); diğerlerinde 0. */
  sigar: number;
  /** Yoğun: süresi en uzun durağın kimliği ve süresi; diğerlerinde null. */
  enUzun: { id: string; dakika: number } | null;
  /** §5.1 sırası (durak kimlikleri). */
  sira: string[];
};

/** 3.5 KK5: kuş uçuşu × 1,3 dolambaç ÷ 4,5 km/sa → saniye. */
export function kestirimYuruyusSn(a: Konum, b: Konum): number {
  return (mesafeM(a, b) * 1.3) / (4500 / 3600);
}

export function saatDakika(hhmm: string): number {
  const [s, d] = hhmm.split(':').map(Number);
  return (s || 0) * 60 + (d || 0);
}

export function dakikaSaat(dk: number): string {
  const m = ((Math.round(dk) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function tempoEtiketi(doluluk: number): TempoEtiketi {
  if (doluluk < 0.6) return 'rahat';
  if (doluluk <= 0.85) return 'normal';
  return 'yogun';
}

/**
 * Günün temposu. `yuruyusSn` verilmezse kestirim kullanılır (3.5).
 * Yürüyüş otel→ilk ve son→otel bacaklarını içerir; otel yoksa ilk duraktan son durağa (T5).
 */
export function tempoHesapla(secenek: {
  duraklar: TempoDuragi[];
  otel: Konum | null;
  baslangic: string;
  bitis: string;
  yuruyusSn?: (a: Konum, b: Konum) => number;
}): TempoSonucu {
  const { duraklar, otel } = secenek;
  const yuruyus = secenek.yuruyusSn ?? kestirimYuruyusSn;
  const konum = (i: number): Konum => (i < 0 ? otel! : duraklar[i].konum);
  const mesafe = (a: number, b: number) => yuruyus(konum(a), konum(b));
  const siraIdx = varsayilanSira(duraklar.length, mesafe, !!otel);
  const yuruyusDk = duraklar.length > 0 ? Math.round(toplamYol(siraIdx, mesafe, !!otel) / 60) : 0;
  const geziDk = duraklar.reduce((t, d) => t + d.dakika, 0);
  const gunDk = Math.max(1, saatDakika(secenek.bitis) - saatDakika(secenek.baslangic));
  const doluluk = (geziDk + yuruyusDk) / gunDk;
  const etiket = tempoEtiketi(doluluk);
  const kalanDk = Math.max(0, gunDk - geziDk - yuruyusDk);
  const enUzun = duraklar.reduce<TempoDuragi | null>((e, d) => (!e || d.dakika > e.dakika ? d : e), null);
  return {
    doluluk,
    etiket,
    durakSayisi: duraklar.length,
    geziDk,
    yuruyusDk,
    baslangic: secenek.baslangic,
    bitis: dakikaSaat(saatDakika(secenek.baslangic) + geziDk + yuruyusDk),
    sigar: etiket === 'rahat' ? Math.floor(kalanDk / 75) : 0,
    enUzun: etiket === 'yogun' && enUzun ? { id: enUzun.id, dakika: enUzun.dakika } : null,
    sira: siraIdx.map((i) => duraklar[i].id),
  };
}

/** 3.5 KK6: boştaki bir mekana en yakın gün (o günün duraklarının/otelin en yakını). Gün boşsa aday değil. */
export function enYakinGun(konum: Konum, gunler: { id: string; duraklar: Konum[] }[]): string | null {
  let enIyi: string | null = null;
  let enKisa = Infinity;
  for (const g of gunler) {
    for (const d of g.duraklar) {
      const m = mesafeM(konum, d);
      if (m < enKisa) {
        enKisa = m;
        enIyi = g.id;
      }
    }
  }
  return enIyi;
}
