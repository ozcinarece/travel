// #97 C: "Geziyi seyahatime al" yürütme — mekanlar havuza, duraklar hedef günlerin sonuna, olay yazılır.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { GeziDuragi, Mekan } from '@/lib/tipler';
import { sonAnahtar } from '@/schedule/sira';

import type { AktarmaPlani } from './aktar';
import { cozumSebebi, icerikPlaceId, olayYaz } from './sorgular';

export type AktarmaSonucu = { eklenenMekan: number; eklenenDurak: number; cozumsuz: number; /** #118: çözülemeyenlerin adı ve sebebi (ilk üçü). */ cozumsuzler: { ad: string; sebep: string }[]; /** Havuzda zaten olanlar. */ zatenVar: number; ilkGunId: string | null; ilkGunIndex: number | null };

export function useGeziAktar() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ seyahatId, geziId, sehirAdi, plan }: { seyahatId: string; geziId: string; sehirAdi: string; plan: AktarmaPlani }): Promise<AktarmaSonucu> => {
      if (!session) throw new Error('oturum yok');
      // 1. Google kimlikleri (backoffice doldurmadıysa adıyla).
      const kimlik = new Map<string, string | null>();
      await Promise.all(plan.duraklar.map(async (d) => kimlik.set(d.id, await icerikPlaceId(d, sehirAdi))));
      const cozulen = plan.duraklar.filter((d) => kimlik.get(d.id));
      const cozumsuzler = plan.duraklar.filter((d) => !kimlik.get(d.id)).map((d) => ({ ad: d.ad, sebep: cozumSebebi(d.id) ?? 'bulunamadi' }));
      let zatenVar = 0;
      // 2. Havuz: tekil place_id ile ekle (zaten varsa 23505 → sessiz).
      const gorulen = new Set<string>();
      let eklenenMekan = 0;
      for (const d of cozulen) {
        const pid = kimlik.get(d.id)!;
        if (gorulen.has(pid)) continue;
        gorulen.add(pid);
        const { error } = await supabase.from('places').insert({ trip_id: seyahatId, place_id: pid, primary_type: d.kategori, lat: d.lat, lng: d.lng, default_minutes: d.sure_dk, added_by: session.user.id });
        if (error && error.code !== '23505') throw error;
        if (!error) eklenenMekan += 1;
        else zatenVar += 1;
      }
      // 3. Günlere ata: havuz satırları + hedef günün mevcut durakları (sonuna, KK3).
      let eklenenDurak = 0;
      let ilkGunId: string | null = null;
      if (plan.atamalar.length > 0) {
        const [{ data: havuz, error: e1 }, { data: duraklar, error: e2 }] = await Promise.all([
          supabase.from('places').select('id, place_id, default_minutes').eq('trip_id', seyahatId),
          supabase.from('stops').select('id, day_id, place_ref, order_key').eq('trip_id', seyahatId),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        const havuzIle = new Map((havuz as Pick<Mekan, 'id' | 'place_id' | 'default_minutes'>[]).map((m) => [m.place_id, m]));
        const atanmis = new Map((duraklar ?? []).map((s) => [s.place_ref as string, s]));
        for (const a of plan.atamalar) {
          const anahtarlar = (duraklar ?? []).filter((s) => s.day_id === a.gunId).map((s) => s.order_key as string);
          for (const d of a.duraklar as GeziDuragi[]) {
            const pid = kimlik.get(d.id);
            const m = pid ? havuzIle.get(pid) : undefined;
            if (!m) continue;
            const mevcut = atanmis.get(m.id);
            const order_key = sonAnahtar(anahtarlar);
            anahtarlar.push(order_key);
            // Zaten bir güne atanmışsa yerinde bırakılır (KK3: hiçbir durak silinmez / taşınmaz).
            if (mevcut) continue;
            const { error } = await supabase.from('stops').insert({ trip_id: seyahatId, day_id: a.gunId, place_ref: m.id, order_key, minutes: Math.min(480, Math.max(15, Math.round(d.sure_dk / 15) * 15)) });
            if (error) throw error;
            atanmis.set(m.id, { id: '', day_id: a.gunId, place_ref: m.id, order_key });
            eklenenDurak += 1;
            ilkGunId ??= a.gunId;
          }
          ilkGunId ??= a.gunId;
        }
      }
      // Program ekranı günü `gun` (index) parametresiyle seçer.
      let ilkGunIndex: number | null = null;
      if (ilkGunId) {
        const { data: gun } = await supabase.from('days').select('index').eq('id', ilkGunId).maybeSingle();
        ilkGunIndex = typeof gun?.index === 'number' ? gun.index : null;
      }
      await olayYaz('gezi_alindi', geziId, { seyahat: seyahatId, mekan: eklenenMekan, durak: eklenenDurak });
      return { eklenenMekan, eklenenDurak, cozumsuz: plan.duraklar.length - cozulen.length, cozumsuzler, zatenVar, ilkGunId, ilkGunIndex };
    },
    onSettled: (_s, _e, v) => {
      qc.invalidateQueries({ queryKey: ['mekanlar', v.seyahatId] });
      qc.invalidateQueries({ queryKey: ['duraklar', v.seyahatId] });
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
    },
  });
}
