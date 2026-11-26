// #432 2/3b ve #515: alıcı ekranı ile "Geziyi paylaş" önizlemesinin ortak başlığı. Saf modül (Supabase'e bağlı değil).
import { t } from '@/i18n';

/** Başlık: "Eskişehir gezisi" (kanvas `Sos_v6_Alici`, `Sos_v6_Paylas`); seyahatin adı varsa o. */
export function aliciBasligi(o: { ad: string | null; sehir: string }): string {
  return o.ad?.trim() || t('paylasim.kiminsiz', { sehir: o.sehir });
}
