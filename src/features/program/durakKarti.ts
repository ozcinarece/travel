// #99 (kanvas PlaceSwipe15) → #140 (kanvas 10 · 12 · 12b): kaydırmalı durak kartı — saf veri ve kamera hesabı (test edilir).
import { zoomDelta } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';
import type { HafifYer } from '@/features/yerler/api';
import { kategoriEtiketi } from '@/lib/kategori';
import { yorumKisa } from '@/lib/pinIkonu';
import type { Durak, Mekan } from '@/lib/tipler';
import { t } from '@/i18n';
import type { DurakDurumu, ProgramSatiri } from '@/schedule/program';
import { yuruyusDk } from '@/schedule/program';
import { dakikaSaat } from '@/schedule/tempo';

/**
 * #140 (kanvas 10 · 12): kart ekran genişliği − 2 × 12 px; kartlar arası 8 px. Varsayılan ölçüler testler ve kamera payı
 * için (390 px ekran); bileşen gerçek genişliği `kartAdimi(ekranGenislik)` ile hesaplar.
 */
export const KART_KENAR = 12;
export const KART_ARALIK = 8;
export const KART_GENISLIK = 390 - 2 * KART_KENAR;
export const KART_ADIM = KART_GENISLIK + KART_ARALIK;
export const kartGenisligi = (ekranGenislik: number) => Math.min(520, ekranGenislik - 2 * KART_KENAR);
export const kartAdimi = (ekranGenislik: number) => kartGenisligi(ekranGenislik) + KART_ARALIK;
/** Kartın yaklaşık yüksekliği (foto 92 + düğmeler + noktalar ≈ 200; gezi kartı biraz uzun) — kamera kaydırma payı. */
export const KART_YUKSEKLIK = 210;

export type DurakKarti = {
  durakId: string;
  mekanId: string;
  placeId: string;
  konum: Konum;
  /** 1'den başlayan kart sırası ("2 / 3"; atlanan dahil). */
  sira: number;
  /** Pin / liste numarası (atlanmayanlar arasında); atlananda null. */
  numara: number | null;
  ad: string;
  /** "Müze" — kategori etiketi. */
  kategori: string;
  /** Kalış süresi (stops.minutes). */
  dakika: number;
  /** Canlı programdan varış / ayrılış (dakika); atlananda null. */
  varisDk: number | null;
  ayrilisDk: number | null;
  puan: number | null;
  yorum: string | null;
  durum: DurakDurumu | null;
  tamamlandi: boolean;
  /** #140 KK3: geliş — "1. duraktan 12 dk yürüyüş" / "Otelden 6 dk yürüyüş" (seçilen mod glifi); ilk durak otelsizse null. */
  gelis: { metin: string; mod: 'yuruyus' | 'taksi'; dk: number } | null;
  /** #140 KK9: konumla yazılan varış anı (ISO). */
  varildi: string | null;
};

/**
 * KK1: seçili günün durakları (otel dahil değil — oteller durak değildir) kart listesine döner. Kart sırası = gün listesi
 * sırası; saatler canlı programdan (atlanan durakta yok). #140 KK3: geliş satırı önceki atlanmamış durağın numarasıyla.
 */
