// #111 şehir editörü — Supabase okuma/yazma. RLS: yalnız admin yazar ve taslak şehirleri okur (#106 is_admin()).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { HafifYer } from '@/features/yerler/api';
import { supabase } from '@/lib/supabase';

import { slugUret } from './gezi';
import { hataVer } from './geziSorgulari';
import { rehberYazisi, type BolumTuru, type MekanBagi, type RehberBolumu, type SehirAlanlari } from './sehir';

export type YonetimSehirDetayi = SehirAlanlari & { id: string; updated_at: string; geziler: { count: number }[] };

export const SEHIR_LISTESI = ['yonetim', 'sehirler', 'liste'] as const;
/** #107'nin şehir seçicisi (`useYonetimSehirleri`) de yenilensin. */
export const SEHIR_SECICI = ['yonetim', 'sehirler'] as const;
export const sehirAnahtari = (id: string | undefined) => ['yonetim', 'sehir', id] as const;
export const rehberAnahtari = (sehirId: string | undefined) => ['yonetim', 'rehber', sehirId] as const;

const ALANLAR = 'id, ad, slug, lat, lng, ozet, yayin, kapak_url, genis_kapak_url, updated_at, geziler(count)';

export function useYonetimSehirListesi() {
  return useQuery({
    queryKey: SEHIR_LISTESI,
    queryFn: async () => {
      const { data, error } = await supabase.from('sehirler').select(ALANLAR).order('ad');
      if (error) throw error;
      return data as unknown as YonetimSehirDetayi[];
    },
  });
}

export function useYonetimSehir(id: string | undefined) {
  return useQuery({
    queryKey: sehirAnahtari(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('sehirler').select(ALANLAR).eq('id', id!).single();
      if (error) throw error;
      return data as unknown as YonetimSehirDetayi;
    },
  });
}

export function sehirAlanlari(s: SehirAlanlari): SehirAlanlari {
  return { ad: s.ad, slug: s.slug, lat: s.lat, lng: s.lng, ozet: s.ozet, yayin: s.yayin, kapak_url: s.kapak_url, genis_kapak_url: s.genis_kapak_url };
}

/** "+ Şehir": Google'dan seçilen şehir taslak olarak (ad, slug, konum); slug çakışırsa sona kısa ek. */
export async function sehirOlustur(yer: Pick<HafifYer, 'ad' | 'lat' | 'lng'>): Promise<string> {
  const temel = slugUret(yer.ad) || 'sehir';
  for (const slug of [temel, `${temel}-${Math.random().toString(36).slice(2, 6)}`]) {
    const { data, error } = await supabase.from('sehirler').insert({ ad: yer.ad.slice(0, 80), slug, lat: yer.lat, lng: yer.lng, yayin: false }).select('id').single();
    if (!error) return (data as { id: string }).id;
    if ((error as { code?: string }).code !== '23505') throw error;
  }
  throw new Error('slug');
}

export function useRehberBolumleri(sehirId: string | undefined) {
  return useQuery({
    queryKey: rehberAnahtari(sehirId),
    enabled: !!sehirId,
    queryFn: async () => {
      const { data, error } = await supabase.from('sehir_rehberi').select('id, sehir_id, bolum, baslik, ozet, yazi_md, sira').eq('sehir_id', sehirId!).order('sira');
      if (error) throw error;
      return data as RehberBolumu[];
    },
  });
}

/** Bölüm ekle / sırala / sil; mekan listesini yaz. Her işlemden sonra bölümler yenilenir. */
export function useRehberIslemleri(sehirId: string) {
  const qc = useQueryClient();
  const yap = useCallback(
    async <T,>(is: () => Promise<T>): Promise<T> => {
      try {
        return await is();
      } finally {
        await qc.invalidateQueries({ queryKey: rehberAnahtari(sehirId) });
      }
    },
    [qc, sehirId],
  );
  return {
    ekle: (bolum: BolumTuru, baslik: string, sira: number) =>
      yap(async () => (await hataVer(supabase.from('sehir_rehberi').insert({ sehir_id: sehirId, bolum, baslik, sira, yazi_md: rehberYazisi(baslik, '') }).select('id').single())) as { id: string }),
    /** Sürükle-sırala: tek upsert deyimi (sıra tekilliği deyim sonunda denetlenir). */
    sirala: (bolumler: RehberBolumu[]) => yap(() => hataVer(supabase.from('sehir_rehberi').upsert(bolumler.map((b, i) => ({ ...b, sira: i + 1 }))))),
    sil: (id: string) =>
      yap(async () => {
        await hataVer(supabase.from('icerik_mekanlari').delete().eq('sahip_tur', 'rehber').eq('sahip_id', id));
        await hataVer(supabase.from('sehir_rehberi').delete().eq('id', id));
      }),
  };
}

export type MekanAdi = { ad: string; kategori: string | null; lat: number; lng: number };

/**
 * Kayıtta yazıdaki mekanlar `icerik_mekanlari`na (yazı sırasıyla); `yerler`de olmayanlar taslak yer olarak açılır
 * (ad: satır içinde bağlantı metni, kartta editörün seçtiği ad). Döner: açılan yer sayısı.
 */
export async function mekanlariYaz(sahipTur: 'rehber' | 'gezi' | 'yer', sahipId: string, baglar: MekanBagi[], bilinen: Record<string, MekanAdi>): Promise<number> {
  const mekanlar = baglar.map((b) => {
    const y = bilinen[b.place_id];
    return { place_id: b.place_id, bicim: b.bicim, ...(y ? { ad: b.ad || y.ad, kategori: y.kategori, lat: y.lat, lng: y.lng } : {}) };
  });
  return (await hataVer(supabase.rpc('icerik_mekanlari_yaz', { p_sahip_tur: sahipTur, p_sahip_id: sahipId, p_mekanlar: mekanlar }))) as number;
}
