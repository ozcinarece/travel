// #144 (kanvas 20): Seyahatler kartlarında yüzde yerine somut durum — "3 / 4 gün planlandı" (bilgi), "2 mekan güne atanmadı"
// ve "Otel yok" (turuncu, dokununca ilgili yere); geri sayım çipi; geçmişte "N mekan gezildi" (seyahat_durumlari RPC'si).
import { useQuery } from '@tanstack/react-query';

import { t } from '@/i18n';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { SeyahatOzet } from '@/lib/tipler';
import { kacinciGun, yerelTarih } from '@/lib/zaman';

export type SeyahatDurumu = { trip_id: string; gun: number; planli_gun: number; atanmamis: number; gezilen: number };

export function useSeyahatDurumlari() {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['seyahat-durumlari'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('seyahat_durumlari');
      if (error) throw error;
      return new Map((data as SeyahatDurumu[]).map((d) => [d.trip_id, d]));
    },
  });
}

export type DurumCipi = { anahtar: 'planli' | 'atanmamis' | 'otel'; metin: string; uyari: boolean };

/** Tarihli seyahatin çipleri; tarihsiz (TASLAK) seyahatte yok. */
export function durumCipleri(sy: Pick<SeyahatOzet, 'start_date' | 'hotel_place_id' | 'stays'>, d: SeyahatDurumu | undefined): DurumCipi[] {
  if (!sy.start_date || !d) return [];
  const cipler: DurumCipi[] = [];
  if (d.gun > 0) cipler.push({ anahtar: 'planli', metin: t('seyahatler.cip.planli', { n: d.planli_gun, gun: d.gun }), uyari: false });
  if (d.atanmamis > 0) cipler.push({ anahtar: 'atanmamis', metin: t('seyahatler.cip.atanmamis', { n: d.atanmamis }), uyari: true });
  const otel = sy.stays?.[0]?.count ?? (sy.hotel_place_id ? 1 : 0);
  if (!otel) cipler.push({ anahtar: 'otel', metin: t('seyahatler.cip.otelYok'), uyari: true });
  return cipler;
}

/** Kapak çipi: "BUGÜN · 2. GÜN" (aktif) / "YARIN" / "4 GÜN SONRA"; tarihsizde null. */
export function geriSayim(sy: Pick<SeyahatOzet, 'start_date' | 'end_date' | 'tz'>, an: Date = new Date()): string | null {
  if (!sy.start_date) return null;
  const gun = kacinciGun(sy, an);
  if (gun) return t('seyahatler.cip.bugunGun', { n: gun });
  const bugun = yerelTarih(an, sy.tz);
  const fark = Math.round((Date.parse(`${sy.start_date}T00:00:00Z`) - Date.parse(`${bugun}T00:00:00Z`)) / 86_400_000);
  if (fark <= 0) return null;
  return fark === 1 ? t('seyahatler.cip.yarin') : t('seyahatler.cip.gunSonra', { n: fark });
}

/** "3 kişi" / "sadece sen". */
export function kisiMetni(n: number): string {
  return n > 1 ? t('seyahatler.kisi', { n }) : t('seyahatler.sadeceSen');
}
