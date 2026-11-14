// #69: Keşfet öne çıkanlar ve filtreler — saf hesaplar. Kaynak: kanvas KesfetFilter8 · docs/05 §2 (öne çıkan ★).
import { t } from '@/i18n';
import { konaklamaMi, pinKategorisi, type PinKategorisi } from '@/lib/pinIkonu';

import type { HafifYer, OneriCipi } from './api';

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
/** Filtre sayfasındaki sıra: Turistik grubu (gezilecek) ve alt seçenekleri (müze, ibadet, manzara), sonra diğerleri. */
export const KATEGORILER: PinKategorisi[] = ['gezilecek', 'muze', 'ibadet', 'manzara', 'yemek', 'kafe', 'park', 'alisveris'];
/**
 * #164 KK1: "Turistik" grubu — tarihi yer ve anıt (gezilecek), müze ve galeri, manzara, ibadet yerleri. Pinler kendi kategori
 * rengini ve glifini korur; grup yalnız süzgeçtir.
 */
export const TURISTIK: PinKategorisi[] = ['gezilecek', 'muze', 'ibadet', 'manzara'];
/** #164 KK3: hızlı çipler — Turistik · Yemek · Kafe · Park · Alışveriş · Tümü (tek seçim). */
export type HizliCip = 'turistik' | 'yemek' | 'kafe' | 'park' | 'alisveris' | 'tumu';
export const HIZLI_CIPLER: HizliCip[] = ['turistik', 'yemek', 'kafe', 'park', 'alisveris', 'tumu'];

export type Filtre = {
  /** Göster: yalnız öne çıkanlar. */
  oneCikan: boolean;
  /** Kategori (çoklu); boş = hepsi. */
  kategoriler: PinKategorisi[];
  puan: PuanEsigi;
  yorum: YorumEsigi;
};
export const BOS_FILTRE: Filtre = { oneCikan: false, kategoriler: [], puan: 0, yorum: 0 };
/** #164 KK3: Keşfet açılışı (ve Temizle) "Turistik" ile — #141 KK7'deki "Tümü" yerine. */
export const VARSAYILAN_FILTRE: Filtre = { ...BOS_FILTRE, kategoriler: TURISTIK };

/**
 * #166 incelemesi: Turistik kategorilerinin AÇIK izin listesi (#164 KK1 tipleri; `historical_place` Google'ın tarihi yer tipi).
 * Pin rengi için tanınmayan tip "gezilecek" sayılır (pinKategorisi), ama süzgeçte yalnız bu tipler Turistik'tir — düğün salonu,
 * `event_venue`, `night_club` gibi yerler Turistik'e ve "Görmen gerekenler"e girmez. Diğer kategoriler pinKategorisi ile.
 */
// #189: sunucunun Turistik birincil tip kümesiyle aynı (supabase/functions/_shared/google.ts TURISTIK_BIRINCIL).
const KATEGORI_IZNI: Partial<Record<PinKategorisi, readonly string[]>> = {
  gezilecek: ['tourist_attraction', 'historical_landmark', 'cultural_landmark', 'monument', 'historical_place', 'sculpture', 'castle'],
  muze: ['museum', 'art_museum', 'history_museum', 'art_gallery'],
  manzara: ['observation_deck'],
  ibadet: ['mosque', 'church', 'synagogue'],
};

/** Birincil tip bu kategoriye uyar mı (Turistik kategorilerinde izin listesi, diğerlerinde pin kategorisi). */
export function kategoriyeUyar(k: PinKategorisi, primaryType: string | null | undefined): boolean {
  if (konaklamaMi(primaryType)) return false;
  const izin = KATEGORI_IZNI[k];
  return izin ? izin.includes(primaryType ?? '') : pinKategorisi(primaryType) === k;
}

/** #164: birincil tipi Turistik grubunda mı (izin listesi; konaklama hiç sayılmaz). Sihirbazın "Görmen gerekenler"i de bunu kullanır. */
export function turistikTur(primaryType: string | null | undefined): boolean {
  return TURISTIK.some((k) => kategoriyeUyar(k, primaryType));
}

/** Turistik grubunun tamamı seçili mi. */
export function turistikSecili(f: Filtre): boolean {
  return TURISTIK.every((k) => f.kategoriler.includes(k));
}

