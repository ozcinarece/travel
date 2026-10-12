// #91 B: diğer gün noktasına dokunma — saf karar + hap verisi (ekrandan bağımsız; test edilir).
import type { GunHapi } from '@/components/harita/tipler';
import { gunHucresi } from '@/components/program/GunKartlari';
import type { HafifYer } from '@/features/yerler/api';
import type { Durak, Gun } from '@/lib/tipler';
import { gunRengi } from '@/theme';

export type PinDokunusu =
  /** Seçili güne atanmamış mekan → günün sonuna hızlı ekle (#53 §6). */
  | { tur: 'hizliEkle' }
  /** Seçili güne atanmamış mekan, gün seçili değilken → mekan paneli (#80). */
  | { tur: 'panel' }
  /** Seçili günün durağı → kaydırmalı durak kartı (#99 KK5; Detay ile panel). */
  | { tur: 'kart' }
  /** Diğer günün durağı → noktanın üstünde gün hapı (KK1). */
  | { tur: 'hapAc' }
  /** Hap açıkken aynı noktaya ya da hapa dokunma → "Güne git" (KK2). */
  | { tur: 'guneGit'; gunId: string };

/**
 * KK1–3: dokunulan mekan diğer günün durağıysa önce hap açılır; hap açıkken aynı noktaya (ya da hapa — işaretçi dokunuşu
 * noktanın konumuna düşer) ikinci dokunuş o güne gider. Başka pine dokununca hap kapanır (çağıran `hapAcik`'ı sıfırlar).
 */
export function pinDokunusu(secenek: { durak: Durak | undefined; seciliGunId: string | undefined; gunSecili: boolean; hapAcikMekanId: string | null; mekanId: string }): PinDokunusu {
  const { durak, seciliGunId, gunSecili, hapAcikMekanId, mekanId } = secenek;
  if (!durak) return gunSecili ? { tur: 'hizliEkle' } : { tur: 'panel' };
  if (durak.day_id === seciliGunId) return { tur: 'kart' };
  if (hapAcikMekanId === mekanId) return { tur: 'guneGit', gunId: durak.day_id };
  return { tur: 'hapAc' };
}

/** Hap içeriği: gün rengi + "Cum 16 · Odunpazarı Evleri" + düğme metni. Durak artık başka günde değilse null (hap kapanır). */
export function gunHapiVerisi(secenek: {
  mekanId: string | null;
  durak: Durak | undefined;
  konum: { lat: number; lng: number } | undefined;
  gunler: Gun[];
  seciliGunId: string | undefined;
  hafif: HafifYer | undefined;
  dugme: string;
}): GunHapi | null {
  const { mekanId, durak, konum, gunler, seciliGunId, hafif, dugme } = secenek;
  if (!mekanId || !durak || !konum || durak.day_id === seciliGunId) return null;
  const g = gunler.find((x) => x.id === durak.day_id);
  if (!g) return null;
  const ad = hafif?.ad?.trim();
  return { pinId: `m:${mekanId}`, konum, renk: gunRengi(g.index), metin: ad ? `${gunHucresi(g, 0).ust} · ${ad}` : gunHucresi(g, 0).ust, dugme };
}
