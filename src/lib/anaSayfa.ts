// #109: ana sayfa düzeni (backoffice yazar, uygulama okur). Selam ve yaklaşan seyahat kartı sabittir; bölümler sırayla
// bunların altında. Uygulama `ana_sayfa_gorunen` görünümünü okur (son yayın, açık + aralıktaki bölümler).
import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';

export type BolumTuru = 'tek_kart' | 'serit' | 'mozaik' | 'sehir_seckisi';
export type BolumKaynagi = 'otomatik' | 'elle';

/** tek_kart: {gezi_id} · serit: {gezi_idler} · mozaik: {yer_idler} · sehir_seckisi: {sehir_idler}. Otomatikte liste boş olabilir. */
export type BolumIcerigi = { gezi_id?: string | null; gezi_idler?: string[]; yer_idler?: string[]; sehir_idler?: string[] };

export type AnaSayfaBolumu = {
  id: string;
  tur: BolumTuru;
  baslik: string;
  sira: number;
  kaynak: BolumKaynagi;
  icerik: BolumIcerigi;
  baslangic_at: string | null;
  bitis_at: string | null;
  /** Taslakta var; görünümde her zaman true. */
  acik?: boolean;
};

/** KK4: yalnız açık ve zaman aralığındaki bölümler, `sira` ile (görünümle aynı kural; önbellekteki liste için de). */
export function gorunenBolumler<T extends Pick<AnaSayfaBolumu, 'sira' | 'baslangic_at' | 'bitis_at'> & { acik?: boolean }>(bolumler: readonly T[], simdi: Date = new Date()): T[] {
  const t = simdi.getTime();
  return bolumler
    .filter((b) => b.acik !== false && (!b.baslangic_at || new Date(b.baslangic_at).getTime() <= t) && (!b.bitis_at || new Date(b.bitis_at).getTime() > t))
    .sort((a, b) => a.sira - b.sira);
}

/** KK1: uygulama ana sayfasının bölümleri (son yayın). */
export function useAnaSayfaBolumleri() {
  return useQuery({
    queryKey: ['ana-sayfa', 'bolumler'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('ana_sayfa_gorunen').select('*').order('sira');
      if (error) throw error;
      return gorunenBolumler(data as AnaSayfaBolumu[]);
    },
  });
}

/**
 * Çizim blokları (kanvas Home13 / Backoffice ekran 3 önizlemesi): tek kartın hemen ardından şerit geliyorsa ikisi tek blok
 * olur — başlık şeridin, önce büyük kart sonra şerit ("Önerilen geziler"). Diğer bölümler kendi başlığıyla tek başına.
 */
export type CizimBlogu<T> = { baslik: string; bolumler: T[] };

export function cizimBloklari<T extends Pick<AnaSayfaBolumu, 'tur' | 'baslik'>>(bolumler: readonly T[]): CizimBlogu<T>[] {
  const bloklar: CizimBlogu<T>[] = [];
  for (let i = 0; i < bolumler.length; i++) {
    const b = bolumler[i];
    const sonraki = bolumler[i + 1];
    if (b.tur === 'tek_kart' && sonraki?.tur === 'serit') {
      bloklar.push({ baslik: sonraki.baslik, bolumler: [b, sonraki] });
      i++;
    } else {
      bloklar.push({ baslik: b.baslik, bolumler: [b] });
    }
  }
  return bloklar;
}

type Sirali = { id: string; sira?: number | null; created_at?: string };
type OneCikan = { id: string; one_cikan_sira: number | null };

/**
 * Bölümün gösterilecek kimlikleri. Elle: içerikteki liste (yalnız yayında olanlar, verilen sırayla). Otomatik: tek kart =
 * en çok alınan gezi (görünüm verir; yoksa ilk gezi), şerit = gezi sırası, mozaik = öne çıkan sırası (en çok `enFazla`).
 */
export function bolumKimlikleri(
  b: Pick<AnaSayfaBolumu, 'tur' | 'kaynak' | 'icerik'>,
  kaynak: { geziler: readonly Sirali[]; yerler: readonly OneCikan[]; sehirler: readonly { id: string }[] },
  enFazla = 8,
): string[] {
  const varOlan = (idler: string[] | undefined, liste: readonly { id: string }[]) => {
    const kume = new Set(liste.map((x) => x.id));
    return (idler ?? []).filter((id) => kume.has(id));
  };
  const geziSirasi = [...kaynak.geziler].sort((a, c) => (a.sira ?? Infinity) - (c.sira ?? Infinity) || (c.created_at ?? '').localeCompare(a.created_at ?? ''));
  switch (b.tur) {
    case 'tek_kart': {
      const id = b.icerik.gezi_id;
      if (id && kaynak.geziler.some((g) => g.id === id)) return [id];
      return b.kaynak === 'otomatik' && geziSirasi[0] ? [geziSirasi[0].id] : [];
    }
    case 'serit':
      return (b.kaynak === 'otomatik' ? geziSirasi.map((g) => g.id) : varOlan(b.icerik.gezi_idler, kaynak.geziler)).slice(0, enFazla);
    case 'mozaik':
      return (
        b.kaynak === 'otomatik'
          ? kaynak.yerler.filter((y) => y.one_cikan_sira !== null).sort((a, c) => a.one_cikan_sira! - c.one_cikan_sira!).map((y) => y.id)
          : varOlan(b.icerik.yer_idler, kaynak.yerler)
      ).slice(0, enFazla);
    case 'sehir_seckisi':
      return varOlan(b.icerik.sehir_idler, kaynak.sehirler).slice(0, enFazla);
  }
}
