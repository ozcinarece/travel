// #97 A KK6: tek yer "+" → yaklaşan (ya da aktif) seyahatin listesine; birden çok aday varsa ekran seçtirir.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { siniflandir } from '@/features/seyahatler/siniflandir';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import { varsayilanDakika } from '@/lib/kategori';
import type { SeyahatOzet } from '@/lib/tipler';

import { olayYaz } from './sorgular';

/** Hedef adayları: aktif + yaklaşan (#143: en erken başlayan önce, tarihsizler sonda). */
export function hedefSeyahatler(liste: SeyahatOzet[] | undefined): SeyahatOzet[] {
  if (!liste) return [];
  const { aktif, yaklasan } = siniflandir(liste);
  const tarih = (s: SeyahatOzet) => s.start_date ?? '9999-12-31';
  return [...aktif, ...[...yaklasan].sort((a, b) => (tarih(a) < tarih(b) ? -1 : tarih(a) > tarih(b) ? 1 : 0))];
}

/** Seyahatin şehir etiketi ("Eskişehir" / "Eskişehir, Türkiye") içerik şehriyle aynı mı. */
export function ayniSehir(cityLabel: string, sehirAdi: string): boolean {
  const k = (x: string) => x.trim().toLocaleLowerCase('tr');
  const ad = k(sehirAdi);
  return !!ad && k(cityLabel.split(',')[0]) === ad;
}

/** #143 KK3: "+ ve ✓" bağlamı — aynı şehirdeki en yakın tarihli seyahat (yoksa null: satır yok, ✓ yok). */
export function varsayilanHedef(adaylar: SeyahatOzet[], sehirAdi: string | null | undefined): SeyahatOzet | null {
  if (!sehirAdi) return null;
  return adaylar.find((s) => ayniSehir(s.city_label, sehirAdi)) ?? null;
}

export type YerEklemeIstegi = { seyahatId: string; yerId: string | null; place_id: string; primary_type: string | null; lat: number; lng: number; /** #143: gezi durağının süresi; yoksa kategori varsayılanı. */ dakika?: number };

export function useYereEkle() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (y: YerEklemeIstegi) => {
      if (!session) throw new Error('oturum yok');
      const { error } = await supabase.from('places').insert({ trip_id: y.seyahatId, place_id: y.place_id, primary_type: y.primary_type, lat: y.lat, lng: y.lng, default_minutes: y.dakika ? Math.min(480, Math.max(15, Math.round(y.dakika))) : varsayilanDakika(y.primary_type), added_by: session.user.id });
      if (error && error.code !== '23505') throw error;
      await olayYaz('yer_eklendi', y.yerId, { seyahat: y.seyahatId, place_id: y.place_id });
    },
    onSuccess: (_d, y) => {
      qc.invalidateQueries({ queryKey: ['mekanlar', y.seyahatId] });
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
    },
  });
}

export type CokluEklemeSonucu = { eklenen: number; zaten: number; cozumsuz: number };

/**
 * #144 KK3: Kaydettiklerim'de bir şehrin tüm yerleri seyahatin listesine — mükerrer (place_id) atlanır; Google kimliği
 * çözülemeyen içerik satırı atlanıp sayılır.
 */
export function useYerleriEkle() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ seyahatId, yerler }: { seyahatId: string; yerler: { yerId: string; place_id: string | null; primary_type: string | null; lat: number; lng: number }[] }): Promise<CokluEklemeSonucu> => {
      if (!session) throw new Error('oturum yok');
      const { data, error } = await supabase.from('places').select('place_id').eq('trip_id', seyahatId);
      if (error) throw error;
      const mevcut = new Set((data ?? []).map((m) => m.place_id as string));
      const gorulen = new Set<string>();
      const yeni = yerler.filter((y): y is typeof y & { place_id: string } => {
        if (!y.place_id || mevcut.has(y.place_id) || gorulen.has(y.place_id)) return false;
        gorulen.add(y.place_id);
        return true;
      });
      if (yeni.length > 0) {
        const { error: e } = await supabase
          .from('places')
          .insert(yeni.map((y) => ({ trip_id: seyahatId, place_id: y.place_id, primary_type: y.primary_type, lat: y.lat, lng: y.lng, default_minutes: varsayilanDakika(y.primary_type), added_by: session.user.id })));
        if (e) throw e;
        await Promise.all(yeni.map((y) => olayYaz('yer_eklendi', y.yerId, { seyahat: seyahatId, place_id: y.place_id })));
      }
      const cozumsuz = yerler.filter((y) => !y.place_id).length;
      return { eklenen: yeni.length, zaten: yerler.length - cozumsuz - yeni.length, cozumsuz };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['mekanlar', v.seyahatId] });
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
      qc.invalidateQueries({ queryKey: ['seyahat-durumlari'] });
    },
  });
}
