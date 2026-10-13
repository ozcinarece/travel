// Places çağrıları — hepsi Supabase Edge Function üzerinden (PRD §7; Autocomplete dahil, ürün onayı PR #4).
// İstemci Google anahtarı taşımaz; oturum token'ı burada üretilir, seçimdeki hafif Details ile kapanır.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useGecikmeli } from '@/lib/useGecikmeli';

import { HafifOnbellek, type AlanGrubu, type Seviye } from './hafifOnbellek';

export type Oneri = { place_id: string; ana: string; ikincil: string; tipler: string[] };

export type HafifYer = {
  place_id: string;
  ad: string;
  lat: number;
  lng: number;
  primary_type: string | null;
  tz: string | null;
  puan: number | null;
  puan_sayisi: number | null;
  acik: boolean | null;
  ulke_kodu: string | null;
  /** Yalnız `saatler: true` ile: haftalık periyotlar (gun 0 = Pazar); boş dizi = her zaman açık; null = bilinmiyor. */
  periyotlar?: { gun: number; ac: string; kapaGun: number; kapa: string }[] | null;
  /** Yalnız `foto: true` ile (#29 önizleme): ilk fotoğraf, 400 px. */
  foto_uri?: string | null;
  /** Yalnız `ozet: true` ile (#45 pin paneli): Google editoryal özeti. */
  ozet?: string | null;
};

const HARFLER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Autocomplete oturum token'ı: her arama oturumu için yeni, seçimde tüketilir. */
export function yeniOturumJetonu(): string {
  let j = '';
  for (let i = 0; i < 32; i++) j += HARFLER[Math.floor(Math.random() * HARFLER.length)];
  return j;
}

async function cagir<T>(ad: string, govde: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(ad, { body: govde });
  if (error) throw error;
  if (!data) throw new Error(`${ad}: boş cevap`);
  return data;
}

export type Merkez = { lat: number; lng: number; yaricapM?: number };

export async function otomatikTamamla(secenek: {
  girdi: string;
  oturum: string;
  tur?: 'cities' | 'lodging';
  limit?: number;
  merkez?: Merkez;
  /** #118: Autocomplete boş dönerse sunucu Text Search dener (içerik yerleri). */
  aramaYedegi?: boolean;
}): Promise<Oneri[]> {
  const cevap = await cagir<{ oneriler: Oneri[] }>('places-autocomplete', {
    input: secenek.girdi,
    sessionToken: secenek.oturum,
    tur: secenek.tur,
    limit: secenek.limit,
    merkez: secenek.merkez,
    ...(secenek.aramaYedegi ? { aramaYedegi: true } : {}),
  });
  return cevap.oneriler;
}

/** 4xx/5xx cevabının gövdesindeki `hata` metni (supabase-js FunctionsHttpError.context); yoksa mesaj. */
export async function fonksiyonHatasi(e: unknown): Promise<string> {
  const ctx = (e as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    const g = await ctx.json().catch(() => null);
    if (g?.hata) return String(g.hata);
  }
  return e instanceof Error ? e.message : String(e);
}

export type LinkCozumu = { yer: HafifYer; kaynak: 'place_id' | 'arama' | 'koordinat' };

/** PRD 3.3 KK1: Google Maps linki → mekan. Desteklenmeyen/çözülemeyen linkte Error('desteklenmeyen_link' | 'cozulemedi'). */
export async function linkCoz(url: string, merkez?: Merkez): Promise<LinkCozumu> {
  const { data, error } = await supabase.functions.invoke<LinkCozumu | { hata: string }>('resolve-link', {
    body: { url, merkez },
  });
  // 4xx cevaplarında supabase-js hata nesnesi döner; gövde context'tedir.
  if (error) {
    const govde = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(govde?.hata ?? error.message);
  }
  if (!data || 'hata' in data) throw new Error((data as { hata?: string } | null)?.hata ?? 'cozulemedi');
  return data;
}

/** Yapıştırılan metin bir link mi? (http/https, kısa Google link, geo:) */
export function linkGibiMi(metin: string): boolean {
  return /^(https?:\/\/|geo:|maps\.app\.goo\.gl|goo\.gl\/|www\.google\.|maps\.google\.)/i.test(metin.trim());
}

