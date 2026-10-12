// #97 / #98: içerik tabloları (sehirler, yerler) — yayınlı okunur; backoffice yazar. Seed: Eskişehir.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Sehir, Yer } from '@/lib/tipler';

import { otomatikTamamla } from '../yerler/api';

const GUN_MS = 24 * 60 * 60 * 1000;

/** #98 KK2: popüler şehir karoları — yayınlı şehirler (ad sırası). */
export function useSehirler() {
  return useQuery({
    queryKey: ['icerik', 'sehirler'],
    staleTime: GUN_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('sehirler').select('id, ad, slug, kapak_url, lat, lng').order('ad');
      if (error) throw error;
      return data as Sehir[];
    },
  });
}

/** #98 KK6 "Rehberden": şehrin yayınlı yerleri, öne çıkan sırasıyla. `sehirId` yoksa boş. */
export function useSehirYerleri(sehirId: string | undefined) {
  return useQuery({
    queryKey: ['icerik', 'yerler', sehirId],
    enabled: !!sehirId,
    staleTime: GUN_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yerler')
        .select('id, sehir_id, place_id, ad, kategori, rehber_md, kapak_url, one_cikan_sira, lat, lng')
        .eq('sehir_id', sehirId!)
        .order('one_cikan_sira', { ascending: true, nullsFirst: false })
        .order('ad');
      if (error) throw error;
      return data as Yer[];
    },
  });
}

/** Seçili Google şehri yayınlı bir şehirle eşleştir: ad eşitliği ya da merkeze 25 km. */
export function sehirEslestir(sehirler: Sehir[] | undefined, secim: { ad: string; lat: number; lng: number } | null): Sehir | undefined {
  if (!sehirler || !secim) return undefined;
  const ad = secim.ad.trim().toLocaleLowerCase('tr');
  const adla = sehirler.find((s) => s.ad.toLocaleLowerCase('tr') === ad);
  if (adla) return adla;
  return sehirler.find((s) => Math.hypot((s.lat - secim.lat) * 111, (s.lng - secim.lng) * 111 * Math.cos((secim.lat * Math.PI) / 180)) <= 25);
}

const cozulen = new Map<string, Promise<string | null>>();

/**
 * Rehber yerinin Google place_id'si: backoffice doldurmadıysa adıyla Autocomplete'ten ilk öneri (şehir merkezine yanlı).
 * Yalnız bellekte tutulur (PRD §7: Google kimliği içerik tablosuna istemciden yazılmaz).
 */
export function yerPlaceId(yer: Yer, sehir: { ad: string; lat: number; lng: number }): Promise<string | null> {
  if (yer.place_id) return Promise.resolve(yer.place_id);
  const anahtar = yer.id;
  let p = cozulen.get(anahtar);
  if (!p) {
    p = otomatikTamamla({ girdi: `${yer.ad}, ${sehir.ad}`, oturum: `yer-${yer.id}`, merkez: { lat: yer.lat, lng: yer.lng, yaricapM: 5000 } })
      .then((oneriler) => oneriler[0]?.place_id ?? null)
      .catch(() => {
        cozulen.delete(anahtar);
        return null;
      });
    cozulen.set(anahtar, p);
  }
  return p;
}
