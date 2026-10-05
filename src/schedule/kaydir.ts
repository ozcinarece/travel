// PRD §5.4 mini-çubuk + 3.7 KK8 (#43 KK5): tetikleyici
// (a) önceki durak tamamlandı, sıradakine `yürüyüş + 10 dk` içinde varılmadı (gecikme) — Atla / Planı koru;
// (b) kullanıcı konumla hâlâ bir durakta, durak planlanan bitiş + 10 dk ile otomatik tamamlandı — Kaydır / Atla / Planı koru.
import type { Program } from './program';
import { UZUN_KALMA_PAYI_DK, yuruyusDk } from './program';

export type MiniCubuk =
  | { tur: 'yuruyus'; hedefId: string; kalanDk: number; gecikmeDk: number }
  | { tur: 'uzun'; durakId: string; uzunDk: number; eskiBitisDk: number; yeniBitisDk: number };

/**
 * `plan`: varış işaretleri olmadan hesaplanan program (eski bitiş); `canli`: varışlarla hesaplanan.
 * Yalnızca bugünün programında çağrılır.
 */
export function miniCubuk(plan: Program, canli: Program, simdiDk: number, buradaId: string | null = null): MiniCubuk | null {
  const satirlar = canli.satirlar;
  // (b) Uzun kalma: konum hâlâ bu durakta, durak otomatik tamamlanmış (planlanan bitiş + 10 dk geçti).
  if (buradaId) {
    const burada = satirlar.find((s) => s.durak.id === buradaId);
    if (burada && burada.durum === 'gecildi' && burada.otomatik) {
      const uzunDk = simdiDk - burada.ayrilisDk;
      if (uzunDk > UZUN_KALMA_PAYI_DK) return { tur: 'uzun', durakId: burada.durak.id, uzunDk, eskiBitisDk: plan.bitisDk, yeniBitisDk: canli.bitisDk + uzunDk };
    }
  }
  // (a) Yürüyüş gecikmesi: önceki tamamlandı, sıradakine yürüyüş + pay içinde varılmadı.
  const siradakiIdx = satirlar.findIndex((s) => s.durum === 'siradaki' || s.durum === 'buradasin');
  if (siradakiIdx < 0) return null;
  const siradaki = satirlar[siradakiIdx];
  const onceki = satirlar.slice(0, siradakiIdx).reverse().find((s) => s.durum === 'gecildi');
  if (!onceki || !siradaki.yuruyus || siradaki.durum === 'buradasin') return null;
  const yuruyusDakika = yuruyusDk(siradaki.yuruyus);
  if (simdiDk - onceki.ayrilisDk <= yuruyusDakika + UZUN_KALMA_PAYI_DK) return null;
  const planSatir = plan.satirlar.find((s) => s.durak.id === siradaki.durak.id);
  const kalanDk = Math.max(0, siradaki.varisDk - simdiDk) || yuruyusDakika;
  const gecikmeDk = Math.max(0, simdiDk - (planSatir?.varisDk ?? siradaki.varisDk));
  return { tur: 'yuruyus', hedefId: siradaki.durak.id, kalanDk, gecikmeDk };
}

/** "Kaydır": bulunulan durağın süresi fiilen geçen süreye (15 dk'ya yukarı yuvarlanmış) çekilir; sonrakiler kayar. */
export function kaydirSuresi(varildiDk: number, simdiDk: number): number {
  return Math.min(480, Math.max(15, Math.ceil((simdiDk - varildiDk) / 15) * 15));
}
