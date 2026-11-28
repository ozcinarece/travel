// #550: web davet girişinden (`src/davet-web`) tam uygulamaya geçiş adresi. Davet girişi yalnız /r/{token} ve
// /r/g/{token}'ı bilir; başka bir yola gidilince (ör. `router.replace('/seyahat/[id]/(sekmeler)/gezi')`) sayfa o adresle
// yeniden yüklenir ve tam uygulama açılır. Rota grupları ("(sekmeler)") adreste yer almaz.
// /r/ yolları yeniden yüklenmez (sunucu yine davet girişini verir: sonsuz döngü olurdu).

type Parametreler = Record<string, string | string[] | undefined>;

export function tamUygulamaAdresi(yol: string, parametreler: Parametreler = {}): string | null {
  if (!yol.startsWith('/') || yol.startsWith('//')) return null;
  let cozuk: string;
  try {
    cozuk = decodeURIComponent(yol);
  } catch {
    // Bozuk `%` dizisi: yeniden yüklenecek güvenilir bir adres yok.
    return null;
  }
  const temiz =
    cozuk
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

/** Davet sayfasına derlemede yazılan meta: tam uygulamanın giriş JS'i (scripts/web-davet-girisi.mjs). */
export const UYGULAMA_JS_META = 'tripmate-uygulama-js';

/**
 * #550: davet özeti çizildikten sonra tam uygulamanın giriş JS'ini boşta önden indirir (`<link rel="prefetch">`, bir kez).
 * Giriş, seyahat ya da ana sayfaya geçişteki tam yeniden yükleme paketi beklemesin. Meta yoksa (ör. geliştirme sunucusu)
 * hiçbir şey yapmaz.
 */
export function uygulamayiOnYukle(belge: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!belge) return false;
  const adres = belge.querySelector(`meta[name="${UYGULAMA_JS_META}"]`)?.getAttribute('content');
  if (!adres || !adres.startsWith('/') || adres.startsWith('//')) return false;
  if (belge.querySelector(`link[rel="prefetch"][href="${adres}"]`)) return false;
  const bag = belge.createElement('link');
  bag.rel = 'prefetch';
  bag.as = 'script';
  bag.href = adres;
  belge.head.appendChild(bag);
  return true;
}
