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
