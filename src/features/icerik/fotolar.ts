// #97: içerik satırları (yer / gezi durağı) için canlı Google verisi — place_id çözümü + hafif Details (foto 400 px, puan,
// yorum). Yalnız bellekte; 24 sa istemci önbelleği (PRD §7).
import { useQuery } from '@tanstack/react-query';

import { hafifYerler, type HafifYer } from '../yerler/api';
import { icerikPlaceId } from './sorgular';

export type IcerikSatiri = { id: string; place_id: string | null; ad: string; lat: number; lng: number; kapak_url?: string | null };
export type IcerikCanli = { place_id: string | null; hafif: HafifYer | null; foto_uri: string | null };

export function useIcerikCanli(satirlar: IcerikSatiri[], sehirAdi: (s: IcerikSatiri) => string, etkin = true) {
  const anahtar = satirlar.map((s) => s.id).join(',');
  return useQuery({
    queryKey: ['icerik-canli', anahtar],
    enabled: etkin && satirlar.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<Map<string, IcerikCanli>> => {
      const ids = await Promise.all(satirlar.map((s) => icerikPlaceId(s, sehirAdi(s))));
      const gecerli = [...new Set(ids.filter((x): x is string => !!x))];
      const hafif = gecerli.length ? await hafifYerler(gecerli, { foto: true }).catch(() => [] as HafifYer[]) : [];
      const ile = new Map(hafif.map((h) => [h.place_id, h]));
      return new Map(satirlar.map((s, i) => [s.id, { place_id: ids[i], hafif: ids[i] ? (ile.get(ids[i]!) ?? null) : null, foto_uri: s.kapak_url ?? (ids[i] ? (ile.get(ids[i]!)?.foto_uri ?? null) : null) }]));
    },
  });
}
