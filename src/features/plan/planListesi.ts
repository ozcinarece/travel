// #182 (kanvas 24): Plan sekmesinin "liste önce" görünümü — saf hesaplar. Durak satırları ve aralarındaki bacaklar eldeki plandan
// (Program'ın canlı hesabı), harita şeridi yalnız bu günün koordinatlarıyla çizilir (önbellekteki rota çizgisi varsa o, yoksa
// noktalar düz bağlanır), "Akşam boş" önerisi listedeki atanmamış mekanlardan ve rehberden (DB). Google'a istek yok (KK7).
import type { Konum } from '@/components/harita/tipler';
import { konumu, konumVar } from '@/lib/konum';
import { pinKategorisi } from '@/lib/pinIkonu';
import { GUNLER_KISA, haftaGunu } from '@/lib/takvim';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { googleGunu, kapaliGunler, type Periyot } from '@/schedule/acilis';
import type { ProgramSatiri, Yuruyus } from '@/schedule/program';

/** Yemek durağının numarası Yemek turuncusu (kanvas 24); diğerleri gün rengi. */
export const YEMEK_RENGI = '#d9480f';

export type PlanSatiri = {
  durak: Durak;
  mekan: Mekan;
  /** Atlanmayanlar arasında sıra (1'den); atlananda null. */
  numara: number | null;
  varisDk: number | null;
  ayrilisDk: number | null;
  /** Önceki noktadan (otel ya da önceki durak) gelen bacak; ilk durakta otel yoksa ya da atlananda null. */
  gelis: Yuruyus | null;
  yemek: boolean;
  durum: ProgramSatiri['durum'] | null;
};

/** Günün durakları liste sırasıyla (order_key), program satırlarının saatleri ve bacaklarıyla. */
export function planSatirlari(gunDurak: Durak[], mekanIle: Map<string, Mekan>, satirlar: ProgramSatiri[]): PlanSatiri[] {
  const satirIle = new Map(satirlar.map((x) => [x.durak.id, x]));
  let numara = 0;
  const sonuc: PlanSatiri[] = [];
  for (const d of gunDurak) {
    const m = mekanIle.get(d.place_ref);
    if (!m) continue;
    const x = satirIle.get(d.id);
    const atlandi = d.skipped || x?.durum === 'atlandi';
    if (!atlandi) numara++;
    sonuc.push({
      durak: d,
      mekan: m,
      numara: atlandi ? null : numara,
      varisDk: x && !atlandi ? x.varisDk : null,
      ayrilisDk: x && !atlandi ? x.ayrilisDk : null,
      gelis: !atlandi ? (x?.yuruyus ?? null) : null,
      yemek: pinKategorisi(m.primary_type) === 'yemek',
      durum: x?.durum ?? null,
    });
  }
  return sonuc;
}

/** Şerit etiketindeki yürüme: yürünen bacakların (ve otele dönüşün) metresi toplamı. */
export function yurumeMetresi(satirlar: Pick<PlanSatiri, 'gelis'>[], oteleDonus: Yuruyus | null): number {
  return [...satirlar.map((s) => s.gelis), oteleDonus].reduce((t, y) => t + (y && y.mod === 'yuruyus' ? y.m : 0), 0);
}

/** "2,1 km" / "850 m". */
export function kmMetni(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export type SeritNokta = { x: number; y: number };

/**
 * KK3: şerit projeksiyonu — eşdikdörtgen (enlemde cos düzeltmesi), tüm noktalar `pay` iç boşlukla kutuya sığar, oran korunur ve
 * ortalanır. Tek nokta (ya da çakışan noktalar) merkeze düşer.
 */
export function seritProjeksiyonu(konumlar: Konum[], genislik: number, yukseklik: number, pay = 22): (k: Konum) => SeritNokta {
  if (konumlar.length === 0) return () => ({ x: genislik / 2, y: yukseklik / 2 });
  const ortaEnlem = konumlar.reduce((t, k) => t + k.lat, 0) / konumlar.length;
  const kx = Math.cos((ortaEnlem * Math.PI) / 180);
  const xs = konumlar.map((k) => k.lng * kx);
  const ys = konumlar.map((k) => k.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const genis = Math.max(maxX - minX, 1e-9);
  const yuksek = Math.max(maxY - minY, 1e-9);
  const olcek = Math.min((genislik - 2 * pay) / genis, (yukseklik - 2 * pay) / yuksek);
  const ox = (genislik - genis * olcek) / 2;
  const oy = (yukseklik - yuksek * olcek) / 2;
  const tek = maxX - minX < 1e-9 && maxY - minY < 1e-9;
  return (k) => (tek ? { x: genislik / 2, y: yukseklik / 2 } : { x: ox + (k.lng * kx - minX) * olcek, y: oy + (maxY - k.lat) * olcek });
}

/** KK5: "Akşam boş" eşiği — son durak bu dakikadan önce bitiyorsa öneri satırları. */
export const AKSAM_ESIGI_DK = 17 * 60;
/** İçerikten (rehber, il listesi) önerilecek yerin son durağa uzaklık sınırı. */
export const REHBER_YAKIN_M = 3000;

/**
 * KK5 + #532 KK3: gün sonunda boşluk varsa (son atlanmamış durak 17:00'den önce bitiyor) adayların yakınlık referansı: son
 * konumlu durak. Boşluk yoksa ya da hiçbir durak konumlu değilse null (#318: (0,0) sayılmaz).
 */
export function aksamBoslugu(satirlar: PlanSatiri[]): Konum | null {
  const etkin = satirlar.filter((s) => s.numara !== null && s.ayrilisDk !== null);
  const son = etkin[etkin.length - 1];
  if (!son || son.ayrilisDk! >= AKSAM_ESIGI_DK) return null;
  return konumu([...etkin].reverse().find((s) => konumVar(s.mekan))?.mekan);
}

/**
 * #582 KK3: mekan, günün tarihine düşen hafta gününde açılış saatine göre kapalıysa o günün kısa adı ("Pzt"); tarihsiz gün ya
 * da saat bilinmiyorsa null (kural uygulanmaz). Saatler anlık okunur, saklanmaz.
 */
export function kapaliGunKisa(tarih: string | null, periyotlar: Periyot[] | null | undefined): string | null {
  if (!tarih || !periyotlar) return null;
  const gun = haftaGunu(tarih);
  return kapaliGunler(periyotlar).includes(googleGunu(gun)) ? GUNLER_KISA[gun] : null;
}

/** #582 KK3 "Başka güne taşı": durağın kendi günü ve mekanın kapalı olduğu günler dışındaki günler (sırasıyla). */
export function tasinabilirGunler<G extends Pick<Gun, 'id' | 'index' | 'date'>>(gunler: G[], buGunId: string, periyotlar: Periyot[] | null | undefined): G[] {
  return [...gunler].sort((a, b) => a.index - b.index).filter((g) => g.id !== buGunId && !kapaliGunKisa(g.date, periyotlar));
}
