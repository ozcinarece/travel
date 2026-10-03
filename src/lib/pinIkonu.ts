// #30: Google `primaryType` → pin içi kategori ikonu; yorum sayısı kısaltması.

export type PinIkonu = 'agac' | 'catal' | 'fincan' | 'muze' | 'anit' | 'goz' | 'kare' | 'pin';

const ESLEME: [RegExp, PinIkonu][] = [
  [/park|garden|zoo|botanical|national_park|hiking|beach|campground/, 'agac'],
  [/restaurant|food|meal|pizza|steak|sushi|bakery|diner|bistro|brunch|breakfast|barbecue|seafood|deli|sandwich/, 'catal'],
  [/cafe|coffee|tea_house|dessert|ice_cream|bar$|pub|wine_bar|cocktail/, 'fincan'],
  [/museum|art_gallery|gallery|aquarium|planetarium|cultural|performing_arts|library|visitor_center/, 'muze'],
  [/tourist_attraction|historical|landmark|monument|church|mosque|synagogue|temple|hindu|cathedral|basilica|castle|palace|fountain|plaza|square$|stadium|amusement|opera|theater|theatre|bridge|tower|ruins|archaeolog/, 'anit'],
  [/observation|viewpoint|scenic|lookout|point_of_interest/, 'goz'],
  [/neighborhood|locality|sublocality|administrative_area|postal|political|route|street/, 'kare'],
];

/** Google primaryType → ikon; bilinmeyen/boş → 'pin'. */
export function pinIkonu(primaryType: string | null | undefined): PinIkonu {
  const t = (primaryType ?? '').toLowerCase();
  if (!t) return 'pin';
  for (const [desen, ikon] of ESLEME) if (desen.test(t)) return ikon;
  return 'pin';
}

/** Yorum sayısı kısaltması: 812 → "812", 1234 → "1,2K", 312456 → "312K", 2,1 M. */
export function yorumKisa(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return null;
  if (n < 1000) return String(Math.round(n));
  const birim = n >= 1_000_000 ? ['M', 1_000_000] as const : ['K', 1000] as const;
  const deger = n / birim[1];
  const metin = deger < 10 ? deger.toFixed(1).replace(/\.0$/, '').replace('.', ',') : String(Math.round(deger));
  return `${metin}${birim[0]}`;
}