/**
 * places-light ham çağrısı. #172 KK3: `puansiz` — puan / "şu an açık" göstermeyen çağrılar Pro maskeyle (Enterprise alanları
 * istenmez). Ekranlar bunu doğrudan değil `useHafifYerler` / `hafifOnbellek` üzerinden kullanır; doğrudan çağrı yalnız
 * otomatik tamamlama seçimi (oturum token'ını kapatır) ve şehir seçimi içindir.
 */
export async function hafifYerler(
  ids: string[],
  secenek: { sehir?: boolean; oturum?: string; saatler?: boolean; foto?: boolean; ozet?: boolean; puansiz?: boolean } = {},
): Promise<HafifYer[]> {
  if (ids.length === 0) return [];
  const cevap = await cagir<{ yerler: HafifYer[] }>('places-light', {
    ids,
    sehir: secenek.sehir,
    saatler: secenek.saatler,
    foto: secenek.foto,
    ozet: secenek.ozet,
    puansiz: secenek.puansiz,
    sessionToken: secenek.oturum,
  });
  return cevap.yerler;
}

const SEVIYE_SECENEGI: Record<Seviye, { saatler?: boolean; foto?: boolean; puansiz?: boolean }> = {
  pro: { puansiz: true },
  hafif: {},
  saatli: { saatler: true },
  saatliFoto: { saatler: true, foto: true },
  proFoto: { foto: true, puansiz: true },
  foto: { foto: true },
};

/** #172 KK1–KK2: oturum boyunca tek önbellek — kimlik başına, alan grubu başına bir kez istenir. */
export const hafifOnbellek = new HafifOnbellek((ids, seviye) => hafifYerler(ids, SEVIYE_SECENEGI[seviye]));

/** Ekranın gösterdiği alanlar → önbellek grupları. `puan`: puan ya da "şu an açık" gösteriliyor mu (KK3). */
export type HafifIhtiyac = { puan: boolean; saatler?: boolean; foto?: boolean };
function gruplar(i: HafifIhtiyac): AlanGrubu[] {
  const g: AlanGrubu[] = [];
  if (i.puan) g.push('puan');
  if (i.saatler) g.push('saat');
  if (i.foto) g.push('foto');
  return g;
}

export function useOneriler(anahtar: string, girdi: string, oturum: string, tur: 'cities' | 'lodging' | undefined, merkez?: Merkez, etkin = true) {
  const gecikmis = useGecikmeli(girdi.trim(), 300);
  return useQuery({
    queryKey: [anahtar, gecikmis, oturum, merkez?.lat, merkez?.lng],
    enabled: etkin && gecikmis.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: () => otomatikTamamla({ girdi: gecikmis, oturum, tur, limit: 3, merkez }),
  });
}

/** PRD 3.2 KK1: şehir araması, ilk 3 sonuç; 300 ms debounce, 2 karakterden az arama yok. */
export function useSehirOnerileri(girdi: string, oturum: string) {
  return useOneriler('sehir-oneri', girdi, oturum, 'cities');
}

/** PRD 3.3 KK1: otel araması (lodging), seyahat şehri çevresine yanlı; link yapıştırıldığında kapalı. */
export function useOtelOnerileri(girdi: string, oturum: string, merkez: Merkez | undefined, etkin: boolean) {
  return useOneriler('otel-oneri', girdi, oturum, 'lodging', merkez, etkin);
}

/**
 * Nearby Search tip kümesi (Edge Function CIP_TIPLERI anahtarı). #69: Keşfet'te çip yok — karo istekleri `hepsi`
 * (gezilecek + müze + ibadet + park + manzara + yemek + kafe + alışveriş) ile; kategori filtresi seçiliyse o kategoriye özel
 * karo istekleri de atılır. `otel`: 3.3 otel adayları. Eski çipler (populer/yemek/sanat/manzara) kaldırıldı. #164: `turistik`
 * (gezilecek + müze + manzara tipleri) varsayılan Turistik grubunun ve sihirbazın "Görmen gerekenler" kümesidir; #178: ibadet
 * yerleri bu kümede yalnız turistik değerleri varsa gelir (sunucu süzgeci).
 */
