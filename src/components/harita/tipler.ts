export type Konum = { lat: number; lng: number };

export type HaritaPini = {
  id: string;
  konum: Konum;
  renk: string;
  /** Pin üstündeki etiket: durak sırası ya da "?" (güne atanmamış); öneri pininde mekan adı. */
  etiket?: string;
  /** durak: numaralı yuvarlak · oneri: beyaz hap "+ ad" (3.4 KK5) · otel: ev simgesi · varsayılan: standart iğne. */
  tur?: 'durak' | 'oneri' | 'otel';
  surukle?: boolean;
};

export type HaritaDairesi = {
  id: string;
  merkez: Konum;
  yaricapM: number;
  renk: string;
};

export type HaritaProps = {
  merkez: Konum;
  /** Web'deki Google zoom seviyesiyle aynı ölçek. */
  zoom?: number;
  pinler?: HaritaPini[];
  daireler?: HaritaDairesi[];
  onPinBas?: (id: string) => void;
  onPinSuruklendi?: (id: string, konum: Konum) => void;
};