/** Filtre açılıştakiyle aynı mı (yalnız Turistik grubu, başka koşul yok): düğme beyaz kalır, özet hapı çıkmaz. */
export function varsayilanMi(f: Filtre): boolean {
  return !f.oneCikan && f.puan === 0 && f.yorum === 0 && f.kategoriler.length === TURISTIK.length && turistikSecili(f);
}

/** Hızlı çip seçili mi: Turistik grubun tamamı, Tümü kategorisiz, diğerleri kendi kategorisi listedeyse. */
export function hizliCipSecili(f: Filtre, c: HizliCip): boolean {
  if (c === 'tumu') return f.kategoriler.length === 0;
  if (c === 'turistik') return turistikSecili(f);
  return f.kategoriler.includes(c);
}

/**
 * Hızlı çipe dokunma (tek seçim): o çipin kategorileri seçilir. Yalnız o çip seçiliyken yeniden dokunmak (Tümü dahil) açılıştaki
 * Turistik'e döner; Turistik'te değişmez. Öne çıkan / puan / yorum koşulları korunur.
 */
export function hizliCipBas(f: Filtre, c: HizliCip): Filtre {
  const kategoriler: PinKategorisi[] = c === 'tumu' ? [] : c === 'turistik' ? TURISTIK : [c];
  const ayni = f.kategoriler.length === kategoriler.length && kategoriler.every((k) => f.kategoriler.includes(k));
  if (ayni && c !== 'turistik') return { ...f, kategoriler: TURISTIK };
  return { ...f, kategoriler };
}

/** Filtre sayfasındaki Turistik hapı: grubun tamamını açar ya da kapatır (alt seçenekler ayrıca açılıp kapanabilir). */
export function turistikDegistir(f: Filtre): Filtre {
  const disinda = f.kategoriler.filter((k) => !TURISTIK.includes(k));
  return { ...f, kategoriler: f.kategoriler.includes('gezilecek') ? disinda : [...TURISTIK, ...disinda] };
}

/**
 * #69 KK10 / #164 (#166 incelemesi 3): tarama kümeleri. Yalnız Turistik kategorileri seçiliyse (varsayılan) yalnız `turistik`
 * istenir — karo bütçesi önce `hepsi`ye harcanmasın. Tümü `hepsi`; başka kategoriler `hepsi` + (Turistik'ten de seçim varsa
 * `turistik`) + kalan kategoriler (4'ten azsa) kendi kümeleriyle.
 */
export function taramaKumeleri(f: Filtre): OneriCipi[] {
  if (f.kategoriler.length === 0) return ['hepsi'];
  const turistikten = f.kategoriler.some((k) => TURISTIK.includes(k));
  const diger = f.kategoriler.filter((k) => !TURISTIK.includes(k));
  if (diger.length === 0) return ['turistik'];
  return ['hepsi', ...(turistikten ? (['turistik'] as OneriCipi[]) : []), ...(diger.length < 4 ? diger : [])];
}

/** İki tarama kümesi listesi aynı mı (sırasız). */
export function ayniKumeler(a: OneriCipi[], b: OneriCipi[]): boolean {
  return a.length === b.length && a.every((k) => b.includes(k));
}

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
  if (f.kategoriler.length > 0 && !f.kategoriler.some((k) => kategoriyeUyar(k, y.primary_type))) return false;
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
  // #164: Turistik grubu tek kategori sayılır ("Turistik" / "Turistik · Yemek" → "2 kategori").
  const turistik = turistikSecili(f);
  const kategoriAdlari = [...(turistik ? [t('kesfet.filtre.turistik')] : []), ...f.kategoriler.filter((k) => !turistik || !TURISTIK.includes(k)).map((k) => t(`kesfet.filtre.kategoriler.${k}`))];
  if (kategoriAdlari.length === 1) parcalar.push(kategoriAdlari[0]);
  else if (kategoriAdlari.length > 1) parcalar.push(t('kesfet.filtre.ozetKategori', { n: kategoriAdlari.length }));
  if (f.puan > 0) parcalar.push(t('kesfet.filtre.ozetPuan', { p: f.puan === 4 ? '4,0' : '4,5' }));
  if (f.yorum > 0) parcalar.push(t('kesfet.filtre.ozetYorum', { n: f.yorum >= 1000 ? `${f.yorum / 1000}K` : String(f.yorum) }));
  parcalar.push(t('kesfet.filtre.gizli', { n: gizli }));
  return parcalar.join(' · ');
}
