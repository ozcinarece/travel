// #181 (kanvas 23 · 23b): Gezi sayfasının saf hesapları — mod (plan / gezi / bitti), kapak satırları, plan özeti gün kartları,
// Listem önizlemesi, rehberden öneriler ve gezi modundaki grup durumu. Hepsi eldeki veriden; Google'a istek yok (KK13).
import { t } from '@/i18n';
import { kategoriEtiketi } from '@/lib/kategori';
import { AYLAR, GUNLER_KISA, haftaGunu, parcala, tarihAraligi } from '@/lib/takvim';
import type { Durak, Gun, Mekan, Oy, Seyahat, Uye, Yer } from '@/lib/tipler';
import { aktifMi, gunSayisi, kacinciGun, yerelTarih } from '@/lib/zaman';
import type { TempoSonucu } from '@/schedule/tempo';
import { gunRengi } from '@/theme';

import type { GeziModu } from './siradakiAdim';

type Tarihli = Pick<Seyahat, 'start_date' | 'end_date' | 'tz'>;

/** Gezi modu: seyahat tarihleri içinde; bitti: dönüş geçti; yoksa (tarihsiz dahil) plan. */
export function geziModu(seyahat: Tarihli, an: Date): GeziModu {
  if (aktifMi(seyahat, an)) return 'gezi';
  if (seyahat.end_date && seyahat.end_date < yerelTarih(an, seyahat.tz)) return 'bitti';
  return 'plan';
}

/** KK4 durum çipi: plan modunda "N gün kaldı", gezi modunda "Bugün · N. gün"; tarihsiz ya da bitmiş gezide yok. */
export function durumCipi(seyahat: Tarihli, an: Date): { tur: 'kalan' | 'bugun'; metin: string } | null {
  const kacinci = kacinciGun(seyahat, an);
  if (kacinci !== null) return { tur: 'bugun', metin: t('geziSayfasi.bugunGun', { n: kacinci }) };
  if (!seyahat.start_date) return null;
  const bugun = yerelTarih(an, seyahat.tz);
  if (seyahat.start_date <= bugun) return null;
  return { tur: 'kalan', metin: t('geziSayfasi.gunKaldi', { n: gunSayisi(bugun, seyahat.start_date) - 1 }) };
}

/** "16–18 Ekim · Cum–Paz · 3 gün"; tek gün "16 Ekim · Cum · 1 gün"; tarihsiz "3 gün · tarih belli değil". */
export function tarihSatiri(seyahat: Pick<Seyahat, 'start_date' | 'end_date'>, gunAdedi: number): string {
  const { start_date: bas, end_date: bit } = seyahat;
  if (!bas || !bit) return t('geziSayfasi.tarihsiz', { n: gunAdedi });
  const gunler = bas === bit ? GUNLER_KISA[haftaGunu(bas)] : `${GUNLER_KISA[haftaGunu(bas)]}–${GUNLER_KISA[haftaGunu(bit)]}`;
  return t('geziSayfasi.tarih', { aralik: tarihAraligi(bas, bit), gunler, n: gunSayisi(bas, bit) });
}

/** Gün kartı etiketi: "Cum 16" (tarihli) ya da "1. gün". */
export function gunEtiketi(g: Pick<Gun, 'date' | 'index'>): string {
  if (!g.date) return t('geziSayfasi.gunNo', { n: g.index });
  return `${GUNLER_KISA[haftaGunu(g.date)]} ${parcala(g.date).gun}`;
}

/** "16 Ekim" — uzun gün adı olmadan (yemek adımı vb.). */
export function gunTarihi(g: Pick<Gun, 'date' | 'index'>): string {
  if (!g.date) return t('geziSayfasi.gunNo', { n: g.index });
  const { gun, ay } = parcala(g.date);
  return `${gun} ${AYLAR[ay - 1]}`;
}

/** Ad kaynağı: DB (bizim içerik) ya da oturumdaki önbellek; bilinmiyorsa null (istek atılmaz). */
export type AdKaynagi = (mekan: Pick<Mekan, 'place_id'>) => string | null;

/** Adı bilinmeyen mekanda ad yerine kategori ("Müze"). */
export function mekanAdi(m: Pick<Mekan, 'place_id' | 'primary_type'>, ad: AdKaynagi): string {
  return ad(m) ?? kategoriEtiketi(m.primary_type);
}

export type GunKarti = {
  gun: Gun;
  renk: string;
  etiket: string;
  /** Tema satırı: ilk durağın adı (biliniyorsa), değilse duraklarının kategorileri; boş günde null. */
  tema: string | null;
  durakSayisi: number;
  /** "09:30–18:10"; yürüyüşler kestirimse (Plan henüz açılmadı) "~09:30–18:10"; boş günde null. */
  saat: string | null;
};

const sirayla = (a: Durak, b: Durak) => (a.order_key < b.order_key ? -1 : a.order_key > b.order_key ? 1 : 0);

