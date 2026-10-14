// #200 KK3–KK6 (kanvas 28): "Günlere dağıt" — sığmayan mekanlar için üç seçenek. Saf hesap (ekrandan ve ağdan bağımsız):
//   kısalt  — her durak orantılı kısalır (taban: kendi süresinin %75'i ya da 20 dk, hangisi büyükse); yemek durakları kısalmaz;
//   uzat    — sığması için gereken günlerin bitişi uzar (en geç 22:00); süreler aynı;
//   liste   — bugünkü davranış: sığanlar dağıtılır, kalanlar Listem'de.
// Gün kapasitesi günün penceresidir (days.start_time / end_time, yoksa seyahatin day_start / day_end). Yol kuş uçuşu tahmini
// (planKur ile aynı); ek Google isteği yok.
import type { Konum } from '@/components/harita/tipler';
import { durakDakikasi, planKur, bacakDk, type PlanMekani, type PlanSonucu } from '@/features/sihirbaz/planKur';
import { pinKategorisi } from '@/lib/pinIkonu';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { dakikaSaat, saatDakika } from '@/schedule/tempo';

/** KK3: günler en geç bu saatte biter. */
export const EN_GEC_BITIS_DK = 22 * 60;
/** KK3: kısaltma tabanı — kendi süresinin %75'i ya da 20 dk (hangisi büyükse; süreden uzun olamaz). */
export const KISALTMA_ORANI = 0.75;
export const KISALTMA_TABAN_DK = 20;
/** Uzatma adımı (bitiş saatleri 5 dk'nın katına yuvarlanır). */
const UZATMA_ADIMI_DK = 5;

export type GunPenceresi = { bas: number; bit: number };
export type SecenekTuru = 'kisalt' | 'uzat' | 'liste';
export type GunOnizlemesi = { gunId: string; index: number; mekan: number; bas: number; bit: number };
export type BitisDegisimi = { gunId: string; index: number; eski: number; yeni: number };

export type DagitimSecenegi = {
  tur: SecenekTuru;
  plan: PlanSonucu;
  /** Dağıtılan (yeni) mekan sayısı ve kalanlar (Listem'de). */
  dagitilan: number;
  kalan: PlanMekani[];
  /** Hepsi sığıyor mu. */
  hepsi: boolean;
  /** Günlerin yeni hali: mekan sayısı (mevcut + yeni), başlangıç–bitiş (dk). */
  onizleme: GunOnizlemesi[];
  /** kısalt: durak süreleri — mevcut duraklar (`stops.id` → dk) ve yeni mekanlar (`places.id` → dk); yalnız değişenler. */
  durakSureleri?: Map<string, number>;
  mekanSureleri?: Map<string, number>;
  /** kısalt: kısalan durakların ortalaması (önce → sonra, dk) ve yemek durağı var mı. */
  ortalama?: { once: number; sonra: number };
  yemekVar?: boolean;
  /** uzat: bitişi değişen günler. */
  bitisler?: BitisDegisimi[];
};

export type DagitimGirdisi = {
  mekanlar: Mekan[];
  gunler: Gun[];
  duraklar: Durak[];
  /** Seyahatin varsayılan gün saatleri ("HH:MM[:SS]"). */
  gunBasi: string;
  gunSonu: string;
  baslangic?: Konum | null;
};

export type DagitimHesabi = {
  /** Bugünkü davranış (seçenek "liste"); hepsi sığıyorsa pencere açılmaz. */
  taban: DagitimSecenegi;
  /** Uygulanabilen seçenekler (taban dahil, sırası kanvasla aynı: kısalt · uzat · liste). */
  secenekler: DagitimSecenegi[];
  /** KK4: hepsini sığdıran ilk seçenek; yoksa en çok mekanı sığdıran. */
  varsayilan: SecenekTuru;
  pencereler: Map<string, GunPenceresi>;
};

