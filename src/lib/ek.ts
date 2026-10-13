// #143: sayının Türkçe iyelik eki — "1'i zaten listende", "6'sı", "10'u". Son okunan sayıya göre (birler basamağı varsa onun,
// yoksa onlar basamağının sesi; tam yüzler "yüz", tam binler "bin").
const BIR = ['', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
const ON = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'];

/** "1'i" · "2'si" · "6'sı" · "10'u" · "40'ı" · "100'ü" · "1000'i". */
export function iyelikEkli(n: number): string {
  const bir = n % 10;
  const on = Math.floor(n / 10) % 10;
  const ek = bir ? BIR[bir] : on ? ON[on] : n % 1000 === 0 && n > 0 ? 'i' : n > 0 ? 'ü' : 'ı';
  return `${n}'${ek}`;
}

const KALIN = 'aıou';
const UNLU = 'aeıioöuü';

/**
 * #144: özel adın yönelme eki — "Bursa'ya", "Eskişehir'e", "Eskişehir Gezisi'ne". Son ünlünün kalınlığına göre -a/-e; ünlüyle
 * biten adda kaynaştırma -y-, çok kelimeli adın son kelimesi ı/i/u/ü ile bitiyorsa (iyelikli tamlama: "Gezisi", "Tatili") -n-.
 * Harfle bitmeyen adda (rakam vb.) karar verilemez → null.
 */
export function yonelmeEkli(ad: string): string | null {
  const temiz = ad.trim();
  const son = temiz.slice(-1).toLocaleLowerCase('tr');
  if (!/\p{L}/u.test(son)) return null;
  const kucuk = temiz.toLocaleLowerCase('tr');
  const sonUnlu = [...kucuk].reverse().find((h) => UNLU.includes(h));
  const ek = sonUnlu && KALIN.includes(sonUnlu) ? 'a' : 'e';
  if (!UNLU.includes(son)) return `${temiz}'${ek}`;
  const tamlama = /\s/.test(temiz) && 'ıiuü'.includes(son);
  return `${temiz}'${tamlama ? 'n' : 'y'}${ek}`;
}
