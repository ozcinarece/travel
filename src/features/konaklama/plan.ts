// #56: gün bazlı otel — saf kurallar (testli). Her günün başlangıç ve bitiş noktası days.start_stay_id / end_stay_id;
// null = otel yok (gün ilk duraktan başlar, son durakta biter).
import type { Gun } from '@/lib/tipler';

export type Konaklama = {
  id: string;
  trip_id: string;
  place_id: string | null;
  lat: number;
  lng: number;
  label: string | null;
};

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
  const nokta = (k: Konaklama | null): UcNokta | null => (k ? { key: konaklamaAnahtari(k.id), lat: k.lat, lng: k.lng, konaklama: k } : null);
  return { baslangic: nokta(u.baslangic), bitis: nokta(u.bitis) };
}
