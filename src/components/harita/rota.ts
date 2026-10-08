// #33: rota çizgilerinden bacak etiketi pinleri ("🚕 12 dk" hapı, bacağın ortasında). #59 §C: yalnız taksi bacağı
// hap taşır (yürüyüş süreleri panelde); yön okları ayrı işaretçi olarak çizilir.
import { cizgiOrtasi } from '@/lib/polyline';

import type { HaritaBolgesi, HaritaCizgisi, HaritaPini, Konum } from './tipler';

export function bacakEtiketPinleri(cizgiler: HaritaCizgisi[]): HaritaPini[] {
  const pinler: HaritaPini[] = [];
  for (const c of cizgiler) {
    if (!c.etiket) continue;
    const orta = cizgiOrtasi(c.noktalar);
    if (!orta) continue;
    pinler.push({ id: `bacak:${c.id}`, konum: orta, renk: c.renk, tur: 'etiket', etiket: c.etiket, etiketIkon: c.etiketIkon });
  }
  return pinler;
}

/** #59 §C: rota üstünde yön oku — konum + saat yönünde derece (0 = kuzey; ok görseli doğuya bakar, Harita -90 uygular). */
export type YonOku = { id: string; konum: Konum; aci: number };

/** Ok aralığı (ekran px), toplam üst sınır, pin merkezine en az uzaklık (px). */
export const OK_ARALIGI_PX = 45;
export const OK_EN_FAZLA = 40;
export const OK_PIN_PAYI_PX = 20;

/**
 * Seçili günün yürüyüş bacaklarına (kesik/ince olmayan, soluk olmayan çizgiler) ~45 px aralıkla ok yerleştirir.
 * Hesap ekran pikselinde (bölge yalnız ölçek verir; merkez önemsiz → kaydırmada sonuç değişmez, yalnız zoom adımında
 * yeniden hesaplanır). Pinlerin 20 px yakınına ok konmaz. Toplam 40'ı aşarsa aralık orantılı büyütülür.
 */
export function yonOklari(cizgiler: HaritaCizgisi[], pinler: HaritaPini[], bolge: HaritaBolgesi | null, ekran: { genislik: number; yukseklik: number }): YonOku[] {
  if (!bolge || bolge.latDelta <= 0 || bolge.lngDelta <= 0) return [];
  const pxLat = ekran.yukseklik / bolge.latDelta;
  const pxLng = ekran.genislik / bolge.lngDelta;
  const px = (k: Konum) => ({ x: (k.lng - bolge.merkez.lng) * pxLng, y: -(k.lat - bolge.merkez.lat) * pxLat });
  const pinNoktalari = pinler.filter((p) => p.tur !== 'etiket').map((p) => px(p.konum));
  const pineYakin = (n: { x: number; y: number }) => pinNoktalari.some((q) => Math.hypot(q.x - n.x, q.y - n.y) < OK_PIN_PAYI_PX);

  const adaylar: YonOku[] = [];
  for (const c of cizgiler) {
    if (c.kesik || c.ince || (c.opaklik ?? 1) < 0.5 || c.noktalar.length < 2) continue;
    let sonraki = OK_ARALIGI_PX / 2;
    let yol = 0;
    for (let i = 1; i < c.noktalar.length; i++) {
      const a = c.noktalar[i - 1];
      const b = c.noktalar[i];
      const pa = px(a);
      const pb = px(b);
      const uz = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      if (uz === 0) continue;
      // Saat yönünde açı: kuzey 0, doğu 90 (ekran y aşağı).
      const aci = (Math.atan2(pb.x - pa.x, -(pb.y - pa.y)) * 180) / Math.PI;
      while (sonraki <= yol + uz) {
        const t = (sonraki - yol) / uz;
        const n = { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
        if (!pineYakin(n)) adaylar.push({ id: `ok:${c.id}:${adaylar.length}`, konum: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }, aci: (aci + 360) % 360 });
        sonraki += OK_ARALIGI_PX;
      }
      yol += uz;
    }
  }
  if (adaylar.length <= OK_EN_FAZLA) return adaylar;
  const adim = Math.ceil(adaylar.length / OK_EN_FAZLA);
  return adaylar.filter((_, i) => i % adim === 0).slice(0, OK_EN_FAZLA);
}