const yemekMi = (m: Pick<Mekan, 'primary_type'> | undefined) => pinKategorisi(m?.primary_type) === 'yemek';
/** Kısalmayan durak: yemek, ya da varılmış / tamamlanmış (geçmişi değiştirmeyiz). */
const sabit = (m: Mekan, d: Durak | null) => yemekMi(m) || !!d?.arrived_at || !!d?.completed_at;

/** Günün penceresi (dk): günün kendi saatleri, yoksa seyahatinki. */
export function gunPenceresi(g: Pick<Gun, 'start_time' | 'end_time'>, gunBasi: string, gunSonu: string): GunPenceresi {
  return { bas: saatDakika(g.start_time ?? gunBasi), bit: saatDakika(g.end_time ?? gunSonu) };
}

/** KK3 tabanı: max(%75, 20 dk), süreden uzun değil. */
export function kisaltmaTabani(dk: number): number {
  return Math.min(dk, Math.max(Math.ceil(dk * KISALTMA_ORANI), KISALTMA_TABAN_DK));
}

/** Orantılı kısaltma: `oran` (≤ 1) uygulanır, tabanın altına inmez; yemek kısalmaz. */
export function kisalt(dk: number, oran: number, yemek: boolean): number {
  if (yemek) return dk;
  return durakDakikasi(Math.max(Math.round(dk * oran), kisaltmaTabani(dk)));
}

/** Günün dolu süresi (ziyaret + yol), planKur'un hesabıyla aynı. */
function gunSuresi(liste: PlanMekani[], bas: Konum | null): number {
  let dk = 0;
  liste.forEach((m, i) => {
    const onceki = i === 0 ? bas : liste[i - 1];
    dk += m.dakika + (onceki ? bacakDk(onceki, m).dk : 0);
  });
  return dk;
}

type Hazirlik = {
  sirali: Gun[];
  pencereler: Map<string, GunPenceresi>;
  /** Günlerdeki mevcut (atlanmamış) duraklar, sırasıyla. */
  mevcut: Map<string, { durak: Durak; mekan: Mekan }[]>;
  /** Dağıtılacak (güne atanmamış) mekanlar. */
  bos: Mekan[];
};

function hazirla(g: DagitimGirdisi): Hazirlik {
  const sirali = [...g.gunler].sort((a, b) => a.index - b.index);
  const pencereler = new Map(sirali.map((gun) => [gun.id, gunPenceresi(gun, g.gunBasi, g.gunSonu)]));
  const mekanIle = new Map(g.mekanlar.map((m) => [m.id, m]));
  const atanmis = new Set(g.duraklar.map((d) => d.place_ref));
  const mevcut = new Map<string, { durak: Durak; mekan: Mekan }[]>();
  for (const gun of sirali) {
    mevcut.set(
      gun.id,
      g.duraklar
        .filter((d) => d.day_id === gun.id && !d.skipped)
        .sort((a, b) => (a.order_key < b.order_key ? -1 : 1))
        .flatMap((durak) => {
          const mekan = mekanIle.get(durak.place_ref);
          return mekan ? [{ durak, mekan }] : [];
        }),
    );
  }
  return { sirali, pencereler, mevcut, bos: g.mekanlar.filter((m) => !atanmis.has(m.id)) };
}

/** Tek hesap: süre seçimi (`sure`) ve gün kapasiteleri (`kapasite`) ile plan + önizleme. */
function hesapla(h: Hazirlik, bas: Konum | null, sure: (m: Mekan, durak: Durak | null) => number, kapasite: (gunId: string) => number) {
  const mevcut = new Map<string, PlanMekani[]>();
  for (const [gunId, liste] of h.mevcut) mevcut.set(gunId, liste.map(({ durak, mekan }) => ({ id: mekan.id, lat: mekan.lat, lng: mekan.lng, dakika: sure(mekan, durak) })));
  const yeni = h.bos.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, dakika: sure(m, null) }));
  const plan = planKur(
    yeni,
    h.sirali.map((g) => ({ id: g.id, index: g.index, kapasiteDk: kapasite(g.id) })),
    { mevcut, baslangic: bas },
  );
  const onizleme = plan.gunler.map((pg) => {
    const p = h.pencereler.get(pg.gunId)!;
    const liste = [...(mevcut.get(pg.gunId) ?? []), ...pg.mekanlar];
    return { gunId: pg.gunId, index: pg.index, mekan: liste.length, bas: p.bas, bit: p.bas + Math.round(gunSuresi(liste, bas)) };
  });
  const dagitilan = plan.gunler.reduce((n, pg) => n + pg.mekanlar.length, 0);
  return { plan, onizleme, dagitilan };
}

