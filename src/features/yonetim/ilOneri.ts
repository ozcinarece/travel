// #401 KK4: BO › İl önerileri — saf kurallar (süzme, sayma, sürükleme sırası, kategori tahmini, başlık satırı). Testli.

/** `public.il_kategori_listesi()` ile aynı sıra. */
export const IL_KATEGORILERI = ['doga', 'yemek', 'tatli_kahve', 'muze', 'tarih', 'carsi', 'aktivite', 'manzara'] as const;
export type IlKategori = (typeof IL_KATEGORILERI)[number];

/** Kanvas BO_IlOnerileri süzgeç sırası: Doğa · Yemek · Tarih · Müze · Çarşı · Aktivite · Tatlı-kahve · Manzara. */
export const SUZGEC_SIRASI: readonly IlKategori[] = ['doga', 'yemek', 'tarih', 'muze', 'carsi', 'aktivite', 'tatli_kahve', 'manzara'];

export type IlOneri = {
  id: string;
  il_slug: string;
  sira: number;
  ad: string;
  kategori: IlKategori;
  amaclar: string[];
  ilce: string | null;
  merkeze_km: number | null;
  neden: string | null;
  place_id: string | null;
  gorunur: boolean;
};

export type IlListesi = {
  il_slug: string;
  il: string;
  yayinda: boolean;
  yayinlandi_at: string | null;
  degistiren: 'rehber' | 'yonetim';
  degisti_at: string;
};

export type Suzgec = { kategori: IlKategori | null; ilce: string | null };

export function suz(liste: readonly IlOneri[], { kategori, ilce }: Suzgec): IlOneri[] {
  return liste.filter((o) => (!kategori || o.kategori === kategori) && (!ilce || o.ilce === ilce));
}

/** Süzgeç çipleri: yalnız dolu kategoriler, kanvas sırasıyla; sayılar ilçe süzgecine göre. */
export function kategoriSayilari(liste: readonly IlOneri[], ilce: string | null): { kategori: IlKategori; sayi: number }[] {
  const say = new Map<IlKategori, number>();
  for (const o of suz(liste, { kategori: null, ilce })) say.set(o.kategori, (say.get(o.kategori) ?? 0) + 1);
  return SUZGEC_SIRASI.filter((k) => say.has(k)).map((k) => ({ kategori: k, sayi: say.get(k)! }));
}

/** İlçe süzgecinin seçenekleri (Türkçe alfabe sırası, tekrarsız). */
export function ilceler(liste: readonly IlOneri[]): string[] {
  return [...new Set(liste.map((o) => o.ilce).filter((i): i is string => !!i))].sort((a, b) => a.localeCompare(b, 'tr'));
}

/**
 * Sürükle-bırak: görünen (süzülmüş) listede `kaynak` satırı `hedef` satırının yerine taşınır. Süzülmüş listede taşınan yer,
 * bütün listede hedef satırın önüne (aşağı taşımada arkasına) girer; diğerlerinin sırası değişmez. Sonuç bütün listenin
 * yeni id sırası (`il_oneri_sirala` girdisi); değişiklik yoksa null.
 */
export function tasi(tum: readonly IlOneri[], gorunen: readonly IlOneri[], kaynak: number, hedef: number): string[] | null {
  const k = gorunen[kaynak];
  const h = gorunen[hedef];
  if (!k || !h || k.id === h.id) return null;
  const sirali = [...tum].sort((a, b) => a.sira - b.sira);
  const kalan = sirali.filter((o) => o.id !== k.id);
  const hi = kalan.findIndex((o) => o.id === h.id);
  const asagi = k.sira < h.sira;
  kalan.splice(asagi ? hi + 1 : hi, 0, k);
  return kalan.map((o) => o.id);
}

/** Silmeden sonra kalanların sırası (boşluk kapanır). */
export function silindiSirasi(tum: readonly IlOneri[], id: string): string[] {
  return [...tum].sort((a, b) => a.sira - b.sira).filter((o) => o.id !== id).map((o) => o.id);
}

/**
 * Yeni yerin kategorisi: seçili kategori süzgeci varsa o; yoksa Google birincil tipinden kaba tahmin (Ece satırda
 * değiştirebilir). Tip tanınmazsa `tarih`.
 */
export function kategoriTahmini(tip: string | null | undefined, secili: IlKategori | null): IlKategori {
  if (secili) return secili;
  const t = tip ?? '';
  if (/museum|art_gallery/.test(t)) return 'muze';
  if (/cafe|coffee|bakery|dessert|ice_cream|confectionery|tea_house|pastry/.test(t)) return 'tatli_kahve';
  if (/restaurant|food|meal|steak|kebab|bar_and_grill/.test(t)) return 'yemek';
  if (/market|shopping|store|bazaar|mall/.test(t)) return 'carsi';
  if (/ski|hiking|adventure|amusement|sports|marina|golf|water_park/.test(t)) return 'aktivite';
  if (/observation|scenic|viewpoint/.test(t)) return 'manzara';
  if (/park|beach|lake|natural|garden|national|nature|campground|island/.test(t)) return 'doga';
  return 'tarih';
}

export function yeniSira(liste: readonly IlOneri[]): number {
  return liste.reduce((m, o) => Math.max(m, o.sira), 0) + 1;
}

/** "bugün 16:25" ya da "18 Kasım 16:25" (İstanbul saati). */
export function zamanEtiketi(iso: string, simdi: Date = new Date(), bugun = 'bugün'): string {
  const tarih = new Date(iso);
  const gun = (d: Date) => d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' });
  const saat = tarih.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
  return `${gun(tarih) === gun(simdi) ? bugun : gun(tarih)} ${saat}`;
}
