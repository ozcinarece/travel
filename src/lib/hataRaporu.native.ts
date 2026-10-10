import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

import { izEkle } from './izler';

// #49: çökme raporlama. DSN (gizli değildir) EAS ortamından EXPO_PUBLIC_SENTRY_DSN ile gelir; yoksa kapalı.
// Kişisel veri gönderilmez; performans izleme kapalı — yalnız hatalar ve native çökmeler.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function hataRaporunuBaslat() {
  if (!dsn) return;
  Sentry.init({ dsn, sendDefaultPii: false, tracesSampleRate: 0, enableAutoSessionTracking: true });
}

/** Kök bileşeni Sentry hata sınırıyla sarar (DSN yoksa olduğu gibi döner). */
export function hataRaporuyla<P extends Record<string, unknown>>(Bilesen: ComponentType<P>): ComponentType<P> {
  return dsn ? Sentry.wrap(Bilesen) : Bilesen;
}

/** #66 KK7: tanı izi — bir sonraki hata raporuna eklenir (DSN yoksa sessiz). Kişisel veri içermez. */
export function izBirak(kategori: string, mesaj: string, seviye: 'info' | 'error' = 'info') {
  izEkle(kategori, mesaj);
  if (!dsn) return;
  Sentry.addBreadcrumb({ category: kategori, message: mesaj, level: seviye });
}

/** #85 KK3: hata sınırının yakaladığı istisna Sentry'ye gider (DSN yoksa yalnız konsol). Kişisel veri içermez. */
export function hataBildir(hata: unknown, baglam?: string) {
  console.error(baglam ?? 'hata', hata);
  if (!dsn) return;
  Sentry.captureException(hata, baglam ? { tags: { baglam } } : undefined);
}
