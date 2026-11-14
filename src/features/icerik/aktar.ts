// #97 C → #143: "Seyahatime al" — saf planlama (ekrandan ve ağdan bağımsız; test edilir).
import type { Durak, Gun, GeziDetay, GeziDuragi, GeziGunu, Mekan } from '@/lib/tipler';

import { gunHucresi } from '@/components/program/GunKartlari';
import { t } from '@/i18n';
import { GUNLER_BULUNMA, haftaGunu, tarihEkle } from '@/lib/takvim';

export type AktarmaSecimi =
  /** Günler sırayla seyahatin günlerine; gün azsa fazlası listeye. */
  | { tur: 'tum' }
  /** Her gezi günü için hedef gün (null = listeye). `dahil[günId] === false` → o gün hiç alınmaz (listeye de değil). */
  | { tur: 'gunler'; eslesme: Record<string, string | null>; dahil?: Record<string, boolean> }
  /** Yalnız mekanlar listeye. */
  | { tur: 'mekanlar' };

export type AktarmaPlani = {
  /** Havuza eklenecek mekanlar (tekil place_id ile; place_id çözülmeden önce durak kimliğiyle). */
  duraklar: GeziDuragi[];
  /** Hedef gün → o güne sırayla eklenecek duraklar (mevcutların sonuna). */
  atamalar: { gunId: string; duraklar: GeziDuragi[] }[];
  /** Yalnız listeye düşenler. */
  listeyeKalan: GeziDuragi[];
};

/** Varsayılan eşleşme: gezi günleri sırayla seyahatin günlerine. */
export function varsayilanEslesme(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunler: Gun[]): Record<string, string | null> {
  const sirali = [...gunler].sort((a, b) => a.index - b.index);
  const e: Record<string, string | null> = {};
  gezi.gezi_gunleri.forEach((g, i) => {
    e[g.id] = sirali[i]?.id ?? null;
  });
  return e;
}

export function aktarmaPlani(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunler: Gun[], secim: AktarmaSecimi): AktarmaPlani {
  // #118: kapalı günler (onay kutusu) planın tamamen dışında — mekanı havuza da, listeye de gitmez.
  const dahilMi = (g: GeziGunu) => secim.tur !== 'gunler' || secim.dahil?.[g.id] !== false;
  const gunler_ = gezi.gezi_gunleri.filter(dahilMi);
  const tum = gunler_.flatMap((g) => g.gezi_duraklari);
  const gorulen = new Set<string>();
  const duraklar = tum.filter((d) => {
    const k = d.place_id ?? d.id;
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    return true;
  });
  if (secim.tur === 'mekanlar') return { duraklar, atamalar: [], listeyeKalan: duraklar };
  const eslesme = secim.tur === 'tum' ? varsayilanEslesme(gezi, gunler) : secim.eslesme;
  const atamalar = new Map<string, GeziDuragi[]>();
  const listeyeKalan: GeziDuragi[] = [];
  const atanan = new Set<string>();
  for (const g of gunler_) {
    const hedef = eslesme[g.id] ?? null;
    for (const d of g.gezi_duraklari) {
      const k = d.place_id ?? d.id;
      if (atanan.has(k)) continue;
      if (hedef) {
        atanan.add(k);
        atamalar.set(hedef, [...(atamalar.get(hedef) ?? []), d]);
      } else listeyeKalan.push(d);
    }
  }
  return { duraklar, atamalar: [...atamalar].map(([gunId, ds]) => ({ gunId, duraklar: ds })), listeyeKalan: listeyeKalan.filter((d) => !atanan.has(d.place_id ?? d.id)) };
}

/** Gezi günü satırı: "1. gün · Odunpazarı". */
export function geziGunuBasligi(g: GeziGunu): string {
  return `${t('gezi.gunKisa', { n: g.sira })}${g.baslik ? ` · ${g.baslik}` : ''}`;
}

/** #143 KK6: hedef seyahatin bugünkü hali (place_id ile). */
export type HedefListesi = {
  /** Listedeki place_id'ler (güne atanmış ya da atanmamış). */
  listede: Set<string>;
  /** Bir güne atanmış place_id → gün kimliği. */
  gunde: Map<string, string>;
  /** Gün kimliği → mevcut durak sayısı. */
  durakSayisi: Map<string, number>;
};

