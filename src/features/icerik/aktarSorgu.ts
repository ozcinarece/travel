// #97 C → #143: "Seyahatime al" yürütme — mekanlar havuza, duraklar hedef günlerin sonuna, olay yazılır. Mükerrer (place_id):
// aynı günde varsa atlanır, listede ama atanmamışsa seçilen güne taşınır (durak eklenir), başka günde varsa yerinde kalır.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { GeziDuragi, GeziGunu, Mekan } from '@/lib/tipler';
import { sonAnahtar } from '@/schedule/sira';

import type { AktarmaPlani } from './aktar';
import { GEZI_ROTA_TAZE_MS, geziRotaAnahtari, gunRotasiniGetir } from './geziRota';
import { cozumSebebi, icerikPlaceId, olayYaz } from './sorgular';

export type AktarmaSonucu = {
  eklenenMekan: number;
  eklenenDurak: number;
  cozumsuz: number;
  /** #118: çözülemeyenlerin adı ve sebebi. */
  cozumsuzler: { ad: string; sebep: string }[];
  /** Havuzda zaten olanlar. */
  zatenVar: number;
  /** #143 KK6: aynı günde zaten olduğu için atlanan / başka günde olduğu için yerinde bırakılan durak. */
  ayniGunde: number;
  baskaGunde: number;
  ilkGunId: string | null;
  ilkGunIndex: number | null;
  /** #192 KK5: seyahatin walk_cache'ine kopyalanan gerçek yol bacağı sayısı. */
  rotaBacagi: number;
};

const sure = (d: GeziDuragi) => Math.min(480, Math.max(15, Math.round(d.sure_dk)));

export function useGeziAktar() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      seyahatId,
      geziId,
      sehirAdi,
      plan,
      secenek,
      gunler,
    }: {
      seyahatId: string;
      geziId: string;
      sehirAdi: string;
      plan: AktarmaPlani;
      secenek: 'tum' | 'gunler' | 'mekan';
      /** #192: gezinin günleri — duraklar güne atanıyorsa bacakları walk_cache'e kopyalanır. */
      gunler?: GeziGunu[];
    }): Promise<AktarmaSonucu> => {
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
        const { error } = await supabase.from('places').insert({ trip_id: seyahatId, place_id: pid, primary_type: d.kategori, lat: d.lat, lng: d.lng, default_minutes: sure(d), added_by: session.user.id });
        if (error && error.code !== '23505') throw error;
        if (!error) eklenenMekan += 1;
        else zatenVar += 1;
      }
      // 3. Günlere ata: havuz satırları + hedef günün mevcut durakları (sonuna, KK3).
      let eklenenDurak = 0;
      let ayniGunde = 0;
      let baskaGunde = 0;
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
            // Zaten bir güne atanmışsa yerinde bırakılır (aynı gün → atlandı, başka gün → yerinde kalır; hiçbir durak silinmez).
            if (mevcut) {
              if (mevcut.day_id === a.gunId) ayniGunde += 1;
              else baskaGunde += 1;
              continue;
            }
            const order_key = sonAnahtar(anahtarlar);
            anahtarlar.push(order_key);
            // #140: süre yuvarlanmaz (15–480 dk sınırı).
            const { error } = await supabase.from('stops').insert({ trip_id: seyahatId, day_id: a.gunId, place_ref: m.id, order_key, minutes: sure(d) });
            if (error) throw error;
            atanmis.set(m.id, { id: '', day_id: a.gunId, place_ref: m.id, order_key });
            eklenenDurak += 1;
            ilkGunId ??= a.gunId;
          }
          ilkGunId ??= a.gunId;
        }
      }
      // #192 KK5: gezinin gerçek yol bacakları seyahatin walk_cache'ine (fetched_at korunur) — Program bu bacaklar için Google'a
      // gitmez. Bacağı önbellekte olmayan gün önce hesaplanır (gezi başına bir kez, gün tek istek). İsteğe bağlı: hata aktarmayı bozmaz.
      let rotaBacagi = 0;
      if (eklenenDurak > 0 && gunler?.length) {
        try {
          const ilgili = new Set(plan.duraklar.map((d) => d.gezi_gun_id));
          await Promise.all(gunler.filter((g) => ilgili.has(g.id) && g.gezi_duraklari.length >= 2).map((g) => qc.fetchQuery({ queryKey: geziRotaAnahtari(g), queryFn: () => gunRotasiniGetir(g), staleTime: GEZI_ROTA_TAZE_MS })));
          const eslesme = cozulen.map((d) => ({ durak_id: d.id, place_id: kimlik.get(d.id) }));
          const { data } = await supabase.rpc('gezi_rotasini_seyahate_kopyala', { p_trip: seyahatId, p_eslesme: eslesme });
          rotaBacagi = typeof data === 'number' ? data : 0;
        } catch {
          // rota kopyası olmadan da aktarma tamam; Program eksik bacakları kendisi ister.
        }
      }
      // Program ekranı günü `gun` (index) parametresiyle seçer.
      let ilkGunIndex: number | null = null;
      if (ilkGunId) {
        const { data: gun } = await supabase.from('days').select('index').eq('id', ilkGunId).maybeSingle();
        ilkGunIndex = typeof gun?.index === 'number' ? gun.index : null;
      }
      // KK7: gün sayısı, yeni durak, atlanan (mükerrer); `secenek` backoffice kırılımı, `mekan`/`durak` eski sayımlarla uyumlu.
      await olayYaz('gezi_alindi', geziId, {
        seyahat: seyahatId,
        secenek,
        gun: plan.atamalar.length,
        yeni: eklenenDurak,
        atlanan: ayniGunde + baskaGunde,
        cozumsuz: plan.duraklar.length - cozulen.length,
        mekan: eklenenMekan,
        durak: eklenenDurak,
      });
      return { eklenenMekan, eklenenDurak, cozumsuz: plan.duraklar.length - cozulen.length, cozumsuzler, zatenVar, ayniGunde, baskaGunde, ilkGunId, ilkGunIndex, rotaBacagi };
    },
    onSettled: (_s, _e, v) => {
      qc.invalidateQueries({ queryKey: ['mekanlar', v.seyahatId] });
      qc.invalidateQueries({ queryKey: ['duraklar', v.seyahatId] });
      qc.invalidateQueries({ queryKey: ['rota-onbellek', v.seyahatId] });
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
      qc.invalidateQueries({ queryKey: ['icerik', 'gezi-alinma', v.geziId] });
    },
  });
}
