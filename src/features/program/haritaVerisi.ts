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

/** #42 KK5 / #65 (docs/05 §2): seçili güne ait olmayan pinler ve atanmamış öneri pinleri bu opaklıkta (%45). */
export const SOLUK_PIN = 0.45;
/** #42 KK7: geçilen rota parçası. */
export const SOLUK_BACAK = 0.35;

/**
 * #61 §5: Google yolu en yakın yola "oturtur" — pin yoldan uzaktaysa polyline pine değmez, dolambaçlıysa (yakın iki
 * POI arasında blok turu) pinlerden kopuk bir çizgi kalır. Çizgi uçlara düz parçayla bağlanır; yol kuş uçuşunun
 * 3 katı ya da kuş uçuşu + 100 m'den (hangisi büyükse) uzunsa, ya da uçları pinlerden 120 m'den uzaksa düz çizgi kullanılır.
 * #88 KK2: kısa bacakta (50 m) eski "3 kat + 150 m" kuralı 300 m'lik dolambaca izin veriyordu; şimdi 150 m.
 */
export const SAPMA_ORANI = 3;
export const SAPMA_PAYI_M = 100;
export const UC_PAYI_M = 120;
export function rotaNoktalari(polyline: string, a: Konum, z: Konum): Konum[] {
  const yol = polylineCoz(polyline).filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lng));
  if (yol.length < 2) return [a, z];
  let uzunluk = 0;
  for (let i = 1; i < yol.length; i++) uzunluk += mesafeM(yol[i - 1], yol[i]);
  const kus = mesafeM(a, z);
  const basUzak = mesafeM(a, yol[0]);
  const sonUzak = mesafeM(yol[yol.length - 1], z);
  if (uzunluk > Math.max(kus * SAPMA_ORANI, kus + SAPMA_PAYI_M) || basUzak > UC_PAYI_M || sonUzak > UC_PAYI_M) return [a, z];
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
  gunler: Gun[];
  tempolar: Map<string, TempoSonucu>;
  seciliGunId: string | undefined;
  seciliNoktalar: MatrisNoktasi[];
  rotalar: RotaHaritasi;
  bacak: BacakKaynagi;
  /** #42 KK7: seçili günde geçilen bacak sayısı (otel→1 dahil); bu kadar bacak soluk çizilir. */
  gecilenBacak: number;
}): HaritaCizgisi[] {
  const { gunler, tempolar, seciliGunId, seciliNoktalar, rotalar, bacak, gecilenBacak } = secenek;
  return gunler.flatMap((g): HaritaCizgisi[] => {
    const tp = tempolar.get(g.id);
    if (!tp || tp.sira.length === 0) return [];
    // #59 §C: çizgi koyu rota tonunda (pinler gün renginde).
    const rengi = rotaRengi(g.index);
    // #77: çizgi kimliği her günde BACAK bazlı ve rota gelsin gelmesin aynı (`rota:<gün>:<from>><to>`): gün seçimi ya da rota
    // gelişi işaretçiyi kaldırıp yeniden kurmak yerine aynı Polyline'ın özelliklerini günceller (Android'de kaldırılan çizgi
    // hayalet kalabiliyordu). Anahtarlar seçili günün matris anahtarlarıyla aynı (mekan: place_id, otel: stay anahtarı).
    const kimlikler = new Map<string, number>();
    const kimlik = (fromKey: string, toKey: string) => {
      const cift = `${fromKey}>${toKey}`;
      const tekrar = kimlikler.get(cift) ?? 0;
      kimlikler.set(cift, tekrar + 1);
      return `rota:${g.id}:${cift}${tekrar ? `#${tekrar}` : ''}`;
    };
    // #91 A (docs/05 v1.8 §3): yalnız seçili günün rotası çizilir. Diğer günler için HİÇBİR çizgi üretilmez — ne düz,
    // ne %32 ince, ne kuş uçuşu; durakları soluk nokta olarak kalır (programPinleri). Boş gün planlarken ekran temiz.
    if (g.id !== seciliGunId) return [];
    // #33: seçili gün bacak bacak gerçek yol; #65: araba bacağı yürümeyle aynı düz çizgi (ok yok); rota gelene kadar kuş
    // uçuşu ince kesikli. #95 (docs/05 v1.9 §4): HER bacakta süre hapı — yürüme `yuru` (siyah), araba `araba` (rota tonu);
    // geçilen bacakta hap yok. (#59 §C'nin "yürüyüş süresi haritada yok" kuralı 12 Eki'de kalktı.)
    // #51: kimlik bacağın uçlarından (from>to) ve kaynağından türer — sıra değişince eski çizgi/etiket yeniden
    // kullanılmaz (Android Polyline/Marker eski koordinatta kalıyordu); aynı çift iki kez geçerse sıra no ayırır.
    return bacakListesi(seciliNoktalar).map((b, i): HaritaCizgisi => {
      const opaklik = i < gecilenBacak ? SOLUK_BACAK : 0.9;
      const cift = `${b.from.key}>${b.to.key}`;
      const id = kimlik(b.from.key, b.to.key);
      const r = rotalar[cift];
      const a = { lat: b.from.lat, lng: b.from.lng };
      const z = { lat: b.to.lat, lng: b.to.lng };
      if (r) {
        const taksi = r.mode === 'DRIVE' && r.drive_seconds;
        const dk = Math.max(1, Math.round((taksi ? r.drive_seconds! : r.seconds) / 60));
        return {
          id,
          noktalar: rotaNoktalari(r.polyline, a, z),
          renk: rengi,
          opaklik,
          arac: !!taksi,
          etiket: i < gecilenBacak ? undefined : `${dk} dk`,
          etiketIkon: taksi ? 'araba' : 'yuru',
          etiketRenk: rengi,
        };
      }
      const m = bacakModu(a, z, bacak(a, z));
      return {
        id,
        noktalar: [a, z],
        // docs/05 §3: rota gelene kadar GÜN renginde (rota tonu değil), 3 dp, kesikli.
        renk: gunRengi(g.index),
        opaklik,
        // Gerçek yol gelene kadar kuş uçuşu: ince kesikli (docs/05 §3).
        kesik: true,
        ince: true,
        arac: m.mod === 'taksi',
        etiket: i < gecilenBacak ? undefined : `~${Math.max(1, Math.round(m.sn / 60))} dk`,
        etiketIkon: m.mod === 'taksi' ? 'araba' : 'yuru',
        // Çizgi gün renginde (kuş uçuşu); hap glifi rota tonunda kalır (PNG yalnız rota tonlarında var).
        etiketRenk: rengi,
      };
    });
  });
}