export type OneriCipi = 'otel' | 'hepsi' | 'turistik' | 'gezilecek' | 'muze' | 'ibadet' | 'yemek' | 'kafe' | 'park' | 'manzara' | 'alisveris';

/** Popülerlik puanı: puan × log10(yorum + 1); eşitlikte place_id (deterministik). */
export function oneriSirala<T extends { place_id: string; puan: number | null; puan_sayisi: number | null }>(yerler: T[]): T[] {
  const skor = (y: T) => (y.puan ?? 0) * Math.log10((y.puan_sayisi ?? 0) + 1);
  return [...yerler].sort((a, b) => skor(b) - skor(a) || a.place_id.localeCompare(b.place_id));
}

/**
 * #29: önizleme kartı — tek mekan, ilk fotoğrafla (fotoğraf başına fatura; yalnız kart açıkken). #172: ortak önbellekten;
 * ad ve tip zaten eldeyse yalnız fotoğraf istenir (Pro maskesi). `puan`: kart puanı bu cevaptan mı gösteriyor.
 */
export function useOnizleme(placeId: string | undefined, ihtiyac: { puan: boolean } = { puan: false }) {
  const gerek: AlanGrubu[] = ihtiyac.puan ? ['puan', 'foto'] : ['foto'];
  return useQuery({
    queryKey: ['onizleme', gerek.join('+'), placeId],
    enabled: !!placeId,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => (await hafifOnbellek.getirHepsi([placeId!], gerek))[placeId!] ?? null,
  });
}

/** #45: pin paneli — tek mekan, ilk fotoğraf + editoryal özet (pahalı SKU; yalnız panel açıkken, 24 sa). */
export function useMekanOzeti(placeId: string | undefined) {
  return useQuery({
    queryKey: ['mekan-ozeti', placeId],
    enabled: !!placeId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const y = (await hafifYerler([placeId!], { foto: true, ozet: true }))[0] ?? null;
      // #172: aynı cevap ad, puan ve fotoğrafı da taşır — ortak önbelleğe yazılır (aynı kimlik ayrıca istenmez).
      if (y) hafifOnbellek.yaz([y], 'foto', [placeId!]);
      return y;
    },
  });
}

/** #31: Place Photo adı → URI (places-photo, 24 sa önbellek); yalnız görünür sayfa için çağrılır. */
export function usePlaceFoto(ad: string | undefined, genislik = 800) {
  return useQuery({
    queryKey: ['place-foto', ad, genislik],
    enabled: !!ad,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => (await cagir<{ uri: string | null }>('places-photo', { ad, genislik })).uri,
  });
}

/**
 * Liste ekranları için toplu hafif Details; istemci belleğinde 24 sa (PRD §7). #172: sorgu kümesi değişse de yalnız
 * önbellekte olmayan kimlikler istenir (KK1); `foto` ile fotoğraf aynı istekte gelir, ayrıca hafif istenmez (KK2); puan
 * göstermeyen ekran Pro maskeyle ister (KK3). Kayıt kimlikle anahtarlıdır.
 */
export function useHafifYerler(ids: string[], ihtiyac: HafifIhtiyac) {
  const sirali = [...new Set(ids)].sort();
  const gerek = gruplar(ihtiyac);
  return useQuery({
    queryKey: ['hafif-yerler', gerek.join('+') || 'temel', sirali],
    enabled: sirali.length > 0,
    // #61 §3: kimlik kümesi değişince (listeye ekleme) eski adlar yeni cevap gelene kadar kalır — etiketler yok olmaz.
    placeholderData: (onceki) => onceki,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: () => hafifOnbellek.getirHepsi(sirali, gerek),
  });
}

export type TamYer = {
  place_id: string;
  ad: string;
  lat: number;
  lng: number;
  primary_type: string | null;
  puan: number | null;
  puan_sayisi: number | null;
  acik: boolean | null;
  kapanis: string | null;
  /** #80: kapalıysa bir sonraki açılış ("Kapalı · yarın 09:00"). */
  acilis: { gun: 'bugun' | 'yarin' | 'sonra'; saat: string } | null;
  saatler: string[];
  /** #80 KK7: bugünün saat aralığı ("08:00–22:00"); bilinmiyorsa null. */
  bugun: string | null;
  adres: string | null;
  /** #80 KK6 "Bilmen gerekenler". */
  ozet: string | null;
  foto_uri: string | null;
  /** #31, #55: en fazla 10 fotoğraf (ad + Google atfı); URI'ler tembel (usePlaceFoto). */
  fotolar: { ad: string; yazar: string | null }[];
  google_maps_uri: string | null;
};

