// #526 KK5: Supabase Yönetim API hata gövdesindeki satır değerlerini loga basmadan önce maskeler.
// Hata kodu ve mesajın ilk satırı kalır; `Key (…)=(…)` değeri ve `DETAIL:` satırının geri kalanı `***` olur.
// Gövde JSON ise metin alanları ayrı ayrı maskelenir (satır sonları orada kaçışsız `\n` olur), değilse düz metin.

const KEY = /\bKey \(.*?\)=\(.*/g;
const DETAIL = /\bDETAIL:.*/g;

function metniMaskele(metin) {
  return metin.replace(KEY, (s) => `${s.slice(0, s.indexOf(')=(') + 2)}(***)`).replace(DETAIL, 'DETAIL: ***');
}

function degerMaskele(deger) {
  if (typeof deger === 'string') return metniMaskele(deger);
  if (Array.isArray(deger)) return deger.map(degerMaskele);
  if (deger && typeof deger === 'object') {
    return Object.fromEntries(Object.entries(deger).map(([k, v]) => [k, degerMaskele(v)]));
  }
  return deger;
}

/** Saf fonksiyon: hata gövdesindeki değerleri `***` ile değiştirir. */
export function hataMaskele(govde) {
  const metin = String(govde);
  try {
    const json = JSON.parse(metin);
    if (json && typeof json === 'object') return JSON.stringify(degerMaskele(json));
  } catch {
    // JSON değil: düz metin.
  }
  return metniMaskele(metin);
}
