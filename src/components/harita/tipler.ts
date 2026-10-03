export type Konum = { lat: number; lng: number };

export type HaritaPini = {
  id: string;
  konum: Konum;
  renk: string;
  /** Daire içindeki etiket: durak sırası ya da "?" (güne atanmamış); aday pininde mekan adı. */
  etiket?: string;
  /** #30: pinin ALTINDA küçük ad etiketi (≤ 18 karakter, kısaltılır); durak/oneri/bos türlerinde. */
  ad?: string;
  /** Aday pininde ★ puan (yoksa yalnız ad). */
  puan?: number | null;
  /**
   * durak: numaralı yuvarlak · oneri: beyaz hap "+ ad" (3.4 KK5) · otel: ev simgesi ·
   * aday: beyaz hap "★ puan · ad" (3.3 haritadan otel seçme, #17) · bos: beyaz daire "?" (3.5 güne atanmamış) ·
   * varsayılan: standart iğne.
   */
  tur?: 'durak' | 'oneri' | 'otel' | 'aday' | 'bos';
  /** Vurgulu aday (seçili kart): siyah hap. */
  secili?: boolean;
  surukle?: boolean;
};

export type HaritaDairesi = {
  id: string;
  merkez: Konum;
  yaricapM: number;
  renk: string;
};

/** Görünür alan: merkez + yarıçap (görünen kenarların kısasının yarısı, metre) + derece aralıkları (etiket çakışması için). */
export type HaritaBolgesi = { merkez: Konum; yaricapM: number; latDelta: number; lngDelta: number };

/** #33: gün rotası çizgisi (düz hat, kuş uçuşu). */
export type HaritaCizgisi = { id: string; noktalar: Konum[]; renk: string; /** 0–1; seçili gün 1, diğerleri 0,3. */ opaklik?: number };

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
  onPinSuruklendi?: (id: string, konum: Konum) => void;
  /** Kullanıcı ya da animasyon durduğunda görünür alan (#17: "Bu bölgede ara" için). */
  onBolgeDegisti?: (bolge: HaritaBolgesi) => void;
};
