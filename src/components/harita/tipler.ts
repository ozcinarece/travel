export type Konum = { lat: number; lng: number };

export type HaritaPini = {
  id: string;
  konum: Konum;
  renk: string;
  /** Pin üstündeki etiket: durak sırası ya da "?" (güne atanmamış). */
  etiket?: string;
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
