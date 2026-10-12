// #108 yer editörü — Supabase okuma/yazma. RLS: yalnız admin yazar ve taslak yerleri okur (#106 is_admin()).
import { useQuery } from '@tanstack/react-query';

import type { HafifYer } from '@/features/yerler/api';
import { supabase } from '@/lib/supabase';

import { hataVer } from './geziSorgulari';
import type { YerAlanlari } from './yer';

export type YonetimYeri = YerAlanlari & { id: string; ses_url: string | null; updated_at: string; sehirler: { ad: string } | null };

export const YER_LISTESI = ['yonetim', 'yerler'] as const;
export const yerAnahtari = (id: string | undefined) => ['yonetim', 'yer', id] as const;

const ALANLAR = 'id, ad, place_id, kategori, sehir_id, one_cikan_sira, kapak_url, rehber_md, yayin, lat, lng, ses_url, updated_at, sehirler(ad)';

/** KK1: tüm yerler (taslak dahil); öne çıkanlar sırayla üstte, sonra ada göre. */
export function useYonetimYerleri() {
  return useQuery({
    queryKey: YER_LISTESI,
    queryFn: async () => {
      const { data, error } = await supabase.from('yerler').select(ALANLAR).order('one_cikan_sira', { ascending: true, nullsFirst: false }).order('ad');
      if (error) throw error;
      return data as unknown as YonetimYeri[];
    },
  });
}

export function useYonetimYer(id: string | undefined) {
  return useQuery({
    queryKey: yerAnahtari(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('yerler').select(ALANLAR).eq('id', id!).single();
      if (error) throw error;
      return data as unknown as YonetimYeri;
    },
  });
}

/** "+ Yer": Google'dan seçilen mekan taslak olarak eklenir (place_id, ad, kategori, konum; puan/yorum saklanmaz — PRD §7). */
export async function yerOlustur(sehirId: string, yer: HafifYer): Promise<string> {
  const satir = await hataVer(
    supabase
      .from('yerler')
      .insert({ sehir_id: sehirId, place_id: yer.place_id, ad: yer.ad.slice(0, 120), kategori: yer.primary_type, lat: yer.lat, lng: yer.lng, yayin: false })
      .select('id')
      .single(),
  );
  return (satir as { id: string }).id;
}

export function yerAlanlari(y: YerAlanlari): YerAlanlari {
  return {
    ad: y.ad,
    place_id: y.place_id,
    kategori: y.kategori,
    sehir_id: y.sehir_id,
    one_cikan_sira: y.one_cikan_sira,
    kapak_url: y.kapak_url,
    rehber_md: y.rehber_md,
    yayin: y.yayin,
    lat: y.lat,
    lng: y.lng,
  };
}
