// #347: Autocomplete oturumunun kapanması. Saf yardımcılar burada (Jest de sınar); Google çağrısı fonksiyonda.
// Kural: aramadan gelen seçim `sessionToken` ile tek bir Details isteğine bağlanır; o istek oturumu kapatır. Önbellekten
// dönülürse Google'a Details gitmez, oturum kapanmaz ve aramada yazılan her tuş ayrı faturalanır.

/** Google Places (New) oturum anahtarı en çok 36 ASCII karakter (places-autocomplete ile aynı kural). */
export function oturumAnahtari(x: unknown): string | undefined {
  return typeof x === 'string' && /^[A-Za-z0-9_-]{8,36}$/.test(x) ? x : undefined;
}

type Kayit<T> = { zaman: number; deger: T };

/**
 * places-light'ın toplu okuması. Token'lı istekte ilk kimlik (seçilen kayıt) önbellekten okunmaz: Google'a gider, oturumu
 * kapatır ve cevap yine önbelleğe yazılır. Token'sız ve sonraki kimlikler bugünkü gibi önbellekten.
 */
export function onbellektenOkunur(i: number, oturum: string | undefined): boolean {
  return !(oturum && i === 0);
}

/** Sınır denetimi için Google'a gidecek kimlik sayısı (önbellekte olmayanlar + token'lı ilk kayıt). */
export function eksikSayisi<T>(tekil: string[], anahtar: (id: string) => string, onbellek: Map<string, Kayit<T>>, simdi: number, ttl: number, oturum: string | undefined): number {
  return tekil.filter((id, i) => {
    if (!onbellektenOkunur(i, oturum)) return true;
    const eski = onbellek.get(anahtar(id));
    return !eski || simdi - eski.zaman >= ttl;
  }).length;
}

/** Toplu okuma: önbellek ya da `detay` (Google). Oturum token'ı yalnız ilk kayda bağlanır. */
export async function topluOku<T>(
  tekil: string[],
  anahtar: (id: string) => string,
  onbellek: Map<string, Kayit<T>>,
  simdi: number,
  ttl: number,
  oturum: string | undefined,
  detay: (id: string, oturum: string | undefined) => Promise<T>,
): Promise<T[]> {
  return Promise.all(
    tekil.map(async (id, i) => {
      const a = anahtar(id);
      const eski = onbellek.get(a);
      if (onbellektenOkunur(i, oturum) && eski && simdi - eski.zaman < ttl) return eski.deger;
      const deger = await detay(id, i === 0 ? oturum : undefined);
      onbellek.set(a, { zaman: simdi, deger });
      return deger;
    }),
  );
}