/** KK3–KK4: sığmayan mekanlar için seçenekler. Taban hepsini sığdırıyorsa `secenekler` yalnız tabandır (pencere açılmaz). */
export function dagitimSecenekleri(g: DagitimGirdisi): DagitimHesabi {
  const h = hazirla(g);
  const bas = g.baslangic ?? null;
  const asil = (m: Mekan, d: Durak | null) => (d ? d.minutes : durakDakikasi(m.default_minutes));
  const pencereKap = (gunId: string) => {
    const p = h.pencereler.get(gunId)!;
    return Math.max(0, p.bit - p.bas);
  };

  const t = hesapla(h, bas, asil, pencereKap);
  const taban: DagitimSecenegi = { tur: 'liste', plan: t.plan, dagitilan: t.dagitilan, kalan: t.plan.atanmamis, hepsi: t.plan.atanmamis.length === 0, onizleme: t.onizleme };
  if (taban.hepsi || h.bos.length === 0) return { taban, secenekler: [taban], varsayilan: 'liste', pencereler: h.pencereler };

  const secenekler: DagitimSecenegi[] = [];

  // ---- kısalt: en az kısaltan oran (1,00 → 0,75; %1 adım) — hepsi sığmazsa tabandaki (en kısa) haliyle.
  let kisa: (ReturnType<typeof hesapla> & { oran: number }) | null = null;
  for (let yuzde = 99; yuzde >= KISALTMA_ORANI * 100; yuzde--) {
    const oran = yuzde / 100;
    const r = hesapla(h, bas, (m, d) => kisalt(asil(m, d), oran, sabit(m, d)), pencereKap);
    kisa = { ...r, oran };
    if (r.plan.atanmamis.length === 0) break;
  }
  if (kisa && kisa.dagitilan > taban.dagitilan) {
    const oran = kisa.oran;
    const durakSureleri = new Map<string, number>();
    const mekanSureleri = new Map<string, number>();
    const once: number[] = [];
    const sonra: number[] = [];
    let yemekVar = false;
    const yerlesen = new Set(kisa.plan.gunler.flatMap((pg) => pg.mekanlar.map((m) => m.id)));
    for (const liste of h.mevcut.values()) {
      for (const { durak, mekan } of liste) {
        if (sabit(mekan, durak)) {
          yemekVar ||= yemekMi(mekan);
          continue;
        }
        const yeni = kisalt(durak.minutes, oran, false);
        once.push(durak.minutes);
        sonra.push(yeni);
        if (yeni !== durak.minutes) durakSureleri.set(durak.id, yeni);
      }
    }
    for (const m of h.bos) {
      if (!yerlesen.has(m.id)) continue;
      if (yemekMi(m)) {
        yemekVar = true;
        continue;
      }
      const a = asil(m, null);
      const yeni = kisalt(a, oran, false);
      once.push(a);
      sonra.push(yeni);
      mekanSureleri.set(m.id, yeni);
    }
    const ort = (x: number[]) => (x.length ? Math.round(x.reduce((n, v) => n + v, 0) / x.length) : 0);
    secenekler.push({
      tur: 'kisalt',
      plan: kisa.plan,
      dagitilan: kisa.dagitilan,
      kalan: kisa.plan.atanmamis,
      hepsi: kisa.plan.atanmamis.length === 0,
      onizleme: kisa.onizleme,
      durakSureleri,
      mekanSureleri,
      ortalama: { once: ort(once), sonra: ort(sonra) },
      yemekVar,
    });
  }

  // ---- uzat: en küçük ortak uzatma (5 dk adım, her gün en geç 22:00); bitiş, gerekiyorsa günün dolduğu saate (5'e yukarı).
  const enCokUzatma = Math.max(0, ...h.sirali.map((gun) => EN_GEC_BITIS_DK - h.pencereler.get(gun.id)!.bit));
  let uzun: ReturnType<typeof hesapla> | null = null;
  for (let ek = UZATMA_ADIMI_DK; ek <= enCokUzatma; ek += UZATMA_ADIMI_DK) {
    const r = hesapla(h, bas, asil, (gunId) => {
      const p = h.pencereler.get(gunId)!;
      return Math.max(0, Math.max(p.bit, Math.min(EN_GEC_BITIS_DK, p.bit + ek)) - p.bas);
    });
    uzun = r;
    if (r.plan.atanmamis.length === 0) break;
  }
  if (uzun && uzun.dagitilan > taban.dagitilan) {
    const bitisler: BitisDegisimi[] = [];
    const onizleme = uzun.onizleme.map((o) => {
      const p = h.pencereler.get(o.gunId)!;
      if (o.bit <= p.bit) return o;
      const yeni = Math.min(EN_GEC_BITIS_DK, Math.ceil(o.bit / UZATMA_ADIMI_DK) * UZATMA_ADIMI_DK);
      bitisler.push({ gunId: o.gunId, index: o.index, eski: p.bit, yeni });
      return o;
    });
    secenekler.push({ tur: 'uzat', plan: uzun.plan, dagitilan: uzun.dagitilan, kalan: uzun.plan.atanmamis, hepsi: uzun.plan.atanmamis.length === 0, onizleme, bitisler });
  }

  secenekler.push(taban);
  const hepsi = secenekler.find((s) => s.hepsi);
  const enCok = secenekler.reduce((a, b) => (b.dagitilan > a.dagitilan ? b : a));
  return { taban, secenekler, varsayilan: (hepsi ?? enCok).tur, pencereler: h.pencereler };
}

