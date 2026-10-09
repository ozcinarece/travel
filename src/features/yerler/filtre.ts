// #69: Keşfet öne çıkanlar ve filtreler — saf hesaplar. Kaynak: kanvas KesfetFilter8 · docs/05 §2 (öne çıkan ★).
import { t } from '@/i18n';
import { pinKategorisi, type PinKategorisi } from '@/lib/pinIkonu';

import type { HafifYer } from './api';

/** Öne çıkan: şehir için yüklenmiş mekanlar arasında skoru en üst %10 (en az 4,3 puan ve 200 yorum). */
export const ONE_CIKAN_ORAN = 0.1;
export const ONE_CIKAN_EN_AZ_PUAN = 4.3;
export const ONE_CIKAN_EN_AZ_YORUM = 200;
/** Yeniden hesap aralığı (ms): liste büyüdükçe yüzde değişir; rozet yanıp sönmesin diye en fazla 10 sn'de bir. */
export const ONE_CIKAN_YENILEME_MS = 10_000;
/** "4,5+" / "4,0+" puan filtresi yalnız bu kadar yorumu olan mekanları sayar. */
export const PUAN_FILTRESI_EN_AZ_YORUM = 100;

export type PuanEsigi = 0 | 4 | 4.5;
export type YorumEsigi = 0 | 500 | 1000 | 5000;
export const PUAN_ESIKLERI: PuanEsigi[] = [0, 4, 4.5];
export const YORUM_ESIKLERI: YorumEsigi[] = [0, 500, 1000, 5000];
export const KATEGORILER: PinKategorisi[] = ['gezilecek', 'muze', 'ibadet', 'yemek', 'kafe', 'park', 'manzara', 'alisveris'];

export type Filtre = {
  /** Göster: yalnız öne çıkanlar. */
  oneCikan: boolean;
  /** Kategori (çoklu); boş = hepsi. */
  kategoriler: PinKategorisi[];
  puan: PuanEsigi;
  yorum: YorumEsigi;
};
export const BOS_FILTRE: Filtre = { oneCikan: false, kategoriler: [], puan: 0, yorum: 0 };

/** Popülerlik skoru (oneriSirala ile aynı): puan × log10(yorum + 1). */
export function skor(y: { puan: number | null; puan_sayisi: number | null }): number {
  return (y.puan ?? 0) * Math.log10((y.puan_sayisi ?? 0) + 1);
}

/**
 * Öne çıkan mekanların kimlikleri: eşik şehre göre — adaylar (≥ 4,3 puan, ≥ 200 yorum) skorla sıralanır, tüm yüklenmiş
 * mekanların %10'u kadarı (en az 1, adaylar yettiğince) öne çıkandır. Eşitlikte place_id (deterministik).
 */
export function oneCikanlar(yerler: HafifYer[]): Set<string> {
  const adaylar = yerler.filter((y) => (y.puan ?? 0) >= ONE_CIKAN_EN_AZ_PUAN && (y.puan_sayisi ?? 0) >= ONE_CIKAN_EN_AZ_YORUM);
  if (adaylar.length === 0) return new Set();
  const n = Math.max(1, Math.ceil(yerler.length * ONE_CIKAN_ORAN));
  const sirali = [...adaylar].sort((a, b) => skor(b) - skor(a) || a.place_id.localeCompare(b.place_id));
  return new Set(sirali.slice(0, n).map((y) => y.place_id));
}

/** Bir mekan filtreden geçer mi (VE)? Puan eşiği yalnız ≥ 100 yorumlu mekanlarda sayılır. */
export function filtredenGecer(y: HafifYer, f: Filtre, oneCikan: Set<string>): boolean {
  if (f.oneCikan && !oneCikan.has(y.place_id)) return false;
  if (f.kategoriler.length > 0 && !f.kategoriler.includes(pinKategorisi(y.primary_type))) return false;
  if (f.puan > 0 && !((y.puan ?? 0) >= f.puan && (y.puan_sayisi ?? 0) >= PUAN_FILTRESI_EN_AZ_YORUM)) return false;
  if (f.yorum > 0 && (y.puan_sayisi ?? 0) < f.yorum) return false;
  return true;
}

export function filtreUygula(yerler: HafifYer[], f: Filtre, oneCikan: Set<string>): HafifYer[] {
  if (!filtreAktif(f)) return yerler;
  return yerler.filter((y) => filtredenGecer(y, f, oneCikan));
}

export function filtreAktif(f: Filtre): boolean {
  return f.oneCikan || f.kategoriler.length > 0 || f.puan > 0 || f.yorum > 0;
}

/** Filtre düğmesindeki rozet sayısı: dört bölümden kaç tanesi varsayılan dışında. */
export function aktifFiltreSayisi(f: Filtre): number {
  return (f.oneCikan ? 1 : 0) + (f.kategoriler.length > 0 ? 1 : 0) + (f.puan > 0 ? 1 : 0) + (f.yorum > 0 ? 1 : 0);
}

/** Kategori seç / bırak (çoklu). */
export function kategoriDegistir(f: Filtre, k: PinKategorisi): Filtre {
  return { ...f, kategoriler: f.kategoriler.includes(k) ? f.kategoriler.filter((x) => x !== k) : [...f.kategoriler, k] };
}

/** #69 KK5: bilgi hapı metni — aktif filtrelere göre ("Şehrin öne çıkanları · 4,5+ puan · 9 mekan gizli"). */
export function filtreOzeti(f: Filtre, gizli: number): string {
  const parcalar: string[] = [];
  if (f.oneCikan) parcalar.push(t('kesfet.filtre.ozetOneCikan'));
  if (f.kategoriler.length === 1) parcalar.push(t(`kesfet.filtre.kategoriler.${f.kategoriler[0]}`));
  else if (f.kategoriler.length > 1) parcalar.push(t('kesfet.filtre.ozetKategori', { n: f.kategoriler.length }));
  if (f.puan > 0) parcalar.push(t('kesfet.filtre.ozetPuan', { p: f.puan === 4 ? '4,0' : '4,5' }));
  if (f.yorum > 0) parcalar.push(t('kesfet.filtre.ozetYorum', { n: f.yorum >= 1000 ? `${f.yorum / 1000}K` : String(f.yorum) }));
  parcalar.push(t('kesfet.filtre.gizli', { n: gizli }));
  return parcalar.join(' · ');
}
