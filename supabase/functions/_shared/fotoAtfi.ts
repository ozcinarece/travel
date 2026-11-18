// Saf yardımcı (Deno'ya bağlı değil): istemci testleri de doğrudan içe aktarır.

/**
 * #348/#351: ilk fotoğrafın Google atfı. Google yazar adının yanında `authorAttributions.uri` bağlantısını da istiyor; adres
 * yalnız https ise döner (ad yoksa bağlantı da yok). `photos` alanının parçası: maske ve SKU değişmez.
 */
export function fotoAtfi(a: { displayName?: string; uri?: string } | undefined): { foto_yazar: string | null; foto_yazar_uri: string | null } {
  const yazar = a?.displayName?.trim() || null;
  const uri = yazar && typeof a?.uri === 'string' && /^https:\/\/\S+$/.test(a.uri.trim()) ? a.uri.trim() : null;
  return { foto_yazar: yazar, foto_yazar_uri: uri };
}

/**
 * #359 KK1: `places-full` galerisi — en fazla 10 fotoğraf; her birinde yazar adı ve `fotoAtfi` kuralıyla yazar bağlantısı
 * (yalnız https, ad yoksa bağlantı yok). Yalnız bellekte; DB'ye ve cihaz önbelleğine yazılmaz (PRD §7).
 */
export function fotoListesi(
  photos: { name: string; authorAttributions?: { displayName?: string; uri?: string }[] }[] | undefined,
): { ad: string; yazar: string | null; yazar_uri: string | null }[] {
  return (photos ?? []).slice(0, 10).map((f) => {
    const { foto_yazar, foto_yazar_uri } = fotoAtfi(f.authorAttributions?.[0]);
    return { ad: f.name, yazar: foto_yazar, yazar_uri: foto_yazar_uri };
  });
}
