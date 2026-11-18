// #347: Autocomplete oturumu ve önbellek. Saf yardımcılar burada (Jest de sınar); Google çağrısı fonksiyonda.
//
// Kural: aramadan gelen seçim `sessionToken` ile tek bir Details isteğine bağlanır ve o istek oturumu kapatır. Seçilen yer
// sunucu önbelleğindeyse Google'a hiç gidilmez; oturum kapanmaz ve aramada yazılan tuşlar tek tek faturalanır. Bu bilerek
// böyle: 12 tuşun altında oturumu kapatmak hiçbir alan maskesinde ucuzlatmıyor (#349, Ürün kararı).
//   - Essentials alanıyla (`id,location`) kapanan oturumda ilk 12 Autocomplete isteği yine "Autocomplete Requests" olarak
//     faturalanır; kapatan çağrı ayrıca "Place Details Essentials" sayılır.
//   - IDs Only ile kapatılırsa Autocomplete istekleri istek başı fiyata döner (oturum yokmuş gibi).
//   - Pro/Enterprise alanıyla kapatmak Autocomplete'i ücretsiz yapar ama kapatan çağrı "Place Details Enterprise +
//     Atmosphere" olarak faturalanır.
//   ≈5 tuşlu bir seçimde: kapatmamak ≈ $0,014; `id,location` ile ≈ $0,019; Pro/Enterprise maskeyle ≈ $0,025.
//   Kaynak: https://developers.google.com/maps/documentation/places/web-service/session-pricing ve
//   https://developers.google.com/maps/billing-and-pricing/pricing (0–100k dilimi).
//   (Teyit #353, session-pricing sayfası: Pro, Enterprise ya da Enterprise + Atmosphere alanıyla kapatan Details istenen
//   alanlardan bağımsız "Place Details Enterprise + Atmosphere" faturalanır; Essentials ile kapatan "Place Details Essentials".)
// Önbellek ıskalanınca token'lı Details zaten gider ve oturumu kapatır (main'deki davranış).
// Aynı kural places-full'da da geçerli (#353): token gelse de önbellekte geçerli kayıt varsa o döner (`tekOku`).

/** Google Places (New) oturum anahtarı en çok 36 ASCII karakter (places-autocomplete ile aynı kural). */
export function oturumAnahtari(x: unknown): string | undefined {
  return typeof x === 'string' && /^[A-Za-z0-9_-]{8,36}$/.test(x) ? x : undefined;
}

type Kayit<T> = { zaman: number; deger: T };

/** Sınır denetimi için Google'a gidecek kimlik sayısı: önbellekte olmayanlar (token önbellek okumasını değiştirmez). */
export function eksikSayisi<T>(tekil: string[], anahtar: (id: string) => string, onbellek: Map<string, Kayit<T>>, simdi: number, ttl: number): number {
  return tekil.filter((id) => {
    const eski = onbellek.get(anahtar(id));
    return !eski || simdi - eski.zaman >= ttl;
  }).length;
}

/** Toplu okuma: önce önbellek, yoksa `detay` (Google). Oturum token'ı yalnız Google'a giden ilk (seçilen) kayda bağlanır. */
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
      if (eski && simdi - eski.zaman < ttl) return eski.deger;
      const deger = await detay(id, i === 0 ? oturum : undefined);
      onbellek.set(a, { zaman: simdi, deger });
      return deger;
    }),
  );
}

/**
 * #353: tek kayıtlık okuma (places-full). Geçerli önbellek kaydı varsa token gelse de Google'a gidilmez. Iskalamada önce
 * sınır denetimi (`sinir`; bir sonuç dönerse istek reddedilir), sonra token'lı `detay` gider ve cevap `yaz` ile önbelleğe girer.
 */
export async function tekOku<T, R>(p: {
  eski: Kayit<T> | undefined;
  gecerli: (k: Kayit<T>) => boolean;
  oturum: string | undefined;
  sinir: () => Promise<R | null>;
  detay: (oturum: string | undefined) => Promise<T>;
  yaz: (deger: T) => void;
}): Promise<{ deger: T } | { red: R }> {
  if (p.eski && p.gecerli(p.eski)) return { deger: p.eski.deger };
  const red = await p.sinir();
  if (red) return { red };
  const deger = await p.detay(p.oturum);
  p.yaz(deger);
  return { deger };
}
