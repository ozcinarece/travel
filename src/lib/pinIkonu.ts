// #30: Google `primaryType` → pin içi kategori ikonu; yorum sayısı kısaltması.

export type PinIkonu = 'agac' | 'catal' | 'fincan' | 'muze' | 'anit' | 'goz' | 'kare' | 'pin' | 'kamera' | 'ibadet' | 'dag' | 'canta';

/** #53: pin kategorisi — beyaz daire, kategori renginde 2,5 px kenar, içinde kategori ikonu. */
export type PinKategorisi = 'gezilecek' | 'muze' | 'ibadet' | 'yemek' | 'kafe' | 'park' | 'manzara' | 'alisveris';

export const KATEGORI_PIN: Record<PinKategorisi, { renk: string; ikon: PinIkonu }> = {
  gezilecek: { renk: '#3b6fe0', ikon: 'kamera' },
  muze: { renk: '#8a4fd6', ikon: 'muze' },
  ibadet: { renk: '#6b7280', ikon: 'ibadet' },
  yemek: { renk: '#e8590c', ikon: 'catal' },
  kafe: { renk: '#9a5b2e', ikon: 'fincan' },
  park: { renk: '#1f8a4c', ikon: 'agac' },
  manzara: { renk: '#0ea5e9', ikon: 'dag' },
  alisveris: { renk: '#c2185b', ikon: 'canta' },
};

// Sıra önemli: ilk eşleşen kazanır (ör. bakery yemek değil kafe; art_gallery müze).
const KATEGORI_ESLEME: [RegExp, PinKategorisi][] = [
  [/church|mosque|synagogue|place_of_worship|temple|cathedral|basilica|hindu|shrine/, 'ibadet'],
  [/museum|art_gallery|gallery/, 'muze'],
  [/cafe|bakery|coffee|tea_house|dessert|ice_cream|confectionery/, 'kafe'],
  [/restaurant|food|meal|pizza|steak|sushi|diner|bistro|brunch|breakfast|barbecue|seafood|deli|sandwich|bar$|pub|wine_bar/, 'yemek'],
  [/park|garden|national_park|zoo|botanical|beach|hiking/, 'park'],
  [/observation|scenic|viewpoint|lookout/, 'manzara'],
  [/shopping|market|store|shop|mall/, 'alisveris'],
];

/** #53: Google primaryType → kategori; tourist_attraction / landmark / bilinmeyen → gezilecek yer. */
export function pinKategorisi(primaryType: string | null | undefined): PinKategorisi {
  const t = (primaryType ?? '').toLowerCase();
  for (const [desen, k] of KATEGORI_ESLEME) if (desen.test(t)) return k;
  return 'gezilecek';
}

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

/** #53: pin alanları — kategori ikonu ve rengi. */
export function kategoriPini(primaryType: string | null | undefined): { ikon: PinIkonu; kategoriRenk: string } {
  const k = KATEGORI_PIN[pinKategorisi(primaryType)];
  return { ikon: k.ikon, kategoriRenk: k.renk };
}
