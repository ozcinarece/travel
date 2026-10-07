import type { PinIkonu } from '@/lib/pinIkonu';

export type Konum = { lat: number; lng: number };

export type HaritaPini = {
  id: string;
  konum: Konum;
  renk: string;
  /** Daire içindeki metin (durak sırası); aday pininde mekan adı; `etiket` türünde hap metni ("🚶 12 dk"). */
  etiket?: string;
  /** #30: pinin ALTINDA kısa ad etiketi (≤ 18 karakter, kısaltılır); durak/listede/oneri/bos türlerinde. */
  ad?: string;
  /** Daire içindeki kategori ikonu (oneri/bos); yoksa 'pin'. */
  ikon?: PinIkonu;
  /** #53: kategori rengi — oneri/bos dairesinin kenarı ve ikonu. */
  kategoriRenk?: string;
  /** #53: küçük pin (32 px; Program'da yarı açık panel). Varsayılan 40 px. */
  kucuk?: boolean;
  /** #47 B5: `etiket` türü hapta metnin önündeki çizgi ikon. */
  etiketIkon?: 'yurume' | 'taksi';
  /** ★ puan: aday hapında; diğer türlerde ad etiketinin ikinci satırında (seçili ya da zoom ≥ 16, #30). */
  puan?: number | null;
  /** Google yorum sayısı; puanla birlikte "★ 4,8 · 312K". */
  yorumSayisi?: number | null;
  /**
   * durak: gün renginde dolu daire + sıra numarası (3.5) · listede: siyah daire + tik (3.4, listeye eklenmiş) ·
   * oneri: beyaz daire + kategori ikonu (3.4 öneri) · bos: beyaz daire + kategori ikonu (3.5 güne atanmamış) ·
   * otel: siyah kare + ev · aday: beyaz hap "★ puan · ad" (3.3) · etiket: küçük beyaz hap (rota bacağı süresi, #33) ·
   * konum: kullanıcının yeri (mavi nokta, #42) · varsayılan: standart iğne.
   */
  tur?: 'durak' | 'listede' | 'oneri' | 'otel' | 'aday' | 'bos' | 'etiket' | 'konum';
  /** Vurgulu (seçili) pin: büyük daire; aday için siyah hap. #42 KK5: Program'da ayrıca turuncu halka. */
  secili?: boolean;
  /** #42 KK5: seçili güne ait olmayan pinler soluk (0–1; varsayılan 1). */
  opaklik?: number;
  /** #42 KK7: tamamlanan durak — yeşil daire + tik. */
  tamam?: boolean;
  surukle?: boolean;
};

export type HaritaDairesi = {
  id: string;
  merkez: Konum;
  yaricapM: number;
  renk: string;
};

/** Görünür alan: merkez + yarıçap (görünen kenarların kısasının yarısı, metre) + derece aralıkları + yaklaşık Google zoom'u. */
export type HaritaBolgesi = { merkez: Konum; yaricapM: number; latDelta: number; lngDelta: number; zoom: number };

/**
 * #33: rota çizgisi. Gerçek yol (Routes polyline) ya da kuş uçuşu.
 * `kesik`: araç bacağı (🚕) kesikli çizilir. `etiket`: bacağın ortasında küçük hap ("🚶 12 dk"); çakışırsa gizlenir.
 */
export type HaritaCizgisi = {
  id: string;
  noktalar: Konum[];
  renk: string;
  /** 0–1; seçili gün 1, diğerleri 0,3. */
  opaklik?: number;
  kesik?: boolean;
  etiket?: string;
  /** #47 B5: bacak hapında ikon (emoji yerine). */
  etiketIkon?: 'yurume' | 'taksi';
};

/** Kamerayı programla taşıma isteği; `sayac` her değişimde yeni animasyon (aynı konuma yeniden gidebilmek için). */
export type HaritaOdagi = { konum: Konum; zoom: number; sayac: number };

export type HaritaProps = {
  merkez: Konum;
  /** Web'deki Google zoom seviyesiyle aynı ölçek. */
  zoom?: number;
  pinler?: HaritaPini[];
  daireler?: HaritaDairesi[];
  cizgiler?: HaritaCizgisi[];
  odak?: HaritaOdagi;
  onPinBas?: (id: string) => void;
  /** Pin dışında haritaya dokunma (#29: önizleme kartını kapatır). */
  onHaritaBas?: () => void;
  onPinSuruklendi?: (id: string, konum: Konum) => void;
  /** Kullanıcı ya da animasyon durduğunda görünür alan (#17: "Bu bölgede ara" için). */
  onBolgeDegisti?: (bolge: HaritaBolgesi) => void;
  /** #47 A1: alt paneli kadar harita dolgusu (Google logosu panelin üstünde kalır). */
  altBosluk?: number;
};
