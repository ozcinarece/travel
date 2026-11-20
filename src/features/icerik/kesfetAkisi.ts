// #277 → #361: ana sayfanın hazır gezileri (Keşfet akışı sorgusu) — yalnız bizim hazır gezilerimiz. Kart verisi kendi içerik tablolarımızdan
// (`geziler`, `gezi_gunleri`, `gezi_duraklari` sayısı, `sehirler.ad`); Google'dan ad, fotoğraf, puan ya da saat yok, akışta
// Places çağrısı yok (PRD §7).
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Gezi } from '@/lib/tipler';

import type { Amac } from './amaclar';

/** Akış kartı: gezi + günlerin durak sayıları (rota şeridi, 1. günden başlayarak). */
export type AkisGezisi = Gezi & { gunDuraklari: number[] };

type HamGezi = Gezi & {
  gezi_gunleri?: { sira: number; gezi_duraklari?: { count: number }[] }[] | null;
};

const AKIS_ALANLARI = 'id, sehir_id, baslik, slug, kapak_url, kapak_atif, ozet, yazar_ad, gun_sayisi, mekan_sayisi, sira, created_at, amaclar, sehirler(ad, slug, kapak_url), gezi_gunleri(sira, gezi_duraklari(count))';

/** Ham satırdan kart verisi: günler sıraya dizilir, her günün durak sayısı alınır. */
export function akisGezisi(h: HamGezi): AkisGezisi {
  const { gezi_gunleri, ...gezi } = h;
  const gunDuraklari = [...(gezi_gunleri ?? [])].sort((a, b) => a.sira - b.sira).map((g) => g.gezi_duraklari?.[0]?.count ?? 0);
  return { ...gezi, gunDuraklari };
}

/** Akışın gezileri: sıra, sonra yeni (her açılışta aynı; rastgelelik yok). */
export function useKesfetAkisi(etkin = true) {
  return useQuery({
    queryKey: ['icerik', 'kesfet-akisi'],
    enabled: etkin,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('geziler').select(AKIS_ALANLARI).order('sira', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as HamGezi[]).map(akisGezisi);
    },
  });
}

/**
 * #300 KK5 (kanvas 29a, 29h-A): akış çiplerinin amaçları, bu sırayla (veritabanındaki `public.amac_listesi()` ile aynı
 * değerler). "Sana göre" bunların dışında: süzgeç yok.
 */
export { AKIS_AMACLARI, type Amac } from './amaclar';

/** Seçili amaca göre süzgeç; null ("Sana göre") ya da artık boş olan amaç süzmez, sıra korunur. */
export function amacaGore<T extends Pick<Gezi, 'amaclar'>>(geziler: readonly T[], amac: Amac | null): T[] {
  if (!amac) return [...geziler];
  return geziler.filter((g) => g.amaclar?.includes(amac));
}
