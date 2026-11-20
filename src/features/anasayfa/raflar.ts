// #406 (UX önerileri kanvası, `Ana_v6_Kesfet`): raflı Keşfet'in saf kuralları. Raflar ve banner BO'nun yayınladığı ana sayfa
// bölümlerinden (`ana_sayfa_gorunen`, tür `raf` / `banner`) gelir; geziler Keşfet akışının kendi içerik tablolarımızdan.
// Google isteği yok.
import { AKIS_AMACLARI, type Amac } from '@/features/icerik/amaclar';
import { kapakAtfiOku, type KapakAtfi } from '@/features/icerik/kapakAtfi';
import { t } from '@/i18n';
import type { AnaSayfaBolumu, BannerHedefi, RafTuru } from '@/lib/anaSayfa';
import type { Gezi, Sehir } from '@/lib/tipler';

/** KK3: bundan az gezisi olan raf gösterilmez. */
export const RAF_EN_AZ = 3;
/** Rafta en çok bu kadar kart kayar; fazlası "Tümü"de. */
export const RAF_EN_COK = 10;

type RafGezisi = Pick<Gezi, 'id' | 'sehir_id' | 'amaclar'>;

export type Raf<G> = {
  /** Yayındaki rafta bölüm kimliği; yayında raf yokken kurulan amaç rafında `amac:{amac}`. */
  id: string;
  baslik: string;
  tur: RafTuru;
  /** Raftaki bütün geziler (kartlar ilk `RAF_EN_COK`, "Tümü" hepsi). */
  geziler: G[];
};

type RafBolumu = Pick<AnaSayfaBolumu, 'id' | 'tur' | 'baslik' | 'icerik'>;

/** KK3: rafın gezileri, verilen sırayla. Amaç: amaç etiketi; şehir: şehrin gezileri; elle: seçilen sırayla, yayında olanlar. */
export function rafGezileri<G extends RafGezisi>(icerik: AnaSayfaBolumu['icerik'], geziler: readonly G[]): G[] {
  switch (icerik.raf_turu) {
    case 'amac':
      return icerik.amac ? geziler.filter((g) => g.amaclar?.includes(icerik.amac!)) : [];
    case 'sehir':
      return icerik.sehir_id ? geziler.filter((g) => g.sehir_id === icerik.sehir_id) : [];
    case 'elle': {
      const harita = new Map(geziler.map((g) => [g.id, g]));
      return [...new Set(icerik.gezi_idler ?? [])].map((id) => harita.get(id)).filter((g): g is G => !!g);
    }
    // KK5: kullanıcı gezileri 26 Kasım paylaşımından sonra.
    default:
      return [];
  }
}

/**
 * KK3: Keşfet'in rafları. Yayında raf varsa onlar, sırayla; 3'ten az gezisi olan raf düşer. Yayında uygun raf kalmazsa
 * (hiç raf yok, hepsi 3'ten az gezili ya da yalnız henüz boş `arkadaslardan` rafı var) ya da bölümler okunamadıysa amaç
 * rafları kurulur (sabit amaç sırasıyla, aynı 3 kuralı). O da boş kalırsa ve gezi varsa tek raf: bütün hazır geziler
 * (#428 inceleme 1: Keşfet boş kalmasın).
 */
export function kesfetRaflari<G extends RafGezisi>(bolumler: readonly RafBolumu[] | null | undefined, geziler: readonly G[]): Raf<G>[] {
  const yayindakiler = (bolumler ?? [])
    .filter((b) => b.tur === 'raf')
    .map((b) => ({ id: b.id, baslik: b.baslik, tur: b.icerik.raf_turu ?? 'elle', geziler: rafGezileri(b.icerik, geziler) }))
    .filter((r) => r.geziler.length >= RAF_EN_AZ);
  if (yayindakiler.length > 0) return yayindakiler;
  const amacRaflari = AKIS_AMACLARI.map((a) => ({ id: `amac:${a}`, baslik: amacRafBasligi(a), tur: 'amac' as const, geziler: rafGezileri({ raf_turu: 'amac', amac: a }, geziler) })).filter(
    (r) => r.geziler.length >= RAF_EN_AZ,
  );
  if (amacRaflari.length > 0 || geziler.length === 0) return amacRaflari;
  return [{ id: 'hepsi', baslik: t('anasayfa.v6.hazirGeziler'), tur: 'elle', geziler: [...geziler] }];
}

