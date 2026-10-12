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

/** #121 KK1: "Görmen gerekenler" en az bu kadar kart hedefler; öne çıkanlar yetmezse turistik liste puan sırasıyla doldurur. */
export const GORMEN_EN_AZ = 10;

/**
 * Çipe göre liste: "Görmen gerekenler" = rehberdekiler (sırayla) + öne çıkanlar (puan sırası) + turistik Nearby listesi
 * (gezilecek + müze; puan sırası, tekrar yok) — en az 10 kart; "Rehberden" = yalnız rehber; kategori çipleri = Google listesi
 * puan sırası (öne çıkan rozeti korunur). #121 KK4: listede olanlar gizlenir (`havuz`), az önce eklenenler (`tut`) ✓ ile kalır.
 */
export function cipListesi(cip: OnerilenCipi, rehber: OnerilenMekan[], hepsi: HafifYer[], kategori: HafifYer[] | undefined, turistik: HafifYer[] = [], havuz: Set<string> = new Set(), tut: Set<string> = new Set()): OnerilenMekan[] {
  const oneCikan = oneCikanlar(hepsi);
  const gizli = (id: string) => havuz.has(id) && !tut.has(id);
  if (cip === 'rehber') return rehber.filter((r) => !gizli(r.place_id));
  if (cip === 'gormen') {
    const gorulen = new Set<string>();
    const sonuc: OnerilenMekan[] = [];
    const ekle = (m: OnerilenMekan) => {
      if (gorulen.has(m.place_id) || gizli(m.place_id)) return;
      gorulen.add(m.place_id);
      sonuc.push(m);
    };
    rehber.forEach(ekle);
    oneriSirala(hepsi.filter((y) => oneCikan.has(y.place_id))).forEach((y) => ekle(googleMekani(y, true)));
    // Turistik türler (tourist_attraction, museum, landmark…) puan sırasıyla; hâlâ azsa `hepsi`nin kalanı.
    oneriSirala(turistik).forEach((y) => ekle(googleMekani(y, oneCikan.has(y.place_id))));
    if (sonuc.length < GORMEN_EN_AZ) oneriSirala(hepsi).forEach((y) => sonuc.length < GORMEN_EN_AZ && ekle(googleMekani(y, oneCikan.has(y.place_id))));
    return sonuc;
  }
  return oneriSirala(kategori ?? []).map((y) => googleMekani(y, oneCikan.has(y.place_id))).filter((m) => !gizli(m.place_id));
}

/** #121 KK: 5. adımın Nearby istek sayacı (oturum başına; PR kanıtı: en çok 3). */
export const nearbySayaci = { istek: 0 };

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
      nearbySayaci.istek += 1;
      if (__DEV__) console.log(`[sihirbaz] nearby istek #${nearbySayaci.istek} · ${cip}`);
      const yerler = await yakinYerler({ cip, merkez: { ...merkez, yaricapM: YARICAP_M }, enFazla: 20 });
      // Kart fotoğrafı: hafif Details foto maskesi (400 px); places-light foto için ≤ 12 kimlik → 12'lik parçalar; 24 sa önbellek.
      const ids = yerler.map((y) => y.place_id);
      const parcalar: string[][] = [];
      for (let i = 0; i < ids.length; i += 12) parcalar.push(ids.slice(i, i + 12));
      const fotolu = (await Promise.all(parcalar.map((p) => hafifYerler(p, { foto: true }).catch(() => [] as HafifYer[])))).flat();
      const foto = new Map(fotolu.map((y) => [y.place_id, y.foto_uri ?? null]));
      return yerler.map((y) => ({ ...y, foto_uri: foto.get(y.place_id) ?? null }));
    },
  });
}

export function useOnerilenler(seyahat: { id: string; lat: number; lng: number; city_label: string }, rehberSehir: Sehir | undefined, cip: OnerilenCipi, havuz: Set<string> = new Set(), tut: Set<string> = new Set()) {
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
  // #121 KK1: turistik türler — iki Nearby isteği daha (gezilecek + müze); toplam 3, 24 sa önbellek.
  const gezilecek = useGoogleListesi(seyahat.id, 'gezilecek', merkez, cip === 'gormen');
  const muze = useGoogleListesi(seyahat.id, 'muze', merkez, cip === 'gormen');
  const googleCip = cip === 'gormen' || cip === 'rehber' ? null : GOOGLE_CIP[cip];
  const kategori = useGoogleListesi(seyahat.id, googleCip ?? 'hepsi', merkez, !!googleCip);
  const turistik = useMemo(() => [...(gezilecek.data ?? []), ...(muze.data ?? [])], [gezilecek.data, muze.data]);
  const liste = useMemo(() => cipListesi(cip, rehber.data ?? [], hepsi.data ?? [], googleCip ? kategori.data : undefined, turistik, havuz, tut), [cip, rehber.data, hepsi.data, kategori.data, googleCip, turistik, havuz, tut]);
  const yukleniyor = cip === 'rehber' ? yerler.isPending || rehber.isPending : cip === 'gormen' ? (rehberSehir ? rehber.isPending : false) || hepsi.isPending || gezilecek.isPending || muze.isPending : kategori.isPending;
  const hata = cip === 'rehber' ? rehber.isError : cip === 'gormen' ? hepsi.isError && rehber.isError : kategori.isError;
  return { liste, yukleniyor: yukleniyor && liste.length === 0, hata: hata && liste.length === 0 };
}
