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

export async function hafifYerler(ids: string[], secenek: { sehir?: boolean; oturum?: string } = {}): Promise<HafifYer[]> {
  if (ids.length === 0) return [];
  const cevap = await cagir<{ yerler: HafifYer[] }>('places-light', {
    ids,
    sehir: secenek.sehir,
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

/** PRD 3.4 KK4: çip önerileri (Nearby Search, POPULARITY). Edge Function 24 sa önbellekler; istemci 1 sa. */
export function useYakinOneriler(cip: OneriCipi | null, merkez: Merkez | undefined) {
  return useQuery({
    queryKey: ['yakin-oneri', cip, merkez?.lat.toFixed(3), merkez?.lng.toFixed(3)],
    enabled: !!cip && !!merkez,
    staleTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: () => yakinYerler({ cip: cip!, merkez: merkez! }),
  });
}

/** Liste ekranları için toplu hafif Details; istemci belleğinde 24 sa (PRD §7). Harita üstünde ad/puan canlı gösterilir. */
export function useHafifYerler(ids: string[]) {
  const sirali = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['hafif-yerler', sirali],
    enabled: sirali.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      // Edge Function istek başına 25 kimlik alır.
      const parcalar: string[][] = [];
      for (let i = 0; i < sirali.length; i += 25) parcalar.push(sirali.slice(i, i + 25));
      const sonuc = await Promise.all(parcalar.map((p) => hafifYerler(p)));
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
