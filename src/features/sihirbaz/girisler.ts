// #144: sihirbaza dışarıdan girişler — "Tekrar kur" (geçmiş seyahatin planı, yeni tarih; 2. adımdan başlar) ve Kaydettiklerim'in
// "Bu şehre seyahat kur"u (rehberli şehir seçili, kaydedilen yerler seyahat oluşunca listeye). Şehir seçimi Google kimliği ve
// saat dilimiyle (AdimNereye ile aynı yol).
import { useQuery } from '@tanstack/react-query';

import { hafifYerler, otomatikTamamla, yeniOturumJetonu } from '@/features/yerler/api';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Sehir, SehirSecimi } from '@/lib/tipler';

/** Google şehir kimliğinden seçim (saat dilimi ve ülke kodu hafif yerden). */
export async function sehirSecimi(placeId: string, adi: string, ikincil: string, oturum: string): Promise<SehirSecimi> {
  const [yer] = await hafifYerler([placeId], { sehir: true, oturum });
  if (!yer?.tz) throw new Error('tz yok');
  return { place_id: yer.place_id, ad: adi || yer.ad, ikincil, lat: yer.lat, lng: yer.lng, tz: yer.tz, country_code: yer.ulke_kodu };
}

/**
 * Rehberli şehir → seçim. #197: tabloda Google kimliği ve saat dilimi varsa Google'a gidilmez; yoksa adıyla Autocomplete (cities),
 * ilk öneri, sonra hafif yer (saat dilimi, ülke kodu).
 */
export async function icerikSehirSecimi(k: Pick<Sehir, 'ad' | 'lat' | 'lng' | 'place_id' | 'tz' | 'ulke_kodu'>): Promise<SehirSecimi> {
  if (k.place_id && k.tz) return { place_id: k.place_id, ad: k.ad, ikincil: '', lat: k.lat, lng: k.lng, tz: k.tz, country_code: k.ulke_kodu ?? null };
  const oturum = yeniOturumJetonu();
  const [o] = await otomatikTamamla({ girdi: k.ad, oturum, tur: 'cities', limit: 1, merkez: { lat: k.lat, lng: k.lng, yaricapM: 50_000 } });
  if (!o) throw new Error('öneri yok');
  return sehirSecimi(o.place_id, k.ad, o.ikincil, oturum);
}

export function useIcerikSehirSecimi(sehir: Sehir | undefined) {
  return useQuery({
    queryKey: ['sihirbaz', 'sehir', sehir?.id],
    enabled: !!sehir,
    staleTime: Infinity,
    retry: 1,
    queryFn: () => icerikSehirSecimi(sehir!),
  });
}

/** Tekrar kur kaynağı: adı ve şehri (seçim olarak). */
export function useTekrarKaynagi(id: string | undefined) {
  const { hesapli } = useOturum();
  return useQuery({
    queryKey: ['sihirbaz', 'tekrar', id],
    enabled: hesapli && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('id, name, city_place_id, city_label, country_code, lat, lng, tz').eq('id', id!).single();
      if (error) throw error;
      const sehir: SehirSecimi = { place_id: data.city_place_id, ad: data.city_label, ikincil: '', lat: data.lat, lng: data.lng, tz: data.tz, country_code: data.country_code };
      return { id: data.id as string, ad: (data.name as string | null) ?? null, sehir };
    },
  });
}

/** Kaynak seyahatin mekanları ve gün planı yeni seyahate (gün sırasıyla); dönen: kopyalanan durak. */
export async function seyahatiKopyala(kaynak: string, hedef: string): Promise<number> {
  const { data, error } = await supabase.rpc('seyahati_kopyala', { p_kaynak: kaynak, p_hedef: hedef });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

let girisSayaci = 0;
/** Girişin tekil numarası (`n` parametresi): aynı seyahat için ikinci "Tekrar kur" da yeniden uygulanır. */
export function yeniGirisNo(): string {
  girisSayaci += 1;
  return String(girisSayaci);
}