/** Seyahatin mekan ve duraklarından `HedefListesi`. */
export function hedefListesi(mekanlar: Pick<Mekan, 'id' | 'place_id'>[], duraklar: Pick<Durak, 'day_id' | 'place_ref'>[]): HedefListesi {
  const pid = new Map(mekanlar.map((m) => [m.id, m.place_id]));
  const gunde = new Map<string, string>();
  const durakSayisi = new Map<string, number>();
  for (const d of duraklar) {
    const p = pid.get(d.place_ref);
    if (p) gunde.set(p, d.day_id);
    durakSayisi.set(d.day_id, (durakSayisi.get(d.day_id) ?? 0) + 1);
  }
  return { listede: new Set(mekanlar.map((m) => m.place_id)), gunde, durakSayisi };
}

export type HedefGunOzeti = { gunId: string; mevcut: number; /** Aynı günde zaten olan (atlanır). */ ortak: GeziDuragi[]; yeni: number };

export type AktarmaOzeti = {
  /** Günlere eklenecek durak: yeni mekan + listede olup güne atanmamış (seçilen güne taşınır). */
  yeniDurak: number;
  /** Gezi günü → "6 mekan · 1'i zaten listende". */
  gunSatirlari: Record<string, { mekan: number; zatenListede: number }>;
  hedefGunler: HedefGunOzeti[];
  /** Başka bir günde zaten olan (yerinde kalır). */
  baskaGunde: GeziDuragi[];
  /** Gün eşleşmesi "Listeye" olanlardan listede olmayanlar. */
  listeyeYeni: number;
  /** "Yalnız mekanları listeme ekle (N yeni)" — tüm gezide listede olmayan tekil mekan. */
  yalnizMekanYeni: number;
};

/**
 * #143 KK5–6: seçime göre ne olacağı — mükerrerler place_id ile: aynı günde varsa atlanır, listede ama atanmamışsa seçilen
 * güne taşınır, başka günde varsa yerinde kalır. `kimlik` çözülmüş place_id'yi verir (çözülmediyse yeni sayılır).
 */
export function aktarmaOzeti(gezi: Pick<GeziDetay, 'gezi_gunleri'>, plan: AktarmaPlani, kimlik: (d: GeziDuragi) => string | null, hedef: HedefListesi): AktarmaOzeti {
  const listedeMi = (d: GeziDuragi) => {
    const pid = kimlik(d);
    return !!pid && hedef.listede.has(pid);
  };
  const gunSatirlari: AktarmaOzeti['gunSatirlari'] = {};
  for (const g of gezi.gezi_gunleri) gunSatirlari[g.id] = { mekan: g.gezi_duraklari.length, zatenListede: g.gezi_duraklari.filter(listedeMi).length };

  const baskaGunde: GeziDuragi[] = [];
  const hedefGunler = plan.atamalar.map((a): HedefGunOzeti => {
    const ortak: GeziDuragi[] = [];
    let yeni = 0;
    for (const d of a.duraklar) {
      const pid = kimlik(d);
      const gun = pid ? hedef.gunde.get(pid) : undefined;
      if (gun === a.gunId) ortak.push(d);
      else if (gun) baskaGunde.push(d);
      else yeni += 1;
    }
    return { gunId: a.gunId, mevcut: hedef.durakSayisi.get(a.gunId) ?? 0, ortak, yeni };
  });

  const tekil = new Map<string, GeziDuragi>();
  for (const d of gezi.gezi_gunleri.flatMap((g) => g.gezi_duraklari)) {
    const k = kimlik(d) ?? d.place_id ?? d.id;
    if (!tekil.has(k)) tekil.set(k, d);
  }
  return {
    yeniDurak: hedefGunler.reduce((n, g) => n + g.yeni, 0),
    gunSatirlari,
    hedefGunler,
    baskaGunde,
    listeyeYeni: plan.listeyeKalan.filter((d) => !listedeMi(d)).length,
    yalnizMekanYeni: [...tekil.values()].filter((d) => !listedeMi(d)).length,
  };
}

/** KK5: düğme — "5 yeni durağı al · Cum 16" / "3 mekanı listeye ekle"; alınacak bir şey yoksa pasif. */
export function alDugmesi(plan: AktarmaPlani, ozet: AktarmaOzeti, gunler: Gun[]): { metin: string; pasif: boolean } {
  if (plan.atamalar.length === 0 && plan.listeyeKalan.length === 0) return { metin: t('gezi.gunSecin'), pasif: true };
  if (ozet.yeniDurak > 0) {
    const adlar = ozet.hedefGunler
      .filter((g) => g.yeni > 0)
      .map((g) => gunler.find((x) => x.id === g.gunId))
      .filter((g): g is Gun => !!g)
      .sort((a, b) => a.index - b.index)
      .map((g) => gunHucresi(g, 0).ust);
    return { metin: t('gezi.yeniDuragiAl', { n: ozet.yeniDurak, gunler: adlar.join(', ') }), pasif: false };
  }
  if (ozet.listeyeYeni > 0) return { metin: t('gezi.mekanListeyeEkle', { n: ozet.listeyeYeni }), pasif: false };
  return { metin: plan.atamalar.length ? t('gezi.hepsiProgramda') : t('gezi.hepsiListede'), pasif: true };
}

