// #407 KK2: akış kartındaki "2 gün önce", "1 hafta önce".
import { t } from '@/i18n';

const DK = 60_000;
const SAAT = 60 * DK;
const GUN = 24 * SAAT;

export function gecenZaman(tarih: string, an: Date = new Date()): string {
  const fark = Math.max(0, an.getTime() - Date.parse(tarih));
  if (fark < SAAT) return t('arkadaslar.azOnce');
  if (fark < GUN) return t('arkadaslar.saatOnce', { n: Math.floor(fark / SAAT) });
  if (fark < 7 * GUN) return t('arkadaslar.gunOnce', { n: Math.floor(fark / GUN) });
  if (fark < 30 * GUN) return t('arkadaslar.haftaOnce', { n: Math.floor(fark / (7 * GUN)) });
  if (fark < 365 * GUN) return t('arkadaslar.ayOnce', { n: Math.floor(fark / (30 * GUN)) });
  return t('arkadaslar.yilOnce', { n: Math.floor(fark / (365 * GUN)) });
}
