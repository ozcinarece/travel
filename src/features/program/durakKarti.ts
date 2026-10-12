// #99 (kanvas PlaceSwipe15): kaydırmalı durak kartı — saf veri ve kamera hesabı (ekrandan bağımsız; test edilir).
import { zoomDelta } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';
import type { HafifYer } from '@/features/yerler/api';
import { kategoriEtiketi } from '@/lib/kategori';
import { yorumKisa } from '@/lib/pinIkonu';
import type { Durak, Mekan } from '@/lib/tipler';
import type { DurakDurumu, ProgramSatiri } from '@/schedule/program';
import { dakikaSaat } from '@/schedule/tempo';

/** Kart genişliği ve kartlar arası boşluk (kanvas: 350 px, 10 px); sayfa adımı = ikisinin toplamı. */
export const KART_GENISLIK = 350;
export const KART_ARALIK = 10;
export const KART_ADIM = KART_GENISLIK + KART_ARALIK;
/** Kartın yaklaşık yüksekliği (foto 100 + metin + düğmeler) + sayfa noktaları — kamera kaydırma payı. */
export const KART_YUKSEKLIK = 100 + 120 + 22;

export type DurakKarti = {
  durakId: string;
  mekanId: string;
  placeId: string;
  konum: Konum;
  /** 1'den başlayan sıra (günün listesindeki yer; atlanan dahil — numaralar listeyle aynı). */
  sira: number;
  ad: string;
  /** "İbadet yeri · 10:00–10:30" — saat satırı program hesabından; yoksa yalnız kategori. */
  altSatir: string;
  puan: number | null;
  yorum: string | null;
  durum: DurakDurumu | null;
  tamamlandi: boolean;
};

/**
 * KK1: seçili günün durakları (otel dahil değil — oteller durak değildir) kart listesine döner. Kart sırası = gün listesi
 * sırası; saat aralığı canlı programdan (atlanan durakta yok).
 */
export function kartListesi(secenek: { gunDurak: Durak[]; mekanIle: Map<string, Mekan>; adlar: Record<string, HafifYer> | undefined; satirlar: ProgramSatiri[] }): DurakKarti[] {
  const { gunDurak, mekanIle, adlar, satirlar } = secenek;
  const satirIle = new Map(satirlar.map((x) => [x.durak.id, x]));
  const kartlar: DurakKarti[] = [];
  for (const d of gunDurak) {
    const m = mekanIle.get(d.place_ref);
    if (!m) continue;
    const h = adlar?.[m.place_id];
    const satir = satirIle.get(d.id);
    const kategori = kategoriEtiketi(h?.primary_type ?? m.primary_type);
    const saat = satir && satir.durum !== 'atlandi' ? `${dakikaSaat(satir.varisDk)}–${dakikaSaat(satir.ayrilisDk)}` : null;
    kartlar.push({
      durakId: d.id,
      mekanId: m.id,
      placeId: m.place_id,
      konum: { lat: m.lat, lng: m.lng },
      sira: kartlar.length + 1,
      ad: h?.ad ?? '…',
      altSatir: saat ? `${kategori} · ${saat}` : kategori,
      puan: h?.puan ?? null,
      yorum: yorumKisa(h?.puan_sayisi),
      durum: satir?.durum ?? null,
      tamamlandi: !!d.completed_at,
    });
  }
  return kartlar;
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
export function kartIndeksi(ofsetX: number, sayi: number): number {
  if (sayi <= 0) return 0;
  return Math.min(sayi - 1, Math.max(0, Math.round(ofsetX / KART_ADIM)));
}

/**
 * KK4: düğme dizilişi — gezi sırasında (bugün, sıradaki ya da buradasın durağı) ilk düğme "Vardık", Detay ikinciye kayar;
 * yoksa Detay · Yol tarifi. "···" her zaman sonda.
 */
export function kartDugmeleri(kart: DurakKarti, bugun: boolean): ('vardik' | 'detay' | 'yolTarifi')[] {
  const gezide = bugun && (kart.durum === 'siradaki' || kart.durum === 'buradasin') && !kart.tamamlandi;
  return gezide ? ['vardik', 'detay'] : ['detay', 'yolTarifi'];
}
