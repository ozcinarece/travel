// #107 gezi editörü — Supabase okuma/yazma. RLS: yalnız admin yazar ve taslakları okur (#106 is_admin()).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { GEZI_GUNLERI_GOMME } from '@/features/icerik/gommeler';
import type { HafifYer } from '@/features/yerler/api';
import { varsayilanDakika } from '@/lib/kategori';
import { supabase } from '@/lib/supabase';
import type { GeziDuragi, GeziGunu } from '@/lib/tipler';

import { slugUret, type GeziAlanlari } from './gezi';

export type YonetimSehri = { id: string; ad: string; slug: string; lat: number; lng: number; yayin: boolean };
export type YonetimGeziOzeti = {
  id: string;
  baslik: string;
  slug: string;
  sehir_id: string;
  gun_sayisi: number;
  mekan_sayisi: number;
  yayin: boolean;
  yayin_at: string | null;
  updated_at: string;
  kapak_url: string | null;
  ozet: string | null;
  sira: number | null;
  created_at: string;
  sehirler: { ad: string } | null;
};
export type YonetimGezi = Omit<YonetimGeziOzeti, 'sehirler'> &
  GeziAlanlari & { sehirler: { ad: string; slug: string } | null; gezi_gunleri: GeziGunu[] };

export const geziAnahtari = (id: string | undefined) => ['yonetim', 'gezi', id] as const;
export const GEZI_LISTESI = ['yonetim', 'geziler'] as const;

export function useYonetimSehirleri() {
  return useQuery({
    queryKey: ['yonetim', 'sehirler'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sehirler').select('id, ad, slug, lat, lng, yayin').order('ad');
      if (error) throw error;
      return data as YonetimSehri[];
    },
  });
}

/** KK1: taslaklar dahil tüm geziler, son düzenlenen üstte. */
export function useYonetimGezileri() {
  return useQuery({
    queryKey: GEZI_LISTESI,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geziler')
        .select('id, baslik, slug, sehir_id, gun_sayisi, mekan_sayisi, yayin, yayin_at, updated_at, kapak_url, ozet, sira, created_at, sehirler(ad)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as unknown as YonetimGeziOzeti[];
    },
  });
}

export function useYonetimGezi(id: string | undefined) {
  return useQuery({
    queryKey: geziAnahtari(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geziler')
        .select(`*, sehirler(ad, slug), ${GEZI_GUNLERI_GOMME}`)
        .eq('id', id!)
        .single();
      if (error) throw error;
      const g = data as unknown as YonetimGezi;
      g.gezi_gunleri = [...(g.gezi_gunleri ?? [])]
        .sort((a, b) => a.sira - b.sira)
        .map((gun) => ({ ...gun, gezi_duraklari: [...(gun.gezi_duraklari ?? [])].sort((a, b) => a.sira - b.sira) }));
      return g;
    },
  });
}

export async function hataVer<T>(istek: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await istek;
  if (error) throw error;
  return data;
}

/** "+ Yeni gezi": taslak + 1. gün; slug benzersiz olsun diye kısa ek. */
export async function geziOlustur(sehirId: string, yazar: string | null): Promise<string> {
  const ek = Math.random().toString(36).slice(2, 6);
  const gezi = await hataVer(
    supabase.from('geziler').insert({ sehir_id: sehirId, baslik: 'Yeni gezi', slug: `${slugUret('Yeni gezi')}-${ek}`, yazar_ad: yazar, yayin: false }).select('id').single(),
  );
  const id = (gezi as { id: string }).id;
  await hataVer(supabase.from('gezi_gunleri').insert({ gezi_id: id, sira: 1 }));
  return id;
}

/** HafifYer → durak satırı (KK4: place_id, ad, kategori, konum otomatik; süre kategori varsayılanı). */
export function yerdenDurak(gunId: string, sira: number, yer: HafifYer) {
  return {
    gezi_gun_id: gunId,
    sira,
    place_id: yer.place_id,
    ad: yer.ad.slice(0, 120),
    kategori: yer.primary_type,
    sure_dk: Math.min(480, Math.max(15, varsayilanDakika(yer.primary_type))),
    lat: yer.lat,
    lng: yer.lng,
  };
}

/** Plan işlemleri: her biri anında yazar, sonra gezi ve liste yenilenir. */
export function useGeziIslemleri(geziId: string | undefined) {
  const qc = useQueryClient();
  const yenile = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: geziAnahtari(geziId) }),
      qc.invalidateQueries({ queryKey: GEZI_LISTESI }),
    ]);
  }, [qc, geziId]);
  const yap = useCallback(
    async (is: () => Promise<unknown>) => {
      try {
        await is();
      } finally {
        await yenile();
      }
    },
    [yenile],
  );

  return {
    gunEkle: (gunler: GeziGunu[]) => yap(() => hataVer(supabase.from('gezi_gunleri').insert({ gezi_id: geziId!, sira: Math.max(0, ...gunler.map((g) => g.sira)) + 1 }))),
    gunSil: (gun: GeziGunu, gunler: GeziGunu[]) =>
      yap(async () => {
        await hataVer(supabase.from('gezi_gunleri').delete().eq('id', gun.id));
        const kalan = gunler.filter((g) => g.id !== gun.id).map((g) => g.id);
        if (kalan.length) await hataVer(supabase.rpc('gezi_gunleri_sirala', { p_gezi: geziId!, p_idler: kalan }));
      }),
    gunBaslik: (gun: GeziGunu, baslik: string) => yap(() => hataVer(supabase.from('gezi_gunleri').update({ baslik: baslik.trim() || null }).eq('id', gun.id))),
    gunleriSirala: (idler: string[]) => yap(() => hataVer(supabase.rpc('gezi_gunleri_sirala', { p_gezi: geziId!, p_idler: idler }))),
    durakEkle: (gun: GeziGunu, yer: HafifYer) =>
      yap(() => hataVer(supabase.from('gezi_duraklari').insert(yerdenDurak(gun.id, Math.max(0, ...gun.gezi_duraklari.map((d) => d.sira)) + 1, yer)))),
    durakGuncelle: (d: GeziDuragi, alanlar: Partial<Pick<GeziDuragi, 'sure_dk' | 'ad'>>) => yap(() => hataVer(supabase.from('gezi_duraklari').update(alanlar).eq('id', d.id))),
    durakSil: (gun: GeziGunu, d: GeziDuragi) =>
      yap(async () => {
        await hataVer(supabase.from('gezi_duraklari').delete().eq('id', d.id));
        const kalan = gun.gezi_duraklari.filter((x) => x.id !== d.id).map((x) => x.id);
        if (kalan.length) await hataVer(supabase.rpc('gezi_duraklari_sirala', { p_gun: gun.id, p_idler: kalan }));
      }),
    duraklariSirala: (gun: GeziGunu, idler: string[]) => yap(() => hataVer(supabase.rpc('gezi_duraklari_sirala', { p_gun: gun.id, p_idler: idler }))),
  };
}

export function alanlariAl(g: GeziAlanlari): GeziAlanlari {
  return {
    baslik: g.baslik,
    slug: g.slug,
    sehir_id: g.sehir_id,
    ozet: g.ozet,
    yazar_ad: g.yazar_ad,
    yazi_md: g.yazi_md,
    kapak_url: g.kapak_url,
    yayin: g.yayin,
    yayin_at: g.yayin_at,
  };
}
