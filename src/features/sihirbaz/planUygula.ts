// #139 KK5: "Planı kur" — planKur sonucunu stops'a yazar (tek toplu insert). Yalnız güne atanmamış mekanlar dağıtılır;
// günlerde zaten olan duraklar yerinde kalır ve kapasiteyi doldurur. #141 "Günlere dağıt" aynı kancayı kullanır.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Konum } from '@/components/harita/tipler';
import { ilSlugu } from '@/features/icerik/ilOnerileri';
import { sehirEslestir } from '@/features/icerik/sorgular';
import { hafifOnbellek, useSaatOnbellegi } from '@/features/yerler/api';
import { supabase } from '@/lib/supabase';
import { haftaGunu } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Sehir } from '@/lib/tipler';
import { googleGunu, kapaliGunler, type Periyot } from '@/schedule/acilis';
import { sonAnahtar } from '@/schedule/sira';

import { durakDakikasi, gezmeSirasi, oncelikSirasi, planKur, type PlanMekani, type PlanSonucu } from './planKur';

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

/** #582: "Planı kur"un saat okumasına süre sınırı; aşılırsa plan saatsiz (kapalı gün kuralı olmadan) kurulur. */
export const SAAT_SURESI_MS = 4000;

/** `ms` içinde bitmezse ya da hata verirse undefined. */
export function sureli<T>(is: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((coz) => {
    const z = setTimeout(() => coz(undefined), ms);
    is.then(
      (v) => {
        clearTimeout(z);
        coz(v);
      },
      () => {
        clearTimeout(z);
        coz(undefined);
      },
    );
  });
}

/** Seyahatin il listesi anahtarı (uygulamadaki `ilSlugu` ile aynı: rehber şehri, yoksa şehir adı). Okunamazsa null. */
async function seyahatIlSlugu(seyahatId: string): Promise<string | null> {
  const [seyahat, sehirler] = await Promise.all([
    supabase.from('trips').select('city_label, lat, lng').eq('id', seyahatId).maybeSingle(),
    supabase.from('sehirler').select('id, ad, slug, lat, lng'),
  ]);
  const s = seyahat.data as { city_label: string | null; lat: number | null; lng: number | null } | null;
  if (seyahat.error || !s) return null;
  const sehir = sehirEslestir((sehirler.data ?? undefined) as Sehir[] | undefined, s.city_label ? { ad: s.city_label, lat: s.lat, lng: s.lng } : null);
  return ilSlugu(sehir, s.city_label);
}

/** #595 KK1: "Planı kur" başına en çok bu kadar yer için açılış saati istenir (Place Details). Önbellekteki saat sayılmaz. */
export const SAAT_TAVANI = 15;

/** Seyahatin oyları: mekan (places.id) → oy sayısı. Okunamazsa undefined. */
async function oylariOku(seyahatId: string): Promise<Map<string, number> | undefined> {
  const { data, error } = await supabase.from('oylar').select('mekan').eq('seyahat_id', seyahatId);
  if (error) return undefined;
  const say = new Map<string, number>();
  for (const o of (data ?? []) as { mekan: string }[]) say.set(o.mekan, (say.get(o.mekan) ?? 0) + 1);
  return say;
}

/** İl listesi sırası: place_id → sıra (yalnız seyahatin ilinin yayındaki listesi). `ilSlug` verilmezse seyahatten çözülür. */
async function ilSirasiniOku(seyahatId: string, placeIdler: string[], ilSlug: string | null | undefined): Promise<Map<string, number> | undefined> {
  if (placeIdler.length === 0) return undefined;
  const slug = ilSlug !== undefined ? ilSlug : await seyahatIlSlugu(seyahatId);
  // Başka ilin listesindeki sıra karışmaz: yalnız bu ilin listesi.
  if (!slug) return undefined;
  const { data, error } = await supabase
    .from('il_oneriler')
    .select('place_id, sira, il_listeleri!inner(yayinda)')
    .eq('il_slug', slug)
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
}

/** Atanmamış mekanların tekil place_id'leri. */
function bosYerler(mekanlar: Mekan[], duraklar: Durak[]): { bos: Mekan[]; placeIdler: string[] } {
  const atanmis = new Set(duraklar.map((d) => d.place_ref));
  const bos = mekanlar.filter((m) => !atanmis.has(m.id));
  return { bos, placeIdler: [...new Set(bos.map((m) => m.place_id).filter(Boolean))] };
}

/** #595 KK3: yalnız ortak oturum önbelleğindeki saatler (istek yok). Hiçbiri yoksa undefined (kural uygulanmaz). */
export function onbellektekiSaatler(placeIdler: string[]): Map<string, Periyot[] | null | undefined> | undefined {
  const saatler = new Map<string, Periyot[] | null | undefined>();
  for (const id of placeIdler) {
    const y = hafifOnbellek.oku(id, ['saat']);
    if (y) saatler.set(id, y.periyotlar);
  }
  return saatler.size > 0 ? saatler : undefined;
}

/**
 * #595 KK1: saati istenecek yerler — önbellekte saati olmayanlardan dağıtım sırasıyla (önce oy, sonra il sırası; #582 KK1)
 * ilk `SAAT_TAVANI` tanesi.
 */
