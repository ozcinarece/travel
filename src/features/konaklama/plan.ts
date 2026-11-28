// #56: gün bazlı otel — saf kurallar (testli). Her günün başlangıç ve bitiş noktası days.start_stay_id / end_stay_id;
// null = otel yok (gün ilk duraktan başlar, son durakta biter).
import { konumVar } from '@/lib/konum';
import type { Gun } from '@/lib/tipler';

export type Konaklama = {
  id: string;
  trip_id: string;
  place_id: string | null;
  /** #318: Google koordinatı 30 günde yenilenemezse null; otel haritada ve rota hesabında yok sayılır. */
  lat: number | null;
  lng: number | null;
  /**
   * Görünen ad. DB'den okununca yalnız `place_id`'siz noktanın adı (`satirdanKonaklama`); `adlarlaKonaklamalar` sonrası
   * takma ad ya da (place_id'li otelde) canlı Google adı. Google adı DB'ye hiç yazılmaz (#248, #584 KK1).
   */
  label: string | null;
  /** #584 KK2: kullanıcının otele verdiği ad (stays.takma_ad); kullanıcı verisi, saklanır. */
  takma_ad?: string | null;
};

/** `stays` okunan alanlar. */
export const KONAKLAMA_ALANLARI = 'id, trip_id, place_id, lat, lng, label, takma_ad';

/**
 * #584 KK1: DB satırı → Konaklama. `place_id`'li satırın `label`'ı okunmaz: eski satırlarda Google adı olabilir (#250
 * temizliği elle çalışana kadar); ad ekranda canlı gelir.
 */
export function satirdanKonaklama(satir: Konaklama): Konaklama {
  return { ...satir, label: satir.place_id ? null : satir.label, takma_ad: satir.takma_ad?.trim() || null };
}

/**
 * #248 KK1: yeni `stays` satırı. `place_id` varsa Google'dan gelen ad `label`'a yazılmaz (PRD §7, T1); ad ekranda
 * places-light ile canlı gösterilir. `place_id`'siz (haritadan seçilen) noktada kullanıcının adı tutulur.
 */
export function yeniKonaklamaSatiri(seyahatId: string, secim: { place_id: string | null; ad: string; lat: number; lng: number }, simdi = new Date()) {
  return {
    trip_id: seyahatId,
    place_id: secim.place_id,
    lat: secim.lat,
    lng: secim.lng,
    label: secim.place_id ? null : secim.ad.trim().slice(0, 80) || null,
    google_fetched_at: secim.place_id ? simdi.toISOString() : null,
  };
}

/**
 * Görünen ad (`label`): takma ad (#584 KK2) > place_id'siz noktanın adı > place_id'li otelin canlı Google adı. Canlı ad
 * yalnız bellekte (places-light) eklenir; DB'ye yazılmaz (#248, #584 KK1).
 */
export function adlarlaKonaklamalar(liste: Konaklama[], canliAd: (placeId: string) => string | null | undefined): Konaklama[] {
  return liste.map((k) => {
    if (k.takma_ad) return { ...k, label: k.takma_ad };
    return k.place_id ? { ...k, label: canliAd(k.place_id) ?? null } : k;
  });
}

/** Canlı adı gereken kimlikler (takma adı yok, place_id dolu). Takma adlı otel için Google'a istek yok. */
export const adiEksikKimlikler = (liste: Konaklama[]) => [...new Set(liste.filter((k) => !k.takma_ad && k.place_id).map((k) => k.place_id!))];

/** #584 KK2: girilen takma ad → `stays.takma_ad` (kırpılır, ≤ 80; boşsa null = takma ad yok). */
export const takmaAdDegeri = (metin: string) => metin.trim().slice(0, 80).trim() || null;

/** Matris / rota anahtarı (walk_cache): otel başına ayrı, konum değişince yeni otel = yeni anahtar. */
export const konaklamaAnahtari = (id: string) => `stay:${id}`;

export type GunUclari = { baslangic: Konaklama | null; bitis: Konaklama | null };

export function gunUclari(gun: Pick<Gun, 'start_stay_id' | 'end_stay_id'> | undefined, konaklamalar: Map<string, Konaklama>): GunUclari {
  if (!gun) return { baslangic: null, bitis: null };
  return {
    baslangic: gun.start_stay_id ? (konaklamalar.get(gun.start_stay_id) ?? null) : null,
    bitis: gun.end_stay_id ? (konaklamalar.get(gun.end_stay_id) ?? null) : null,
  };
}

/**
 * #318 inceleme 3: listenin başlangıç / bitiş otel satırları. Satırın varlığı ve adı `gunUclari`'ndan gelir (konum süzgeci
 * yok): koordinatı boşalmış otel "otel yok" görünmez, bitiş satırı kaybolmaz. `ucNoktalari` yalnız hesap ve harita içindir.
 * `son`: bitiş satırının türü; gün otelsizse null (satır yok).
 */
