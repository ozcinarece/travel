// #181 KK5 (kanvas 23 · 27): Gezi sayfasında kapağın altındaki tek, sessiz "Sıradaki adım" satırı. Öncelik sırasıyla ilk doğru
// koşul gösterilir; biri bitince sıradaki gelir. Gezi modunda ve bitmiş gezide satır yok (gezi modunda yerine bugünün durak
// kartı; 8 "Gezi bitti → Harcamaları kapat" Harcamalar (#183) ile gelir). Koşulların hiçbiri yoksa satır gizlenir.
import { pinKategorisi } from '@/lib/pinIkonu';
import type { Durak, Gun, Mekan } from '@/lib/tipler';

export type GeziModu = 'plan' | 'gezi' | 'bitti';

export type SiradakiAdim =
  /** 1 Plan kurulmamış (hiç durak yok) → Planı kur. `mekanSayisi` 0 ise önce mekan seçilir. */
  | { tur: 'planKur'; mekanSayisi: number }
  /** 2 Güne atanmamış mekan → Dağıt. `otelYok`: satırın altına "otel de seçilmedi" eklenir. */
  | { tur: 'dagit'; mekanIdleri: string[]; otelYok: boolean }
  /** 3 Otel yok → Otel seç. */
  | { tur: 'otel' }
  /** 4 Tek kişi → Davet et. */
  | { tur: 'davet' }
  /** 5 Bir günde yemek durağı yok → Öğle yemeği ekle. */
  | { tur: 'yemek'; gun: Gun }
  /** 6 Yarın başlıyor → İlk durak ve çıkış saati. */
  | { tur: 'yarin'; ilkMekanId: string | null; cikis: string };

export type SiradakiGirdi = {
  mod: GeziModu;
  gunler: Gun[];
  duraklar: Durak[];
  mekanlar: Mekan[];
  /** Seyahatin oteli (stays) var mı. */
  otelVar: boolean;
  /** Plan sekmesindeki otel şeridinde "Şimdi değil" dendi (cihazda); otel adımı atlanır. */
  otelErtelendi?: boolean;
  uyeSayisi: number;
  /** Seyahat dilimine göre bugün (YYYY-MM-DD) ve seyahatin gidiş tarihi. */
  bugun: string;
  baslangic: string | null;
  /** "HH:MM" — 1. günün çıkış saati (days.start_time, yoksa trips.day_start). */
  ilkGunCikis: string;
};

const sira = (a: { order_key: string }, b: { order_key: string }) => (a.order_key < b.order_key ? -1 : a.order_key > b.order_key ? 1 : 0);

/** YYYY-MM-DD + 1 gün. */
function ertesiGun(tarih: string): string {
  const [y, a, g] = tarih.split('-').map(Number);
  return new Date(Date.UTC(y, a - 1, g + 1)).toISOString().slice(0, 10);
}

/** Öncelik: plan kur → dağıt → otel → davet → yemek → yarın. Gezi / bitmiş gezide null. */
export function siradakiAdim(g: SiradakiGirdi): SiradakiAdim | null {
  if (g.mod !== 'plan') return null;
  const aktif = g.duraklar.filter((d) => !d.skipped);
  if (g.duraklar.length === 0) return { tur: 'planKur', mekanSayisi: g.mekanlar.length };

  const atanan = new Set(g.duraklar.map((d) => d.place_ref));
  const atanmamis = g.mekanlar.filter((m) => !atanan.has(m.id)).sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  if (atanmamis.length > 0) return { tur: 'dagit', mekanIdleri: atanmamis.map((m) => m.id), otelYok: !g.otelVar };

  if (!g.otelVar && !g.otelErtelendi) return { tur: 'otel' };
  if (g.uyeSayisi <= 1) return { tur: 'davet' };

  const mekanIle = new Map(g.mekanlar.map((m) => [m.id, m]));
  for (const gun of [...g.gunler].sort((a, b) => a.index - b.index)) {
    const gunun = aktif.filter((d) => d.day_id === gun.id);
    if (gunun.length === 0) continue;
    if (!gunun.some((d) => pinKategorisi(mekanIle.get(d.place_ref)?.primary_type) === 'yemek')) return { tur: 'yemek', gun };
  }

  if (g.baslangic && g.baslangic === ertesiGun(g.bugun)) {
    const ilkGun = [...g.gunler].sort((a, b) => a.index - b.index)[0];
    const ilk = ilkGun ? aktif.filter((d) => d.day_id === ilkGun.id).sort(sira)[0] : undefined;
    return { tur: 'yarin', ilkMekanId: ilk?.place_ref ?? null, cikis: g.ilkGunCikis };
  }
  return null;
}
