import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

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
