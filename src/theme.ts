// #136 Tripmate kimliği (kanvas "Marka kimliği" → Temel): Gece ana renk, Mandalina vurgu, Lacivert metin, Buz yüzey;
// başlık Archivo (genişlik 115, kalınlık 850), metin Figtree. Jetonlar: docs/06-marka.md. Hex'ler KÜÇÜK harf (pin PNG anahtarları).

export const renk = {
  zemin: '#ffffff',
  /** Lacivert — metin. */
  metin: '#0e1430',
  /** Gri mavi — ikincil metin, açıklama. */
  ikincil: '#4a5274',
  /** Yer tutucu, pasif sekme ikonu. */
  soluk: '#6a7290',
  /** Buz — yüzey: arama, ikincil düğme, alıntı, kart zemini. */
  yuzey: '#eef2ff',
  /** Çizgi — kenar ve ayraç. */
  ayrac: '#dde3f6',
  /** Gece — ana renk: birincil düğme, koyu kart, seçili sekme/çip, pin kenarı. */
  ana: '#152a6b',
  /** Koyu kart üstünde ikincil metin ve açık avatar. */
  anaAcik: '#c9d2f2',
  /** Mandalina — vurgu: Yeni düğmesi, rozet, sıradaki durak, Listeye ekle. Üstünde yazı Lacivert. */
  vurgu: '#ff7a1a',
  uyari: '#d93a2b',
  uyariZemin: '#fbe7e4',
  /** Başarı: Listede ✓ zemini / ikon metni. */
  basari: '#16a06e',
  basariMetin: '#0e7a52',
  basariZemin: '#e3f5ee',
  /** Harita arkasındaki ekran zemini (kanvas 3c). */
  haritaZemin: '#f1f3f8',
} as const;

// Gün renkleri (kanvas Temel · harita dili): 1 mavi · 2 sarı (üstünde Lacivert yazı) · 3 yeşil · 4 mor; 5–6 ek, 7. günden sonra döner.
/** Kişi yüzleri (avatar zemini) sırası: Mandalina, Gece, Gece açık. */
export const yuzRenkleri = [renk.vurgu, renk.ana, renk.anaAcik] as const;

export const gunRenkleri = ['#2c64f5', '#f5a524', '#16a06e', '#7b4fe0', '#e0457b', '#0ea5e9'] as const;

export function gunRengi(gunIndex: number): string {
  return gunRenkleri[(gunIndex - 1) % gunRenkleri.length];
}

/** Gün rengi üstündeki yazı: sarı (2. gün) Lacivert, diğerleri beyaz. */
export function gunUstuMetin(gunRengiHex: string): string {
  return gunRengiHex.toLowerCase() === '#f5a524' ? renk.metin : renk.zemin;
}

/** Rota tonu = gün renginin ~%20 koyusu (pinler gün renginde kalır). */
export const rotaRenkleri = ['#2350c4', '#c4841d', '#128058', '#623fb3', '#b33762', '#0b84ba'] as const;

export function rotaRengi(gunIndex: number): string {
  return rotaRenkleri[(gunIndex - 1) % rotaRenkleri.length];
}

/** Figtree: metin; Archivo SemiExpanded 850: başlıklar (`baslik`). Eski adlar (normal · orta · yari · kalin · ekstra) korunur. */
export const yazi = {
  normal: 'Figtree_400Regular',
  orta: 'Figtree_500Medium',
  yari: 'Figtree_600SemiBold',
  kalin: 'Figtree_700Bold',
  ekstra: 'Figtree_800ExtraBold',
  /** Archivo wdth 115 / wght 850 — ekran, kart ve bölüm başlıkları (assets/fonts, statik örnek). */
  baslik: 'ArchivoSemiExpanded_850',
} as const;

/** Yazı ölçeği (px): başlıklar Archivo, gerisi Figtree; etiket büyük harf 800. */
export const olcek = { ekran: 32, kart: 24, bolum: 20, metin: 16, alt: 14, etiket: 12 } as const;

/** Köşeler: düğme/giriş 14 · kart 22 · rozet 8 · çip tam yuvarlak. */
export const kose = { dugme: 14, kart: 22, rozet: 8, cip: 999, alan: 12 } as const;

/** Gölge yok; yalnız harita üstündeki kart / panel / çekmece hafif gölgeli. */
export const haritaGolgesi = {
  shadowColor: renk.metin,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 18,
  elevation: 6,
} as const;

export const bosluk = { kenar: 20, arasi: 12 } as const;

// PRD §11: dokunma hedefleri ≥ 44 pt.
export const minDokunma = 44;
