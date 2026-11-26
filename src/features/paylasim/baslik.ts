// #432 2/3b ve #515: alıcı ekranı ile "Geziyi paylaş" önizlemesinin ortak başlığı. Saf modül (Supabase'e bağlı değil).
import { t } from '@/i18n';

/** Başlık: "Eskişehir gezisi" (kanvas `Sos_v6_Alici`, `Sos_v6_Paylas`); seyahatin adı varsa o. */
export function aliciBasligi(o: { ad: string | null; sehir: string }): string {
  return o.ad?.trim() || t('paylasim.kiminsiz', { sehir: o.sehir });
}

/** #517 KK3: kişi metninin kipi. Plan kipinde "gidiyor"; gezi ve bitti kipinde "gezdi" (`geziModu`). */
export type KisiKipi = 'gidiyor' | 'gezdi';

export function kisiKipi(mod: 'plan' | 'gezi' | 'bitti'): KisiKipi {
  return mod === 'plan' ? 'gidiyor' : 'gezdi';
}

/**
 * #517 KK3–KK4: "3 gün · 12 durak · 3 kişi gidiyor"; tek kişilik seyahatte kişi sayısı yazılmaz. Çekmecedeki önizleme, linkin
 * mesajı ve alıcı ekranı aynı metni kullanır.
 */
export function paylasimOzeti(gun: number, durak: number, kisi: number, kip: KisiKipi): string {
  const parcalar = [t('paylasim.gun', { n: gun }), t('paylasim.durak', { n: durak })];
  if (kisi > 1) parcalar.push(t(kip === 'gidiyor' ? 'paylasim.kisiGidiyor' : 'paylasim.kisi', { n: kisi }));
  return parcalar.join(' · ');
}
