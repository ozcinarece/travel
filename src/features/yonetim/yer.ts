// #108 yer editörü — saf kurallar: alanlar, place_id denetimi, öne çıkan sırası. Testli. (Rehber yazısı: #156 bloklar.ts)

/** Editörde tutulan yer alanları (Genel + Rehber). */
export type YerAlanlari = {
  ad: string;
  place_id: string | null;
  kategori: string | null;
  sehir_id: string;
  one_cikan_sira: number | null;
  kapak_url: string | null;
  rehber_md: string | null;
  yayin: boolean;
  lat: number;
  lng: number;
};

/** KK7: Google place_id biçimi (DB kısıtıyla aynı). */
export function gecerliPlaceId(id: string | null | undefined): boolean {
  return !!id && /^[A-Za-z0-9_-]{10,255}$/.test(id);
}

/** Öne çıkan sırası girdisi: boş = öne çıkmıyor; 1 ve üstü tam sayı. */
export function oneCikanSirasi(girdi: string): number | null | 'gecersiz' {
  const t = girdi.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 ? n : 'gecersiz';
}

/** Türkçe binlik ayraçlı sayı: 1240 → "1.240". */
export function binlik(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
