// #140 KK10 "Gerideyiz" hesabı ve "Saatleri kaydır" yazımı — Plan (`program.tsx`) ile Gezi sayfası (#580 KK4) aynı mantığı
// kullanır. Saf: veri eldekinden, zaman `trips.tz` ile.
import type { Konum } from '@/components/harita/tipler';
import { gecikme, type Gecikme } from '@/schedule/kaydir';
import { dakikaSaat, kestirimTaksiSn, kestirimYuruyusSn } from '@/schedule/tempo';
import type { Durak, Gun } from '@/lib/tipler';
import { yerelAn, yerelSaatDk } from '@/lib/zaman';

import type { GunProgrami } from './useProgram';

export type GeriKalma = Gecikme & { burada: boolean };

/**
 * Yalnız konum açıkken. Buradaysan gerçek varış (arrived_at), yoldaysan şu an + kalan yol (kuş uçuşu kestirimi, seçilen mod).
 */
export function geriKalmaHesapla(p: { prog: GunProgrami | null; konum: Konum | null; gunDurak: Pick<Durak, 'id' | 'arrived_at'>[]; buradaId: string | null; tz: string }): GeriKalma | null {
  const { prog, konum, gunDurak, buradaId, tz } = p;
  if (!prog?.bugun || prog.simdiDk === null || !konum) return null;
  const hedef = prog.canli.satirlar.find((x) => x.durum === 'siradaki' || x.durum === 'buradasin');
  if (!hedef || !hedef.durak.konum) return null;
  const d = gunDurak.find((x) => x.id === hedef.durak.id);
  const varisDk = d?.arrived_at ? yerelSaatDk(new Date(d.arrived_at), tz) : null;
  const hedefKonum = hedef.durak.konum;
  const kalanSn = hedef.yuruyus?.mod === 'taksi' ? kestirimTaksiSn(konum, hedefKonum) : kestirimYuruyusSn(konum, hedefKonum);
  const g = gecikme(prog.canli, {
    simdiDk: prog.simdiDk,
    buradaId,
    varisDk,
    kalanDk: kalanSn / 60,
  });
  return g ? { ...g, burada: hedef.durum === 'buradasin' } : null;
}

export type KaydirmaYazimi =
  | {
      tur: 'durak';
      id: string;
      completed_at: string;
      completed_by: string | null;
      auto_completed: false;
    }
  | { tur: 'gun'; id: string; start_time: string };

/** "Saatleri kaydır": önceki durağın ayrılışı (ilk durakta günün başlangıcı) beklenen varıştan bacak süresi kadar önceye çekilir. */
export function kaydirmaYazimi(g: Gecikme, gun: Pick<Gun, 'id' | 'date'>, tz: string, benId: string | null): KaydirmaYazimi {
  const yeni = Math.round(g.yeniAyrilisDk);
  if (g.oncekiId && gun.date) {
    return {
      tur: 'durak',
      id: g.oncekiId,
      completed_at: yerelAn(gun.date, yeni, tz).toISOString(),
      completed_by: benId,
      auto_completed: false,
    };
  }
  return {
    tur: 'gun',
    id: gun.id,
    start_time: `${dakikaSaat(Math.max(0, yeni))}:00`,
  };
}
