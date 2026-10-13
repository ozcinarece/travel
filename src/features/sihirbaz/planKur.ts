// #139 KK5 "Planı kur": seçilen mekanları yakınlığa göre bölgelere ayırıp günlere SIRAYLA dağıtır (1. gün dolunca 2. gün).
// Gün kapasitesi ≈ 10:00–19:00 (ziyaret + yol). Bölge sığmazsa kalanı ertesi güne geçer; hiçbir güne sığmayan "Listede,
// güne atanmamış" kalır. Gün içi sıra otelden / ilk duraktan en yakın komşu. Yalnız kuş uçuşu tahmini (ek Google isteği yok).
// Saf: ekrandan bağımsız, testli. #141 "Günlere dağıt" aynı fonksiyonu atanmamış mekanlarla çağırır (`mevcut` dolu günler).
import { mesafeM } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';
import { kestirimTaksiSn, kestirimYuruyusSn, TAKSI_ESIGI_SN } from '@/schedule/tempo';

export type PlanMekani = { id: string; lat: number; lng: number; dakika: number; ad?: string };
export type PlanGunu = { id: string; index: number };

/** 10:00–19:00. */
export const GUN_KAPASITESI_DK = 9 * 60;
/** İki mekan arası kuş uçuşu bu kadar ya da azsa aynı bölge (yürüme mesafesi, ~20 dk). */
export const BOLGE_ESIGI_M = 1500;

export type PlanGunSonucu = { gunId: string; index: number; mekanlar: PlanMekani[]; ziyaretDk: number; yolDk: number; arabaBacagi: number };
export type PlanSonucu = { gunler: PlanGunSonucu[]; atanmamis: PlanMekani[]; bolgeSayisi: number };

/** Bacak: kuş uçuşu yürüyüş tahmini; 40 dk'yı aşarsa araç tahmini (Program'ın 40 dk kuralı). Dakika kesirli (yuvarlama yok). */
export function bacakDk(a: Konum, b: Konum): { dk: number; araba: boolean } {
  const yuru = kestirimYuruyusSn(a, b);
  if (yuru <= TAKSI_ESIGI_SN) return { dk: yuru / 60, araba: false };
  return { dk: kestirimTaksiSn(a, b) / 60, araba: true };
}

/** Tek bağlantılı kümeleme: eşiğin altındaki her çift aynı bölgede (birleşim-bul). Sıra girdiyle kararlı. */
export function bolgeler(mekanlar: PlanMekani[], esikM = BOLGE_ESIGI_M): PlanMekani[][] {
  const ata = mekanlar.map((_, i) => i);
  const kok = (i: number): number => (ata[i] === i ? i : (ata[i] = kok(ata[i])));
  for (let i = 0; i < mekanlar.length; i++) {
    for (let j = i + 1; j < mekanlar.length; j++) {
      if (mesafeM(mekanlar[i], mekanlar[j]) <= esikM) ata[kok(j)] = kok(i);
    }
  }
  const gruplar = new Map<number, PlanMekani[]>();
  mekanlar.forEach((m, i) => {
    const k = kok(i);
    gruplar.set(k, [...(gruplar.get(k) ?? []), m]);
  });
  return [...gruplar.values()];
}

function merkez(grup: PlanMekani[]): Konum {
  return { lat: grup.reduce((t, m) => t + m.lat, 0) / grup.length, lng: grup.reduce((t, m) => t + m.lng, 0) / grup.length };
}

/** En yakın komşu sırası; `bas` verilirse ondan, yoksa en batıdaki mekandan başlar (kararlı). */
export function enYakinKomsu(mekanlar: PlanMekani[], bas: Konum | null): PlanMekani[] {
  const kalan = [...mekanlar];
  const sira: PlanMekani[] = [];
  let simdi: Konum | null = bas;
  while (kalan.length) {
    let en = 0;
    if (simdi) {
      let enKisa = Infinity;
      kalan.forEach((m, i) => {
        const d = mesafeM(simdi!, m);
        if (d < enKisa) {
          enKisa = d;
          en = i;
        }
      });
    } else {
      kalan.forEach((m, i) => {
        if (m.lng < kalan[en].lng) en = i;
      });
    }
    const [m] = kalan.splice(en, 1);
    sira.push(m);
    simdi = m;
  }
  return sira;
}

/**
 * Mekanları gezme sırasına dizer: önce en kalabalık bölge (eşitlikte toplam süre), sonra son mekana merkezi en yakın bölge;
 * bölge içi en yakın komşu (ilk bölgede otelden / başlangıçtan).
 */
