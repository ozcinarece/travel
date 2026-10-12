// #97 / #98 / #100: içerik tabloları (sehirler, yerler, geziler, kaydedilenler, olaylar) — yayınlı okunur; backoffice yazar.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Gezi, GeziDetay, Kaydedilen, KaydedilenTuru, OlayTuru, Sehir, Yer } from '@/lib/tipler';

import { otomatikTamamla } from '../yerler/api';

const GUN_MS = 24 * 60 * 60 * 1000;

/** Yayınlı şehirler + gezi sayısı ("N gezi"; #98 karoları, #97 filtreleri). */
export function useSehirler() {
  return useQuery({
    queryKey: ['icerik', 'sehirler'],
    staleTime: GUN_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('sehirler').select('id, ad, slug, kapak_url, lat, lng, geziler(count)').order('ad');
      if (error) throw error;
      return (data as unknown as (Sehir & { geziler: { count: number }[] })[]).map(({ geziler, ...s }) => ({ ...s, gezi_sayisi: geziler?.[0]?.count ?? 0 }) as Sehir);
    },
  });
}

const YER_ALANLARI = 'id, sehir_id, place_id, ad, kategori, rehber_md, kapak_url, one_cikan_sira, lat, lng';

/** Şehrin yayınlı yerleri, öne çıkan sırasıyla (#98 Rehberden, #100 rehber). */
export function useSehirYerleri(sehirId: string | undefined) {
  return useQuery({
    queryKey: ['icerik', 'yerler', sehirId],
    enabled: !!sehirId,
    staleTime: GUN_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('yerler').select(YER_ALANLARI).eq('sehir_id', sehirId!).order('one_cikan_sira', { ascending: true, nullsFirst: false }).order('ad');
      if (error) throw error;
      return data as Yer[];
    },
  });
}

/** #97 KK5: tüm yayınlı yerler (ana sayfa mozaiği + "Tümü"), öne çıkan sırası, şehir adıyla. */
export function useTumYerler() {
  return useQuery({
    queryKey: ['icerik', 'yerler', 'hepsi'],
    staleTime: GUN_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('yerler').select(`${YER_ALANLARI}, sehirler(ad, slug, lat, lng)`).order('one_cikan_sira', { ascending: true, nullsFirst: false }).order('ad');
      if (error) throw error;
      return data as unknown as (Yer & { sehirler: { ad: string; slug: string; lat: number; lng: number } | null })[];
    },
  });
}

const GEZI_ALANLARI = 'id, sehir_id, baslik, slug, kapak_url, ozet, yazar_ad, gun_sayisi, mekan_sayisi, sira, created_at, sehirler(ad, slug)';

