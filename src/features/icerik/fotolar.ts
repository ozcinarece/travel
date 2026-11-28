// #97: içerik satırları (yer / gezi durağı) için Google kimliği ve fotoğraf. #172 KK7–KK9: ad, kategori ve konum satırın
// kendisinden (DB) gelir, puan gösterilmez; fotoğraf önce bizim kapağımız, yoksa Google fotoğrafı (Pro foto maskesi, ortak
// önbellek: kimlik başına bir kez). Yalnız bellekte; 24 sa istemci önbelleği (PRD §7).
import { useQuery } from '@tanstack/react-query';

import { hafifOnbellek, type HafifYer } from '../yerler/api';
import { googleYazarBaglantisi, kapakAtfiOku, type FotoAtfi } from './kapakAtfi';
import { icerikPlaceId } from './sorgular';

export type IcerikSatiri = { id: string; place_id: string | null; ad: string; lat: number | null; lng: number | null; kapak_url?: string | null; kapak_atif?: unknown };
/** #348: `foto_atif` fotoğrafın geldiği yerden (satırın kendi kapağı ya da Google); fotoğraf yoksa null. */
export type IcerikCanli = { place_id: string | null; foto_uri: string | null; foto_atif: FotoAtfi | null };

/** Satırın fotoğrafı ve atfı: önce kendi kapağımız (kendi atfıyla), yoksa Google fotoğrafı (Google atfıyla). */
export function satirFotosu(s: Pick<IcerikSatiri, 'kapak_url' | 'kapak_atif'>, google: Pick<HafifYer, 'foto_uri' | 'foto_yazar' | 'foto_yazar_uri'> | undefined): Pick<IcerikCanli, 'foto_uri' | 'foto_atif'> {
  if (s.kapak_url) return { foto_uri: s.kapak_url, foto_atif: { tur: 'kapak', atif: kapakAtfiOku(s.kapak_atif) } };
  if (google?.foto_uri) {
    const yazar = google.foto_yazar?.trim() || null;
    return { foto_uri: google.foto_uri, foto_atif: { tur: 'google', yazar, uri: googleYazarBaglantisi(yazar, google.foto_yazar_uri) } };
  }
  return { foto_uri: null, foto_atif: null };
}

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
      return new Map(satirlar.map((s, i) => [s.id, { place_id: ids[i], ...satirFotosu(s, ids[i] ? google[ids[i]!] : undefined) }]));
    },
  });
}

/**
 * Mekan panelinin yedek verisi (places-full gelene kadar): DB'deki ad, kategori ve konumla; puan yok (KK9–KK10).
 * #205 Parça 1: konum boşalmış olabilir (gece temizliği); panel konumu kullanmaz, yol tarifi `yolTarifiHedefi` ile ada düşer.
 */
export type IcerikHafif = Omit<HafifYer, 'lat' | 'lng'> & { lat: number | null; lng: number | null };
export function icerikHafif(placeId: string, satir: { ad: string; kategori: string | null; lat: number | null; lng: number | null }): IcerikHafif {
  return { place_id: placeId, ad: satir.ad, lat: satir.lat, lng: satir.lng, primary_type: satir.kategori, tz: null, puan: null, puan_sayisi: null, acik: null, ulke_kodu: null };
}
