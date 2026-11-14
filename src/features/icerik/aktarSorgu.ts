// #97 C → #143: "Seyahatime al" yürütme — mekanlar havuza, duraklar hedef günlerin sonuna, olay yazılır. Mükerrer (place_id):
// aynı günde varsa atlanır, listede ama atanmamışsa seçilen güne taşınır (durak eklenir), başka günde varsa yerinde kalır.
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';

import { yeniGunUclari } from '@/features/konaklama/plan';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import { tarihEkle } from '@/lib/takvim';
import type { GeziDetay, GeziDuragi, GeziGunu, Gun, Mekan, SehirSecimi } from '@/lib/tipler';
import { sonAnahtar } from '@/schedule/sira';

import { sanalGunMu, type AktarmaPlani } from './aktar';
import { GEZI_ROTA_TAZE_MS, geziRotaAnahtari, gunRotasiniGetir } from './geziRota';
import { durakSuresi, yeniSeyahatGovdesi, yeniSeyahatGunleri, yeniSeyahatPlani, yeniSeyahatTarihleri } from './seyahateAl';
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

const sure = durakSuresi;

/** Planın durakları → Google kimliği (backoffice doldurmadıysa adıyla) ve çözülemeyenlerin sebebi. */
async function kimlikleriCoz(duraklar: GeziDuragi[], sehirAdi: string) {
  const kimlik = new Map<string, string | null>();
  await Promise.all(duraklar.map(async (d) => kimlik.set(d.id, await icerikPlaceId(d, sehirAdi))));
  const cozulen = duraklar.filter((d) => kimlik.get(d.id));
  const cozumsuzler = duraklar.filter((d) => !kimlik.get(d.id)).map((d) => ({ ad: d.ad, sebep: cozumSebebi(d.id) ?? 'bulunamadi' }));
  return { kimlik, cozulen, cozumsuzler };
}

/**
 * #192 KK5: gezinin gerçek yol bacakları seyahatin walk_cache'ine (fetched_at korunur) — Program bu bacaklar için Google'a
 * gitmez. Bacağı önbellekte olmayan gün önce hesaplanır (gezi başına bir kez, gün tek istek). İsteğe bağlı: hata aktarmayı bozmaz.
 */
async function rotayiKopyala(qc: QueryClient, seyahatId: string, gunler: GeziGunu[], duraklar: GeziDuragi[], kimlik: Map<string, string | null>): Promise<number> {
  try {
    const ilgili = new Set(duraklar.map((d) => d.gezi_gun_id));
    await Promise.all(gunler.filter((g) => ilgili.has(g.id) && g.gezi_duraklari.length >= 2).map((g) => qc.fetchQuery({ queryKey: geziRotaAnahtari(g), queryFn: () => gunRotasiniGetir(g), staleTime: GEZI_ROTA_TAZE_MS })));
    const eslesme = duraklar.filter((d) => kimlik.get(d.id)).map((d) => ({ durak_id: d.id, place_id: kimlik.get(d.id) }));
    const { data } = await supabase.rpc('gezi_rotasini_seyahate_kopyala', { p_trip: seyahatId, p_eslesme: eslesme });
    return typeof data === 'number' ? data : 0;
  } catch {
    // rota kopyası olmadan da aktarma tamam; Program eksik bacakları kendisi ister.
    return 0;
  }
}

/**
 * #193 KK5: seyahatin sonuna `n` gün — tarihliyse bitiş tarihi uzar (seyahat_tarihlerini_degistir; günler mevcut gün sayısından
 * sayılır, hiçbir gün silinmez), tarihsizse tarihsiz gün. Yeni günler son günün bitiş otelinden başlar ve oraya döner. Yeni
 * günlerin kimlikleri sırayla döner.
 */