export function gezmeSirasi(mekanlar: PlanMekani[], baslangic: Konum | null = null): { sira: PlanMekani[]; bolgeSayisi: number } {
  const gruplar = bolgeler(mekanlar);
  const sira: PlanMekani[] = [];
  let son: Konum | null = baslangic;
  const kalan = [...gruplar];
  while (kalan.length) {
    let en = 0;
    if (sira.length === 0) {
      kalan.forEach((g, i) => {
        const e = kalan[en];
        const toplam = (x: PlanMekani[]) => x.reduce((t, m) => t + m.dakika, 0);
        if (g.length > e.length || (g.length === e.length && toplam(g) > toplam(e))) en = i;
      });
    } else {
      let enKisa = Infinity;
      kalan.forEach((g, i) => {
        const d = mesafeM(son!, merkez(g));
        if (d < enKisa) {
          enKisa = d;
          en = i;
        }
      });
    }
    const [g] = kalan.splice(en, 1);
    const dizi = enYakinKomsu(g, son);
    sira.push(...dizi);
    son = dizi[dizi.length - 1] ?? son;
  }
  return { sira, bolgeSayisi: gruplar.length };
}

/** Alt çubuk özeti (#139 KK4): "N mekan · K bölge · ~S saat" — S tek sırada ziyaret + yol, saate yuvarlanır (≈, en az 1). */
export function secimOzeti(mekanlar: PlanMekani[]): { mekan: number; bolge: number; saat: number } {
  if (mekanlar.length === 0) return { mekan: 0, bolge: 0, saat: 0 };
  const { sira, bolgeSayisi } = gezmeSirasi(mekanlar);
  let dk = 0;
  sira.forEach((m, i) => {
    dk += m.dakika + (i > 0 ? bacakDk(sira[i - 1], m).dk : 0);
  });
  return { mekan: mekanlar.length, bolge: bolgeSayisi, saat: Math.max(1, Math.round(dk / 60)) };
}

/**
 * KK5: dağıtım. `mevcut`: günlerde zaten olan duraklar (sırasıyla; kapasiteyi doldurur, yeni mekanlar arkalarına eklenir).
 * `baslangic`: günün başladığı otel (yoksa ilk duraktan başlar, ilk bacak yok).
 */
export function planKur(
  mekanlar: PlanMekani[],
  gunler: PlanGunu[],
  secenek: { kapasiteDk?: number; baslangic?: Konum | null; mevcut?: Map<string, PlanMekani[]> } = {},
): PlanSonucu {
  const kapasite = secenek.kapasiteDk ?? GUN_KAPASITESI_DK;
  const bas = secenek.baslangic ?? null;
  const sirali = [...gunler].sort((a, b) => a.index - b.index);
  const sonuc: PlanGunSonucu[] = sirali.map((g) => ({ gunId: g.id, index: g.index, mekanlar: [], ziyaretDk: 0, yolDk: 0, arabaBacagi: 0 }));
  // Mevcut duraklar: günün dolu kısmı (yol + ziyaret), sonra yeni mekanlar.
  const dolu = sirali.map((g) => {
    const liste = secenek.mevcut?.get(g.id) ?? [];
    let dk = 0;
    liste.forEach((m, i) => {
      const onceki = i === 0 ? bas : liste[i - 1];
      dk += m.dakika + (onceki ? bacakDk(onceki, m).dk : 0);
    });
    return { dk, son: (liste[liste.length - 1] as Konum | undefined) ?? bas };
  });
  const { sira, bolgeSayisi } = gezmeSirasi(mekanlar, bas);
  const atanmamis: PlanMekani[] = [];
  let g = 0;
  for (const m of sira) {
    let yerlesti = false;
    // İmleç yalnız mekan yerleşince ilerler: sığmayan mekan (boş güne bile) önceki günün kalan kapasitesini boşa harcatmaz.
    for (let k = g; k < sonuc.length; k++) {
      const onceki = dolu[k].son;
      const bacak = onceki ? bacakDk(onceki, m) : { dk: 0, araba: false };
      if (dolu[k].dk + bacak.dk + m.dakika <= kapasite) {
        dolu[k] = { dk: dolu[k].dk + bacak.dk + m.dakika, son: m };
        const s = sonuc[k];
        s.mekanlar.push(m);
        s.ziyaretDk += m.dakika;
        s.yolDk += bacak.dk;
        if (bacak.araba) s.arabaBacagi += 1;
        yerlesti = true;
        g = k;
        break;
      }
      // Boş güne bile sığmıyorsa bu mekan hiçbir güne sığmaz → atanmamış.
      if (dolu[k].dk === 0) break;
    }
    if (!yerlesti) atanmamis.push(m);
  }
  return { gunler: sonuc, atanmamis, bolgeSayisi };
}

/** stops.minutes 15–480 (DB kısıtı); #140: 15'in katına yuvarlanmaz, tam dakika. */
export function durakDakikasi(dk: number): number {
  return Math.min(480, Math.max(15, Math.round(dk)));
}
