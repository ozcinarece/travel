// #42: Program tek ekran haritasının pin ve çizgi verisi (saf fonksiyonlar).
import { mesafeM } from '@/components/harita/geo';
import type { HaritaCizgisi, HaritaPini, Konum } from '@/components/harita/tipler';
import type { GunUcNoktalari } from '@/features/konaklama/plan';
import type { HafifYer } from '@/features/yerler/api';
import { kategoriPini } from '@/lib/pinIkonu';
import { polylineCoz } from '@/lib/polyline';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { bacakModu, type BacakKaynagi, type TempoSonucu } from '@/schedule/tempo';
import { gunRengi, renk, rotaRengi } from '@/theme';

import { bacakListesi, type MatrisNoktasi, type RotaHaritasi } from './sorgular';

/** #42 KK5: seçili güne ait olmayan pinler ve atanmamış öneri pinleri bu opaklıkta. */
export const SOLUK_PIN = 0.4;
/** #42 KK7: geçilen rota parçası. */
export const SOLUK_BACAK = 0.35;

/**
 * #61 §5: Google yolu en yakın yola "oturtur" — pin yoldan uzaktaysa polyline pine değmez, dolambaçlıysa (yakın iki
 * POI arasında blok turu) pinlerden kopuk bir çizgi kalır. Çizgi uçlara düz parçayla bağlanır; yol kuş uçuşunun
 * 3 katı + 150 m'den uzunsa (ya da uçları pinlerden 120 m'den uzaksa) düz çizgi kullanılır.
 */
export const SAPMA_ORANI = 3;
export const SAPMA_PAYI_M = 150;
export const UC_PAYI_M = 120;
export function rotaNoktalari(polyline: string, a: Konum, z: Konum): Konum[] {
  const yol = polylineCoz(polyline).filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lng));
  if (yol.length < 2) return [a, z];
  let uzunluk = 0;
  for (let i = 1; i < yol.length; i++) uzunluk += mesafeM(yol[i - 1], yol[i]);
  const kus = mesafeM(a, z);
  const basUzak = mesafeM(a, yol[0]);
  const sonUzak = mesafeM(yol[yol.length - 1], z);
  if (uzunluk > kus * SAPMA_ORANI + SAPMA_PAYI_M || basUzak > UC_PAYI_M || sonUzak > UC_PAYI_M) return [a, z];
  return [...(basUzak > 2 ? [a] : []), ...yol, ...(sonUzak > 2 ? [z] : [])];
}

export function programPinleri(secenek: {
  /** #56: her günün başlangıç / bitiş oteli. */
  gunUclari: Map<string, GunUcNoktalari>;
  mekanlar: Mekan[];
  duraklar: Durak[];
  gunler: Gun[];
  tempolar: Map<string, TempoSonucu>;
  adlar: Record<string, HafifYer> | undefined;
  seciliGunId: string | undefined;
  /** Pin paneli açık olan mekan (places.id). */
  seciliMekanId: string | null;
  /** Tamamlanan durakların mekan kimlikleri (yalnız bugün). */
  tamamlananMekanIds: Set<string>;
  /** Kullanıcı konumu (yalnız seyahat gününde). */
  konum: Konum | null;
}): HaritaPini[] {
  const { gunUclari, mekanlar, duraklar, gunler, tempolar, adlar, seciliGunId, seciliMekanId, tamamlananMekanIds, konum } = secenek;
  const durakIle = new Map(duraklar.map((d) => [d.place_ref, d]));
  const gunIndex = new Map(gunler.map((g) => [g.id, g.index]));
  // #30: pin numarası = gün içi sıra (§5.1 ya da elle); rota çizgisiyle okunur.
  const gunSiralari = new Map<string, number>();
  for (const g of gunler) tempolar.get(g.id)?.sira.forEach((mekanId, i) => gunSiralari.set(mekanId, i + 1));

  const pinler: HaritaPini[] = [];
  pinler.push(...otelPinleri(gunler, gunUclari, seciliGunId));
  for (const m of mekanlar) {
    const d = durakIle.get(m.id);
    const idx = d ? gunIndex.get(d.day_id) : undefined;
    const hafif = adlar?.[m.place_id];
    const secili = m.id === seciliMekanId;
    const seciliGunde = !!d && d.day_id === seciliGunId;
    const ortak = {
      id: `m:${m.id}`,
      konum: { lat: m.lat, lng: m.lng },
      ad: hafif?.ad ?? '…',
      puan: hafif?.puan ?? null,
      yorumSayisi: hafif?.puan_sayisi ?? null,
      secili,
      // KK5: seçili günün pinleri tam renk; diğer günler ve atanmamışlar soluk (seçili pin hariç).
      opaklik: seciliGunde || secili ? 1 : SOLUK_PIN,
    };
    if (idx) {
      // #61 §5: numara yalnız seçili günün pinlerinde (diğer günler numarasız küçük nokta; listeyle karışmasın).
      const sira = seciliGunde ? gunSiralari.get(m.id) : undefined;
      pinler.push({ ...ortak, tur: 'durak', renk: gunRengi(idx), etiket: sira ? String(sira) : '', tamam: seciliGunde && tamamlananMekanIds.has(m.id) });
    } else {
      pinler.push({ ...ortak, tur: 'bos', renk: renk.metin, ...kategoriPini(m.primary_type) });
    }
  }
  if (konum) pinler.push({ id: 'konum', tur: 'konum', konum, renk: '#4285f4' });
  return pinler;
}