async function sonaGunEkle(seyahatId: string, n: number): Promise<string[]> {
  const [{ data: trip, error: e1 }, { data: gunler, error: e2 }] = await Promise.all([
    supabase.from('trips').select('start_date').eq('id', seyahatId).single(),
    supabase.from('days').select('id, index, end_stay_id').eq('trip_id', seyahatId).order('index'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const mevcut = (gunler ?? []) as Pick<Gun, 'id' | 'index' | 'end_stay_id'>[];
  const sonIndex = mevcut.reduce((m, g) => Math.max(m, g.index), 0);
  const baslangic = (trip as { start_date: string | null }).start_date;
  if (baslangic) {
    const { error } = await supabase.rpc('seyahat_tarihlerini_degistir', { p_trip_id: seyahatId, p_start: baslangic, p_end: tarihEkle(baslangic, sonIndex + n - 1) });
    if (error) throw error;
  } else {
    const uclar = yeniGunUclari(mevcut);
    const { error } = await supabase.from('days').insert(Array.from({ length: n }, (_, i) => ({ trip_id: seyahatId, index: sonIndex + i + 1, date: null, ...uclar })));
    if (error) throw error;
  }
  const { data: yeni, error: e3 } = await supabase.from('days').select('id, index').eq('trip_id', seyahatId).gt('index', sonIndex).order('index');
  if (e3) throw e3;
  return ((yeni ?? []) as Pick<Gun, 'id'>[]).slice(0, n).map((g) => g.id);
}

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
      ekGunler,
    }: {
      seyahatId: string;
      geziId: string;
      sehirAdi: string;
      plan: AktarmaPlani;
      secenek: 'tum' | 'gunler' | 'mekan';
      /** #192: gezinin günleri — duraklar güne atanıyorsa bacakları walk_cache'e kopyalanır. */
      gunler?: GeziGunu[];
      /** #193 KK5: planın sanal hedefleri ("+1"…), sona eklenecekleri sırayla. */
      ekGunler?: string[];
    }): Promise<AktarmaSonucu> => {
      if (!session) throw new Error('oturum yok');
      // 1. Google kimlikleri (backoffice doldurmadıysa adıyla).
      const { kimlik, cozulen, cozumsuzler } = await kimlikleriCoz(plan.duraklar, sehirAdi);
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
      // #193 KK5: fazla gezi günleri için seyahatin sonuna gün eklenir; sanal hedefler yeni günlere.
      let atamalar = plan.atamalar;
      if (ekGunler?.length && atamalar.some((a) => sanalGunMu(a.gunId))) {
        const yeniGunler = await sonaGunEkle(seyahatId, ekGunler.length);
        const harita = new Map(ekGunler.map((id, i) => [id, yeniGunler[i]]));
        atamalar = atamalar.map((a) => (sanalGunMu(a.gunId) ? { ...a, gunId: harita.get(a.gunId) ?? a.gunId } : a));
      }
      atamalar = atamalar.filter((a) => !sanalGunMu(a.gunId));
      if (atamalar.length > 0) {
        const [{ data: havuz, error: e1 }, { data: duraklar, error: e2 }] = await Promise.all([
          supabase.from('places').select('id, place_id, default_minutes').eq('trip_id', seyahatId),
          supabase.from('stops').select('id, day_id, place_ref, order_key').eq('trip_id', seyahatId),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        const havuzIle = new Map((havuz as Pick<Mekan, 'id' | 'place_id' | 'default_minutes'>[]).map((m) => [m.place_id, m]));
        const atanmis = new Map((duraklar ?? []).map((s) => [s.place_ref as string, s]));
        for (const a of atamalar) {
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
      const rotaBacagi = eklenenDurak > 0 && gunler?.length ? await rotayiKopyala(qc, seyahatId, gunler, cozulen, kimlik) : 0;
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
        gun: atamalar.length,
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
      if (v.ekGunler?.length) {
        qc.invalidateQueries({ queryKey: ['gunler', v.seyahatId] });
        qc.invalidateQueries({ queryKey: ['seyahat', v.seyahatId] });
      }
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
      qc.invalidateQueries({ queryKey: ['icerik', 'gezi-alinma', v.geziId] });
    },
  });
}

export type YeniSeyahatGirdisi = {
  gezi: GeziDetay;
  /** Gezinin şehri (Google kimliği ve saat dilimiyle; sihirbazın şehir seçimiyle aynı yol). */
  sehir: SehirSecimi;
  gunSayisi: number;
  /** null → "Tarih sonra" (tarihsiz). */
  baslangic: string | null;
  /** 'plan': gezinin günleri sırayla; 'mekan': yalnız seçilen mekanlar, güne atanmadan (KK10). */
  secim: { tur: 'plan' } | { tur: 'mekan'; duraklar: GeziDuragi[] };
  /** KK3 ölçümü: sayfanın açıldığı an (sihirbazın `plan_kuruldu` süresiyle aynı). */
  baslangicAni: number;
};

export type YeniSeyahatSonucu = {
  /** Hiçbir mekan çözülemediyse seyahat açılmaz (null). */
  seyahatId: string | null;
  gun: number;
  eklenenDurak: number;
  eklenenMekan: number;
  cozumsuz: number;
  cozumsuzler: { ad: string; sebep: string }[];
};

/**
 * #193 KK2–KK3 · KK10: yeni seyahat akışın içinde — Google kimlikleri çözülür, sonra seyahat + günler + mekanlar + plan TEK
 * işlemde (`geziden_seyahat_ac`; hata olursa hiçbiri yazılmaz). Ardından (isteğe bağlı) gerçek yol bacakları kopyalanır ve olaylar
 * yazılır: `gezi_alindi` (yeni seyahat) ve planda `plan_kuruldu` (kaynak: gezi).
 */
export function useGezidenSeyahatAc() {
  const { session } = useOturum();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gezi, sehir, gunSayisi, baslangic, secim, baslangicAni }: YeniSeyahatGirdisi): Promise<YeniSeyahatSonucu> => {
      if (!session) throw new Error('oturum yok');
      const { gunler, plan } =
        secim.tur === 'plan'
          ? yeniSeyahatPlani(gezi, gunSayisi, baslangic)
          : { gunler: yeniSeyahatGunleri(gunSayisi, baslangic), plan: { duraklar: secim.duraklar, atamalar: [], listeyeKalan: secim.duraklar } satisfies AktarmaPlani };
      const { kimlik, cozulen, cozumsuzler } = await kimlikleriCoz(plan.duraklar, gezi.sehirler?.ad ?? sehir.ad);
      const govde = yeniSeyahatGovdesi(plan, gunler, kimlik);
      // #118 KK4: hiçbir mekan çözülemediyse boş seyahat açılmaz; sayfa açık kalır ve sebep söylenir.
      if (govde.mekanlar.length === 0) return { seyahatId: null, gun: gunler.length, eklenenDurak: 0, eklenenMekan: 0, cozumsuz: cozumsuzler.length, cozumsuzler };
      const { data, error } = await supabase.rpc('geziden_seyahat_ac', {
        p_seyahat: { name: gezi.baslik, city_place_id: sehir.place_id, city_label: sehir.ad, country_code: sehir.country_code, lat: sehir.lat, lng: sehir.lng, tz: sehir.tz, ...yeniSeyahatTarihleri(baslangic, gunSayisi) },
        p_gun_sayisi: gunler.length,
        p_mekanlar: govde.mekanlar,
        p_duraklar: govde.duraklar,
      });
      if (error) throw error;
      const seyahatId = data as string;
      if (govde.duraklar.length > 0) await rotayiKopyala(qc, seyahatId, gezi.gezi_gunleri, cozulen, kimlik);
      const doluGun = new Set(govde.duraklar.map((d) => d.gun)).size;
      await olayYaz('gezi_alindi', gezi.id, {
        seyahat: seyahatId,
        secenek: secim.tur === 'plan' ? 'tum' : 'mekan',
        yeni_seyahat: true,
        gun: doluGun,
        yeni: govde.duraklar.length,
        atlanan: 0,
        cozumsuz: cozumsuzler.length,
        mekan: govde.mekanlar.length,
        durak: govde.duraklar.length,
      });
      // KK3: sihirbazın "plan kuruldu" ölçümüyle aynı (mekan = atanan durak, gün = dolu gün, süre = sayfanın açılışından).
      if (secim.tur === 'plan')
        await olayYaz('plan_kuruldu', seyahatId, {
          kaynak: 'gezi',
          mekan: govde.duraklar.length,
          gun: doluGun,
          atanmamis: govde.mekanlar.length - govde.duraklar.length,
          sure_sn: Math.round((Date.now() - baslangicAni) / 1000),
        });
      return { seyahatId, gun: gunler.length, eklenenDurak: govde.duraklar.length, eklenenMekan: govde.mekanlar.length, cozumsuz: cozumsuzler.length, cozumsuzler };
    },
    onSettled: (_s, _e, v) => {
      qc.invalidateQueries({ queryKey: ['seyahatler'] });
      qc.invalidateQueries({ queryKey: ['seyahat-durumlari'] });
      qc.invalidateQueries({ queryKey: ['icerik', 'gezi-alinma', v.gezi.id] });
    },
  });
}
