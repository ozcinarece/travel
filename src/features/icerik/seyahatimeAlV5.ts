// #408 KK6 (UX önerileri kanvası `Sayfa_v5_SeyahatimeAl`): "Seyahatime al" çekmecesinin metinleri — saf, test edilir.
// Seyahat satırının altında "Ayşe ve Mert de görecek", gün satırlarında "Cuma 16'ya · 7 durak" ya da "Seyahate pazar 18'i
// ekler", altta "1'i zaten listende" ve tek turuncu "N durağı al".
import { birlestir } from '@/features/gezi/seyahatV7';
import { t } from '@/i18n';
import { belirtmeSayi, dahiBaglaci, yonelmeSayi } from '@/lib/ek';
import { GUNLER, haftaGunu, parcala } from '@/lib/takvim';
import type { GeziDetay, Gun, UyeOzet } from '@/lib/tipler';

import type { AktarmaOzeti, AktarmaPlani } from './aktar';

/** Seyahatin günü: "Cuma 16'ya · 7 durak"; tarihsiz seyahatte "1. güne · 7 durak". */
export function hedefGunMetni(g: Pick<Gun, 'index' | 'date'>, durak: number): string {
  const gun = g.date ? `${GUNLER[haftaGunu(g.date)]} ${yonelmeSayi(parcala(g.date).gun)}` : t('gezi.v6.gunNoYonelme', { n: g.index });
  return t('gezi.v6.hedefGun', { gun, durak });
}

/** Seyahatte olmayan (sona eklenecek) gün: "Seyahate pazar 18'i ekler"; tarihsiz seyahatte "Seyahate 3. günü ekler". */
export function eklenecekGunMetni(g: Pick<Gun, 'index' | 'date'>): string {
  const gun = g.date ? `${GUNLER[haftaGunu(g.date)].toLocaleLowerCase('tr')} ${belirtmeSayi(parcala(g.date).gun)}` : t('gezi.v6.gunNoBelirtme', { n: g.index });
  return t('gezi.v6.ekler', { gun });
}

/** Seçili gezi günlerinde hedef seyahatin listesinde zaten olan durak sayısı ("1'i zaten listende"). */
export function zatenListendeSayisi(gezi: Pick<GeziDetay, 'gezi_gunleri'>, ozet: Pick<AktarmaOzeti, 'gunSatirlari'>, dahil: Record<string, boolean>): number {
  return gezi.gezi_gunleri.filter((g) => dahil[g.id] !== false).reduce((n, g) => n + (ozet.gunSatirlari[g.id]?.zatenListede ?? 0), 0);
}

/** Tek turuncu düğme: "12 durağı al"; alınacak bir şey yoksa pasif ("Bir gün seç" / "Hepsi zaten programında"). */
export function durakAlDugmesi(plan: AktarmaPlani, ozet: Pick<AktarmaOzeti, 'yeniDurak' | 'listeyeYeni'>): { metin: string; pasif: boolean } {
  if (plan.atamalar.length === 0 && plan.listeyeKalan.length === 0) return { metin: t('gezi.gunSecin'), pasif: true };
  if (ozet.yeniDurak > 0) return { metin: t('gezi.v6.durakAl', { n: ozet.yeniDurak }), pasif: false };
  if (ozet.listeyeYeni > 0) return { metin: t('gezi.mekanListeyeEkle', { n: ozet.listeyeYeni }), pasif: false };
  return { metin: plan.atamalar.length ? t('gezi.hepsiProgramda') : t('gezi.hepsiListede'), pasif: true };
}

/**
 * Seyahat satırının alt satırı: benden başka üyeler — "Ayşe ve Mert de görecek", "Okan da görecek"; adsız üye "bir arkadaşın".
 * `yuzler`: adı olan ilk iki üyenin baş harfi (kanvasta iki yüz). Başka üye yoksa null (satır yok).
 */
export function goreceklerSatiri(uyeler: Pick<UyeOzet, 'user_id' | 'display_name'>[], benId: string | null): { metin: string; yuzler: string[] } | null {
  const digerleri = uyeler.filter((u) => u.user_id !== benId);
  if (digerleri.length === 0) return null;
  const adlar = digerleri.map((u, i) => u.display_name?.trim() || t(i === 0 ? 'seyahatV7.adsiz' : 'seyahatV7.adsizKucuk'));
  const kisiler = birlestir(adlar);
  const yuzler = digerleri
    .map((u) => u.display_name?.trim())
    .filter((ad): ad is string => !!ad)
    .slice(0, 2)
    .map((ad) => ad.charAt(0).toLocaleUpperCase('tr'));
  return { metin: t('gezi.v6.gorecek', { kisiler, de: dahiBaglaci(adlar[adlar.length - 1]) }), yuzler };
}