/**
 * #56 §6: her otel tek pin (aynı otel birden çok günde kullanılsa da). Seçili günün başlangıç / bitiş otelleri tam
 * renk, diğer günlerinkiler soluk.
 */
export function otelPinleri(gunler: Gun[], gunUclari: Map<string, GunUcNoktalari>, seciliGunId: string | undefined): HaritaPini[] {
  const oteller = new Map<string, { konum: Konum; secili: boolean }>();
  for (const g of gunler) {
    const u = gunUclari.get(g.id);
    for (const n of [u?.baslangic, u?.bitis]) {
      if (!n) continue;
      const onceki = oteller.get(n.key);
      const secili = g.id === seciliGunId || !!onceki?.secili;
      oteller.set(n.key, { konum: { lat: n.lat, lng: n.lng }, secili });
    }
  }
  return [...oteller].map(([key, o]) => ({
    id: `otel:${key}`,
    tur: 'otel' as const,
    konum: o.konum,
    renk: renk.metin,
    opaklik: o.secili ? 1 : SOLUK_PIN,
  }));
}

export function programCizgileri(secenek: {
  gunUclari: Map<string, GunUcNoktalari>;
  mekanIle: Map<string, Mekan>;
  gunler: Gun[];
  tempolar: Map<string, TempoSonucu>;
  seciliGunId: string | undefined;
  seciliNoktalar: MatrisNoktasi[];
  rotalar: RotaHaritasi;
  bacak: BacakKaynagi;
  /** #42 KK7: seçili günde geçilen bacak sayısı (otel→1 dahil); bu kadar bacak soluk çizilir. */
  gecilenBacak: number;
}): HaritaCizgisi[] {
  const { gunUclari, mekanIle, gunler, tempolar, seciliGunId, seciliNoktalar, rotalar, bacak, gecilenBacak } = secenek;
  return gunler.flatMap((g): HaritaCizgisi[] => {
    const tp = tempolar.get(g.id);
    if (!tp || tp.sira.length === 0) return [];
    // #59 §C: çizgi koyu rota tonunda (pinler gün renginde).
    const rengi = rotaRengi(g.index);
    if (g.id !== seciliGunId) {
      const noktalar = tp.sira.map((mekanId) => mekanIle.get(mekanId)).filter((m): m is Mekan => !!m).map((m) => ({ lat: m.lat, lng: m.lng }));
      const u = gunUclari.get(g.id);
      const uc = (n: GunUcNoktalari['baslangic'] | undefined) => (n ? [{ lat: n.lat, lng: n.lng }] : []);
      const yol = [...uc(u?.baslangic), ...noktalar, ...uc(u?.bitis)];
      // #59 §C: diğer günlerin rotası ince, %32.
      return yol.length >= 2 ? [{ id: `rota:${g.id}`, noktalar: yol, renk: rengi, opaklik: 0.32, ince: true }] : [];
    }
    // #33: seçili gün bacak bacak gerçek yol (araç bacağı noktalı + "taksi 14 dk" hapı); gelene kadar kuş uçuşu kesikli.
    // #59 §C: yürüyüş süre hapları haritada yok (panelde var) — `etiket` yalnız taksi bacağında.
    // #51: kimlik bacağın uçlarından (from>to) ve kaynağından türer — sıra değişince eski çizgi/etiket yeniden
    // kullanılmaz (Android Polyline/Marker eski koordinatta kalıyordu); aynı çift iki kez geçerse sıra no ayırır.
    const gorulen = new Map<string, number>();
    return bacakListesi(seciliNoktalar).map((b, i): HaritaCizgisi => {
      const opaklik = i < gecilenBacak ? SOLUK_BACAK : 0.9;
      const cift = `${b.from.key}>${b.to.key}`;
      const tekrar = gorulen.get(cift) ?? 0;
      gorulen.set(cift, tekrar + 1);
      const kimlik = `rota:${g.id}:${cift}${tekrar ? `#${tekrar}` : ''}`;
      const r = rotalar[cift];
      const a = { lat: b.from.lat, lng: b.from.lng };
      const z = { lat: b.to.lat, lng: b.to.lng };
      if (r) {
        const taksi = r.mode === 'DRIVE' && r.drive_seconds;
        const dk = Math.max(1, Math.round((taksi ? r.drive_seconds! : r.seconds) / 60));
        return {
          id: `${kimlik}:yol`,
          noktalar: rotaNoktalari(r.polyline, a, z),
          renk: rengi,
          opaklik,
          kesik: !!taksi,
          etiket: i < gecilenBacak || !taksi ? undefined : `${dk} dk`,
          etiketIkon: taksi ? 'taksi' : 'yurume',
        };
      }
      const m = bacakModu(a, z, bacak(a, z));
      return {
        id: `${kimlik}:kus`,
        noktalar: [a, z],
        renk: rengi,
        opaklik,
        // Gerçek yol gelene kadar kuş uçuşu: her zaman kesikli.
        kesik: true,
        etiket: i < gecilenBacak || m.mod !== 'taksi' ? undefined : `~${Math.max(1, Math.round(m.sn / 60))} dk`,
        etiketIkon: m.mod === 'taksi' ? 'taksi' : 'yurume',
      };
    });
  });
}
