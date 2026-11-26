// #432 2/3b ve #515: alıcı ekranı ile "Geziyi paylaş" önizlemesinin ortak başlığı. Saf modül (Supabase'e bağlı değil).
import { t } from '@/i18n';

/** Başlık: "Eskişehir gezisi" (kanvas `Sos_v6_Alici`, `Sos_v6_Paylas`); seyahatin adı varsa o. */
export function aliciBasligi(o: { ad: string | null; sehir: string }): string {
  return o.ad?.trim() || t('paylasim.kiminsiz', { sehir: o.sehir });
}

/** #517 KK3 (#530 inceleme 3): kişi metninin kipi, `geziModu` ile: plan "gidiyor", gezi "geziyor", bitti "gezdi". Sunucu aynı kuralı kullanır. */
export type KisiKipi = 'gidiyor' | 'geziyor' | 'gezdi';

export function kisiKipi(mod: 'plan' | 'gezi' | 'bitti'): KisiKipi {
  return mod === 'plan' ? 'gidiyor' : mod === 'gezi' ? 'geziyor' : 'gezdi';
}

/**
 * #530 inceleme 1: paylaşımda yalnız ilk ad ("Ayşe Yılmaz" → "Ayşe"). Her boşlukta bölünür (sekme, U+00A0 dahil); sunucudaki
 * `paylasim_ozeti` ile aynı. Ad yoksa null.
 */
export function ilkAd(ad: string | null | undefined): string | null {
  return ad?.trim().split(/\s+/)[0] || null;
}

/**
 * #517 KK3–KK4: "3 gün · 12 durak · 3 kişi gidiyor"; tek kişilik seyahatte kişi sayısı yazılmaz. Çekmecedeki önizleme, linkin
 * mesajı ve alıcı ekranı aynı metni kullanır.
 */
export function paylasimOzeti(gun: number, durak: number, kisi: number, kip: KisiKipi): string {
  const parcalar = [t('paylasim.gun', { n: gun }), t('paylasim.durak', { n: durak })];
  const anahtar = kip === 'gidiyor' ? 'paylasim.kisiGidiyor' : kip === 'geziyor' ? 'paylasim.kisiGeziyor' : 'paylasim.kisi';
  if (kisi > 1) parcalar.push(t(anahtar, { n: kisi }));
  return parcalar.join(' · ');
}
