// #97: içerik satırları (yer / gezi durağı) için Google kimliği ve fotoğraf. #172 KK7–KK9: ad, kategori ve konum satırın
// kendisinden (DB) gelir, puan gösterilmez; fotoğraf önce bizim kapağımız, yoksa Google fotoğrafı (Pro foto maskesi, ortak
// önbellek: kimlik başına bir kez). Yalnız bellekte; 24 sa istemci önbelleği (PRD §7).
import { useQuery } from '@tanstack/react-query';

import { hafifOnbellek, type HafifYer } from '../yerler/api';
import { icerikPlaceId } from './sorgular';

export type IcerikSatiri = { id: string; place_id: string | null; ad: string; lat: number; lng: number; kapak_url?: string | null };
export type IcerikCanli = { place_id: string | null; foto_uri: string | null };

/** `foto: false`: yalnız Google kimliği (ör. hazır geziyi seyahate alırken) — places-light çağrılmaz. */
export function useIcerikCanli(satirlar: IcerikSatiri[], sehirAdi: (s: IcerikSatiri) => string, etkin = true, secenek: { foto?: boolean } = {}) {
  const foto = secenek.foto !== false;
  const anahtar = satirlar.map((s) => `${s.id}:${s.kapak_url ? 1 : 0}`).join(',');
  return useQuery({
    queryKey: ['icerik-canli', foto ? 'foto' : 'kimlik', anahtar],
    enabled: etkin && satirlar.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<Map<string, IcerikCanli>> => {
      const ids = await Promise.all(satirlar.map((s) => icerikPlaceId(s, sehirAdi(s))));
      const kapaksiz = foto ? [...new Set(satirlar.flatMap((s, i) => (!s.kapak_url && ids[i] ? [ids[i]!] : [])))] : [];
      const google = kapaksiz.length ? await hafifOnbellek.getirHepsi(kapaksiz, ['foto']).catch(() => ({}) as Record<string, HafifYer>) : {};
      return new Map(satirlar.map((s, i) => [s.id, { place_id: ids[i], foto_uri: s.kapak_url ?? (ids[i] ? (google[ids[i]!]?.foto_uri ?? null) : null) }]));
    },
  });
}

/** Mekan panelinin yedek verisi (places-full gelene kadar): DB'deki ad, kategori ve konumla; puan yok (KK9–KK10). */
export function icerikHafif(placeId: string, satir: { ad: string; kategori: string | null; lat: number; lng: number }): HafifYer {
  return { place_id: placeId, ad: satir.ad, lat: satir.lat, lng: satir.lng, primary_type: satir.kategori, tz: null, puan: null, puan_sayisi: null, acik: null, ulke_kodu: null };
}
