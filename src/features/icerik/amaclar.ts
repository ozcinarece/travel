// #300: amaç etiketleri, veritabanındaki `public.amac_listesi()` ile aynı değerler ve sıra. Saf modül (akış ve BO ortak).
export const AKIS_AMACLARI = ['kultur_tarih', 'lezzet', 'doga', 'yavas', 'gece', 'cocuklu'] as const;
export type Amac = (typeof AKIS_AMACLARI)[number];