/** "Cuma'da" / "1. günde". */
export function gunBulunma(g: Gun): string {
  return g.date ? GUNLER_BULUNMA[haftaGunu(g.date)] : t('gezi.gunBulunma', { n: g.index });
}

/** `**…**` ile işaretli metni düz / kalın parçalara böler (bilgi kutusu). */
export function kalinParcalar(metin: string): { metin: string; kalin: boolean }[] {
  return metin
    .split('**')
    .map((m, i) => ({ metin: m, kalin: i % 2 === 1 }))
    .filter((p) => p.metin);
}

/**
 * KK6 bilgi kutusu: "Cuma'da zaten 3 durağın var, **Kurşunlu Külliyesi** ikisinde de ortak. Kalan **5 yeni durak** eklenir,
 * saatler yeniden hesaplanır." Hedef günler boşsa ve mükerrer yoksa söylenecek bir şey yok → null.
 */
export function aktarmaBilgisi(ozet: AktarmaOzeti, gunler: Gun[]): string | null {
  const dolu = ozet.hedefGunler.filter((g) => g.mevcut > 0);
  if (dolu.length === 0 && ozet.baskaGunde.length === 0) return null;
  const cumleler: string[] = [];
  for (const h of dolu) {
    const g = gunler.find((x) => x.id === h.gunId);
    if (!g) continue;
    const ortak = h.ortak.length === 1 ? t('gezi.bilgiOrtakTek', { ad: h.ortak[0].ad }) : h.ortak.length > 1 ? t('gezi.bilgiOrtak', { n: h.ortak.length }) : '';
    cumleler.push(`${t('gezi.bilgiMevcut', { gun: gunBulunma(g), n: h.mevcut })}${ortak}.`);
  }
  if (ozet.baskaGunde.length === 1) cumleler.push(t('gezi.bilgiBaskaGunTek', { ad: ozet.baskaGunde[0].ad }));
  else if (ozet.baskaGunde.length > 1) cumleler.push(t('gezi.bilgiBaskaGun', { n: ozet.baskaGunde.length }));
  const atlandi = ozet.baskaGunde.length > 0 || dolu.some((h) => h.ortak.length > 0);
  if (ozet.yeniDurak === 0) cumleler.push(t('gezi.bilgiYeniYok'));
  else cumleler.push(t(atlandi ? 'gezi.bilgiKalan' : 'gezi.bilgiYeni', { n: ozet.yeniDurak }));
  return cumleler.join(' ');
}

/** Olay `gezi_alindi` seçeneği (backoffice "tüm / günler / mekan" kırılımı). */
export function aktarmaSecenegi(gezi: Pick<GeziDetay, 'gezi_gunleri'>, secim: AktarmaSecimi): 'tum' | 'gunler' | 'mekan' {
  if (secim.tur === 'mekanlar') return 'mekan';
  if (secim.tur === 'tum') return 'tum';
  return gezi.gezi_gunleri.every((g) => secim.dahil?.[g.id] !== false && !!secim.eslesme[g.id]) ? 'tum' : 'gunler';
}

// ---------------------------------------------------------------- #193 KK5: eksik gün (seyahatin sonuna eklenir)

/** Seyahatte henüz olmayan, aktarımda sona eklenecek gün: "+1" son günden sonraki ilk gün. */
export const sanalGunMu = (id: string | null | undefined): id is string => !!id && id.startsWith('+');
const sanalSirasi = (id: string) => Number(id.slice(1));

/** Gezinin seyahatten fazla günleri → sanal hedef ("+1", "+2"…), gezi sırasıyla. */
export function eksikGunler(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunler: Pick<Gun, 'id'>[]): Record<string, string> {
  const e: Record<string, string> = {};
  gezi.gezi_gunleri.forEach((g, i) => {
    if (i >= gunler.length) e[g.id] = `+${i - gunler.length + 1}`;
  });
  return e;
}

/** Sayfanın varsayılan eşleşmesi: günler sırayla; fazla gezi günleri sona eklenecek güne (KK5). */
export function hedefEslesmesi(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunler: Gun[]): Record<string, string | null> {
  return { ...varsayilanEslesme(gezi, gunler), ...eksikGunler(gezi, gunler) };
}

