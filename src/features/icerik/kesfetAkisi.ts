// #277 (#237 v2, kanvas 29a · 29b): Keşfet akışı — yalnız bizim hazır gezilerimiz. Kart verisi kendi içerik tablolarımızdan
// (`geziler`, `gezi_gunleri`, `gezi_duraklari` sayısı, `sehirler.ad`); Google'dan ad, fotoğraf, puan ya da saat yok, akışta
// Places çağrısı yok (PRD §7).
import { useQuery } from '@tanstack/react-query';
import { Share } from 'react-native';

import { t } from '@/i18n';
import { davetLinki } from '@/lib/davetLinki';
import { supabase } from '@/lib/supabase';
import type { Gezi } from '@/lib/tipler';

import { ayniSehir } from './yerEkle';

/**
 * KK6: akış bir yayın bayrağının arkasında. Ece en az 8 şehir ve 40 kart olunca repo değişkeni `KESFET_AKISI=1` yapar ve
 * `eas-update` çalıştırır (`.github/workflows/eas-update.yml`). Kapalıyken ana ekran bugünkü hazır geziler bölümünü gösterir.
 */
export function kesfetAkisiAcik(): boolean {
  return process.env.EXPO_PUBLIC_KESFET_AKISI === '1';
}

/** Akış kartı: gezi + günlerin durak sayıları (rota şeridi, 1. günden başlayarak). */
export type AkisGezisi = Gezi & { gunDuraklari: number[] };

type HamGezi = Gezi & {
  gezi_gunleri?: { sira: number; gezi_duraklari?: { count: number }[] }[] | null;
};

const AKIS_ALANLARI = 'id, sehir_id, baslik, slug, kapak_url, ozet, yazar_ad, gun_sayisi, mekan_sayisi, sira, created_at, sehirler(ad, slug, kapak_url), gezi_gunleri(sira, gezi_duraklari(count))';

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
 * KK3: yaklaşan seyahatin şehrinin gezileri önde, sonra diğerleri; her iki grupta da sorgu sırası korunur. Şehir yoksa
 * (yaklaşan seyahat yok) ya da o şehrin gezisi yoksa `sehirGezileri` boş döner.
 */
export function akisSirasi<T extends Pick<Gezi, 'sehirler'>>(geziler: readonly T[], sehir: string | null | undefined): { sehirGezileri: T[]; digerleri: T[] } {
  if (!sehir) return { sehirGezileri: [], digerleri: [...geziler] };
  const sehirGezileri: T[] = [];
  const digerleri: T[] = [];
  for (const g of geziler) (g.sehirler?.ad && ayniSehir(sehir, g.sehirler.ad) ? sehirGezileri : digerleri).push(g);
  return { sehirGezileri, digerleri };
}

/** KK8: ekran okuyucu etiketi — "Eskişehir, 3 gün, 14 durak, Tripmate gezisi". */
export function kartEtiketi(g: Pick<Gezi, 'gun_sayisi' | 'mekan_sayisi' | 'sehirler' | 'baslik'>): string {
  return t('kesfetAkisi.kartEtiket', {
    sehir: g.sehirler?.ad ?? g.baslik,
    gun: g.gun_sayisi,
    durak: g.mekan_sayisi,
  });
}

/** KK4: WhatsApp'ta paylaş — sistemin paylaş sayfası, bugünkü hazır gezi linkiyle (gezi sayfasıyla aynı metin). */
export function geziyiPaylas(g: Pick<Gezi, 'baslik' | 'slug'>) {
  return Share.share({
    message: t('gezi.paylasMetin', {
      baslik: g.baslik,
      link: davetLinki(`gezi/${g.slug}`).replace('/r/gezi/', '/gezi/'),
    }),
  }).catch(() => {});
}
