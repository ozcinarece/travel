import type { SeyahatOzet } from '@/lib/tipler';
import { aktifMi, yerelTarih } from '@/lib/zaman';

/** #276 KK1: başlangıca en çok bu kadar gün kalan tarihli seyahat "yaklaşan"dır. */
export const YAKLASAN_GUN = 14;
/** #276 KK1: bitişinden en çok bu kadar gün geçen seyahat "yeni biten"dir (ana ekranda 29c kartları). */
export const YENI_BITEN_GUN = 7;

/** İki YYYY-MM-DD arası gün farkı (b − a). */
function gunArasi(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export type Siniflar = {
  /** Bugün [gidiş, dönüş] aralığında (gezi günü). */
  aktif: SeyahatOzet[];
  /** Tarihli ve başlangıca ≤ 14 gün; en yakın önce. */
  yaklasan: SeyahatOzet[];
  /** Tarihsiz ya da başlangıca > 14 gün; tarihliler tarih sırasıyla, tarihsizler sonda. */
  planlanan: SeyahatOzet[];
  /** Bitişin üstünden 1–7 gün geçti; yeniden eskiye. */
  yeniBiten: SeyahatOzet[];
  /** Bitişin üstünden 7 günden çok geçti; yeniden eskiye. */
  gecmis: SeyahatOzet[];
};

const artan = (a: SeyahatOzet, b: SeyahatOzet) => {
  const x = a.start_date ?? '9999-12-31';
  const y = b.start_date ?? '9999-12-31';
  return x < y ? -1 : x > y ? 1 : 0;
};
const yenidenEskiye = (a: SeyahatOzet, b: SeyahatOzet) => (a.end_date! > b.end_date! ? -1 : a.end_date! < b.end_date! ? 1 : 0);

/**
 * #276 KK1 (PRD 3.1): aktif · yaklaşan (≤ 14 gün) · planlanan (tarihsiz ya da > 14 gün) · yeniBiten (bitiş ≤ 7 gün önce) ·
 * geçmiş. "Bugün" seyahat şehrinin dilimine göredir (`trips.tz`), cihaz saatine göre değil.
 */
export function siniflandir(liste: SeyahatOzet[], an = new Date()): Siniflar {
  const s: Siniflar = { aktif: [], yaklasan: [], planlanan: [], yeniBiten: [], gecmis: [] };
  for (const sy of liste) {
    const bugun = yerelTarih(an, sy.tz);
    if (aktifMi(sy, an)) s.aktif.push(sy);
    else if (sy.end_date && sy.end_date < bugun) (gunArasi(sy.end_date, bugun) <= YENI_BITEN_GUN ? s.yeniBiten : s.gecmis).push(sy);
    else if (sy.start_date && gunArasi(bugun, sy.start_date) <= YAKLASAN_GUN) s.yaklasan.push(sy);
    else s.planlanan.push(sy);
  }
  s.yaklasan.sort(artan);
  s.planlanan.sort(artan);
  s.yeniBiten.sort(yenidenEskiye);
  s.gecmis.sort(yenidenEskiye);
  return s;
}

/** Bitmemiş seyahatler (aktif + yaklaşan + planlanan): Gezilerim › YAKLAŞAN ve "+" hedefleri. Tarih sırası, taslaklar sonda. */
export function bitmemis(s: Siniflar): SeyahatOzet[] {
  return [...s.aktif, ...s.yaklasan, ...s.planlanan];
}

/** Biten seyahatler (yeniBiten + geçmiş): Gezilerim › GEÇMİŞ; seyahat bitişin ertesi günü buraya iner (kanvas 29d). */
export function biten(s: Siniflar): SeyahatOzet[] {
  return [...s.yeniBiten, ...s.gecmis];
}

export type AcilisDurumu =
  | { tur: 'yok' }
  | { tur: 'aktif' | 'yaklasan' | 'planlanan' | 'yeniBiten'; seyahat: SeyahatOzet }
  | { tur: 'eski' };

/**
 * #276 KK2: açılış durumu. Öncelik aktif > yaklaşan (en yakın) > yeniBiten (en yeni) > planlanan (en yakın; tarihsiz sonda).
 * Seyahat hiç yoksa `yok` (29a), yalnız eski seyahatler varsa `eski` (Keşfet, seyahat Profil › Gezilerim'de).
 */
export function acilisDurumu(liste: SeyahatOzet[], an = new Date()): AcilisDurumu {
  if (liste.length === 0) return { tur: 'yok' };
  const s = siniflandir(liste, an);
  if (s.aktif[0]) return { tur: 'aktif', seyahat: s.aktif[0] };
  if (s.yaklasan[0]) return { tur: 'yaklasan', seyahat: s.yaklasan[0] };
  if (s.yeniBiten[0]) return { tur: 'yeniBiten', seyahat: s.yeniBiten[0] };
  if (s.planlanan[0]) return { tur: 'planlanan', seyahat: s.planlanan[0] };
  return { tur: 'eski' };
}