/** KK5: fazla gün varsayılan seçilmez. */
export function varsayilanDahil(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunler: Gun[]): Record<string, boolean> {
  return Object.fromEntries(Object.keys(eksikGunler(gezi, gunler)).map((id) => [id, false]));
}

/**
 * Seçili gezi günlerinin sanal hedefleri sıkıştırılır: yalnız 5. gün seçildiyse tek gün eklenir. Dönen: sanal kimlik → seyahatin
 * sonuna eklenecek kaçıncı gün (1, 2…). Seçilmemiş bir satırın etiketi için `dahilDegil` seçilirse alacağı sıra.
 */
export function sanalSira(gezi: Pick<GeziDetay, 'gezi_gunleri'>, eslesme: Record<string, string | null>, dahil: Record<string, boolean>): Map<string, number> {
  const secili = [...new Set(gezi.gezi_gunleri.filter((g) => dahil[g.id] !== false).map((g) => eslesme[g.id]).filter(sanalGunMu))].sort((a, b) => sanalSirasi(a) - sanalSirasi(b));
  return new Map(secili.map((id, i) => [id, i + 1]));
}

/** Seçilmemiş sanal hedefin "seçilirse" sırası (önündeki seçili sanal günlerden sonra). */
export function sanalSiraOnizleme(sira: Map<string, number>, id: string): number {
  return sira.get(id) ?? [...sira.keys()].filter((k) => sanalSirasi(k) < sanalSirasi(id)).length + 1;
}

/** Sanal günün gösterim nesnesi ("Paz 18" / "3. gün"): son günden `n` gün sonra; tarihsiz seyahatte tarihsiz. */
export function sanalGun(gunler: Gun[], id: string, n: number): Gun {
  const son = [...gunler].sort((a, b) => b.index - a.index)[0];
  const tripId = son?.trip_id ?? '';
  return { id, trip_id: tripId, index: (son?.index ?? 0) + n, date: son?.date ? tarihEkle(son.date, n) : null, start_time: null, end_time: null, order_manual: false, start_stay_id: null, end_stay_id: null };
}

/** Planın sanal hedefleri (seçili günlerden), eklenecekleri sırayla. */
export function eklenecekGunler(plan: AktarmaPlani, sira: Map<string, number>): string[] {
  return [...new Set(plan.atamalar.map((a) => a.gunId).filter(sanalGunMu))].sort((a, b) => (sira.get(a) ?? 0) - (sira.get(b) ?? 0));
}

/**
 * KK5 bilgi cümlesi: "Seyahatin 2 gün; 3. günü seçersen seyahate **Paz 18** eklenir." — seçildiyse "…; 3. gün için seyahate
 * **Paz 18** eklenir." Fazla gün yoksa null.
 */
export function eksikGunBilgisi(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunler: Gun[], eslesme: Record<string, string | null>, dahil: Record<string, boolean>): string | null {
  const eksik = eksikGunler(gezi, gunler);
  const satirlar = gezi.gezi_gunleri.filter((g) => eksik[g.id] && sanalGunMu(eslesme[g.id]));
  if (satirlar.length === 0) return null;
  const sira = sanalSira(gezi, eslesme, dahil);
  const secili = satirlar.filter((g) => dahil[g.id] !== false);
  // Seçiliyse gerçek sıraları; hiçbiri seçili değilse hepsi seçilseydi alacakları tarihler (art arda).
  const hedefler = secili.length ? secili : satirlar;
  const adlar = hedefler.map((g) => g.sira);
  const tarihler = hedefler.map((g, i) => gunHucresi(sanalGun(gunler, eslesme[g.id]!, secili.length ? (sira.get(eslesme[g.id]!) ?? i + 1) : i + 1), 0).ust).join(', ');
  const gunListesi = adlar.length === 1 ? t('gezi.eksikGunTek', { n: adlar[0] }) : t('gezi.eksikGunCok', { liste: siraliListe(adlar.map((n) => `${n}.`)) });
  return t(secili.length ? 'gezi.eksikGunSecildi' : 'gezi.eksikGunSecilmedi', { n: gunler.length, gunler: gunListesi, tarihler });
}

/** "3., 4. ve 5." */
function siraliListe(parcalar: string[]): string {
  return parcalar.length <= 1 ? (parcalar[0] ?? '') : `${parcalar.slice(0, -1).join(', ')}${t('gezi.ve')}${parcalar[parcalar.length - 1]}`;
}