export function saatIstenecekler(bos: Mekan[], oncelik: Pick<PlanOnceligi, 'oylar' | 'ilSira'>, onbellekte: ReadonlySet<string>): string[] {
  // planKur'la aynı sıra: önce gezme (yakınlık) sırası, üstüne oy ve il sırası.
  const sira = oncelikSirasi(gezmeSirasi(bos.map((m) => oncelikli(m, oncelik))).sira).sira;
  const placeId = new Map(bos.map((m) => [m.id, m.place_id]));
  const secilen: string[] = [];
  for (const pm of sira) {
    const id = placeId.get(pm.id);
    if (!id || onbellekte.has(id) || secilen.includes(id)) continue;
    secilen.push(id);
    if (secilen.length === SAAT_TAVANI) break;
  }
  return secilen;
}

/**
 * #582: önceliği anlık okur. Oylar ve il listesi sırası DB'den (yalnız seyahatin ilinin yayındaki listesi); açılış saatleri
 * ortak places-light önbelleğinden. #595 KK1: önbellekte saati olmayan yerlerden dağıtım sırasıyla en çok `SAAT_TAVANI`
 * tanesi istenir (tarihli seyahatte; ⌈N/25⌉ = 1 istek, en çok 15 Details). Saat okuması `SAAT_SURESI_MS` ile sınırlı;
 * aşılırsa yalnız önbellektekiler kullanılır. Saatler yalnız bellekte kalır. Her parça bağımsız: biri okunamazsa o kural
 * uygulanmaz, plan yine kurulur. `ilSlug` verilmezse seyahatten çözülür.
 */
export async function planOnceliginiOku(
  seyahatId: string,
  mekanlar: Mekan[],
  duraklar: Durak[],
  tarihli: boolean,
  secenek: { ilSlug?: string | null; saatSuresiMs?: number } = {},
): Promise<PlanOnceligi> {
  const { bos, placeIdler } = bosYerler(mekanlar, duraklar);
  if (bos.length === 0) return {};
  // Saat isteğinin sırası oy ve il sırasına bağlı (KK1): önce bu ikisi.
  const [oylar, ilSira] = await Promise.all([
    oylariOku(seyahatId).catch(() => undefined),
    ilSirasiniOku(seyahatId, placeIdler, secenek.ilSlug).catch(() => undefined),
  ]);
  // Tarihsiz seyahatte hafta günü yok → saat istenmez.
  const saatler = await (async () => {
    if (!tarihli || placeIdler.length === 0) return undefined;
    const onbellek = onbellektekiSaatler(placeIdler);
    const istenecek = saatIstenecekler(bos, { oylar, ilSira }, new Set(onbellek?.keys() ?? []));
    const gelen = istenecek.length ? await sureli(hafifOnbellek.getirHepsi(istenecek, ['saat']), secenek.saatSuresiMs ?? SAAT_SURESI_MS) : undefined;
    const sonuc = new Map(onbellek ?? []);
    for (const id of istenecek) if (gelen?.[id]) sonuc.set(id, gelen[id].periyotlar);
    return sonuc.size > 0 ? sonuc : undefined;
  })().catch(() => undefined);
  return { oylar, ilSira, saatler };
}

/**
 * #595 KK3: sihirbazın "K yer sığmıyor" önizlemesi "Planı kur" ile aynı kuralla — oy, il sırası ve (önbellekte varsa)
 * kapalı günler. Google'a istek atmaz: oy ve il sırası DB'den, saat yalnız ortak önbellekten (geldikçe yeniden hesaplanır).
 */
export function usePlanOnizlemeOnceligi(seyahatId: string | null, mekanlar: Mekan[] | undefined, duraklar: Durak[] | undefined, tarihli: boolean, ilSlug?: string | null): PlanOnceligi | undefined {
  const { placeIdler } = useMemo(() => bosYerler(mekanlar ?? [], duraklar ?? []), [mekanlar, duraklar]);
  const db = useQuery({
    // 'oylar' önekiyle: oy verilince (Listem, gerçek zamanlı) ['oylar', seyahatId] geçersiz sayılır, bu da onunla yenilenir.
    queryKey: ['oylar', seyahatId, 'plan-onceligi', ilSlug === undefined ? 'seyahatten' : ilSlug, placeIdler],
    enabled: !!seyahatId && placeIdler.length > 0,
    staleTime: 30 * 1000,
    placeholderData: (onceki) => onceki,
    queryFn: async () => {
      const [oylar, ilSira] = await Promise.all([
        oylariOku(seyahatId!).catch(() => undefined),
        ilSirasiniOku(seyahatId!, placeIdler, ilSlug).catch(() => undefined),
      ]);
      return { oylar, ilSira };
    },
  });
  const saatSurumu = useSaatOnbellegi(tarihli);
  return useMemo(() => {
    if (!mekanlar || !duraklar) return undefined;
    // saatSurumu: önbelleğe saat girince yeniden oku.
    void saatSurumu;
    const saatler = tarihli ? onbellektekiSaatler(placeIdler) : undefined;
    return { oylar: db.data?.oylar, ilSira: db.data?.ilSira, saatler };
  }, [mekanlar, duraklar, tarihli, placeIdler, db.data, saatSurumu]);
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
