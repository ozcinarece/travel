// #401 KK5–KK8 (Marka kimliği kanvası, `Ekran07cIlOnerileri`): uygulamada il önerileri. Yayındaki il listesi sihirbazın
// "Neleri görmek istersin?" adımını doldurur: sıra her zaman `sira`, üstte yalnız dolu kategorilerin altı çizili sekmeleri,
// Google yakın araması yalnız listenin altındaki "Yakındaki diğer yerler" açılınca (kapalıyken 0 istek).
// Saf kurallar üstte (testli), veri kancaları altta. PRD §7: tablodan yalnız place_id, primary_type ve konum gelir; ad ve
// `neden` Rehber'in ya da Ece'nin metni.
import { useQuery } from '@tanstack/react-query';

import { mesafeM } from '@/components/harita/geo';
import type { OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { birKezDene, hafifOnbellek, oneriSirala, type HafifYer, type OneriCipi } from '@/features/yerler/api';
import { SUZGEC_SIRASI, type IlKategori } from '@/features/yonetim/ilOneri';
import { slugUret } from '@/features/yonetim/gezi';
import { t } from '@/i18n';
import { kategoriEtiketi, varsayilanDakika } from '@/lib/kategori';
import { konaklamaMi } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { supabase } from '@/lib/supabase';

export type IlYeri = {
  id: string;
  sira: number;
  ad: string;
  kategori: IlKategori;
  ilce: string | null;
  merkeze_km: number | null;
  neden: string | null;
  place_id: string | null;
  primary_type: string | null;
  lat: number | null;
  lng: number | null;
};

/** Sekme: `null` = Hepsi. */
export type IlSekmesi = IlKategori | null;

/** Kanvas: "merkeze_km 5 ve altıysa km yazmaz, yalnız ilçe". */
export const KM_ESIGI = 5;

/** İl listesinin anahtarı: rehber şehrinin slug'ı, yoksa seyahatin şehir adından (BO ile aynı slug kuralı). */
export function ilSlugu(rehberSehir: { slug: string } | undefined, sehirAdi: string | null | undefined): string | null {
  if (rehberSehir?.slug) return rehberSehir.slug;
  const ad = (sehirAdi ?? '').split(',')[0].trim();
  return ad.length >= 2 ? slugUret(ad) : null;
}

/** Kanvas sırası (BO `SUZGEC_SIRASI`); yalnız listede yeri olan kategoriler. */
export function doluKategoriler(liste: readonly Pick<IlYeri, 'kategori'>[]): IlKategori[] {
  const var_ = new Set(liste.map((y) => y.kategori));
  return SUZGEC_SIRASI.filter((k) => var_.has(k));
}

/** Seçili sekmeye göre süzer; sıra her zaman `sira`. */
export function sekmeyeGore<T extends Pick<IlYeri, 'kategori' | 'sira'>>(liste: readonly T[], sekme: IlSekmesi): T[] {
  return liste.filter((y) => !sekme || y.kategori === sekme).sort((a, b) => a.sira - b.sira);
}

export function kategoriAdi(k: IlKategori): string {
  return t(`ilOneri.kategori.${k}`);
}

/** Satırın alt satırı: "Doğa · Mudurnu · 31 km"; 5 km ve altında km yazmaz; ilçe yoksa atlanır. */
export function ilYeriAltSatiri(y: Pick<IlYeri, 'kategori' | 'ilce' | 'merkeze_km'>): string {
  const km = y.merkeze_km !== null && y.merkeze_km > KM_ESIGI ? t('ilOneri.km', { km: Math.round(y.merkeze_km) }) : null;
  return [kategoriAdi(y.kategori), y.ilce, km].filter(Boolean).join(' · ');
}

/** Listeye eklenebilir mi: Google kimliği ve konumu olmalı (plan kuşu uçuşu konumla hesaplanır). */
export function eklenebilir(y: IlYeri): y is IlYeri & { place_id: string; lat: number; lng: number } {
  return !!y.place_id && typeof y.lat === 'number' && typeof y.lng === 'number';
}

/** İl satırı → sihirbazın mekan kaydı (panel ve listeye ekleme). Puan yok (kendi içeriğimiz). */
export function ilYeriMekani(y: IlYeri, foto: string | null | undefined): OnerilenMekan | null {
  if (!eklenebilir(y)) return null;
  return { place_id: y.place_id, ad: y.ad, primary_type: y.primary_type, lat: y.lat, lng: y.lng, puan: null, puan_sayisi: null, foto_uri: foto ?? null, neden: 'rehber', dakika: varsayilanDakika(y.primary_type) };
}

/** "Yakındaki diğer yerler": sekmenin Google yakın arama kümesi (Edge Function CIP_TIPLERI anahtarı). */
export const YAKIN_CIP: Record<IlKategori | 'hepsi', OneriCipi> = {
  hepsi: 'gormen',
  doga: 'park',
  yemek: 'yemek',
  tatli_kahve: 'kafe',
  muze: 'muze',
  tarih: 'turistik_tarihi',
  carsi: 'alisveris',
  aktivite: 'park',
  manzara: 'manzara',
};

/** Google sonuçlarından il listesinde olanlar ve konaklama çıkar; popülerlik sırası. */
export function yakindakiDigerleri(google: readonly HafifYer[], ilPlaceIdleri: ReadonlySet<string>): HafifYer[] {
  return oneriSirala(google.filter((y) => !ilPlaceIdleri.has(y.place_id) && !konaklamaMi(y.primary_type)));
}

/** Google satırının alt satırı: "Park · ★ 4,5 · 3 km" (seyahat merkezine kuş uçuşu; ad ve puan saklanmaz). */
export function googleAltSatiri(y: Pick<HafifYer, 'primary_type' | 'puan' | 'lat' | 'lng'>, merkez: { lat: number; lng: number } | null): string {
  const puan = puanMetni(y.puan);
  const km = merkez ? t('ilOneri.km', { km: Math.max(1, Math.round(mesafeM(merkez, y) / 1000)) }) : null;
  return [kategoriEtiketi(y.primary_type), puan ? `★ ${puan}` : null, km].filter(Boolean).join(' · ');
}

const GUN_MS = 24 * 60 * 60 * 1000;
const ALANLAR = 'id, sira, ad, kategori, ilce, merkeze_km, neden, place_id, primary_type, lat, lng';

/**
 * Yayındaki il listesinin görünür satırları, `sira` ile. RLS anonim ve kullanıcıya zaten yalnız bunları okutur; yönetici
 * taslağı da okuyabildiği için yayın ve görünürlük burada da süzülür (Ece uygulamada taslağı görmez).
 */
export function useIlYerleri(slug: string | null) {
  return useQuery({
    queryKey: ['il-yerleri', slug],
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('il_oneriler')
        .select(`${ALANLAR}, il_listeleri!inner(yayinda)`)
        .eq('il_slug', slug!)
        .eq('gorunur', true)
        .eq('il_listeleri.yayinda', true)
        .order('sira');
      if (error) throw error;
      return ((data ?? []) as (IlYeri & { il_listeleri?: unknown })[]).map(({ il_listeleri: _l, ...y }) => y as IlYeri);
    },
  });
}

/**
 * Satır fotoğrafları: ortak önbellekten yalnız fotoğraf (Pro foto maskesi, 12'lik parçalar, aynı kimlik oturumda bir kez).
 * Ekran yalnız görünen ilk satırların kimliklerini verir; kaydırdıkça sınır büyür.
 */
export function useIlFotolari(placeIdleri: readonly string[]) {
  const ids = [...new Set(placeIdleri)].sort();
  return useQuery({
    queryKey: ['il-fotolari', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: GUN_MS,
    retry: birKezDene,
    placeholderData: (onceki) => onceki,
    queryFn: async () => {
      const k = await hafifOnbellek.getirHepsi(ids, ['foto']).catch(() => ({}) as Record<string, HafifYer>);
      return Object.fromEntries(ids.map((id) => [id, k[id]?.foto_uri ?? null])) as Record<string, string | null>;
    },
  });
}
