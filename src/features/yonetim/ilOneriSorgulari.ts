// #401 KK4: BO › İl önerileri — Supabase okuma/yazma. RLS: yalnız admin taslağı okur ve yazar (il_oneriler, il_listeleri).
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { hataVer } from './geziSorgulari';
import type { IlKategori, IlListesi, IlOneri } from './ilOneri';

export const IL_LISTELERI = ['yonetim', 'il-listeleri'] as const;
export const ilOnerileriAnahtari = (slug: string | undefined) => ['yonetim', 'il-oneriler', slug] as const;

const ALANLAR = 'id, il_slug, sira, ad, kategori, amaclar, ilce, merkeze_km, neden, place_id, gorunur';

export function useIlListeleri() {
  return useQuery({
    queryKey: IL_LISTELERI,
    queryFn: async () => (await hataVer(supabase.from('il_listeleri').select('il_slug, il, yayinda, yayinlandi_at, degistiren, degisti_at').order('il'))) as IlListesi[],
  });
}

export function useIlOnerileri(slug: string | undefined) {
  return useQuery({
    queryKey: ilOnerileriAnahtari(slug),
    enabled: !!slug,
    queryFn: async () => (await hataVer(supabase.from('il_oneriler').select(ALANLAR).eq('il_slug', slug!).order('sira'))) as IlOneri[],
  });
}

export type IlOneriAlanlari = Partial<Pick<IlOneri, 'kategori' | 'amaclar' | 'neden' | 'gorunur'>>;

export async function ilOneriGuncelle(id: string, alanlar: IlOneriAlanlari): Promise<void> {
  await hataVer(supabase.from('il_oneriler').update(alanlar).eq('id', id));
}

/** Sürükleme ve silme sonrası: bütün ilin yeni id sırası tek çağrıda 1..n olur. */
export async function ilOneriSirala(slug: string, idler: string[]): Promise<void> {
  await hataVer(supabase.rpc('il_oneri_sirala', { p_il: slug, p_idler: idler }));
}

export async function ilOneriSil(slug: string, id: string, kalanSira: string[]): Promise<void> {
  await hataVer(supabase.from('il_oneriler').delete().eq('id', id));
  await ilOneriSirala(slug, kalanSira);
}

/**
 * "+ Yer ekle": yalnız arama önerisinin kimliği ve adı yazılır (Place Details isteği yok, PRD §7: ad Ece'nin listesi için
 * içerik adı). Konum boş kalır; içerik hattı OSM'den doldurur.
 */
export async function ilOneriEkle(slug: string, yer: { place_id: string; ad: string; tip: string | null }, kategori: IlKategori, sira: number): Promise<void> {
  await hataVer(
    supabase.from('il_oneriler').insert({ il_slug: slug, sira, ad: yer.ad.slice(0, 120), kategori, place_id: yer.place_id, primary_type: yer.tip }),
  );
}

export async function ilListesiYayinla(slug: string): Promise<void> {
  await hataVer(supabase.from('il_listeleri').update({ yayinda: true, yayinlandi_at: new Date().toISOString() }).eq('il_slug', slug));
}
