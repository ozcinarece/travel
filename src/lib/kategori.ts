// Google birincil tip → kategori etiketi ve varsayılan kalınacak süre (PRD §6).
import { eslesenKategori, konaklamaMi, type PinKategorisi } from './pinIkonu';

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

/**
 * Ekran etiketi. v1 Türkçe. #189 KK4: Nearby'nin Turistik'te döndürebileceği bütün tipler burada; etiketi olmayan tipte ham
 * İngilizce ad değil, kategorinin genel adı gösterilir (kategoriEtiketi).
 */
const ETIKET: Record<string, string> = {
  museum: 'Müze',
  art_museum: 'Müze',
  history_museum: 'Müze',
  art_gallery: 'Galeri',
  tourist_attraction: 'Gezilecek yer',
  historical_landmark: 'Tarihî yer',
  historical_place: 'Tarihî yer',
  cultural_landmark: 'Kültürel yer',
  monument: 'Anıt',
  sculpture: 'Heykel',
  castle: 'Kale',
  fountain: 'Çeşme',
  church: 'Kilise',
  mosque: 'Cami',
  synagogue: 'Sinagog',
  hindu_temple: 'Tapınak',
  place_of_worship: 'İbadet yeri',
  park: 'Park',
  garden: 'Bahçe',
  viewpoint: 'Manzara',
  scenic_point: 'Manzara',
  observation_deck: 'Manzara',
  botanical_garden: 'Botanik bahçesi',
  national_park: 'Milli park',
  city_park: 'Park',
  hiking_area: 'Yürüyüş alanı',
  beach: 'Plaj',
  restaurant: 'Restoran',
  turkish_restaurant: 'Türk restoranı',
  italian_restaurant: 'İtalyan restoranı',
  pizza_restaurant: 'Pizzacı',
  seafood_restaurant: 'Balık restoranı',
  fast_food_restaurant: 'Fast food',
  steak_house: 'Et lokantası',
  kebab_shop: 'Kebapçı',
  meal_takeaway: 'Paket yemek',
  cafe: 'Kafe',
  coffee_shop: 'Kahveci',
  tea_house: 'Çay evi',
  bar: 'Bar',
  bakery: 'Fırın',
  dessert_shop: 'Tatlıcı',
  confectionery: 'Şekerci',
  ice_cream_shop: 'Dondurmacı',
  shopping_mall: 'AVM',
  market: 'Pazar',
  farmers_market: 'Pazar',
  department_store: 'Mağaza',
  store: 'Mağaza',
  zoo: 'Hayvanat bahçesi',
  aquarium: 'Akvaryum',
  amusement_park: 'Lunapark',
  plaza: 'Meydan',
  neighborhood: 'Mahalle',
  lodging: 'Konaklama',
  hotel: 'Otel',
};

/** #189 KK4: etiketsiz tipte kategorinin genel adı (Keşfet çipinin adı gibi). */
const GENEL_AD: Record<PinKategorisi, string> = {
  gezilecek: 'Gezilecek yer',
  muze: 'Müze',
  ibadet: 'İbadet yeri',
  yemek: 'Yemek',
  kafe: 'Kafe',
  park: 'Park',
  manzara: 'Manzara',
  alisveris: 'Alışveriş',
};
/** Eşleme tablosunda olmayan ama gezilecek yer olduğu belli tipler (ör. ileride eklenecek tarihî tipler). */
const GEZILECEK_DESENI = /attraction|landmark|historic|monument|heritage|ruins|archaeolog|castle|palace|fortress|memorial|sculpture|cultural/;

export function kategoriEtiketi(primaryType: string | null | undefined): string {
  if (!primaryType) return 'Mekan';
  const etiket = ETIKET[primaryType];
  if (etiket) return etiket;
  if (konaklamaMi(primaryType)) return 'Konaklama';
  const k = eslesenKategori(primaryType);
  if (k) return GENEL_AD[k];
  return GEZILECEK_DESENI.test(primaryType) ? GENEL_AD.gezilecek : 'Mekan';
}

/** Türkçe etiketi olan tipte etiket, yoksa null (ham İngilizce gösterilmesin diye; #156 rehber kartı). */
export function bilinenKategori(primaryType: string | null | undefined): string | null {
  return (primaryType && ETIKET[primaryType]) || null;
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
