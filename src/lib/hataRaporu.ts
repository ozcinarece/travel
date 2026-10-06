import type { ComponentType } from 'react';

// #49: web'de çökme raporlama yok (native: hataRaporu.native.ts).
export function hataRaporunuBaslat() {}

export function hataRaporuyla<P extends Record<string, unknown>>(Bilesen: ComponentType<P>): ComponentType<P> {
  return Bilesen;
}
