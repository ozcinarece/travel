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

export async function otomatikTamamla(secenek: {
  girdi: string;
  oturum: string;
  tur?: 'cities' | 'lodging';
  limit?: number;
}): Promise<Oneri[]> {
  const cevap = await cagir<{ oneriler: Oneri[] }>('places-autocomplete', {
    input: secenek.girdi,
    sessionToken: secenek.oturum,
    tur: secenek.tur,
    limit: secenek.limit,
  });
  return cevap.oneriler;
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

/** PRD 3.2 KK1: şehir araması, ilk 3 sonuç; 300 ms debounce, 2 karakterden az arama yok. */
export function useSehirOnerileri(girdi: string, oturum: string) {
  const gecikmis = useGecikmeli(girdi.trim(), 300);
  return useQuery({
    queryKey: ['sehir-oneri', gecikmis, oturum],
    enabled: gecikmis.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: () => otomatikTamamla({ girdi: gecikmis, oturum, tur: 'cities', limit: 3 }),
  });
}
