// #192: önerilen gezinin gerçek yolu. Bir günün bacakları önce önbellek tablosundan okunur (gezi_rota_onbellek; yayınlı gezide
// herkes, taslakta admin); biri bile eksik ya da 30 günden eskiyse `gezi-rota` günü tek istekte hesaplar ve yazar. Aynı geziyi
// açan sonraki herkes tablodan okur (Google isteği yok). Hata olursa harita kuş uçuşu çizgide, süreler kestirimde kalır.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { GeziDuragi, GeziGunu } from '@/lib/tipler';

export type GeziRotaBacagi = {
  kimden_durak_id: string;
  kime_durak_id: string;
  /** Mevcut bacak modu kuralı: yürüyüş 40 dk'yı aşarsa DRIVE. */
  mod: 'WALK' | 'DRIVE';
  /** Yürüyüş rotası (kodlu polyline), süresi ve mesafesi. */
  polyline: string;
  saniye: number;
  metre: number;
  /** Araç rotası (yalnız DRIVE'da). */
  arac_saniye: number | null;
  arac_metre: number | null;
  arac_polyline: string | null;
  fetched_at: string;
};
/** `kimden>kime` (durak kimlikleri) → bacak. */
export type GeziRotalari = Map<string, GeziRotaBacagi>;

/** Google Routes koşulu: konum en çok 30 gün saklanır; daha eskisi yeniden hesaplanır. */
export const ROTA_ONBELLEK_GUN = 30;
const SUTUNLAR = 'kimden_durak_id, kime_durak_id, mod, polyline, saniye, metre, arac_saniye, arac_metre, arac_polyline, fetched_at';
const BOS: GeziRotalari = new Map();

export const bacakAnahtari = (kimden: string, kime: string) => `${kimden}>${kime}`;

/** Günün ardışık durak çiftleri (sıralı). */
export function gunCiftleri(duraklar: Pick<GeziDuragi, 'id'>[]): string[] {
  return duraklar.slice(1).map((d, i) => bacakAnahtari(duraklar[i].id, d.id));
}

/** Günün bütün bacakları var ve 30 günden yeni mi. */
export function gunTamMi(duraklar: Pick<GeziDuragi, 'id'>[], satirlar: GeziRotaBacagi[], simdi = Date.now()): boolean {
  const sinir = simdi - ROTA_ONBELLEK_GUN * 24 * 60 * 60 * 1000;
  const taze = new Set(satirlar.filter((s) => Date.parse(s.fetched_at) >= sinir).map((s) => bacakAnahtari(s.kimden_durak_id, s.kime_durak_id)));
  return gunCiftleri(duraklar).every((c) => taze.has(c));
}

/** Önce tablo; eksik / eski bacak varsa `gezi-rota` (gün tek istekte). */
export async function gunRotasiniGetir(gun: Pick<GeziGunu, 'id' | 'gezi_duraklari'>): Promise<GeziRotaBacagi[]> {
  const { data, error } = await supabase.from('gezi_rota_onbellek').select(SUTUNLAR).eq('gezi_gun_id', gun.id);
  if (!error && gunTamMi(gun.gezi_duraklari, (data ?? []) as GeziRotaBacagi[])) return data as GeziRotaBacagi[];
  const { data: c, error: e } = await supabase.functions.invoke<{ bacaklar: GeziRotaBacagi[] }>('gezi-rota', { body: { gezi_gun_id: gun.id } });
  if (e) throw e;
  return c?.bacaklar ?? [];
}

/** Sorgu anahtarı: gün + durak sırası (duraklar değişince yeniden okunur). */
export const geziRotaAnahtari = (gun: Pick<GeziGunu, 'id' | 'gezi_duraklari'>) => ['icerik', 'gezi-rota', gun.id, gun.gezi_duraklari.map((d) => d.id).join(',')];
export const GEZI_ROTA_TAZE_MS = 24 * 60 * 60 * 1000;

export function rotaHaritasi(satirlar: GeziRotaBacagi[] | undefined): GeziRotalari {
  // #199 KK2: kimliği eksik satır atlanır (bozuk cevap haritayı düşürmesin; o bacak kuş uçuşunda kalır).
  const gecerli = Array.isArray(satirlar) ? satirlar.filter((s) => !!s && typeof s.kimden_durak_id === 'string' && typeof s.kime_durak_id === 'string') : [];
  return gecerli.length ? new Map(gecerli.map((s) => [bacakAnahtari(s.kimden_durak_id, s.kime_durak_id), s])) : BOS;
}

/** Seçili günün bacakları (KK2–KK3). Durak sayısı 2'den azsa istek yok. */
export function useGeziRotasi(gun: Pick<GeziGunu, 'id' | 'gezi_duraklari'> | undefined) {
  const sorgu = useQuery({
    queryKey: gun ? geziRotaAnahtari(gun) : ['icerik', 'gezi-rota', 'yok'],
    enabled: !!gun && gun.gezi_duraklari.length >= 2,
    staleTime: GEZI_ROTA_TAZE_MS,
    gcTime: GEZI_ROTA_TAZE_MS,
    retry: 1,
    queryFn: () => gunRotasiniGetir(gun!),
  });
  return { rotalar: rotaHaritasi(sorgu.data), yukleniyor: sorgu.isPending && !!gun && gun.gezi_duraklari.length >= 2 };
}
