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

export type OneriCipi = 'otel' | 'populer' | 'yemek' | 'sanat' | 'manzara';
export const ONERI_CIPLERI: OneriCipi[] = ['populer', 'yemek', 'sanat', 'manzara'];

/**
 * #61 §1: aynı görünür bölge + aynı çip → aynı sonuç. İstek merkezi 0,002° (~200 m) ızgaraya, yarıçap 250 m adıma
 * oturtulur (küçük kaydırma isteği değiştirmez; önbellek anahtarı da bu değerlerdir) ve sonuç puan × yorum sayısına göre
 * sabit sıralanır (Google'ın POPULARITY sırası çağrıdan çağrıya oynuyordu).
 */
export const ONERI_IZGARASI = 0.002;
export const ONERI_YARICAP_ADIMI_M = 250;
export function oneriIstegi(merkez: Merkez): Merkez {
  const yuvarla = (d: number) => Math.round(d / ONERI_IZGARASI) * ONERI_IZGARASI;
  return { lat: yuvarla(merkez.lat), lng: yuvarla(merkez.lng), yaricapM: Math.max(ONERI_YARICAP_ADIMI_M, Math.round((merkez.yaricapM ?? 3000) / ONERI_YARICAP_ADIMI_M) * ONERI_YARICAP_ADIMI_M) };
}
/** Popülerlik puanı: puan × log10(yorum + 1); eşitlikte place_id (deterministik). */
export function oneriSirala<T extends { place_id: string; puan: number | null; puan_sayisi: number | null }>(yerler: T[]): T[] {
  const skor = (y: T) => (y.puan ?? 0) * Math.log10((y.puan_sayisi ?? 0) + 1);
  return [...yerler].sort((a, b) => skor(b) - skor(a) || a.place_id.localeCompare(b.place_id));
}

/** PRD 3.4 KK4 / #28: çip önerileri görünür bölge için (Nearby Search, POPULARITY). Edge Function 24 sa önbellekler; istemci 1 sa. */
export function useYakinOneriler(cip: OneriCipi | null, merkez: Merkez | undefined) {
  const istek = merkez ? oneriIstegi(merkez) : undefined;
  return useQuery({
    queryKey: ['yakin-oneri', cip, istek?.lat.toFixed(4), istek?.lng.toFixed(4), istek?.yaricapM],
    enabled: !!cip && !!istek,
    staleTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => oneriSirala(await yakinYerler({ cip: cip!, merkez: istek! })),
  });
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
  saatler: string[];
  foto_uri: string | null;
  /** #31, #55: en fazla 10 fotoğraf (ad + Google atfı); URI'ler tembel (usePlaceFoto). */
  fotolar: { ad: string; yazar: string | null }[];
  google_maps_uri: string | null;
  yorumlar: { yazar: string; puan: number | null; metin: string; zaman: string }[];
};

/** PRD 3.8 KK6: tam Details yalnızca detay ekranında; istemcide önbellek yok (yorumlar saklanmaz). */
export function useTamYer(placeId: string | undefined, tz?: string) {
  return useQuery({
    queryKey: ['tam-yer', placeId],
    enabled: !!placeId,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
    queryFn: async () => (await cagir<{ yer: TamYer }>('places-full', { id: placeId, tz })).yer,
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
