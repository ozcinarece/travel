// PRD §5.3 Tempo + 3.5 KK5 kestirim. 3.5 kuş uçuşu kestirimiyle, 3.7 gerçek matris süresiyle aynı fonksiyonu çağırır.
import { mesafeM } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';

import { varsayilanSira } from './siralama';

export type TempoDuragi = { id: string; konum: Konum; dakika: number };

export type TempoEtiketi = 'rahat' | 'normal' | 'yogun';

export type TempoSonucu = {
  /** Σ süre + Σ yürüyüş + Σ taksi / gün uzunluğu. */
  doluluk: number;
  etiket: TempoEtiketi;
  durakSayisi: number;
  geziDk: number;
  /** Yalnız yürünen bacaklar (#33: 40 dk'yı aşan bacak araçla). */
  yuruyusDk: number;
  /** Araç bacakları (🚕); yoksa 0. */
  taksiDk: number;
  /** Yürüyüş/taksi süresinin en az biri kestirim mi (matris gelmedi)? */
  kestirim: boolean;
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

/** #33: bu süreyi aşan yürüyüş bacağı araçla (🚕) alınır. */
export const TAKSI_ESIGI_SN = 40 * 60;

/** Araç kestirimi: kuş uçuşu × 1,4 ÷ 25 km/sa + 3 dk (bekleme/iniş-biniş). */
export function kestirimTaksiSn(a: Konum, b: Konum): number {
  return (mesafeM(a, b) * 1.4) / (25_000 / 3600) + 180;
}

/** Bir bacağın gerçek/kestirim süreleri: yürüyüş (sıralama için) + araç (varsa). */
export type BacakSuresi = { yuruyusSn: number; taksiSn: number | null; kestirim: boolean };
export type BacakKaynagi = (a: Konum, b: Konum) => BacakSuresi;

/** Bacak modu: yürüyüş eşiği aşılırsa taksi; taksi süresi yoksa kestirim. */
export function bacakModu(a: Konum, b: Konum, bacak: BacakSuresi): { mod: 'yuruyus' | 'taksi'; sn: number; kestirim: boolean } {
  if (bacak.yuruyusSn <= TAKSI_ESIGI_SN) return { mod: 'yuruyus', sn: bacak.yuruyusSn, kestirim: bacak.kestirim };
  return bacak.taksiSn !== null ? { mod: 'taksi', sn: bacak.taksiSn, kestirim: bacak.kestirim } : { mod: 'taksi', sn: kestirimTaksiSn(a, b), kestirim: true };
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
 * Günün temposu. `bacak` verilmezse kestirim kullanılır (3.5); 3.7 ile aynı matrisi alır (#33).
 * Yürüyüş otel→ilk ve son→otel bacaklarını içerir; otel yoksa ilk duraktan son durağa (T5).
 * `sira` verilirse (elle sıralanmış gün) o sıra kullanılır; yoksa §5.1 (NN + 2-opt) yürüyüş süresiyle.
 * 40 dk'yı aşan bacaklar araç sayılır: `taksiDk` ayrı toplanır, doluluğa dahildir.
 */
export function tempoHesapla(secenek: {
  duraklar: TempoDuragi[];
  otel: Konum | null;
  baslangic: string;
  bitis: string;
  /** Eski imza (testler, kestirim): yalnız yürüyüş saniyesi. */
  yuruyusSn?: (a: Konum, b: Konum) => number;
  /** Gerçek matris: yürüyüş + (varsa) araç süresi; kestirim bayrağıyla. */
  bacak?: BacakKaynagi;
  sira?: string[];
}): TempoSonucu {
  const { duraklar, otel } = secenek;
  const bacak: BacakKaynagi =
    secenek.bacak ??
    (secenek.yuruyusSn
      ? (a, b) => ({ yuruyusSn: secenek.yuruyusSn!(a, b), taksiSn: null, kestirim: false })
      : (a, b) => ({ yuruyusSn: kestirimYuruyusSn(a, b), taksiSn: null, kestirim: true }));
  const konum = (i: number): Konum => (i < 0 ? otel! : duraklar[i].konum);
  const mesafe = (a: number, b: number) => bacak(konum(a), konum(b)).yuruyusSn;
  const verilen = secenek.sira?.map((id) => duraklar.findIndex((d) => d.id === id)).filter((i) => i >= 0);
  const siraIdx = verilen && verilen.length === duraklar.length ? verilen : varsayilanSira(duraklar.length, mesafe, !!otel);
  let yuruyusSn = 0;
  let taksiSn = 0;
  let kestirim = false;
  if (duraklar.length > 0) {
    const yol = otel ? [-1, ...siraIdx, -1] : siraIdx;
    for (let i = 1; i < yol.length; i++) {
      const a = konum(yol[i - 1]);
      const b = konum(yol[i]);
      const m = bacakModu(a, b, bacak(a, b));
      if (m.mod === 'taksi') taksiSn += m.sn;
      else yuruyusSn += m.sn;
      if (m.kestirim) kestirim = true;
    }
  }
  const yuruyusDk = Math.round(yuruyusSn / 60);
  const taksiDk = Math.round(taksiSn / 60);
  const geziDk = duraklar.reduce((t, d) => t + d.dakika, 0);
  const gunDk = Math.max(1, saatDakika(secenek.bitis) - saatDakika(secenek.baslangic));
  const doluluk = (geziDk + yuruyusDk + taksiDk) / gunDk;
  const etiket = tempoEtiketi(doluluk);
  const kalanDk = Math.max(0, gunDk - geziDk - yuruyusDk - taksiDk);
  const enUzun = duraklar.reduce<TempoDuragi | null>((e, d) => (!e || d.dakika > e.dakika ? d : e), null);
  return {
    doluluk,
    etiket,
    durakSayisi: duraklar.length,
    geziDk,
    yuruyusDk,
    taksiDk,
    kestirim,
    baslangic: secenek.baslangic,
    bitis: dakikaSaat(saatDakika(secenek.baslangic) + geziDk + yuruyusDk + taksiDk),
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