/** KK6: yatay gün kartları — gün rengi, gün adı, tema, durak sayısı, saat aralığı (tempo hesabından; istek yok). */
export function gunKartlari(p: { gunler: Gun[]; duraklar: Durak[]; mekanlar: Mekan[]; tempolar: Map<string, TempoSonucu>; ad: AdKaynagi }): GunKarti[] {
  const mekanIle = new Map(p.mekanlar.map((m) => [m.id, m]));
  return [...p.gunler]
    .sort((a, b) => a.index - b.index)
    .map((g) => {
      const gunun = p.duraklar
        .filter((d) => d.day_id === g.id && !d.skipped)
        .sort(sirayla)
        .map((d) => mekanIle.get(d.place_ref))
        .filter((m): m is Mekan => !!m);
      const tp = p.tempolar.get(g.id);
      const ilkAd = gunun.map((m) => p.ad(m)).find((x): x is string => !!x);
      const kategoriler = [...new Set(gunun.map((m) => kategoriEtiketi(m.primary_type)))].slice(0, 2);
      return {
        gun: g,
        renk: gunRengi(g.index),
        etiket: gunEtiketi(g),
        tema: gunun.length === 0 ? null : (ilkAd ?? kategoriler.join(' · ')),
        durakSayisi: gunun.length,
        saat: gunun.length > 0 && tp ? `${tp.kestirim ? '~' : ''}${tp.baslangic}–${tp.bitis}` : null,
      };
    });
}

export type ListemOnizlemeSatiri = { mekan: Mekan; oy: number; benimOyum: boolean; gun: Gun | null };

/** KK7: en çok oy alan 3 mekan (eşitlikte önce eklenen); güne atanmışsa günü. */
export function listemOnizlemesi(p: { mekanlar: Mekan[]; duraklar: Durak[]; gunler: Gun[]; oylar: Oy[]; benId: string | null; adet?: number }): ListemOnizlemeSatiri[] {
  const oy = new Map<string, number>();
  const benim = new Set<string>();
  for (const o of p.oylar) {
    oy.set(o.mekan, (oy.get(o.mekan) ?? 0) + 1);
    if (o.kullanici === p.benId) benim.add(o.mekan);
  }
  const gunIle = new Map(p.gunler.map((g) => [g.id, g]));
  const durakIle = new Map(p.duraklar.map((d) => [d.place_ref, d]));
  return [...p.mekanlar]
    .sort((a, b) => (oy.get(b.id) ?? 0) - (oy.get(a.id) ?? 0) || (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    .slice(0, p.adet ?? 3)
    .map((m) => {
      const d = durakIle.get(m.id);
      return { mekan: m, oy: oy.get(m.id) ?? 0, benimOyum: benim.has(m.id), gun: d ? (gunIle.get(d.day_id) ?? null) : null };
    });
}

/**
 * KK8: rehberden öneriler — şehrin yayınlı öne çıkan yerlerinden listede olmayanlar (en çok 6). Yalnız place_id'si olan yerler
 * (listeye Google'a gitmeden eklenir); öne çıkan işaretli yer yoksa şehrin diğer yayınlı yerleri.
 */
export function rehberOnerileri(yerler: Yer[], mekanlar: Pick<Mekan, 'place_id'>[], adet = 6): (Yer & { place_id: string })[] {
  const listede = new Set(mekanlar.map((m) => m.place_id));
  const uygun = yerler.filter((y): y is Yer & { place_id: string } => !!y.place_id && !listede.has(y.place_id));
  const oneCikan = uygun.filter((y) => y.one_cikan_sira !== null).sort((a, b) => a.one_cikan_sira! - b.one_cikan_sira!);
  return (oneCikan.length > 0 ? oneCikan : uygun).slice(0, adet);
}

export type GrupDurumu = { uye: Uye; varis: { mekanId: string; at: string } | null };

/** Konumla yazılan son varışın geçerlilik süresi (GrupPenceresi ile aynı). */
const VARIS_OMRU_MS = 12 * 60 * 60 * 1000;

/**
 * KK12: gezi modunda grup kartı — diğer üyelerin son "vardı" kaydı (stops.arrived_*; konum paylaşan üyelerde yazılır). Son 12
 * saatte varışı olmayan üye "konumunu paylaşmıyor" gösterilir.
 */
export function grupDurumlari(uyeler: Uye[], benId: string | null, duraklar: Durak[], an: Date): GrupDurumu[] {
  return uyeler
    .filter((u) => u.user_id !== benId)
    .map((u) => {
      const son = duraklar
        .filter((d) => d.arrived_by === u.user_id && d.arrived_at && an.getTime() - Date.parse(d.arrived_at) <= VARIS_OMRU_MS)
        .sort((a, b) => (a.arrived_at! < b.arrived_at! ? 1 : -1))[0];
      return { uye: u, varis: son ? { mekanId: son.place_ref, at: son.arrived_at! } : null };
    });
}
