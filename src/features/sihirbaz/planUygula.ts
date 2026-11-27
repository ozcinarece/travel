// #139 KK5: "Planı kur" — planKur sonucunu stops'a yazar (tek toplu insert). Yalnız güne atanmamış mekanlar dağıtılır;
// günlerde zaten olan duraklar yerinde kalır ve kapasiteyi doldurur. #141 "Günlere dağıt" aynı kancayı kullanır.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Konum } from '@/components/harita/tipler';
import { hafifOnbellek } from '@/features/yerler/api';
import { supabase } from '@/lib/supabase';
import { haftaGunu } from '@/lib/takvim';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { googleGunu, kapaliGunler, type Periyot } from '@/schedule/acilis';
import { sonAnahtar } from '@/schedule/sira';

import { durakDakikasi, planKur, type PlanMekani, type PlanSonucu } from './planKur';

/**
 * #582: dağıtım önceliği ve kapalı günler. `oylar`: mekan (places.id) → oy sayısı; `ilSira`: place_id → il listesi sırası;
 * `saatler`: place_id → haftalık periyotlar (yalnız bellekte, anlık okunur; DB'ye yazılmaz — PRD §7). Eksik alan = kural yok.
 */
export type PlanOnceligi = {
  oylar?: ReadonlyMap<string, number>;
  ilSira?: ReadonlyMap<string, number>;
  saatler?: ReadonlyMap<string, Periyot[] | null | undefined>;
};

// Kapasite, kayda yazılacak süreyle hesaplanır (durakDakikasi); gün kapasitesini aşan birkaç dakika kalmaz.
const planMekani = (m: Mekan, dakika = m.default_minutes): PlanMekani => ({ id: m.id, lat: m.lat, lng: m.lng, dakika: durakDakikasi(dakika) });

/** Yeni dağıtılacak mekan: öncelik ve (saat biliniyorsa) kapalı günlerle. */
function oncelikli(m: Mekan, o: PlanOnceligi | undefined): PlanMekani {
  const pm = planMekani(m);
  if (!o) return pm;
  const oy = o.oylar?.get(m.id);
  const ilSira = o.ilSira?.get(m.place_id);
  const kapali = o.saatler?.get(m.place_id);
  return {
    ...pm,
    ...(oy ? { oy } : {}),
    ...(ilSira != null ? { ilSira } : {}),
    ...(kapali ? { kapaliGunler: kapaliGunler(kapali) } : {}),
  };
}

export function planiHesapla(p: { mekanlar: Mekan[]; gunler: Gun[]; duraklar: Durak[]; baslangic?: Konum | null; oncelik?: PlanOnceligi }): PlanSonucu {
  const atanmis = new Set(p.duraklar.map((d) => d.place_ref));
  const mekanIle = new Map(p.mekanlar.map((m) => [m.id, m]));
  const mevcut = new Map<string, PlanMekani[]>();
  for (const g of p.gunler) {
    const liste = p.duraklar
      .filter((d) => d.day_id === g.id && !d.skipped)
      .sort((a, b) => (a.order_key < b.order_key ? -1 : 1))
      .map((d) => {
        const m = mekanIle.get(d.place_ref);
        return m ? planMekani(m, d.minutes) : null;
      })
      .filter((x): x is PlanMekani => !!x);
    mevcut.set(g.id, liste);
  }
  const bos = p.mekanlar.filter((m) => !atanmis.has(m.id)).map((m) => oncelikli(m, p.oncelik));
  return planKur(
    bos,
    p.gunler.map((g) => ({ id: g.id, index: g.index, haftaGunu: g.date ? googleGunu(haftaGunu(g.date)) : null })),
    { mevcut, baslangic: p.baslangic ?? null },
  );
}

/**
 * #582: önceliği anlık okur. Oylar ve il listesi sırası DB'den; açılış saatleri ortak places-light önbelleğinden (Plan /
 * Listem bu oturumda istediyse Google'a yeni istek yok; yoksa yalnız atanmamış mekanlar, 25'lik parçalarla). Saatler yalnız
 * bellekte kalır. Her parça bağımsız: biri okunamazsa o kural uygulanmaz, plan yine kurulur.
 */
export async function planOnceliginiOku(seyahatId: string, mekanlar: Mekan[], duraklar: Durak[], tarihli: boolean): Promise<PlanOnceligi> {
  const atanmis = new Set(duraklar.map((d) => d.place_ref));
  const bos = mekanlar.filter((m) => !atanmis.has(m.id));
  if (bos.length === 0) return {};
  const placeIdler = [...new Set(bos.map((m) => m.place_id).filter(Boolean))];
  const [oylar, ilSira, saatler] = await Promise.all([
    (async () => {
      const { data, error } = await supabase.from('oylar').select('mekan').eq('seyahat_id', seyahatId);
      if (error) return undefined;
      const say = new Map<string, number>();
      for (const o of (data ?? []) as { mekan: string }[]) say.set(o.mekan, (say.get(o.mekan) ?? 0) + 1);
      return say;
    })().catch(() => undefined),
    (async () => {
      if (placeIdler.length === 0) return undefined;
      const { data, error } = await supabase
        .from('il_oneriler')
        .select('place_id, sira, il_listeleri!inner(yayinda)')
        .in('place_id', placeIdler)
        .eq('gorunur', true)
        .eq('il_listeleri.yayinda', true);
      if (error) return undefined;
      const sira = new Map<string, number>();
      for (const r of (data ?? []) as { place_id: string | null; sira: number }[]) {
        if (!r.place_id) continue;
        const eski = sira.get(r.place_id);
        if (eski === undefined || r.sira < eski) sira.set(r.place_id, r.sira);
      }
      return sira;
    })().catch(() => undefined),
    // Tarihsiz seyahatte hafta günü yok → saat istenmez.
    (async () => {
      if (!tarihli || placeIdler.length === 0) return undefined;
      const yerler = await hafifOnbellek.getirHepsi(placeIdler, ['saat']);
      return new Map(placeIdler.map((id) => [id, yerler[id]?.periyotlar] as const));
    })().catch(() => undefined),
  ]);
  return { oylar, ilSira, saatler };
}

export function usePlaniUygula(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { mekanlar: Mekan[]; gunler: Gun[]; duraklar: Durak[]; baslangic?: Konum | null }) => {
      const oncelik = await planOnceliginiOku(seyahatId, p.mekanlar, p.duraklar, p.gunler.some((g) => !!g.date));
      const plan = planiHesapla({ ...p, oncelik });
      const satirlar: { trip_id: string; day_id: string; place_ref: string; order_key: string; minutes: number }[] = [];
      for (const g of plan.gunler) {
        let anahtarlar = p.duraklar.filter((d) => d.day_id === g.gunId).map((d) => d.order_key);
        for (const m of g.mekanlar) {
          const k = sonAnahtar(anahtarlar);
          anahtarlar = [...anahtarlar, k];
          satirlar.push({ trip_id: seyahatId, day_id: g.gunId, place_ref: m.id, order_key: k, minutes: m.dakika });
        }
      }
      if (satirlar.length > 0) {
        const { error } = await supabase.from('stops').insert(satirlar);
        if (error) throw error;
      }
      return plan;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['duraklar', seyahatId] }),
  });
}