export function otelUcSatirlari(u: GunUclari): { baslangic: Konaklama | null; bitis: Konaklama | null; son: 'donus' | 'bitis' | null } {
  if (!u.baslangic && !u.bitis) return { baslangic: null, bitis: null, son: null };
  return { baslangic: u.baslangic, bitis: u.bitis, son: u.bitis && u.bitis.id === u.baslangic?.id ? 'donus' : 'bitis' };
}

/** Yeni gün varsayılanı: önceki (son) günün bitişinden başlar, aynı yere döner. */
export function yeniGunUclari(gunler: Pick<Gun, 'index' | 'end_stay_id'>[]): { start_stay_id: string | null; end_stay_id: string | null } {
  const son = [...gunler].sort((a, b) => b.index - a.index)[0];
  const id = son?.end_stay_id ?? null;
  return { start_stay_id: id, end_stay_id: id };
}

export type OtelKapsami = 'bugun' | 'sonrasi';
export type GunOtelGuncellemesi = { id: string; start_stay_id: string | null; end_stay_id: string | null };

/**
 * Alt sayfa "Kaydet" → hangi günler nasıl değişir?
 * - Seçilen gün: başlangıç = `otel`, bitiş = taşınmada `bitisOteli`, değilse `otel` (aynı otele dönüş).
 * - "Bu gün ve sonrası": sonraki her gün başlangıç = bitiş = günün bitiş oteli (zincir).
 * - "Yalnız bu gün": diğer günlere dokunulmaz; yalnız taşınmada ertesi gün yeni otelden başlar (bitişi eski
 *   başlangıcına eşitse — aynı otele dönüş — o da yeni otel olur).
 * `otel` null = otel yok. Değişmeyen günler listeye girmez.
 */
export function otelPlani(
  gunler: Pick<Gun, 'id' | 'index' | 'start_stay_id' | 'end_stay_id'>[],
  gunId: string,
  kapsam: OtelKapsami,
  otel: string | null,
  bitisOteli?: string | null,
): GunOtelGuncellemesi[] {
  const sirali = [...gunler].sort((a, b) => a.index - b.index);
  const i = sirali.findIndex((g) => g.id === gunId);
  if (i < 0) return [];
  const bitis = bitisOteli === undefined ? otel : bitisOteli;
  const hedef = new Map<string, GunOtelGuncellemesi>();
  hedef.set(sirali[i].id, { id: sirali[i].id, start_stay_id: otel, end_stay_id: bitis });
  if (kapsam === 'sonrasi') {
    for (const g of sirali.slice(i + 1)) hedef.set(g.id, { id: g.id, start_stay_id: bitis, end_stay_id: bitis });
  } else if (bitis !== otel && sirali[i + 1]) {
    const ertesi = sirali[i + 1];
    const donus = ertesi.end_stay_id === ertesi.start_stay_id;
    hedef.set(ertesi.id, { id: ertesi.id, start_stay_id: bitis, end_stay_id: donus ? bitis : ertesi.end_stay_id });
  }
  return sirali
    .map((g) => hedef.get(g.id))
    .filter((u): u is GunOtelGuncellemesi => {
      if (!u) return false;
      const g = sirali.find((x) => x.id === u.id)!;
      return g.start_stay_id !== u.start_stay_id || g.end_stay_id !== u.end_stay_id;
    });
}

/** "Ibis Eskişehir · Cmt 17 ve Paz 18 gecesi" için: otelin bitiş noktası olduğu günler (gece orada). */
export function otelinGeceleri(gunler: Pick<Gun, 'id' | 'index' | 'end_stay_id'>[], stayId: string): Pick<Gun, 'id' | 'index'>[] {
  return [...gunler].filter((g) => g.end_stay_id === stayId).sort((a, b) => a.index - b.index);
}

/** Günün uç noktası (matris / rota): anahtar stay:<id> + konum. */
export type UcNokta = { key: string; lat: number; lng: number; konaklama: Konaklama };
export type GunUcNoktalari = { baslangic: UcNokta | null; bitis: UcNokta | null };

export function ucNoktalari(gun: Pick<Gun, 'start_stay_id' | 'end_stay_id'> | undefined, konaklamalar: Map<string, Konaklama>): GunUcNoktalari {
  const u = gunUclari(gun, konaklamalar);
  // #318: koordinatı boşalmış otel uç nokta sayılmaz (gün otelsiz gibi hesaplanır; haritada pin yok).
  const nokta = (k: Konaklama | null): UcNokta | null =>
    k && konumVar(k) ? { key: konaklamaAnahtari(k.id), lat: k.lat, lng: k.lng, konaklama: k } : null;
  return { baslangic: nokta(u.baslangic), bitis: nokta(u.bitis) };
}
