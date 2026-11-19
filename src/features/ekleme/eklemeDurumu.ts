// #388 (#378 Ş2): ekleme hatalarının kullanıcı metni. Ham hata metni (`e.message`) kullanıcıya gösterilmez, yalnız Sentry'ye gider.
// Üç kalıp: bağlantı yok (+ Tekrar dene), diğer hatalar ("Eklenemedi. Tekrar dener misin?"), bilgi (hepsi zaten listede; nötr renk).
import { t } from '@/i18n';
import { agHatasi } from '@/lib/baglanti';
import { hataBildir } from '@/lib/hataRaporu';

export type EklemeDurumu = {
  metin: string;
  /** 'bilgi' hata değildir (KK3): ikincil metin renginde yazılır. */
  tur: 'hata' | 'bilgi';
  /** KK1: bağlantı hatasında "Tekrar dene" son denemeyi yineler. */
  tekrar?: () => void;
};

/** KK1 · KK2: yakalanan hata → kullanıcı metni. Ham hata `baglam` etiketiyle Sentry'ye bildirilir. */
export function eklemeHatasi(e: unknown, baglam: string, tekrar?: () => void): EklemeDurumu {
  hataBildir(e, baglam);
  if (agHatasi(e)) return { metin: t('ekleme.baglantiYok'), tur: 'hata', tekrar };
  return { metin: t('anasayfa.ekleHata'), tur: 'hata' };
}

/** #388 inceleme: çevrimdışıyken pasif ekleme düğmesinin nedeni (mevcut `ekleme.baglantiYok` satırı, düğmesiz). */
export function cevrimdisiDurumu(): EklemeDurumu {
  return { metin: t('ekleme.baglantiYok'), tur: 'hata' };
}

/** KK3: hepsi zaten listede (hata değil). */
export function hepsiListedeBilgisi(): EklemeDurumu {
  return { metin: t('ekleme.hepsiListede'), tur: 'bilgi' };
}