/** #97 KK4: önerilen geziler (sıra, sonra yeni); `sehirId` ile süzülür. */
export function useGeziler(sehirId?: string) {
  return useQuery({
    queryKey: ['icerik', 'geziler', sehirId ?? 'hepsi'],
    staleTime: GUN_MS,
    queryFn: async () => {
      let q = supabase.from('geziler').select(GEZI_ALANLARI).order('sira', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      if (sehirId) q = q.eq('sehir_id', sehirId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Gezi[];
    },
  });
}

/** #97 B: gezi + yazı + günler + duraklar (slug ile). */
export function useGezi(slug: string | undefined) {
  return useQuery({
    queryKey: ['icerik', 'gezi', slug],
    enabled: !!slug,
    staleTime: GUN_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geziler')
        .select(`${GEZI_ALANLARI}, yazi_md, gezi_gunleri(id, gezi_id, sira, baslik, gezi_duraklari(id, gezi_gun_id, sira, place_id, ad, kategori, sure_dk, lat, lng))`)
        .eq('slug', slug!)
        .single();
      if (error) throw error;
      const g = data as unknown as GeziDetay;
      g.gezi_gunleri = [...(g.gezi_gunleri ?? [])].sort((a, b) => a.sira - b.sira).map((gun) => ({ ...gun, gezi_duraklari: [...(gun.gezi_duraklari ?? [])].sort((a, b) => a.sira - b.sira) }));
      return g;
    },
  });
}

/** Seçili Google şehrini yayınlı bir şehirle eşleştir: ad eşitliği ya da merkeze 25 km. */
export function sehirEslestir(sehirler: Sehir[] | undefined, secim: { ad: string; lat: number; lng: number } | null): Sehir | undefined {
  if (!sehirler || !secim) return undefined;
  const ad = secim.ad.trim().toLocaleLowerCase('tr');
  const adla = sehirler.find((s) => s.ad.toLocaleLowerCase('tr') === ad);
  if (adla) return adla;
  return sehirler.find((s) => Math.hypot((s.lat - secim.lat) * 111, (s.lng - secim.lng) * 111 * Math.cos((secim.lat * Math.PI) / 180)) <= 25);
}

const cozulen = new Map<string, Promise<string | null>>();

/**
 * İçerik satırının (yer ya da gezi durağı) Google place_id'si: backoffice doldurmadıysa adıyla Autocomplete'ten ilk öneri
 * (konuma yanlı). Yalnız bellekte tutulur (PRD §7: Google kimliği içerik tablosuna istemciden yazılmaz).
 */
export function icerikPlaceId(satir: { id: string; place_id: string | null; ad: string; lat: number; lng: number }, sehirAdi: string): Promise<string | null> {
  if (satir.place_id) return Promise.resolve(satir.place_id);
  let p = cozulen.get(satir.id);
  if (!p) {
    p = otomatikTamamla({ girdi: `${satir.ad}, ${sehirAdi}`, oturum: `icerik-${satir.id}`, merkez: { lat: satir.lat, lng: satir.lng, yaricapM: 5000 } })
      .then((oneriler) => oneriler[0]?.place_id ?? null)
      .catch(() => {
        cozulen.delete(satir.id);
        return null;
      });
    cozulen.set(satir.id, p);
  }
  return p;
}

/** #98 uyumluluk: rehber yeri için (şehir adı). */
export function yerPlaceId(yer: Yer, sehir: { ad: string }): Promise<string | null> {
  return icerikPlaceId(yer, sehir.ad);
}

// ---------------------------------------------------------------- kaydedilenler (#97 KK B3, #100)

export function useKaydedilenler() {
  const { session } = useOturum();
  return useQuery({
    queryKey: ['kaydedilenler', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('kaydedilenler').select('tur, hedef_id, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Kaydedilen[];
    },
  });
}

/** Kalp aç/kapat (iyimser güncelleme). */
export function useKaydet() {
  const { session } = useOturum();
  const qc = useQueryClient();
  const anahtar = ['kaydedilenler', session?.user.id];
  return useMutation({
    mutationFn: async ({ tur, hedef_id, kayitli }: { tur: KaydedilenTuru; hedef_id: string; kayitli: boolean }) => {
      if (!session) throw new Error('oturum yok');
      const { error } = kayitli
        ? await supabase.from('kaydedilenler').delete().match({ user_id: session.user.id, tur, hedef_id })
        : await supabase.from('kaydedilenler').insert({ user_id: session.user.id, tur, hedef_id });
      if (error && error.code !== '23505') throw error;
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: anahtar });
      const onceki = qc.getQueryData<Kaydedilen[]>(anahtar) ?? [];
      qc.setQueryData<Kaydedilen[]>(anahtar, v.kayitli ? onceki.filter((k) => !(k.tur === v.tur && k.hedef_id === v.hedef_id)) : [{ tur: v.tur, hedef_id: v.hedef_id, created_at: new Date().toISOString() }, ...onceki]);
      return { onceki };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(anahtar, ctx.onceki);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: anahtar }),
  });
}

/** Analitik olayı (sessiz; hata yutulur). */
export async function olayYaz(tur: OlayTuru, hedef_id: string | null, meta?: Record<string, unknown>) {
  try {
    await supabase.from('olaylar').insert({ tur, hedef_id, meta: meta ?? null });
  } catch {
    // analitik akışı kullanıcıyı durdurmaz
  }
}
