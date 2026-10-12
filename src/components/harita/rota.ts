// #33: rota çizgilerinden bacak etiketi pinleri ("araba 12 dk" hapı, bacağın ortasında). #59 §C / #65: yalnız araba bacağı
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
export const OK_ARALIGI_PX = 24;
export const OK_EN_FAZLA = 80;
export const OK_PIN_PAYI_PX = 20;

/**
 * Seçili günün yürüyüş bacaklarına (kesik/ince/araba olmayan, soluk olmayan çizgiler) ~24 px aralıkla ok yerleştirir (#65).
 * Hesap ekran pikselinde (bölge yalnız ölçek verir; merkez önemsiz → kaydırmada sonuç değişmez, yalnız zoom adımında
 * yeniden hesaplanır). Pinlerin 20 px yakınına ok konmaz. Toplam 80'i (OK_EN_FAZLA) aşarsa seyreltilir.
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
    if (c.kesik || c.ince || c.arac || (c.opaklik ?? 1) < 0.5 || c.noktalar.length < 2) continue;
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

/**
 * #88 (ikinci tur): Polyline anahtarı — kuş uçuşu (`kesik`) ve gerçek rota AYRI bileşen örnekleridir. #91 ikinci turdan beri
 * Android (Harita.native) sabit yuva havuzu kullanır (aşağıda); bu anahtar yalnız kaldırmanın güvenilir olduğu yerler için. Geçişte desen prop'u
 * değiştirilmez: kesikli çizgi kaldırılır, düz çizgi eklenir (Android'de `lineDashPattern`'ı kaldırmak / boşaltmak güvenilmez;
 * #89'daki boş dizi cihazda düz üretmedi). Aynı bacağın iki hali farklı anahtar, aynı hal aynı anahtar.
 */
export function cizgiAnahtari(c: Pick<HaritaCizgisi, 'id' | 'kesik'>): string {
  return `${c.id}|${c.kesik ? 'kus' : 'yol'}`;
}

/**
 * #91 (ikinci tur): Android'de Polyline KALDIRMAK güvenilmez — react-native-maps 1.27 `MapView.removeFeatureAt(index)` listeden
 * İNDEKSLE siler; `safeAddFeature` uygulama arka plandayken (`paused`) ya da `features.size() < index` iken öğeyi `features`
 * yerine `savedFeatures`'a koyar (haritaya yine eklenmiş olur) ve listeye null dolgu girebilir. Liste JS çocuklarından bir
 * ayrıştı mı, sonraki kaldırma yanlış (ya da null) öğeyi siler; Google Maps'teki Polyline nesnesi haritada kalır (hayalet:
 * Cum 16'nın tam kalınlıkta rotası ve eski kuş uçuşu başka gün seçiliyken duruyordu). Çözüm: rota çizgileri SABİT YUVA
 * HAVUZUNDA yaşar — havuz yalnız büyür, Polyline hiç kaldırılmaz; her yuvada hep aynı 4 örnek (kesik · gölge · kenar · renk)
 * durur ve yalnız `coordinates` / `strokeColor` güncellenir. Boş yuva: koordinat yok + saydam. Desen prop'u hiçbir örnekte
 * değişmez (#88).
 */
export type RotaKatmani = { ad: 'kesik' | 'golge' | 'kenar' | 'renk'; noktalar: Konum[]; renk: string; genislik: number; zIndex: number };

export const SAYDAM = '#00000000';
/** #59 §C (RouteSpec5): gölge 11 dp %12 · beyaz kenar 9 dp · renk 5,5 dp; kuş uçuşu 3 dp. */
export const ROTA_OLCU = { golge: 11, kenar: 9, cizgi: 5.5, ince: 3, golgeRenk: '#0f0f0f', golgeOpaklik: 0.12 } as const;

/** "#rrggbb" + opaklık → "#rrggbbaa". */
export function saydam(hex: string, opaklik: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opaklik)) * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? `${hex}${a}` : hex;
}

/** Havuz boyutu: şimdiye kadar görülen en çok çizgi sayısı (yalnız büyür). */
export function yuvaSayisi(onceki: number, cizgiSayisi: number): number {
  return Math.max(onceki, cizgiSayisi);
}

/**
 * Bir yuvanın 4 katmanı. Çizgi yoksa hepsi boş + saydam. Kuş uçuşu (`kesik`): yalnız 'kesik' katmanı dolu. Rota: üç düz
 * katman dolu, 'kesik' boş. Katman sırası ve genişlikleri sabittir (yalnız koordinat ve renk değişir).
 */
export function rotaYuvaKatmanlari(c: HaritaCizgisi | null): RotaKatmani[] {
  const bos: Konum[] = [];
  const opaklik = c?.opaklik ?? 1;
  const kesik = !!c && !!c.kesik;
  const duz = !!c && !c.kesik;
  return [
    { ad: 'kesik', noktalar: kesik ? c.noktalar : bos, renk: kesik ? saydam(c.renk, opaklik) : SAYDAM, genislik: ROTA_OLCU.ince, zIndex: 0 },
    { ad: 'golge', noktalar: duz ? c.noktalar : bos, renk: duz ? saydam(ROTA_OLCU.golgeRenk, ROTA_OLCU.golgeOpaklik * opaklik) : SAYDAM, genislik: ROTA_OLCU.golge, zIndex: 1 },
    { ad: 'kenar', noktalar: duz ? c.noktalar : bos, renk: duz ? saydam('#ffffff', opaklik) : SAYDAM, genislik: ROTA_OLCU.kenar, zIndex: 2 },
    { ad: 'renk', noktalar: duz ? c.noktalar : bos, renk: duz ? saydam(c.renk, opaklik) : SAYDAM, genislik: ROTA_OLCU.cizgi, zIndex: 3 },
  ];
}
