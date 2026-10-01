// PRD §5.4 mini-çubuk + 3.7 KK8: (a) sıradaki durağa yürüyüş başladı, (b) bir durakta 10+ dk uzun kalındı.
import type { Program } from './program';
import { UZUN_KALMA_PAYI_DK, yuruyusDk } from './program';

export type MiniCubuk =
  | { tur: 'yuruyus'; hedefId: string; kalanDk: number; gecikmeDk: number }
  | { tur: 'uzun'; durakId: string; uzunDk: number; eskiBitisDk: number; yeniBitisDk: number };

/**
 * `plan`: varış işaretleri olmadan hesaplanan program (eski bitiş); `canli`: varışlarla hesaplanan.
 * Yalnızca bugünün programında çağrılır.
 */
export function miniCubuk(plan: Program, canli: Program, simdiDk: number): MiniCubuk | null {
  const satirlar = canli.satirlar;
  const buradasin = satirlar.find((s) => s.durum === 'buradasin');
  if (buradasin) {
    const uzunDk = simdiDk - buradasin.ayrilisDk;
    if (uzunDk > UZUN_KALMA_PAYI_DK) {
      // Uzun kalma: bitiş, şu andan itibaren kalan durakların süresi + yürüyüşlerle kayar.
      const yeniBitisDk = canli.bitisDk + uzunDk;
      return { tur: 'uzun', durakId: buradasin.durak.id, uzunDk, eskiBitisDk: plan.bitisDk, yeniBitisDk };
    }
    return null;
  }
  const siradaki = satirlar.find((s) => s.durum === 'siradaki');
  const gecilenVar = satirlar.some((s) => s.durum === 'gecildi');
  if (!siradaki || !gecilenVar || !siradaki.yuruyus) return null;
  const planSatir = plan.satirlar.find((s) => s.durak.id === siradaki.durak.id);
  const kalanDk = Math.max(0, siradaki.varisDk - simdiDk) || yuruyusDk(siradaki.yuruyus);
  const gecikmeDk = Math.max(0, Math.max(siradaki.varisDk, simdiDk) - (planSatir?.varisDk ?? siradaki.varisDk));
  return { tur: 'yuruyus', hedefId: siradaki.durak.id, kalanDk, gecikmeDk };
}

/** "Kaydır": bulunulan durağın süresi fiilen geçen süreye (15 dk'ya yukarı yuvarlanmış) çekilir; sonrakiler kayar. */
export function kaydirSuresi(varildiDk: number, simdiDk: number): number {
  return Math.min(480, Math.max(15, Math.ceil((simdiDk - varildiDk) / 15) * 15));
}
