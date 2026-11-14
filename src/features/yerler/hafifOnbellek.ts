// #172 KK1–KK3: places-light istemci önbelleği — kimlik başına, alan grubu başına (yalnız bellekte; PRD §7 gereği ad, puan,
// saat ve fotoğraf cihaza ya da DB'ye yazılmaz). Ekranlar istediği kimlikleri ve alan gruplarını söyler; önbellek yalnız
// eksik olanları ister. Aynı anda (aynı tur) gelen istekler tek partide birleşir: bir ekran hem adları hem fotoğrafları
// isterse o kimlik için tek Google isteği (foto maskesi) gider.
import type { HafifYer } from './api';

/** Temel alanlar (ad, konum, birincil tip, saat dilimi) her seviyede gelir; gruplar bunun üstüne eklenir. */
export type AlanGrubu = 'puan' | 'saat' | 'foto';

/**
 * Sunucu seviyeleri (places-light maskeleri): pro = temel (Pro SKU, #172 KK3) · hafif = + puan / şu an açık (Enterprise) ·
 * saatli = + haftalık açılış (Enterprise) · saatliFoto = saatli + fotoğraf · proFoto = temel + fotoğraf · foto = hafif +
 * fotoğraf.
 */
export type Seviye = 'pro' | 'hafif' | 'saatli' | 'saatliFoto' | 'proFoto' | 'foto';

const SEVIYE_GRUPLARI: Record<Seviye, AlanGrubu[]> = {
  pro: [],
  hafif: ['puan'],
  saatli: ['puan', 'saat'],
  saatliFoto: ['puan', 'saat', 'foto'],
  proFoto: ['foto'],
  foto: ['puan', 'foto'],
};

/** places-light: istek başına en çok 25 kimlik; fotoğraflı istekte en çok 12. */
const PARCA = (s: Seviye) => (s === 'foto' || s === 'proFoto' || s === 'saatliFoto' ? 12 : 25);

/** İstemci önbelleği ömrü (PRD §7: 24 sa); "şu an açık" gibi alanlar grubuyla birlikte eskir. */
export const HAFIF_OMUR_MS = 24 * 60 * 60 * 1000;

/**
 * Eksik gruplar için en ucuz tek seviye (temel her seviyede gelir). Kayıt yoksa ve grup gerekmiyorsa yalnız temel (pro);
 * saat ve fotoğraf birlikte eksikse tek istek (saatliFoto).
 */
export function seviyeler(eksik: ReadonlySet<AlanGrubu>, kayitVar: boolean): Seviye[] {
  if (eksik.size === 0) return kayitVar ? [] : ['pro'];
  if (eksik.has('saat')) return [eksik.has('foto') ? 'saatliFoto' : 'saatli'];
  if (eksik.has('foto')) return [eksik.has('puan') ? 'foto' : 'proFoto'];
  return ['hafif'];
}

type Kayit = { yer: HafifYer; /** grup → yazıldığı an; 'temel' her yazımda. */ zaman: Map<AlanGrubu | 'temel', number> };
type Is = { ids: string[]; gerek: AlanGrubu[]; coz: () => void; red: (e: unknown) => void };

/** Bir seviyenin cevabından yalnız o seviyenin getirdiği alanlar alınır (Pro cevabındaki boş puan, eldeki puanı silmez). */
function birlestir(eski: HafifYer | undefined, yeni: HafifYer, gruplar: AlanGrubu[]): HafifYer {
  const yer: HafifYer = eski
    ? { ...eski, place_id: yeni.place_id, ad: yeni.ad, lat: yeni.lat, lng: yeni.lng, primary_type: yeni.primary_type, tz: yeni.tz }
    : { ...yeni, puan: null, puan_sayisi: null, acik: null, periyotlar: undefined, foto_uri: undefined };
  if (gruplar.includes('puan')) Object.assign(yer, { puan: yeni.puan, puan_sayisi: yeni.puan_sayisi, acik: yeni.acik });
  if (gruplar.includes('saat')) yer.periyotlar = yeni.periyotlar;
  if (gruplar.includes('foto')) yer.foto_uri = yeni.foto_uri ?? null;
  return yer;
}

