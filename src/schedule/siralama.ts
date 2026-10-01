// PRD §5.1: bir günün varsayılan sırası — başlangıçtan (otel ya da ilk durak) en yakın komşu, sonra 2-opt (≤ 20 durak).
// Saf TS; mesafe fonksiyonu dışarıdan gelir (3.5 kuş uçuşu kestirimi, 3.7 gerçek yürüyüş süresi).

export type Mesafe = (a: number, b: number) => number;

/**
 * `n` durak (0..n-1) ve isteğe bağlı başlangıç düğümü `-1` (otel) için sıra döndürür.
 * `mesafe(i, j)` i/j ∈ [-1, n). `otelVar` false ise başlangıç 0. durak (ilk eklenen) olur.
 */
export function varsayilanSira(n: number, mesafe: Mesafe, otelVar: boolean): number[] {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  const kalan = new Set(Array.from({ length: n }, (_, i) => i));
  const sira: number[] = [];
  let simdi = otelVar ? -1 : 0;
  if (!otelVar) {
    kalan.delete(0);
    sira.push(0);
  }
  while (kalan.size > 0) {
    let enYakin = -1;
    let enKisa = Infinity;
    for (const k of kalan) {
      const d = mesafe(simdi, k);
      if (d < enKisa) {
        enKisa = d;
        enYakin = k;
      }
    }
    kalan.delete(enYakin);
    sira.push(enYakin);
    simdi = enYakin;
  }
  return n <= 20 ? ikiOpt(sira, mesafe, otelVar) : sira;
}

/** Toplam yol: başlangıç → … → son (otel varsa otele dönüş dahil, §5.3). */
export function toplamYol(sira: number[], mesafe: Mesafe, otelVar: boolean): number {
  if (sira.length === 0) return 0;
  let toplam = otelVar ? mesafe(-1, sira[0]) : 0;
  for (let i = 0; i < sira.length - 1; i++) toplam += mesafe(sira[i], sira[i + 1]);
  if (otelVar) toplam += mesafe(sira[sira.length - 1], -1);
  return toplam;
}

function ikiOpt(baslangic: number[], mesafe: Mesafe, otelVar: boolean): number[] {
  let sira = baslangic.slice();
  let enIyi = toplamYol(sira, mesafe, otelVar);
  let gelisti = true;
  // Otel yoksa ilk durak sabit (günün ilk eklenen durağı başlangıçtır).
  const ilk = otelVar ? 0 : 1;
  while (gelisti) {
    gelisti = false;
    for (let i = ilk; i < sira.length - 1; i++) {
      for (let j = i + 1; j < sira.length; j++) {
        const aday = sira.slice(0, i).concat(sira.slice(i, j + 1).reverse(), sira.slice(j + 1));
        const yol = toplamYol(aday, mesafe, otelVar);
        if (yol + 1e-9 < enIyi) {
          sira = aday;
          enIyi = yol;
          gelisti = true;
        }
      }
    }
  }
  return sira;
}
