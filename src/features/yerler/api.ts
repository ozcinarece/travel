// Places çağrıları — hepsi Supabase Edge Function üzerinden (PRD §7; Autocomplete dahil, ürün onayı PR #4).
// İstemci Google anahtarı taşımaz; oturum token'ı burada üretilir, seçimdeki hafif Details ile kapanır.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useGecikmeli } from '@/lib/useGecikmeli';

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
}): Promise<Oneri[]> {
  const cevap = await cagir<{ oneriler: Oneri[] }>('places-autocomplete', {
    input: secenek.girdi,
    sessionToken: secenek.oturum,
    tur: secenek.tur,
    limit: secenek.limit,
    merkez: secenek.merkez,
  });
  return cevap.oneriler;
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

export async function hafifYerler(ids: string[], secenek: { sehir?: boolean; oturum?: string; saatler?: boolean; foto?: boolean; ozet?: boolean } = {}): Promise<HafifYer[]> {
  if (ids.length === 0) return [];
  const cevap = await cagir<{ yerler: HafifYer[] }>('places-light', {
    ids,
    sehir: secenek.sehir,
    saatler: secenek.saatler,
    foto: secenek.foto,
    ozet: secenek.ozet,
    sessionToken: secenek.oturum,
  });
  return cevap.yerler;
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
 * karo istekleri de atılır. `otel`: 3.3 otel adayları. Eski çipler (populer/yemek/sanat/manzara) kaldırıldı.
 */
export type OneriCipi = 'otel' | 'hepsi' | 'gezilecek' | 'muze' | 'ibadet' | 'yemek' | 'kafe' | 'park' | 'manzara' | 'alisveris';

/** Popülerlik puanı: puan × log10(yorum + 1); eşitlikte place_id (deterministik). */
export function oneriSirala<T extends { place_id: string; puan: number | null; puan_sayisi: number | null }>(yerler: T[]): T[] {
  const skor = (y: T) => (y.puan ?? 0) * Math.log10((y.puan_sayisi ?? 0) + 1);
  return [...yerler].sort((a, b) => skor(b) - skor(a) || a.place_id.localeCompare(b.place_id));
}

/** #29: önizleme kartı — tek mekan, ilk fotoğrafla (fotoğraf başına fatura; yalnız kart açıkken). */
export function useOnizleme(placeId: string | undefined) {
  return useQuery({
    queryKey: ['onizleme', placeId],
    enabled: !!placeId,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => (await hafifYerler([placeId!], { foto: true }))[0] ?? null,
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
    queryFn: async () => (await hafifYerler([placeId!], { foto: true, ozet: true }))[0] ?? null,
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

/** Liste ekranları için toplu hafif Details; istemci belleğinde 24 sa (PRD §7). Harita üstünde ad/puan canlı gösterilir. */
export function useHafifYerler(ids: string[], secenek: { saatler?: boolean } = {}) {
  const sirali = [...new Set(ids)].sort();
  const saatler = !!secenek.saatler;
  return useQuery({
    queryKey: ['hafif-yerler', saatler ? 'saatli' : 'hafif', sirali],
    enabled: sirali.length > 0,
    // #61 §3: kimlik kümesi değişince (listeye ekleme) eski adlar yeni cevap gelene kadar kalır — etiketler yok olmaz.
    placeholderData: (onceki) => onceki,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      // Edge Function istek başına 25 kimlik alır.
      const parcalar: string[][] = [];
      for (let i = 0; i < sirali.length; i += 25) parcalar.push(sirali.slice(i, i + 25));
      const sonuc = await Promise.all(parcalar.map((p) => hafifYerler(p, { saatler })));
      const harita: Record<string, HafifYer> = {};
      for (const y of sonuc.flat()) harita[y.place_id] = y;
      return harita;
    },
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
export function useYorumlar(placeId: string | undefined, acik: boolean) {
  return useQuery({
    queryKey: ['yorumlar', placeId],
    enabled: !!placeId && acik,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => cagir<YorumOzeti>('places-reviews', { id: placeId }),
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
  return cevap.yerler;
}
