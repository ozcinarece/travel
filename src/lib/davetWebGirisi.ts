// #550: web davet girişinden (`src/davet-web`) tam uygulamaya geçiş adresi. Davet girişi yalnız /r/{token} ve
// /r/g/{token}'ı bilir; başka bir yola gidilince (ör. `router.replace('/seyahat/[id]/(sekmeler)/gezi')`) sayfa o adresle
// yeniden yüklenir ve tam uygulama açılır. Rota grupları ("(sekmeler)") adreste yer almaz.
// /r/ yolları yeniden yüklenmez (sunucu yine davet girişini verir: sonsuz döngü olurdu).

type Parametreler = Record<string, string | string[] | undefined>;

export function tamUygulamaAdresi(yol: string, parametreler: Parametreler = {}): string | null {
  if (!yol.startsWith('/') || yol.startsWith('//')) return null;
  const temiz =
    decodeURIComponent(yol)
      .split('/')
      .filter((parca) => parca && !/^\(.*\)$/.test(parca))
      .map(encodeURIComponent)
      .join('/') || '';
  const tam = `/${temiz}`;
  if (tam === '/r' || tam.startsWith('/r/')) return null;
  const sorgu = new URLSearchParams();
  for (const [ad, deger] of Object.entries(parametreler)) {
    // Bulunamayan yolun parçaları (`+not-found` / `...unmatched`) sorguya girmez.
    if (deger === undefined || Array.isArray(deger) || ad.includes('not-found') || ad.includes('unmatched')) continue;
    sorgu.set(ad, deger);
  }
  const s = sorgu.toString();
  return s ? `${tam}?${s}` : tam;
}
