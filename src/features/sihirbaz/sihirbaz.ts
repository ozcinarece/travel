// #98: seyahat kurma sihirbazı — saf yardımcılar (ekrandan bağımsız; test edilir). Kanvas TripWizard14.
import { AYLAR, GUNLER_KISA, haftaGunu, parcala, tarihEkle, type Tarih } from '@/lib/takvim';
import type { Gun } from '@/lib/tipler';

export const ADIMLAR = ['nereye', 'nezaman', 'oteller', 'kimlerle', 'onerilenler'] as const;
export type Adim = (typeof ADIMLAR)[number];

export function sonrakiAdim(a: Adim): Adim | null {
  const i = ADIMLAR.indexOf(a);
  return ADIMLAR[i + 1] ?? null;
}
export function oncekiAdim(a: Adim): Adim | null {
  const i = ADIMLAR.indexOf(a);
  return i > 0 ? ADIMLAR[i - 1] : null;
}

/** KK2: "Eskişehir Gezisi"; iki şehirde "Eskişehir – Bursa Gezisi". Boş listede boş. */
export function seyahatAdiOner(sehirler: string[]): string {
  const adlar = sehirler.map((s) => s.trim()).filter(Boolean);
  if (adlar.length === 0) return '';
  return `${adlar.join(' – ')} Gezisi`;
}

/** Ekranda görünen ad: kullanıcı yazdıysa o, yoksa şehir etiketi. */
export function seyahatAdi(s: { name?: string | null; city_label: string }): string {
  return s.name?.trim() || s.city_label;
}

/** KK3: takvimde iki dokunuş = aralık (ilk gidiş, ikinci dönüş; dönüş gidişten önceyse gidiş yeniden başlar; aynı güne iki kez = tek gün). */
export type Aralik = { gidis: Tarih; donus: Tarih | null } | null;
export function tarihDokun(aralik: Aralik, gun: Tarih): Aralik {
  // #117 KK3: yalnız gidiş seçiliyken aynı güne ikinci dokunuş seçimi sıfırlar (tek günlük seyahat için Devam yeter).
  if (aralik && !aralik.donus && gun === aralik.gidis) return null;
  if (!aralik || aralik.donus) return { gidis: gun, donus: null };
  if (gun < aralik.gidis) return { gidis: gun, donus: null };
  return { gidis: aralik.gidis, donus: gun };
}

/** "16 – 19 Ekim · 4 gün · 3 gece" (aynı ay) · "30 Ekim – 2 Kasım · 4 gün · 3 gece" · tek gün "16 Ekim · 1 gün". */
export function tarihOzeti(aralik: Aralik): string {
  if (!aralik) return '';
  const g = parcala(aralik.gidis);
  const son = aralik.donus ?? aralik.gidis;
  const d = parcala(son);
  const gunSayisi = gunFarki(aralik.gidis, son) + 1;
  const tarih = gunSayisi === 1 ? `${g.gun} ${AYLAR[g.ay - 1]}` : g.ay === d.ay && g.yil === d.yil ? `${g.gun} – ${d.gun} ${AYLAR[g.ay - 1]}` : `${g.gun} ${AYLAR[g.ay - 1]} – ${d.gun} ${AYLAR[d.ay - 1]}`;
  const parcalar = [tarih, `${gunSayisi} gün`];
  if (gunSayisi > 1) parcalar.push(`${gunSayisi - 1} gece`);
  return parcalar.join(' · ');
}

export function gunFarki(a: Tarih, b: Tarih): number {
  const [ya, aa, ga] = a.split('-').map(Number);
  const [yb, ab, gb] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, ab - 1, gb) - Date.UTC(ya, aa - 1, ga)) / 86_400_000);
}

/** KK4: geceler — i. gece = i. günün akşamı → (i+1). günün sabahı; tek günlük / tarihsiz seyahatte 1 gece ("1. gece"). */
export type Gece = { sira: number; etiket: string; aksamGun: Gun; sabahGun: Gun | null };
export function geceler(gunler: Gun[]): Gece[] {
  const sirali = [...gunler].sort((a, b) => a.index - b.index);
  if (sirali.length === 0) return [];
  if (sirali.length === 1) return [{ sira: 1, etiket: '1. gece', aksamGun: sirali[0], sabahGun: null }];
  return sirali.slice(0, -1).map((g, i) => ({
    sira: i + 1,
    etiket: g.date ? `${kisaGun(g.date)} → ${kisaGun(tarihEkle(g.date, 1))}` : `${i + 1}. gece`,
    aksamGun: g,
    sabahGun: sirali[i + 1],
  }));
}

function kisaGun(t: Tarih): string {
  return `${GUNLER_KISA[haftaGunu(t)]} ${parcala(t).gun}`;
}

/**
 * KK4: bir geceye otel atama — akşam gününün bitişi ve (varsa) sabah gününün başlangıcı o otel olur; sabah gününün
 * bitişi boşsa ya da başlangıcıyla aynıysa (aynı otele dönüş) o da güncellenir. Diğer günlere dokunulmaz.
 */
export function gecePlani(gece: Gece, stayId: string | null): { id: string; start_stay_id: string | null; end_stay_id: string | null }[] {
  const sonuc = [{ id: gece.aksamGun.id, start_stay_id: gece.aksamGun.start_stay_id, end_stay_id: stayId }];
  // Tek günlük seyahat: gün hem o otelden başlar hem orada biter.
  if (!gece.sabahGun) sonuc[0] = { ...sonuc[0], start_stay_id: stayId };
  else {
    const s = gece.sabahGun;
    const donus = s.end_stay_id === null || s.end_stay_id === s.start_stay_id;
    sonuc.push({ id: s.id, start_stay_id: stayId, end_stay_id: donus ? stayId : s.end_stay_id });
  }
  return sonuc;
}

/** Gecenin oteli (akşam gününün bitiş oteli). */
export function geceninOteli(gece: Gece): string | null {
  return gece.aksamGun.end_stay_id;
}

/** KK1 ilerleme: 5 nokta, aktif uzun. */
export function adimIndeksi(a: Adim): number {
  return ADIMLAR.indexOf(a);
}