export function amacRafBasligi(a: Amac): string {
  return t(`anasayfa.v6.amacRafi.${a}`);
}

/** "Tümü" ekranı (`/geziler?raf=…`): aynı kuralla kurulan raflardan biri; bulunmazsa null. */
export function rafBul<G extends RafGezisi>(id: string, bolumler: readonly RafBolumu[] | null | undefined, geziler: readonly G[]): Raf<G> | null {
  return kesfetRaflari(bolumler, geziler).find((r) => r.id === id) ?? null;
}

type BannerGezisi = RafGezisi & Pick<Gezi, 'slug' | 'kapak_url' | 'kapak_atif'>;
type BannerSehri = Pick<Sehir, 'id' | 'kapak_url' | 'kapak_atif'>;

export type Banner = {
  id: string;
  baslik: string;
  ustYazi: string | null;
  /** Ece'nin görseli; yoksa hedefin (gezi ya da şehir) Commons kapağı; o da yoksa null (kanvastaki zemin). */
  kapak: string | null;
  atif: KapakAtfi | null;
  hedef: BannerHedefi;
  /** "N hazır gezi ›". */
  geziSayisi: number;
  /** Gezi hedefinde gezinin adresi. */
  slug: string | null;
};

/**
 * KK2: aynı anda tek banner — yayındaki ilk (sıraca) banner, hedefi çözülebiliyorsa. Hedef yayında değilse (gezi kalkmış,
 * raf 3'ten az gezili ya da şehrin hazır gezisi yok) banner gösterilmez; dokununca boş sayfa açılmasın. Süresi bitmiş banner
 * görünümden zaten düşer (`ana_sayfa_gorunen`).
 */
export function aktifBanner<G extends BannerGezisi>(
  bolumler: readonly RafBolumu[] | null | undefined,
  geziler: readonly G[],
  sehirler: readonly BannerSehri[],
  raflar: readonly Raf<G>[],
): Banner | null {
  const b = (bolumler ?? []).find((x) => x.tur === 'banner' && !!x.icerik.hedef);
  if (!b) return null;
  const hedef = b.icerik.hedef!;
  let sayi = 0;
  let slug: string | null = null;
  let yedekKapak: { kapak_url?: string | null; kapak_atif?: unknown } | null = null;
  if (hedef.tur === 'gezi') {
    const g = geziler.find((x) => x.id === hedef.id);
    if (!g) return null;
    sayi = 1;
    slug = g.slug;
    yedekKapak = g;
  } else if (hedef.tur === 'sehir') {
    sayi = geziler.filter((x) => x.sehir_id === hedef.id).length;
    yedekKapak = sehirler.find((x) => x.id === hedef.id) ?? null;
  } else {
    sayi = raflar.find((r) => r.id === hedef.id)?.geziler.length ?? 0;
  }
  if (sayi === 0) return null;
  const kendi = b.icerik.kapak_url ? { kapak_url: b.icerik.kapak_url, kapak_atif: b.icerik.kapak_atif } : null;
  const kaynak = kendi ?? (yedekKapak?.kapak_url ? yedekKapak : null);
  const ustYazi = b.icerik.ust_yazi?.trim() || null;
  return { id: b.id, baslik: b.baslik, ustYazi, kapak: kaynak?.kapak_url ?? null, atif: kaynak ? kapakAtfiOku(kaynak.kapak_atif) : null, hedef, geziSayisi: sayi, slug };
}

/**
 * KK3 kartın alt satırı: "11 durak · Bursa" (durak günlerden; gün verisi yoksa gezinin sayacı). Şehir rafında yalnız
 * "N durak": başlık zaten şehri söylüyor (#428 inceleme, soru 2).
 */
export function rafKartAltSatiri(
  g: Pick<Gezi, 'mekan_sayisi'> & { gunDuraklari?: readonly number[]; sehirler?: { ad: string } | null },
  rafTuru?: RafTuru,
): string {
  const durak = g.gunDuraklari && g.gunDuraklari.length > 0 ? g.gunDuraklari.reduce((a, b) => a + b, 0) : g.mekan_sayisi;
  const yer = rafTuru === 'sehir' ? null : g.sehirler?.ad;
  return yer ? t('anasayfa.v6.kartAlt', { durak, yer }) : t('anasayfa.v6.kartAltYersiz', { durak });
}
