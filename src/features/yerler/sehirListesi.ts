// #189 Ek 2: Keşfet arama düzeni — saf hesaplar. Karo ızgarası yok: açılışta şehir listesi (şehir genişliğinde, çip başına bir
// istek; Turistik üç alt istek), gezinme bedava (pinler eldeki listeden görünüme göre süzülür), görünüm için yalnız
// "Bu alanda ara" (tek istek; az sonuçta bir kez 3 kat yarıçap). Birikim oturum boyu; hiçbir şey silinmez.
import { mesafeM } from '@/components/harita/geo';
import type { HaritaBolgesi, Konum } from '@/components/harita/tipler';
import type { PinKategorisi } from '@/lib/pinIkonu';

import { oneriSirala, type HafifYer, type OneriCipi } from './api';
import { AZ_ONERI, gorunurOneriSayisi } from './cekmece';
import { TURISTIK, type Filtre } from './filtre';

/** Şehir listesinin yarıçapı, sunucu cevabı gelene kadar (sunucu ayardan seçer: kesfet_esikleri.sehir_yaricap_m). */
export const VARSAYILAN_SEHIR_YARICAPI_M = 8000;
/** KK9: süzgeçten bundan az yer geçerse alan bir kez GENISLETME_KATI ile büyütülür. */
export const GENISLETME_ESIGI = 5;
export const GENISLETME_KATI = 3;
/** places-nearby'nin kabul ettiği en büyük yarıçap (m). */
export const ALAN_EN_BUYUK_M = 15_000;

export type Alan = { merkez: Konum; yaricapM: number };

const TURISTIK_ALT: Partial<Record<PinKategorisi, OneriCipi>> = {
  muze: 'turistik_muze',
  gezilecek: 'turistik_tarihi',
  // İbadet yerleri Turistik isteğinde birincil tiple gelmez (#190); tarihî yerler isteği en yakını.
  ibadet: 'turistik_tarihi',
  manzara: 'turistik_manzara',
};
const KATEGORI_CIPI: Partial<Record<PinKategorisi, OneriCipi>> = { yemek: 'yemek', kafe: 'kafe', park: 'park', alisveris: 'alisveris' };

/**
 * KK7: filtrenin şehir istekleri. Turistik kategorileri alt isteklere (tam grup → üçü: müze ve galeri · tarihî yer, anıt,
 * kültürel · manzara ve park), Yemek / Kafe / Park / Alışveriş kendi çipine gider; Tümü tek `hepsi` isteğidir.
 */
export function sehirCipleri(f: Filtre): OneriCipi[] {
  if (f.kategoriler.length === 0) return ['hepsi'];
  const cipler: OneriCipi[] = [];
  for (const k of f.kategoriler) {
    const c = TURISTIK_ALT[k] ?? KATEGORI_CIPI[k];
    if (c && !cipler.includes(c)) cipler.push(c);
  }
  return cipler;
}

/** KK9: "Bu alanda ara"nın tek isteği: yalnız Turistik grubu → `turistik`; tek kategori → kendi çipi; Tümü / karışık → `hepsi`. */
export function alanCipi(f: Filtre): OneriCipi {
  if (f.kategoriler.length > 0 && f.kategoriler.every((k) => TURISTIK.includes(k))) return 'turistik';
  if (f.kategoriler.length === 1) return KATEGORI_CIPI[f.kategoriler[0]] ?? 'hepsi';
  return 'hepsi';
}

/** Görünümün arama alanı: merkez = görünüm merkezi, yarıçap = yarı köşegen. */
export function gorunumAlani(b: HaritaBolgesi): Alan {
  const kose = { lat: b.merkez.lat + b.latDelta / 2, lng: b.merkez.lng + b.lngDelta / 2 };
  return { merkez: b.merkez, yaricapM: Math.min(ALAN_EN_BUYUK_M, Math.max(100, Math.round(mesafeM(b.merkez, kose)))) };
}

/** KK9 genişletme: aynı merkez, 3 kat yarıçap (sunucu sınırında kesilir). */
export function genisAlan(a: Alan): Alan {
  return { merkez: a.merkez, yaricapM: Math.min(ALAN_EN_BUYUK_M, Math.round(a.yaricapM * GENISLETME_KATI)) };
}

export function genisletilmeli(gelenSayi: number): boolean {
  return gelenSayi < GENISLETME_ESIGI;
}

/** Görünüm alanı (yarı köşegen dairesi) tümüyle bu alanın içinde mi. */
export function alanIcinde(gorunum: Alan, alan: Alan): boolean {
  return mesafeM(gorunum.merkez, alan.merkez) + gorunum.yaricapM <= alan.yaricapM;
}

/** Görünüm merkezi şehir dairesinin dışında mı. */
export function sehirDisinda(b: HaritaBolgesi, sehir: Alan): boolean {
  return mesafeM(b.merkez, sehir.merkez) > sehir.yaricapM;
}

/**
 * KK9: "Bu alanda ara" hapı görünür mü. Şehir dışına kaydırınca, ya da şehir içinde görünümde az öneri kalınca (kullanıcı
 * açıkça bakıyor) çıkar; daha önce aranmış bir alanın içindeyse (aynı alan) çıkmaz. Otomatik istek yok: hap yalnız bir öneridir.
 */
export function alandaAraGorunur(s: { bolge: HaritaBolgesi | null; sehir: Alan | null; arananlar: Alan[]; oneriler: HafifYer[] }): boolean {
  if (!s.bolge || !s.sehir) return false;
  const g = gorunumAlani(s.bolge);
  if (s.arananlar.some((a) => alanIcinde(g, a))) return false;
  if (sehirDisinda(s.bolge, s.sehir)) return true;
  return gorunurOneriSayisi(s.oneriler, s.bolge) < AZ_ONERI;
}

/** Birikimli listeye ekler: yeni place_id eklenir, bilinen güncellenir (puan tazelenir), hiçbir şey silinmez. Yeni sayısını döner. */
export function birikimeEkle(birikim: Map<string, HafifYer>, yerler: HafifYer[]): number {
  let yeni = 0;
  for (const y of yerler) {
    if (!y.place_id) continue;
    if (!birikim.has(y.place_id)) yeni += 1;
    birikim.set(y.place_id, y);
  }
  return yeni;
}

/** Birikimli liste, popülerlik sırasıyla (oneriSirala). */
export function birikimListesi(birikim: Map<string, HafifYer> | undefined): HafifYer[] {
  return birikim ? oneriSirala([...birikim.values()]) : [];
}

/**
 * #66 KK6: çizilecek öneri pini sayısı sınırı. Aşılırsa görünür alan dışındakiler çizilmez (listede kalırlar); görünür alanda
 * bile sınır aşılırsa popülerlik sırasıyla ilk `sinir` kalır.
 */
export const PIN_SINIRI = 250;
export function gorunurOneriler<T extends { lat: number; lng: number }>(yerler: T[], bolge: HaritaBolgesi | null, sinir = PIN_SINIRI): T[] {
  if (yerler.length <= sinir) return yerler;
  if (!bolge) return yerler.slice(0, sinir);
  const icinde = (y: T) => Math.abs(y.lat - bolge.merkez.lat) <= bolge.latDelta / 2 && Math.abs(y.lng - bolge.merkez.lng) <= bolge.lngDelta / 2;
  return yerler.filter(icinde).slice(0, sinir);
}
