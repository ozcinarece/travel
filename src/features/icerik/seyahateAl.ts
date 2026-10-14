// #193 (kanvas 19b · 19c): "Seyahatime al" — yeni seyahat akışın içinde ve "Yalnız mekanlar" seçimi. Saf hesaplar (ekrandan ve
// ağdan bağımsız; test edilir): yeni seyahatin günleri ve planı, tek işlem RPC'sinin gövdesi, mekan seçim listesi.
import { t } from '@/i18n';
import { tarihEkle } from '@/lib/takvim';
import { pinKategorisi } from '@/lib/pinIkonu';
import type { GeziDetay, GeziDuragi, GeziGunu, Gun } from '@/lib/tipler';
import { sonAnahtar } from '@/schedule/sira';

import { aktarmaPlani, type AktarmaPlani } from './aktar';

/** KK2: "Kaç gün" sınırı. */
export const EN_AZ_GUN = 1;
export const EN_COK_GUN = 30;
export const gunSiniri = (n: number) => Math.min(EN_COK_GUN, Math.max(EN_AZ_GUN, Math.round(n)));

/** Seyahatte durak süresi sınırı (15–480 dk; #140: yuvarlanmaz). */
export const durakSuresi = (d: Pick<GeziDuragi, 'sure_dk'>) => Math.min(480, Math.max(15, Math.round(d.sure_dk)));

/** Yeni seyahatin (henüz yok) günleri: "yeni:1"…; tarihliyse başlangıçtan itibaren. */
export function yeniSeyahatGunleri(gunSayisi: number, baslangic: string | null): Gun[] {
  return Array.from({ length: gunSiniri(gunSayisi) }, (_, i) => ({
    id: `yeni:${i + 1}`,
    trip_id: '',
    index: i + 1,
    date: baslangic ? tarihEkle(baslangic, i) : null,
    start_time: null,
    end_time: null,
    order_manual: false,
    start_stay_id: null,
    end_stay_id: null,
  }));
}

/** Başlangıç + gün sayısı → seyahat tarihleri ("Tarih sonra" → ikisi de null). */
export function yeniSeyahatTarihleri(baslangic: string | null, gunSayisi: number): { start_date: string | null; end_date: string | null } {
  return baslangic ? { start_date: baslangic, end_date: tarihEkle(baslangic, gunSiniri(gunSayisi) - 1) } : { start_date: null, end_date: null };
}

export type YeniSeyahatOzeti = {
  /** Durağı gelen gün sayısı (gezinin günleri seyahatin günlerine sırayla). */
  gun: number;
  /** Günlere sırayla eklenecek durak. */
  durak: number;
  /** Seyahat gezi kadar uzun değilse fazla günlerin mekanları Listem'e (atanmamış). */
  listeye: number;
};

/** KK2–KK3: yeni seyahatin planı — gezinin günleri sırayla; seyahat kısaysa fazlası listeye, uzunsa son günler boş. */
export function yeniSeyahatPlani(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunSayisi: number, baslangic: string | null): { gunler: Gun[]; plan: AktarmaPlani; ozet: YeniSeyahatOzeti } {
  const gunler = yeniSeyahatGunleri(gunSayisi, baslangic);
  const plan = aktarmaPlani(gezi, gunler, { tur: 'tum' });
  return { gunler, plan, ozet: { gun: plan.atamalar.length, durak: plan.atamalar.reduce((n, a) => n + a.duraklar.length, 0), listeye: plan.listeyeKalan.length } };
}

export type YeniSeyahatMekani = { place_id: string; primary_type: string | null; lat: number; lng: number; dk: number };
export type YeniSeyahatDuragi = { gun: number; place_id: string; order_key: string; dk: number };

/**
 * `geziden_seyahat_ac` gövdesi: tekil mekanlar (Listem) + günlere sırayla duraklar (gün içinde sona eklenir gibi anahtar).
 * `kimlik`: durak → çözülmüş Google kimliği; çözülemeyen durak atlanır. Aynı mekan iki günde geçiyorsa ilk günde kalır.
 */