/** #80 KK10: tek Google yorumu; `yayin` ISO ("En yeni" sırası), `zaman` Google'ın göreli metni. */
export type Yorum = { yazar: string; puan: number | null; metin: string; zaman: string; yayin: string | null };
export type YorumOzeti = { place_id: string; puan: number | null; puan_sayisi: number | null; yorumlar: Yorum[] };

/** #80 panel Genel sekmesi: fotoğraflar, saatler, adres, özet — yorumsuz; 24 sa bellek (Edge Function da 24 sa önbellekler). */
export function useTamYer(placeId: string | undefined, tz?: string) {
  return useQuery({
    queryKey: ['tam-yer', placeId, tz ?? null],
    enabled: !!placeId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => (await cagir<{ yer: TamYer }>('places-full', { id: placeId, tz })).yer,
  });
}

/** #80 KK8: yorumlar YALNIZ Yorumlar sekmesi açıkken istenir (`acik`); 24 sa bellek, DB'ye yazılmaz (PRD §7). */
/** #142 KK3: places-reviews günlük sınırı doldu — sekmede "Google'da aç". */
export class YorumSiniri extends Error {
  constructor() {
    super('yorum_siniri');
  }
}

/**
 * #80 KK8 / #142 KK3: yorumlar yalnız sekmeye dokununca istenir; aynı oturumda cihazda tutulur (ikinci açılışta istek yok),
 * DB'ye yazılmaz (PRD §7). Sınır doluysa YorumSiniri (önbelleğe girmez; sonraki açılışta yeniden denenir).
 */
export function useYorumlar(placeId: string | undefined, acik: boolean) {
  return useQuery({
    queryKey: ['yorumlar', placeId],
    enabled: !!placeId && acik,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: (n, e) => !(e instanceof YorumSiniri) && n < 1,
    queryFn: async () => {
      const cevap = await cagir<YorumOzeti | { sinir: true }>('places-reviews', { id: placeId });
      if ('sinir' in cevap && cevap.sinir) throw new YorumSiniri();
      return cevap as YorumOzeti;
    },
  });
}

/** Nearby Search (New) — tek çağrı, önbellek Edge Function'da 24 sa. Cevap yalnız bellekte tutulur (PRD §7). */
export async function yakinYerler(secenek: { cip: OneriCipi; merkez: Merkez; enFazla?: number }): Promise<HafifYer[]> {
  const cevap = await cagir<{ yerler: HafifYer[] }>('places-nearby', {
    merkez: { lat: secenek.merkez.lat, lng: secenek.merkez.lng },
    yaricapM: secenek.merkez.yaricapM ?? 3000,
    cip: secenek.cip,
    enFazla: secenek.enFazla,
  });
  // #172: Nearby cevabı ad, tip, konum, puan ve "şu an açık"ı taşır (hafif maskesiyle aynı alanlar, saat dilimi hariç) —
  // ortak önbelleğe yazılır; listeye eklenen öneri ya da çekmece fotoğrafı için bu alanlar yeniden istenmez.
  hafifOnbellek.yaz(cevap.yerler, 'hafif');
  return cevap.yerler;
}

/**
 * #141/#142 → #172 KK8: yalnız fotoğraf gereken kartlar (adı DB'den gelen içerik kartları) — ortak önbellekten, eksik
 * kimlikler için Pro foto maskesi (12'lik parçalar). Kimlik → fotoğraf adresi (yoksa null).
 */
export function useYerFotolari(placeIds: string[]) {
  const sirali = [...new Set(placeIds)].sort();
  return useQuery({
    queryKey: ['yer-foto', sirali],
    enabled: sirali.length > 0,
    placeholderData: (onceki) => onceki,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const yerler = await hafifOnbellek.getirHepsi(sirali, ['foto']);
      return new Map(sirali.map((id) => [id, yerler[id]?.foto_uri ?? null] as const));
    },
  });
}
