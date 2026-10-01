// 3.7 / 3.1 / 3.8 ortak: bir günün programı (plan + canlı) ve mini-çubuk (§5.4).
import { useEffect, useMemo, useState } from 'react';

import type { Konum } from '@/components/harita/tipler';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { yerelSaatDk, yerelTarih } from '@/lib/zaman';
import { miniCubuk, type MiniCubuk } from '@/schedule/kaydir';
import { programHesapla, type Program, type ProgramDuragi, type YuruyusKaynagi } from '@/schedule/program';

/** Postgres time "09:00:00" → "09:00". */
export const saatKisa = (tm: string | null | undefined, varsayilan: string) => (tm ? tm.slice(0, 5) : varsayilan);

/** Dakikada bir yenilenen "şu an" (seyahat dilimi için Date). */
export function useSimdi(aktif: boolean): Date {
  const [an, setAn] = useState(() => new Date());
  useEffect(() => {
    if (!aktif) return;
    const z = setInterval(() => setAn(new Date()), 60_000);
    return () => clearInterval(z);
  }, [aktif]);
  return an;
}

export function gunDuraklari(gun: Gun, duraklar: Durak[]): Durak[] {
  return duraklar.filter((d) => d.day_id === gun.id).sort((a, b) => (a.order_key < b.order_key ? -1 : a.order_key > b.order_key ? 1 : 0));
}

export type GunProgrami = {
  gun: Gun;
  bugun: boolean;
  simdiDk: number | null;
  /** Varış işaretleri olmadan (eski bitiş). */
  plan: Program;
  /** Varış işaretleriyle (KK7). */
  canli: Program;
  cubuk: MiniCubuk | null;
  otel: Konum | null;
};

export function useGunProgrami(secenek: {
  seyahat: Seyahat | undefined;
  gun: Gun | undefined;
  duraklar: Durak[];
  mekanlar: Mekan[];
  yuruyus: YuruyusKaynagi;
  an: Date;
  yolaCikilanlar?: Set<string>;
}): GunProgrami | null {
  const { seyahat, gun, duraklar, mekanlar, yuruyus, an, yolaCikilanlar } = secenek;
  return useMemo(() => {
    if (!seyahat || !gun) return null;
    const otel = seyahat.hotel_lat !== null && seyahat.hotel_lng !== null ? { lat: seyahat.hotel_lat, lng: seyahat.hotel_lng } : null;
    const bugun = !!gun.date && gun.date === yerelTarih(an, seyahat.tz);
    const simdiDk = bugun ? yerelSaatDk(an, seyahat.tz) : null;
    const mekanIle = new Map(mekanlar.map((m) => [m.id, m]));
    const yap = (varisla: boolean): ProgramDuragi[] =>
      gunDuraklari(gun, duraklar)
        .map((d) => ({ d, m: mekanIle.get(d.place_ref) }))
        .filter((x): x is { d: Durak; m: Mekan } => !!x.m)
        .map(({ d, m }) => ({
          id: d.id,
          key: m.place_id,
          konum: { lat: m.lat, lng: m.lng },
          dakika: d.minutes,
          varildiDk: varisla && d.arrived_at ? yerelSaatDk(new Date(d.arrived_at), seyahat.tz) : null,
          skipped: d.skipped,
        }));
    const baslangic = saatKisa(gun.start_time, saatKisa(seyahat.day_start, '09:00'));
    const plan = programHesapla({ baslangic, duraklar: yap(false), otel, yuruyus, simdiDk: null });
    const canli = programHesapla({ baslangic, duraklar: yap(true), otel, yuruyus, simdiDk, yolaCikilanlar });
    const cubuk = simdiDk !== null ? miniCubuk(plan, canli, simdiDk) : null;
    return { gun, bugun, simdiDk, plan, canli, cubuk, otel };
  }, [seyahat, gun, duraklar, mekanlar, yuruyus, an, yolaCikilanlar]);
}
