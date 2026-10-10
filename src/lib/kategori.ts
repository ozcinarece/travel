// Google birincil tip → kategori etiketi ve varsayılan kalınacak süre (PRD §6).

/** PRD §6: dakika. Listede olmayan tip 45. */
const VARSAYILAN_DAKIKA: Record<string, number> = {
  museum: 90,
  art_gallery: 60,
  tourist_attraction: 60,
  historical_landmark: 45,
  church: 30,
  place_of_worship: 30,
  park: 45,
  viewpoint: 20,
  scenic_point: 20,
  restaurant: 75,
  // #83: kafe / kahveci 30 dk (45 uzun geliyordu).
  cafe: 30,
  coffee_shop: 30,
  bar: 90,
  bakery: 20,
  shopping_mall: 90,
  market: 45,
  zoo: 120,
  aquarium: 120,
  amusement_park: 240,
};

export function varsayilanDakika(primaryType: string | null | undefined): number {
  return (primaryType && VARSAYILAN_DAKIKA[primaryType]) || 45;
}

/** Ekran etiketi; bilinmeyen tip alt çizgileri boşluğa çevirir. v1 Türkçe. */
const ETIKET: Record<string, string> = {
  museum: 'Müze',
  art_gallery: 'Galeri',
  tourist_attraction: 'Gezilecek yer',
  historical_landmark: 'Tarihi yer',
  historical_place: 'Tarihi yer',
  monument: 'Anıt',
  church: 'Kilise',
  mosque: 'Cami',
  synagogue: 'Sinagog',
  place_of_worship: 'İbadet yeri',
  park: 'Park',
  garden: 'Bahçe',
  viewpoint: 'Manzara',
  scenic_point: 'Manzara',
  observation_deck: 'Seyir terası',
  restaurant: 'Restoran',
  italian_restaurant: 'İtalyan restoranı',
  pizza_restaurant: 'Pizzacı',
  cafe: 'Kafe',
  coffee_shop: 'Kahveci',
  bar: 'Bar',
  bakery: 'Fırın',
  ice_cream_shop: 'Dondurmacı',
  shopping_mall: 'AVM',
  market: 'Pazar',
  store: 'Mağaza',
  zoo: 'Hayvanat bahçesi',
  aquarium: 'Akvaryum',
  amusement_park: 'Lunapark',
  plaza: 'Meydan',
  neighborhood: 'Mahalle',
  lodging: 'Konaklama',
  hotel: 'Otel',
};

export function kategoriEtiketi(primaryType: string | null | undefined): string {
  if (!primaryType) return 'Mekan';
  return ETIKET[primaryType] ?? primaryType.replace(/_/g, ' ');
}

/** "1,25 sa" / "45 dk" (kanvas biçimi). */
export function sureMetni(dakika: number): string {
  // #51: ondalık saat yok — "X sa Y dk" / "X sa" / "Y dk".
  const d = Math.max(0, Math.round(dakika));
  if (d < 60) return `${d} dk`;
  const sa = Math.floor(d / 60);
  const kalan = d % 60;
  return kalan ? `${sa} sa ${kalan} dk` : `${sa} sa`;
}
