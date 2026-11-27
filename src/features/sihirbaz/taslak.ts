// #581 KK2–KK3: sihirbazın taslak seyahati. Seyahat 2 → 3 geçişinde oluşur ama şehir ve tarih kilitli değildir; 3. adımdan
// geri dönüp değiştirince Devam yeni seyahat açmaz, aynı taslağı günceller (KK3a). Tarihsiz seyahat "Kaç gün?" sayacıyla
// N günlük kurulur (KK2). Gün sayısı azalınca sondaki günler silinir; durakları gider, yerler kalır → plansız listeye düşer
// (KK3c). Şehir değişince 3. adımda seçilen yerler onaydan sonra listeden çıkar (KK3b).
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { yeniGunUclari } from '@/features/konaklama/plan';
import { supabase } from '@/lib/supabase';
import type { SehirSecimi } from '@/lib/tipler';

import { gunFarki, gunSayisiSinirla, type Aralik } from './sihirbaz';

export { gunSayisiSinirla, TARIHSIZ_EN_AZ, TARIHSIZ_EN_COK, TARIHSIZ_VARSAYILAN } from './sihirbaz';

/** 2. adımın seçimi: tarih aralığı ya da tarihsiz N gün. */
export type TarihSecimi = { tur: 'tarihli'; gidis: string; donus: string } | { tur: 'tarihsiz'; gun: number };

export function tarihSecimi(aralik: Aralik, tarihsizGun: number | null): TarihSecimi | null {
  if (tarihsizGun !== null) return { tur: 'tarihsiz', gun: gunSayisiSinirla(tarihsizGun) };
  if (!aralik) return null;
  return {
    tur: 'tarihli',
    gidis: aralik.gidis,
    donus: aralik.donus ?? aralik.gidis,
  };
}

type MevcutTaslak = {
  start_date: string | null;
  end_date: string | null;
  gunSayisi: number;
};

/** KK3a: taslağın tarihi değişmeli mi? Aynıysa istek atılmaz. */
export function tarihDegisti(mevcut: MevcutTaslak, secim: TarihSecimi): boolean {
  if (secim.tur === 'tarihli') return mevcut.start_date !== secim.gidis || mevcut.end_date !== secim.donus;
  return mevcut.start_date !== null || mevcut.end_date !== null || mevcut.gunSayisi !== secim.gun;
}

/** Seçimin gün sayısı. */
export function secimGunSayisi(secim: TarihSecimi): number {
  return secim.tur === 'tarihli' ? gunFarki(secim.gidis, secim.donus) + 1 : secim.gun;
}

/** KK3b: şehir değişti mi (aynı Google kimliği aynı şehirdir). */
export function sehirDegisti(eski: Pick<SehirSecimi, 'place_id'> | null, yeni: Pick<SehirSecimi, 'place_id'> | null): boolean {
  return !!eski && !!yeni && eski.place_id !== yeni.place_id;
}

/**
 * Tarihsiz seyahatin günlerini N'e getirir: tarihler boşalır, fazla günler sondan silinir (durakları cascade, yerler kalır),
 * eksik günler son günün bitiş otelinden başlayıp oraya dönerek eklenir (#56, `useGunEkle` ile aynı kural).
 */
export async function tarihsizGunleriKur(seyahatId: string, n: number): Promise<void> {
  const { error: e1 } = await supabase.from('trips').update({ start_date: null, end_date: null }).eq('id', seyahatId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('days').delete().eq('trip_id', seyahatId).gt('index', n);
  if (e2) throw e2;
  const { error: e3 } = await supabase.from('days').update({ date: null }).eq('trip_id', seyahatId).not('date', 'is', null);
  if (e3) throw e3;
  const { data: gunler, error: e4 } = await supabase.from('days').select('index, end_stay_id').eq('trip_id', seyahatId).order('index');
  if (e4) throw e4;
  const sonIndex = gunler?.[gunler.length - 1]?.index ?? 0;
  if (sonIndex >= n) return;
  const uclar = yeniGunUclari(gunler ?? []);
  const { error: e5 } = await supabase.from('days').insert(
    Array.from({ length: n - sonIndex }, (_, i) => ({
      trip_id: seyahatId,
      index: sonIndex + i + 1,
      date: null,
      ...uclar,
    })),
  );
  if (e5) throw e5;
}

/** Taslağın tarihini seçime getirir. Tarihli seçimde mevcut RPC (günler tarihle kayar, tek işlem). */
export async function taslakTarihiniKur(seyahatId: string, secim: TarihSecimi): Promise<void> {
  if (secim.tur === 'tarihli') {
    const { error } = await supabase.rpc('seyahat_tarihlerini_degistir', {
      p_trip_id: seyahatId,
      p_start: secim.gidis,
      p_end: secim.donus,
    });
    if (error) throw error;
    return;
  }
  await tarihsizGunleriKur(seyahatId, secim.gun);
}

/** KK3a–KK3b: taslağın şehrini (ve adını) değiştirir; `yerleriCikar` onaylandıysa seçilen yerler listeden çıkar. */
export async function taslakSehriniKur(seyahatId: string, sehir: SehirSecimi, ad: string, yerleriCikar: boolean): Promise<void> {
  if (yerleriCikar) {
    const { error } = await supabase.from('places').delete().eq('trip_id', seyahatId);
    if (error) throw error;
  }
  const { error } = await supabase
    .from('trips')
    .update({
      name: ad.trim().slice(0, 80) || null,
      city_place_id: sehir.place_id,
      city_label: sehir.ad.slice(0, 80),
      country_code: sehir.country_code,
      lat: sehir.lat,
      lng: sehir.lng,
      tz: sehir.tz,
    })
    .eq('id', seyahatId);
  if (error) throw error;
}

function yenile(qc: ReturnType<typeof useQueryClient>, seyahatId: string) {
  for (const k of ['seyahat', 'gunler', 'duraklar', 'mekanlar']) qc.invalidateQueries({ queryKey: [k, seyahatId] });
  qc.invalidateQueries({ queryKey: ['seyahatler'] });
  qc.invalidateQueries({ queryKey: ['seyahat-durumlari'] });
}

export function useTaslakTarihi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seyahatId, secim }: { seyahatId: string; secim: TarihSecimi }) => taslakTarihiniKur(seyahatId, secim),
    onSettled: (_s, _h, { seyahatId }) => yenile(qc, seyahatId),
  });
}

export function useTaslakSehri() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seyahatId, sehir, ad, yerleriCikar }: { seyahatId: string; sehir: SehirSecimi; ad: string; yerleriCikar: boolean }) =>
      taslakSehriniKur(seyahatId, sehir, ad, yerleriCikar),
    onSettled: (_s, _h, { seyahatId }) => yenile(qc, seyahatId),
  });
}
