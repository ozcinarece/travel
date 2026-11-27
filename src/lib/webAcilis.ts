// #549: web davet sayfasına build sırasında yazılan açılış katmanını (scripts/web-davet-acilis.mjs) kaldırır.
// Kök düzen açılış kararını verip ilk ekranı çizdiği karede çağrılır; böylece arada beyaz kare görünmez.
// Native'de ve katman olmayan sayfalarda hiçbir şey yapmaz.
export const WEB_ACILIS_ID = 'davet-acilis';

export function webAcilisiKaldir(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(WEB_ACILIS_ID)?.remove();
  document.getElementById(`${WEB_ACILIS_ID}-stil`)?.remove();
}
