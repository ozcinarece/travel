/** Google puanı Türkçe biçimde ("4,6"); yoksa null. */
export function puanMetni(puan: number | null | undefined): string | null {
  if (puan === null || puan === undefined || !Number.isFinite(puan)) return null;
  return puan.toFixed(1).replace('.', ',');
}