export function yeniSeyahatGovdesi(plan: AktarmaPlani, gunler: Gun[], kimlik: Map<string, string | null>): { mekanlar: YeniSeyahatMekani[]; duraklar: YeniSeyahatDuragi[] } {
  const mekanlar = new Map<string, YeniSeyahatMekani>();
  for (const d of plan.duraklar) {
    const pid = kimlik.get(d.id);
    if (pid && !mekanlar.has(pid)) mekanlar.set(pid, { place_id: pid, primary_type: d.kategori, lat: d.lat, lng: d.lng, dk: durakSuresi(d) });
  }
  const atanan = new Set<string>();
  const duraklar: YeniSeyahatDuragi[] = [];
  for (const a of plan.atamalar) {
    const gun = gunler.find((g) => g.id === a.gunId)?.index;
    if (!gun) continue;
    const anahtarlar: string[] = [];
    for (const d of a.duraklar) {
      const pid = kimlik.get(d.id);
      if (!pid || atanan.has(pid) || !mekanlar.has(pid)) continue;
      atanan.add(pid);
      const order_key = sonAnahtar(anahtarlar);
      anahtarlar.push(order_key);
      duraklar.push({ gun, place_id: pid, order_key, dk: durakSuresi(d) });
    }
  }
  return { mekanlar: [...mekanlar.values()], duraklar };
}

/** KK2 bilgi satırı: "**Eskişehir'de üç gün** adıyla yeni seyahat açılır, 3 günün 14 durağı aynı sırayla gelir. Otel ve davet sonra." */
export function yeniSeyahatBilgisi(ad: string, ozet: YeniSeyahatOzeti, mekanSecimi?: number): string {
  if (mekanSecimi !== undefined) return t('gezi.yeniBilgiMekan', { ad, n: mekanSecimi });
  const ana = ozet.durak > 0 ? t('gezi.yeniBilgi', { ad, gun: ozet.gun, durak: ozet.durak }) : t('gezi.yeniBilgiBos', { ad });
  return `${ana}${ozet.listeye > 0 ? ` ${t('gezi.yeniBilgiListe', { n: ozet.listeye })}` : ''} ${t('gezi.yeniBilgiSonra')}`;
}

// ---------------------------------------------------------------- KK8: "Yalnız mekanlar" seçim listesi

export type MekanSatiri = {
  durak: GeziDuragi;
  /** Seyahatin listesinde zaten var → kutucuk yerine "Listende", seçilemez. */
  listede: boolean;
  yemek: boolean;
};
export type MekanGrubu = { gun: GeziGunu; satirlar: MekanSatiri[] };

/** Gezinin günlerine göre gruplu mekanlar; aynı mekan iki günde geçiyorsa yalnız ilk gününde. */
export function mekanGruplari(gezi: Pick<GeziDetay, 'gezi_gunleri'>, kimlik: (d: GeziDuragi) => string | null, listede: Set<string>): MekanGrubu[] {
  const gorulen = new Set<string>();
  return gezi.gezi_gunleri
    .map((gun) => ({
      gun,
      satirlar: gun.gezi_duraklari.flatMap((durak): MekanSatiri[] => {
        const pid = kimlik(durak);
        const k = pid ?? durak.place_id ?? durak.id;
        if (gorulen.has(k)) return [];
        gorulen.add(k);
        return [{ durak, listede: !!pid && listede.has(pid), yemek: pinKategorisi(durak.kategori) === 'yemek' }];
      }),
    }))
    .filter((g) => g.satirlar.length > 0);
}

/** Seçilebilen satırlar (listede olmayanlar). */
export const secilebilirler = (gruplar: MekanGrubu[]) => gruplar.flatMap((g) => g.satirlar.filter((s) => !s.listede));

/** KK8 varsayılanı: yemek durakları hariç hepsi seçili (listede olanlar seçilemez). */
export function varsayilanMekanSecimi(gruplar: MekanGrubu[]): Set<string> {
  return new Set(secilebilirler(gruplar).filter((s) => !s.yemek).map((s) => s.durak.id));
}

/** Grubun "Hepsini seç / Hepsini kaldır" hali: seçilebilenlerin hepsi seçiliyse kaldır. */
export function grupHepsiSecili(grup: MekanGrubu, secili: Set<string>): boolean {
  const s = grup.satirlar.filter((x) => !x.listede);
  return s.length > 0 && s.every((x) => secili.has(x.durak.id));
}

/** Seçilenler → aktarım planı (yalnız listeye, güne atanmaz). */
export function mekanSecimPlani(gruplar: MekanGrubu[], secili: Set<string>): AktarmaPlani {
  const duraklar = secilebilirler(gruplar)
    .filter((s) => secili.has(s.durak.id))
    .map((s) => s.durak);
  return { duraklar, atamalar: [], listeyeKalan: duraklar };
}
