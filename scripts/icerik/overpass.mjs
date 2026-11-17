// Overpass istemcisi (içerik hattı, docs/07). Google'a gidilmez. #266 KK4–KK5: her istekte süre sınırı, yalnız geçici
// hatalarda (429, 502, 503, 504, ağ) yeniden deneme, `Retry-After`'a uyma ve koşu bütçesi. Loglara sorgu ya da yanıt yazılmaz.

export const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
/** KK4: tek bir Overpass isteğinin süre sınırı. */
export const ISTEK_SURESI_MS = 120_000;
/** KK5: yalnız bu durumlarda (ve ağ hatasında) yeniden denenir. */
export const GECICI_DURUMLAR = new Set([429, 502, 503, 504]);

/** Overpass ya da ağ hatası. `yeniden`: geçici mi; `bekleMs`: sunucunun `Retry-After` ile istediği bekleme. */
export class OverpassHatasi extends Error {
  constructor(mesaj, { durum = null, yeniden = false, bekleMs = null } = {}) {
    super(mesaj);
    this.name = 'OverpassHatasi';
    this.durum = durum;
    this.yeniden = yeniden;
    this.bekleMs = bekleMs;
  }
}

/** KK4: koşunun süre bütçesi doldu; kalan iş yapılmaz. */
export class SureBittiHatasi extends Error {
  constructor() {
    super('süre bütçesi doldu');
    this.name = 'SureBittiHatasi';
  }
}

/** `Retry-After` başlığı → ms (saniye ya da HTTP tarihi). Yoksa ya da okunamazsa null. */
export function retryAfterMs(deger, simdi = Date.now()) {
  if (deger == null || deger === '') return null;
  const s = String(deger).trim();
  if (/^\d+$/.test(s)) return Number(s) * 1000;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : Math.max(0, t - simdi);
}

/**
 * Tek deneme: sunucular sırayla sorulur, her istek `ISTEK_SURESI_MS` ile sınırlı. Geçici olmayan bir 4xx (ör. 400 bozuk
 * sorgu) hemen durdurur; diğer sunucu da denenmez. Hepsi düşerse son hata atılır.
 */
export async function overpassBirKez(sorgu, { fetchFn = fetch } = {}) {
  let son = new OverpassHatasi('Overpass yanıt vermedi', { yeniden: true });
  for (const url of OVERPASS) {
    let cevap;
    try {
      cevap = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'tripmate-icerik-hatti (github.com/ozcinarece/travel)' },
        body: new URLSearchParams({ data: sorgu }),
        signal: AbortSignal.timeout(ISTEK_SURESI_MS),
      });
    } catch {
      son = new OverpassHatasi('Overpass ağ hatası ya da zaman aşımı', { yeniden: true });
      continue;
    }
    if (cevap.ok) {
      try {
        return await cevap.json();
      } catch {
        son = new OverpassHatasi('Overpass yanıtı okunamadı', { yeniden: true });
        continue;
      }
    }
    const yeniden = GECICI_DURUMLAR.has(cevap.status);
    son = new OverpassHatasi(`Overpass HTTP ${cevap.status}`, { durum: cevap.status, yeniden, bekleMs: retryAfterMs(cevap.headers?.get?.('retry-after')) });
    if (!yeniden && cevap.status >= 400 && cevap.status < 500) throw son;
  }
  throw son;
}

const uyu = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * KK5: yalnız geçici hatada (429/502/503/504/ağ) en çok `deneme` kez, artan beklemeyle yeniden dener; `Retry-After` varsa
 * ona uyar. `bitis` (ms, `simdi()` ile aynı saat) verilirse bekleme bütçeyi aşacaksa ya da bütçe dolmuşsa `SureBittiHatasi`.
 */
export async function overpassYeniden(sorgu, { deneme = 3, fetchFn, bekle = uyu, simdi = Date.now, bitis = Infinity } = {}) {
  for (let i = 0; ; i += 1) {
    if (simdi() >= bitis) throw new SureBittiHatasi();
    try {
      return await overpassBirKez(sorgu, { fetchFn });
    } catch (e) {
      if (!(e instanceof OverpassHatasi) || !e.yeniden || i + 1 >= deneme) throw e;
      const ms = e.bekleMs ?? 5000 * 3 ** i;
      if (simdi() + ms >= bitis) throw new SureBittiHatasi();
      await bekle(ms);
    }
  }
}
