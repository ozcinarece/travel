import type { ComponentType } from 'react';

// #49: web'de çökme raporlama yok (native: hataRaporu.native.ts).
export function hataRaporunuBaslat() {}

export function hataRaporuyla<P extends Record<string, unknown>>(Bilesen: ComponentType<P>): ComponentType<P> {
  return Bilesen;
}

/** #66 KK7: tanı izi (Sentry breadcrumb; web'de yok). */
export function izBirak(_kategori: string, _mesaj: string, _seviye: 'info' | 'error' = 'info') {}
