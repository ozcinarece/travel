// ÜRETİLMİŞ DOSYA — scripts/pin-ikonlari.mjs (#59 B). Elle düzenleme; ikon/renk değişince betiği çalıştır.
import type { ImageRequireSource } from 'react-native';

/** "<ikon>-<rrggbb>" → paketlenmiş PNG (@1x/@2x/@3x). */
export const PIN_IKONLARI: Record<string, ImageRequireSource> = {
  'kamera-3b6fe0': require('../../../assets/pin/kamera-3b6fe0.png'),
  'muze-8a4fd6': require('../../../assets/pin/muze-8a4fd6.png'),
  'ibadet-6b7280': require('../../../assets/pin/ibadet-6b7280.png'),
  'catal-e8590c': require('../../../assets/pin/catal-e8590c.png'),
  'fincan-9a5b2e': require('../../../assets/pin/fincan-9a5b2e.png'),
  'agac-1f8a4c': require('../../../assets/pin/agac-1f8a4c.png'),
  'dag-0ea5e9': require('../../../assets/pin/dag-0ea5e9.png'),
  'canta-c2185b': require('../../../assets/pin/canta-c2185b.png'),
  'kamera-ffffff': require('../../../assets/pin/kamera-ffffff.png'),
  'muze-ffffff': require('../../../assets/pin/muze-ffffff.png'),
  'ibadet-ffffff': require('../../../assets/pin/ibadet-ffffff.png'),
  'catal-ffffff': require('../../../assets/pin/catal-ffffff.png'),
  'fincan-ffffff': require('../../../assets/pin/fincan-ffffff.png'),
  'agac-ffffff': require('../../../assets/pin/agac-ffffff.png'),
  'dag-ffffff': require('../../../assets/pin/dag-ffffff.png'),
  'canta-ffffff': require('../../../assets/pin/canta-ffffff.png'),
  'tik-ffffff': require('../../../assets/pin/tik-ffffff.png'),
  'ev-ffffff': require('../../../assets/pin/ev-ffffff.png'),
  'taksi-0f0f0f': require('../../../assets/pin/taksi-0f0f0f.png'),
  'ok-ffffff': require('../../../assets/pin/ok-ffffff.png'),
  'daire-kamera-28': require('../../../assets/pin/daire-kamera-28.png'),
  'dolu-kamera-28': require('../../../assets/pin/dolu-kamera-28.png'),
  'daire-muze-28': require('../../../assets/pin/daire-muze-28.png'),
  'dolu-muze-28': require('../../../assets/pin/dolu-muze-28.png'),
  'daire-ibadet-28': require('../../../assets/pin/daire-ibadet-28.png'),
  'dolu-ibadet-28': require('../../../assets/pin/dolu-ibadet-28.png'),
  'daire-catal-28': require('../../../assets/pin/daire-catal-28.png'),
  'dolu-catal-28': require('../../../assets/pin/dolu-catal-28.png'),
  'daire-fincan-28': require('../../../assets/pin/daire-fincan-28.png'),
  'dolu-fincan-28': require('../../../assets/pin/dolu-fincan-28.png'),
  'daire-agac-28': require('../../../assets/pin/daire-agac-28.png'),
  'dolu-agac-28': require('../../../assets/pin/dolu-agac-28.png'),
  'daire-dag-28': require('../../../assets/pin/daire-dag-28.png'),
  'dolu-dag-28': require('../../../assets/pin/dolu-dag-28.png'),
  'daire-canta-28': require('../../../assets/pin/daire-canta-28.png'),
  'dolu-canta-28': require('../../../assets/pin/dolu-canta-28.png'),
  'tik-28': require('../../../assets/pin/tik-28.png'),
  'tamam-28': require('../../../assets/pin/tamam-28.png'),
  'daire-kamera-34': require('../../../assets/pin/daire-kamera-34.png'),
  'dolu-kamera-34': require('../../../assets/pin/dolu-kamera-34.png'),
  'daire-muze-34': require('../../../assets/pin/daire-muze-34.png'),
  'dolu-muze-34': require('../../../assets/pin/dolu-muze-34.png'),
  'daire-ibadet-34': require('../../../assets/pin/daire-ibadet-34.png'),
  'dolu-ibadet-34': require('../../../assets/pin/dolu-ibadet-34.png'),
  'daire-catal-34': require('../../../assets/pin/daire-catal-34.png'),
  'dolu-catal-34': require('../../../assets/pin/dolu-catal-34.png'),
  'daire-fincan-34': require('../../../assets/pin/daire-fincan-34.png'),
  'dolu-fincan-34': require('../../../assets/pin/dolu-fincan-34.png'),
  'daire-agac-34': require('../../../assets/pin/daire-agac-34.png'),
  'dolu-agac-34': require('../../../assets/pin/dolu-agac-34.png'),
  'daire-dag-34': require('../../../assets/pin/daire-dag-34.png'),
  'dolu-dag-34': require('../../../assets/pin/dolu-dag-34.png'),
  'daire-canta-34': require('../../../assets/pin/daire-canta-34.png'),
  'dolu-canta-34': require('../../../assets/pin/dolu-canta-34.png'),
  'tik-34': require('../../../assets/pin/tik-34.png'),
  'tamam-34': require('../../../assets/pin/tamam-34.png'),
  'otel-28': require('../../../assets/pin/otel-28.png'),
};

/** "<ikon>-<rrggbb>" anahtarı. */
export function pinIkonuAnahtari(ikon: string, renk: string): string {
  return `${ikon}-${renk.replace('#', '').toLowerCase()}`;
}

/** Pin içi ikonun PNG'si; üretilmemiş (ikon, renk) çifti için undefined → SVG'ye düşülür. */
export function pinIkonuPng(ikon: string, renk: string): ImageRequireSource | undefined {
  return PIN_IKONLARI[pinIkonuAnahtari(ikon, renk)];
}
