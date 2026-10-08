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
  'tik-ffffff': require('../../../assets/pin/tik-ffffff.png'),
  'ev-ffffff': require('../../../assets/pin/ev-ffffff.png'),
  'taksi-0f0f0f': require('../../../assets/pin/taksi-0f0f0f.png'),
  'ok-ffffff': require('../../../assets/pin/ok-ffffff.png'),
};

/** Pin içi ikonun PNG'si; üretilmemiş (ikon, renk) çifti için undefined → SVG'ye düşülür. */
export function pinIkonuPng(ikon: string, renk: string): ImageRequireSource | undefined {
  return PIN_IKONLARI[`${ikon}-${renk.replace('#', '').toLowerCase()}`];
}
