// #308 KK1 (kanvas `Sayfa_v7_Seyahat_*`): seyahat sayfasının üstündeki 260 pt haritanın pinleri ve çizgileri. Saf hesap; Google'a
// istek yok. Gezi modunda bugünün yürüme çizgisi çağırandan gelir (`programCizgileri`, önbellekteki `walk_cache`); plan
// modunda her günün durakları gün renginde, aralarında kuş uçuşu çizgi (rota tonu).
import type { HaritaCizgisi, HaritaPini, Konum } from '@/components/harita/tipler';
import { konumu } from '@/lib/konum';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { gunRengi, renk, rotaRengi } from '@/theme';

import { geziKadraji } from './yakinda';

export type UstHaritaHali = 'plan' | 'gezi' | 'bos';

const sirayla = (a: Durak, b: Durak) => (a.order_key < b.order_key ? -1 : a.order_key > b.order_key ? 1 : 0);

function gununPinleri(g: Gun, duraklar: Durak[], mekanIle: Map<string, Mekan>): { pinler: HaritaPini[]; noktalar: Konum[] } {
  const pinler: HaritaPini[] = [];
  const noktalar: Konum[] = [];
  duraklar
    .filter((d) => d.day_id === g.id && !d.skipped)
    .sort(sirayla)
    .forEach((d, i) => {
      const k = konumu(mekanIle.get(d.place_ref));
      if (!k) return;
      noktalar.push(k);
      pinler.push({ id: `durak:${d.id}`, tur: 'durak', konum: k, renk: gunRengi(g.index), etiket: String(i + 1), tamam: !!d.completed_at });
    });
  return { pinler, noktalar };
}

export function ustHaritaVerisi(p: {
  hal: UstHaritaHali;
  gunler: Gun[];
  duraklar: Durak[];
  mekanlar: Mekan[];
  bugunGunId: string | null;
  konum: Konum | null;
  otel: Konum | null;
  /** Öneri pinleri (beyaz, lacivert kenarlı): boş gün ve #532 "Yakında, bugüne ekle". */
  oneriler: { id: string; konum: Konum }[];
  /** Gezi modunda bugünün yürüme çizgileri (önbellekten). */
  bugunCizgileri: HaritaCizgisi[];
}): { pinler: HaritaPini[]; cizgiler: HaritaCizgisi[]; /** #532 KK1: kadraja sığdırılacak noktalar; boşsa şehir merkezi. */ sigdir: Konum[] } {
  const mekanIle = new Map(p.mekanlar.map((m) => [m.id, m]));
  const pinler: HaritaPini[] = [];
  const cizgiler: HaritaCizgisi[] = [];
  if (p.hal === 'plan') {
    for (const g of [...p.gunler].sort((a, b) => a.index - b.index)) {
      const gun = gununPinleri(g, p.duraklar, mekanIle);
      pinler.push(...gun.pinler);
      if (gun.noktalar.length > 1) cizgiler.push({ id: `ust:${g.id}`, noktalar: gun.noktalar, renk: rotaRengi(g.index), ince: true });
    }
  } else if (p.hal === 'gezi') {
    const bugun = p.gunler.find((g) => g.id === p.bugunGunId);
    if (bugun) pinler.push(...gununPinleri(bugun, p.duraklar, mekanIle).pinler);
    for (const o of p.oneriler) pinler.push({ id: `ust:oneri:${o.id}`, tur: 'oneri', konum: o.konum, renk: renk.zemin, kategoriRenk: renk.ana });
    cizgiler.push(...p.bugunCizgileri);
  } else {
    if (p.otel) pinler.push({ id: 'ust:otel', tur: 'otel', konum: p.otel, renk: renk.ana });
    for (const o of p.oneriler) pinler.push({ id: `ust:oneri:${o.id}`, tur: 'oneri', konum: o.konum, renk: renk.zemin, kategoriRenk: renk.ana });
  }
  // KK1: konum izni yoksa konum noktası çizilmez (çağıran null verir).
  if (p.konum && p.hal !== 'plan') pinler.push({ id: 'ust:konum', tur: 'konum', konum: p.konum, renk: renk.ana });
  // #532 KK1: plan modu değişmez (bütün pinler); gezi ve boş günde kadraj bugüne odaklanır, uzaktaki konum kadrajı bozmaz.
  const sigdir =
    p.hal === 'plan'
      ? pinler.map((x) => x.konum)
      : geziKadraji({
          duraklar: pinler.filter((x) => x.tur === 'durak').map((x) => x.konum),
          oneriler: p.oneriler.map((o) => o.konum),
          otel: p.hal === 'bos' ? p.otel : null,
          konum: p.konum,
        });
  return { pinler, cizgiler, sigdir };
}