/** "09:00–20:00" — bütün günlerin penceresi aynıysa; değilse null. */
export function ortakPencere(pencereler: Map<string, GunPenceresi>): string | null {
  const liste = [...pencereler.values()];
  if (liste.length === 0) return null;
  const ilk = liste[0];
  return liste.every((p) => p.bas === ilk.bas && p.bit === ilk.bit) ? `${dakikaSaat(ilk.bas)}–${dakikaSaat(ilk.bit)}` : null;
}

/** Seçeneğin yazılacağı hal: yeni duraklar (gün + mekan + süre), kısalan mevcut duraklar, uzayan günler ("HH:MM"). */
export function dagitimYazimi(s: DagitimSecenegi, mekanlar: Mekan[]): {
  yeni: { gunId: string; mekanId: string; dakika: number }[];
  sureler: { durakId: string; dakika: number }[];
  bitisler: { gunId: string; bitis: string }[];
} {
  const mekanIle = new Map(mekanlar.map((m) => [m.id, m]));
  return {
    yeni: s.plan.gunler.flatMap((pg) =>
      pg.mekanlar.map((pm) => ({ gunId: pg.gunId, mekanId: pm.id, dakika: s.mekanSureleri?.get(pm.id) ?? durakDakikasi(mekanIle.get(pm.id)?.default_minutes ?? pm.dakika) })),
    ),
    sureler: [...(s.durakSureleri ?? new Map()).entries()].map(([durakId, dakika]) => ({ durakId, dakika })),
    bitisler: (s.bitisler ?? []).map((b) => ({ gunId: b.gunId, bitis: dakikaSaat(b.yeni) })),
  };
}