export class HafifOnbellek {
  private kayitlar = new Map<string, Kayit>();
  /** Uçuştaki istekler (kimlik → o kimliği getiren isteklerin bitişi): aynı kimlik ikinci kez istenmez. */
  private ucustaki = new Map<string, Promise<unknown>>();
  private kuyruk: Is[] = [];
  private zamanlayici: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly getir: (ids: string[], seviye: Seviye) => Promise<HafifYer[]>,
    private readonly simdi: () => number = () => Date.now(),
  ) {}

  /** Geçerli (ömrü dolmamış) kayıt; `gerek` gruplarının hepsi varsa. */
  oku(id: string, gerek: AlanGrubu[] = []): HafifYer | undefined {
    const k = this.kayitlar.get(id);
    if (!k || !this.taze(k, 'temel')) return undefined;
    return gerek.every((g) => this.taze(k, g)) ? k.yer : undefined;
  }

  /** Tüm kayıtları atar (oturum değişince ya da testte başka bir cihazı taklit ederken). */
  temizle() {
    this.kayitlar.clear();
  }

  /** Dışarıdan gelen cevabı (ör. otomatik tamamlama seçimi, pin paneli) önbelleğe yazar. */
  yaz(yerler: HafifYer[], seviye: Seviye, idler?: string[]) {
    const gruplar = SEVIYE_GRUPLARI[seviye];
    const an = this.simdi();
    yerler.forEach((y, i) => {
      if (!y) return;
      for (const id of new Set([idler?.[i] ?? y.place_id, y.place_id])) {
        const eski = this.kayitlar.get(id);
        const gecerliEski = eski && this.taze(eski, 'temel') ? eski : undefined;
        const zaman = new Map(gecerliEski?.zaman ?? []);
        zaman.set('temel', an);
        for (const g of gruplar) zaman.set(g, an);
        this.kayitlar.set(id, { yer: birlestir(gecerliEski?.yer, y, gruplar), zaman });
      }
    });
  }

  /**
   * Kimliklerin `gerek` gruplarıyla verisi: eldekiler istenmez, eksikler en ucuz seviyeyle istenir. Aynı turdaki çağrılar
   * birleşir. Dönen kayıt kimlikle anahtarlıdır; alınamayan kimlik yer almaz.
   */
  getirHepsi(ids: string[], gerek: AlanGrubu[] = []): Promise<Record<string, HafifYer>> {
    const tekil = [...new Set(ids.filter((x) => typeof x === 'string' && x.length > 0))];
    if (tekil.length === 0) return Promise.resolve({});
    return new Promise<void>((coz, red) => {
      this.kuyruk.push({ ids: tekil, gerek, coz, red });
      if (!this.zamanlayici) this.zamanlayici = setTimeout(() => void this.bosalt(), 0);
    }).then(() => {
      const sonuc: Record<string, HafifYer> = {};
      for (const id of tekil) {
        const y = this.oku(id);
        if (y) sonuc[id] = y;
      }
      return sonuc;
    });
  }

  private taze(k: Kayit, g: AlanGrubu | 'temel') {
    const z = k.zaman.get(g);
    return z !== undefined && this.simdi() - z < HAFIF_OMUR_MS;
  }

  private eksik(id: string, gerek: Iterable<AlanGrubu>): { eksik: Set<AlanGrubu>; kayitVar: boolean } {
    const k = this.kayitlar.get(id);
    const kayitVar = !!k && this.taze(k, 'temel');
    const eksik = new Set<AlanGrubu>();
    for (const g of gerek) if (!kayitVar || !this.taze(k!, g)) eksik.add(g);
    return { eksik, kayitVar };
  }

  private async bosalt() {
    this.zamanlayici = null;
    const isler = this.kuyruk.splice(0);
    try {
      await this.isle(isler);
    } catch (e) {
      for (const is of isler) is.red(e);
    }
  }

  private async isle(isler: Is[]) {
    const ihtiyac = new Map<string, Set<AlanGrubu>>();
    for (const is of isler) {
      for (const id of is.ids) {
        const s = ihtiyac.get(id) ?? new Set<AlanGrubu>();
        for (const g of is.gerek) s.add(g);
        ihtiyac.set(id, s);
      }
    }
    // Uçuştaki istek bitince eksik yeniden hesaplanır (aynı kimlik iki kez gitmez); beklerken başka partinin başlattığı
    // istekler de beklenir.
    for (;;) {
      const bekle = [...ihtiyac.keys()].map((id) => this.ucustaki.get(id)).filter((p): p is Promise<unknown> => !!p);
      if (bekle.length === 0) break;
      await Promise.allSettled(bekle);
    }

    const seviyeIdleri = new Map<Seviye, string[]>();
    for (const [id, gerek] of ihtiyac) {
      const { eksik, kayitVar } = this.eksik(id, gerek);
      for (const s of seviyeler(eksik, kayitVar)) seviyeIdleri.set(s, [...(seviyeIdleri.get(s) ?? []), id]);
    }
    const kimlikSozleri = new Map<string, Promise<void>[]>();
    for (const [seviye, idler] of seviyeIdleri) {
      const boy = PARCA(seviye);
      for (let i = 0; i < idler.length; i += boy) {
        const parca = idler.slice(i, i + boy);
        const soz = this.getir(parca, seviye).then((yerler) => this.yaz(yerler, seviye, parca));
        for (const id of parca) kimlikSozleri.set(id, [...(kimlikSozleri.get(id) ?? []), soz]);
      }
    }
    const kimlikBitisi = new Map<string, Promise<void>>();
    for (const [id, sozler] of kimlikSozleri) {
      const bitis = Promise.all(sozler).then(() => undefined);
      kimlikBitisi.set(id, bitis);
      this.ucustaki.set(id, bitis);
      bitis
        .catch(() => undefined)
        .finally(() => {
          if (this.ucustaki.get(id) === bitis) this.ucustaki.delete(id);
        });
    }
    for (const is of isler) {
      Promise.all(is.ids.map((id) => kimlikBitisi.get(id) ?? Promise.resolve())).then(
        () => is.coz(),
        (e) => is.red(e),
      );
    }
  }
}
