// #139 KK5: "Planı kur" — planKur sonucunu stops'a yazar (tek toplu insert). Yalnız güne atanmamış mekanlar dağıtılır;
// günlerde zaten olan duraklar yerinde kalır ve kapasiteyi doldurur. #141 "Günlere dağıt" aynı kancayı kullanır.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Konum } from '@/components/harita/tipler';
import { supabase } from '@/lib/supabase';
import type { Durak, Gun, Mekan } from '@/lib/tipler';
import { sonAnahtar } from '@/schedule/sira';

import { durakDakikasi, planKur, type PlanMekani, type PlanSonucu } from './planKur';

// Kapasite, kayda yazılacak süreyle hesaplanır (durakDakikasi); gün kapasitesini aşan birkaç dakika kalmaz.
const planMekani = (m: Mekan, dakika = m.default_minutes): PlanMekani => ({ id: m.id, lat: m.lat, lng: m.lng, dakika: durakDakikasi(dakika) });

export function planiHesapla(p: { mekanlar: Mekan[]; gunler: Gun[]; duraklar: Durak[]; baslangic?: Konum | null }): PlanSonucu {
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
  const bos = p.mekanlar.filter((m) => !atanmis.has(m.id)).map((m) => planMekani(m));
  return planKur(bos, p.gunler.map((g) => ({ id: g.id, index: g.index })), { mevcut, baslangic: p.baslangic ?? null });
}

export function usePlaniUygula(seyahatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { mekanlar: Mekan[]; gunler: Gun[]; duraklar: Durak[]; baslangic?: Konum | null }) => {
      const plan = planiHesapla(p);
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
