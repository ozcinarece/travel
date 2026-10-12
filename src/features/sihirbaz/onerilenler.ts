// #98 KK6 · "Görmen gerekenler": rehber yerleri (`yerler`) + Keşfet öne çıkan hesabı (#70) + Google kategori çipleri.
// Saf birleştirme burada (test edilir); veri çekme kancası altta.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { oneCikanlar } from '@/features/yerler/filtre';
import { hafifYerler, oneriSirala, yakinYerler, type HafifYer, type OneriCipi } from '@/features/yerler/api';
import { varsayilanDakika } from '@/lib/kategori';
import type { Sehir, Yer } from '@/lib/tipler';

import { useSehirYerleri, yerPlaceId } from '../icerik/sorgular';

export const CIPLER = ['gormen', 'yemek', 'kafe', 'manzara', 'rehber'] as const;
export type OnerilenCipi = (typeof CIPLER)[number];

export type OnerilenMekan = {
  place_id: string;
  ad: string;
  primary_type: string | null;
  lat: number;
  lng: number;
  puan: number | null;
  puan_sayisi: number | null;
  foto_uri: string | null;
  /** Neden rozeti: ★ Öne çıkan (Keşfet hesabı) / ★ Rehberde (içerik ekibi). */
  neden: 'oneCikan' | 'rehber' | null;
  /** Kalınacak süre (dk) — kategoriden. */
  dakika: number;
};

/** Rehber yeri + çözülmüş Google verisi (puan/yorum/foto) → kart satırı. place_id çözülemediyse null (kart çizilmez). */
export function rehberMekani(yer: Yer, placeId: string | null, hafif: HafifYer | undefined): OnerilenMekan | null {
  if (!placeId) return null;
  const tip = hafif?.primary_type ?? yer.kategori;
  return {
    place_id: placeId,
    ad: yer.ad,
    primary_type: tip,
    lat: hafif?.lat ?? yer.lat,
    lng: hafif?.lng ?? yer.lng,
    puan: hafif?.puan ?? null,
    puan_sayisi: hafif?.puan_sayisi ?? null,
    foto_uri: yer.kapak_url ?? hafif?.foto_uri ?? null,
    neden: 'rehber',
    dakika: varsayilanDakika(tip),
  };
}

export function googleMekani(y: HafifYer, oneCikan: boolean): OnerilenMekan {
  return {
    place_id: y.place_id,
    ad: y.ad,
    primary_type: y.primary_type,
    lat: y.lat,
    lng: y.lng,
    puan: y.puan,
    puan_sayisi: y.puan_sayisi,
    foto_uri: y.foto_uri ?? null,
    neden: oneCikan ? 'oneCikan' : null,
    dakika: varsayilanDakika(y.primary_type),
  };
}

/**
 * Çipe göre liste: "Görmen gerekenler" = rehberdekiler (sırayla) + öne çıkanlar (puan sırası, tekrar yok);
 * "Rehberden" = yalnız rehber; kategori çipleri = Google listesi puan sırası (öne çıkan rozeti korunur).
 */
export function cipListesi(cip: OnerilenCipi, rehber: OnerilenMekan[], hepsi: HafifYer[], kategori: HafifYer[] | undefined): OnerilenMekan[] {
  const oneCikan = oneCikanlar(hepsi);
  if (cip === 'rehber') return rehber;
  if (cip === 'gormen') {
    const gorulen = new Set(rehber.map((r) => r.place_id));
    const one = oneriSirala(hepsi.filter((y) => oneCikan.has(y.place_id) && !gorulen.has(y.place_id))).map((y) => googleMekani(y, true));
    return [...rehber, ...one];
  }
  return oneriSirala(kategori ?? []).map((y) => googleMekani(y, oneCikan.has(y.place_id)));
}

const GOOGLE_CIP: Record<Exclude<OnerilenCipi, 'gormen' | 'rehber'>, OneriCipi> = { yemek: 'yemek', kafe: 'kafe', manzara: 'manzara' };
const YARICAP_M = 6000;
const GUN_MS = 24 * 60 * 60 * 1000;

/** Şehir merkezi etrafında bir çipin Google listesi (fotoğraflı); 24 sa önbellek. */
function useGoogleListesi(anahtar: string, cip: OneriCipi, merkez: { lat: number; lng: number }, etkin: boolean) {
  return useQuery({
    queryKey: ['sihirbaz-oneri', anahtar, cip, merkez.lat.toFixed(3), merkez.lng.toFixed(3)],
    enabled: etkin,
    staleTime: GUN_MS,
    retry: 1,
    queryFn: async () => {
      const yerler = await yakinYerler({ cip, merkez: { ...merkez, yaricapM: YARICAP_M }, enFazla: 20 });
      // Kart fotoğrafı: hafif Details foto maskesi (400 px); 24 sa istemci önbelleği.
      const fotolu = await hafifYerler(yerler.map((y) => y.place_id), { foto: true }).catch(() => [] as HafifYer[]);
      const foto = new Map(fotolu.map((y) => [y.place_id, y.foto_uri ?? null]));
      return yerler.map((y) => ({ ...y, foto_uri: foto.get(y.place_id) ?? null }));
    },
  });
}

export function useOnerilenler(seyahat: { id: string; lat: number; lng: number; city_label: string }, rehberSehir: Sehir | undefined, cip: OnerilenCipi) {
  const merkez = { lat: seyahat.lat, lng: seyahat.lng };
  const yerler = useSehirYerleri(rehberSehir?.id);
  // Rehber yerlerinin Google kimliği ve canlı verisi (puan, yorum, foto).
  const rehber = useQuery({
    queryKey: ['sihirbaz-rehber', rehberSehir?.id, (yerler.data ?? []).map((y) => y.id).join(',')],
    enabled: !!rehberSehir && !!yerler.data,
    staleTime: GUN_MS,
    queryFn: async () => {
      const liste = yerler.data ?? [];
      const ids = await Promise.all(liste.map((y) => yerPlaceId(y, rehberSehir!)));
      const gecerli = ids.filter((x): x is string => !!x);
      const hafif = gecerli.length ? await hafifYerler(gecerli, { foto: true }).catch(() => [] as HafifYer[]) : [];
      const hafifIle = new Map(hafif.map((h) => [h.place_id, h]));
      return liste.map((y, i) => rehberMekani(y, ids[i], ids[i] ? hafifIle.get(ids[i]!) : undefined)).filter((m): m is OnerilenMekan => !!m);
    },
  });
  const hepsi = useGoogleListesi(seyahat.id, 'hepsi', merkez, true);
  const googleCip = cip === 'gormen' || cip === 'rehber' ? null : GOOGLE_CIP[cip];
  const kategori = useGoogleListesi(seyahat.id, googleCip ?? 'hepsi', merkez, !!googleCip);
  const liste = useMemo(() => cipListesi(cip, rehber.data ?? [], hepsi.data ?? [], googleCip ? kategori.data : undefined), [cip, rehber.data, hepsi.data, kategori.data, googleCip]);
  const yukleniyor = cip === 'rehber' ? yerler.isPending || rehber.isPending : cip === 'gormen' ? (rehberSehir ? rehber.isPending : false) || hepsi.isPending : kategori.isPending;
  const hata = cip === 'rehber' ? rehber.isError : cip === 'gormen' ? hepsi.isError && rehber.isError : kategori.isError;
  return { liste, yukleniyor: yukleniyor && liste.length === 0, hata: hata && liste.length === 0 };
}