export function kartListesi(secenek: { gunDurak: Durak[]; mekanIle: Map<string, Mekan>; adlar: Record<string, HafifYer> | undefined; satirlar: ProgramSatiri[] }): DurakKarti[] {
  const { gunDurak, mekanIle, adlar, satirlar } = secenek;
  const satirIle = new Map(satirlar.map((x) => [x.durak.id, x]));
  const kartlar: DurakKarti[] = [];
  let numara = 0;
  let oncekiNumara: number | null = null;
  for (const d of gunDurak) {
    const m = mekanIle.get(d.place_ref);
    if (!m) continue;
    const h = adlar?.[m.place_id];
    const satir = satirIle.get(d.id);
    const atlandi = d.skipped || satir?.durum === 'atlandi';
    const y = !atlandi ? satir?.yuruyus : null;
    const gelis = y
      ? {
          metin: t(oncekiNumara === null ? 'program.kart.gelisOtel' : 'program.kart.gelisDurak', { n: oncekiNumara ?? 0, dk: yuruyusDk(y), mod: t(y.mod === 'taksi' ? 'program.kart.araba' : 'program.kart.yuruyus') }),
          mod: y.mod,
          dk: yuruyusDk(y),
        }
      : null;
    if (!atlandi) numara++;
    kartlar.push({
      durakId: d.id,
      mekanId: m.id,
      placeId: m.place_id,
      konum: { lat: m.lat, lng: m.lng },
      sira: kartlar.length + 1,
      numara: atlandi ? null : numara,
      ad: h?.ad ?? '…',
      kategori: kategoriEtiketi(h?.primary_type ?? m.primary_type),
      dakika: d.minutes,
      varisDk: satir && !atlandi ? satir.varisDk : null,
      ayrilisDk: satir && !atlandi ? satir.ayrilisDk : null,
      puan: h?.puan ?? null,
      yorum: yorumKisa(h?.puan_sayisi),
      durum: satir?.durum ?? null,
      tamamlandi: !!d.completed_at,
      gelis,
      varildi: d.arrived_at ?? null,
    });
    if (!atlandi) oncekiNumara = numara;
  }
  return kartlar;
}

/** "11:03 – 11:48" (atlananda null). */
export function kartSaati(k: Pick<DurakKarti, 'varisDk' | 'ayrilisDk'>): string | null {
  return k.varisDk === null || k.ayrilisDk === null ? null : `${dakikaSaat(k.varisDk)} – ${dakikaSaat(k.ayrilisDk)}`;
}

/** #140 KK7: kartın altındaki "Sonra:" — sıradaki atlanmamış kart; yoksa null. */
export function sonrakiKart(kartlar: DurakKarti[], durakId: string): DurakKarti | null {
  const i = kartlar.findIndex((k) => k.durakId === durakId);
  if (i < 0) return null;
  return kartlar.slice(i + 1).find((k) => k.numara !== null) ?? null;
}

/**
 * #140 KK8: saate göre odak — gezi gününde açılışta öne gelen kart: buradasın / sıradaki durak; yoksa (gün bitti) son
 * kart. Plan gününde ilk kart.
 */
export function odakKarti(kartlar: DurakKarti[], gezi: boolean): DurakKarti | null {
  if (kartlar.length === 0) return null;
  if (!gezi) return kartlar[0];
  return kartlar.find((k) => k.durum === 'buradasin') ?? kartlar.find((k) => k.durum === 'siradaki') ?? kartlar[kartlar.length - 1];
}

/**
 * KK2: kart yerleşince harita pine kayar; pin kartın ÜSTÜNDE kalsın diye kamera merkezi pinin güneyine alınır
 * (kart yüksekliğinin yarısı + alt pay kadar). Ölçek: görünür enlem aralığı = zoomDelta(zoom) ekran yüksekliğine yayılır.
 */
export function kartKamerasi(secenek: { konum: Konum; zoom: number; ekranYukseklik: number; kartYukseklik?: number; altPay?: number }): { konum: Konum; zoom: number } {
  const { konum, zoom, ekranYukseklik, kartYukseklik = KART_YUKSEKLIK, altPay = 14 } = secenek;
  const z = Math.min(17, Math.max(14, zoom));
  const derecePx = zoomDelta(z) / Math.max(1, ekranYukseklik);
  const kaymaPx = (kartYukseklik + altPay) / 2;
  return { konum: { lat: konum.lat - kaymaPx * derecePx, lng: konum.lng }, zoom: z };
}

/** Kaydırma bitince hangi kart yerleşti (ofset → indeks, sınırlar içinde). */
export function kartIndeksi(ofsetX: number, sayi: number, adim = KART_ADIM): number {
  if (sayi <= 0) return 0;
  return Math.min(sayi - 1, Math.max(0, Math.round(ofsetX / adim)));
}
