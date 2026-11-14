// #111 şehir editörü — Supabase okuma/yazma. RLS: yalnız admin yazar ve taslak şehirleri okur (#106 is_admin()).
import { useQuery } from '@tanstack/react-query';

import type { HafifYer } from '@/features/yerler/api';
import { supabase } from '@/lib/supabase';

import { slugUret } from './gezi';
import { hataVer } from './geziSorgulari';
import type { MekanBagi, RehberBolumu, SehirAlanlari } from './sehir';
import type { BilinenMekan, RehberTaslagi, TaslakBolum } from './rehberTaslak';

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

/**
 * "+ Şehir": Google'dan seçilen şehir taslak olarak (ad, slug, konum); slug çakışırsa sona kısa ek. #197: seçimin Google kimliği,
 * saat dilimi ve ülke kodu da yazılır (seçici şehir modunda zaten alır; ek istek yok) — seyahat açarken şehir için Google'a gidilmez.
 */
export async function sehirOlustur(yer: Pick<HafifYer, 'ad' | 'lat' | 'lng'> & Partial<Pick<HafifYer, 'place_id' | 'tz' | 'ulke_kodu'>>): Promise<string> {
  const temel = slugUret(yer.ad) || 'sehir';
  const kimlik = { place_id: yer.place_id ?? null, tz: yer.tz ?? null, ulke_kodu: yer.ulke_kodu ?? null };
  for (const slug of [temel, `${temel}-${Math.random().toString(36).slice(2, 6)}`]) {
    const { data, error } = await supabase.from('sehirler').insert({ ad: yer.ad.slice(0, 80), slug, lat: yer.lat, lng: yer.lng, yayin: false, ...kimlik }).select('id').single();
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
      const { data, error } = await supabase.from('sehir_rehberi').select('id, sehir_id, bolum, baslik, ozet, yazi_md, sira, gizli').eq('sehir_id', sehirId!).order('sira');
      if (error) throw error;
      return data as RehberBolumu[];
    },
  });
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

// ---------------------------------------------------------------- #156 rehber taslağı, yayın, geçmiş

export const taslakAnahtari = (sehirId: string | undefined) => ['yonetim', 'rehber-taslak', sehirId] as const;
export const surumAnahtari = (sehirId: string | undefined) => ['yonetim', 'rehber-surum', sehirId] as const;

/** Taslak (yoksa null: editör canlı bölümlerden başlar). */
export function useRehberTaslagi(sehirId: string | undefined) {
  return useQuery({
    queryKey: taslakAnahtari(sehirId),
    enabled: !!sehirId,
    queryFn: async () => {
      const { data, error } = await supabase.from('sehir_rehberi_taslak').select('bolumler, bilinen, updated_at, yayinlandi_at').eq('sehir_id', sehirId!).maybeSingle();
      if (error) throw error;
      return (data as RehberTaslagi | null) ?? null;
    },
  });
}

export type RehberSurumu = { id: number; bolumler: TaslakBolum[]; neden: 'kayit' | 'silme' | 'donus' | 'yayin'; yazan: string | null; created_at: string };

/** Geçmiş: son 20 sürüm (en yenisi üstte). */
export function useRehberSurumleri(sehirId: string | undefined, etkin: boolean) {
  return useQuery({
    queryKey: surumAnahtari(sehirId),
    enabled: !!sehirId && etkin,
    queryFn: async () => {
      const { data, error } = await supabase.from('sehir_rehberi_surum').select('id, bolumler, neden, yazan, created_at').eq('sehir_id', sehirId!).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data as RehberSurumu[];
    },
  });
}

/** Taslağı yazar (sürüm kuralı veritabanında). Döner: taslağın updated_at'i. */
/**
 * Taslağı yazar (sürüm kuralı veritabanında). `onceki`: düzenlemenin dayandığı taslak damgası (yoksa null); sunucudaki
 * taslak başka yerde değiştiyse 40001. Döner: taslağın yeni updated_at'i.
 */
export async function rehberTaslakKaydet(
  sehirId: string,
  bolumler: TaslakBolum[],
  bilinen: Record<string, BilinenMekan>,
  neden: 'kayit' | 'silme' | 'donus',
  onceki: string | null,
): Promise<string> {
  return (await hataVer(supabase.rpc('rehber_taslak_kaydet', { p_sehir: sehirId, p_bolumler: bolumler, p_bilinen: bilinen, p_neden: neden, p_onceki: onceki }))) as string;
}

/** Yayınla: `beklenen` damgalı taslak canlıya (değiştiyse 40001); mekan bağlantıları yazılır. Döner: açılan taslak yer sayısı. */
export async function rehberYayinla(sehirId: string, beklenen: string): Promise<number> {
  return (await hataVer(supabase.rpc('rehber_yayinla', { p_sehir: sehirId, p_beklenen: beklenen }))) as number;
}
