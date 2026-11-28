// #139 KK5 "Planı kur": seçilen mekanları yakınlığa göre bölgelere ayırıp gezme sırasıyla günlere dağıtır. #665: her günün
// durak kotası var (mevcut + yeni duraklar günlere eşit bölünür; fark en çok 1), gün kotası ya da kapasitesi dolunca ertesi
// güne geçilir. Gün kapasitesi ≈ 10:00–19:00 (ziyaret + yol). Hiçbir güne sığmayan "Listede, güne atanmamış" kalır.
// Gün içi sıra otelden / ilk duraktan en yakın komşu. Yol kuş uçuşu tahmini (rota isteği yok).
// Saf: ekrandan bağımsız, testli. #141 "Günlere dağıt" aynı fonksiyonu atanmamış mekanlarla çağırır (`mevcut` dolu günler).
// #582: dağıtım sırası önce oy, sonra il listesi sırası, sonra yakınlık; açılış saatine göre kapalı günler atlanır. Oy, sıra ve
// saatleri çağıran verir (planUygula); verilmezse eski davranış. Bu fonksiyon saf; "Planı kur" (planUygula) tarihli seyahatte
// önbellekte saati olmayan mekanlar için ⌈N/25⌉ places-light 'saat' isteği atar (24 sa önbellek, 4 sn süre sınırı).
import { mesafeM } from '@/components/harita/geo';
import type { Konum } from '@/components/harita/tipler';
import { konumu, konumVar } from '@/lib/konum';
import { kestirimTaksiSn, kestirimYuruyusSn, TAKSI_ESIGI_SN } from '@/schedule/tempo';

/**
 * #318: `lat`/`lng` null = Google koordinatı boşalmış mekan; yol hesabına girmez, sıranın sonuna eklenir.
 * #582 KK1: `oy` grubun "ben de isterim" oy sayısı, `ilSira` il listesindeki sırası (1 = en önemli). KK2: `kapaliGunler`
 * açılış saatine göre kapalı olduğu Google hafta günleri (0 = Pazar); verilmezse (saat yok) kural uygulanmaz.
 */
export type PlanMekani = { id: string; lat: number | null; lng: number | null; dakika: number; ad?: string; oy?: number; ilSira?: number | null; kapaliGunler?: number[] };
export type KonumluMekan = PlanMekani & Konum;
/** #200: `kapasiteDk` verilirse o günün penceresi (başlangıç–bitiş); yoksa ortak kapasite. #582: `haftaGunu` Google hafta günü (0 = Pazar); tarihsiz günde yok. */
export type PlanGunu = { id: string; index: number; kapasiteDk?: number; haftaGunu?: number | null };

/** 10:00–19:00. */
export const GUN_KAPASITESI_DK = 9 * 60;
/** İki mekan arası kuş uçuşu bu kadar ya da azsa aynı bölge (yürüme mesafesi, ~20 dk). */
export const BOLGE_ESIGI_M = 1500;

export type PlanGunSonucu = { gunId: string; index: number; mekanlar: PlanMekani[]; ziyaretDk: number; yolDk: number; arabaBacagi: number };
export type PlanSonucu = { gunler: PlanGunSonucu[]; atanmamis: PlanMekani[]; bolgeSayisi: number };

/** Bacak: kuş uçuşu yürüyüş tahmini; 40 dk'yı aşarsa araç tahmini (Program'ın 40 dk kuralı). Dakika kesirli (yuvarlama yok). */
export function bacakDk(a: Konum, b: Konum): { dk: number; araba: boolean } {
  const yuru = kestirimYuruyusSn(a, b);
  if (yuru <= TAKSI_ESIGI_SN) return { dk: yuru / 60, araba: false };
  return { dk: kestirimTaksiSn(a, b) / 60, araba: true };
}

/** #318: iki uçtan biri koordinatsızsa bacak yok (0 dk). */
export function bacakVarsa(a: PlanMekani | Konum | null, b: PlanMekani): { dk: number; araba: boolean } {
  const ka = konumu(a);
  const kb = konumu(b);
  return ka && kb ? bacakDk(ka, kb) : { dk: 0, araba: false };
}

/** Listedeki son koordinatlı nokta; yoksa `yedek`. */
export function sonKonum(liste: PlanMekani[], yedek: Konum | null): Konum | null {
  for (let i = liste.length - 1; i >= 0; i--) {
    const k = konumu(liste[i]);
    if (k) return k;
  }
  return yedek;
}

/** Tek bağlantılı kümeleme: eşiğin altındaki her çift aynı bölgede (birleşim-bul). Sıra girdiyle kararlı. */
export function bolgeler<T extends KonumluMekan>(mekanlar: T[], esikM = BOLGE_ESIGI_M): T[][] {
  const ata = mekanlar.map((_, i) => i);
  const kok = (i: number): number => (ata[i] === i ? i : (ata[i] = kok(ata[i])));
  for (let i = 0; i < mekanlar.length; i++) {
    for (let j = i + 1; j < mekanlar.length; j++) {
      if (mesafeM(mekanlar[i], mekanlar[j]) <= esikM) ata[kok(j)] = kok(i);
    }
  }
  const gruplar = new Map<number, T[]>();
  mekanlar.forEach((m, i) => {
    const k = kok(i);
    gruplar.set(k, [...(gruplar.get(k) ?? []), m]);
  });
  return [...gruplar.values()];
}

function merkez(grup: KonumluMekan[]): Konum {
  return { lat: grup.reduce((t, m) => t + m.lat, 0) / grup.length, lng: grup.reduce((t, m) => t + m.lng, 0) / grup.length };
}

/** En yakın komşu sırası; `bas` verilirse ondan, yoksa en batıdaki mekandan başlar (kararlı). */
export function enYakinKomsu<T extends KonumluMekan>(mekanlar: T[], bas: Konum | null): T[] {
  const kalan = [...mekanlar];
  const sira: T[] = [];
  let simdi: Konum | null = bas;
  while (kalan.length) {
    let en = 0;
    if (simdi) {
      let enKisa = Infinity;
      kalan.forEach((m, i) => {
        const d = mesafeM(simdi!, m);
        if (d < enKisa) {
          enKisa = d;
          en = i;
        }
      });
    } else {
      kalan.forEach((m, i) => {
        if (m.lng < kalan[en].lng) en = i;
      });
    }
    const [m] = kalan.splice(en, 1);
    sira.push(m);
    simdi = m;
  }
  return sira;
}

/**
 * Mekanları gezme sırasına dizer: önce en kalabalık bölge (eşitlikte toplam süre), sonra son mekana merkezi en yakın bölge;
 * bölge içi en yakın komşu (ilk bölgede otelden / başlangıçtan).
 */
export function gezmeSirasi(mekanlar: PlanMekani[], baslangic: Konum | null = null): { sira: PlanMekani[]; bolgeSayisi: number } {
  // #318: koordinatsız mekanlar bölgelere girmez; girdi sırasıyla en sona eklenir.
  const konumlu = mekanlar.filter((m): m is KonumluMekan => konumVar(m));
  const konumsuz = mekanlar.filter((m) => !konumVar(m));
  const gruplar = bolgeler(konumlu);
  const sira: PlanMekani[] = [];
  let son: Konum | null = baslangic;
  const kalan = [...gruplar];
  while (kalan.length) {
    let en = 0;
    if (sira.length === 0) {
      kalan.forEach((g, i) => {
        const e = kalan[en];
        const toplam = (x: PlanMekani[]) => x.reduce((t, m) => t + m.dakika, 0);
        if (g.length > e.length || (g.length === e.length && toplam(g) > toplam(e))) en = i;
      });
    } else {
      let enKisa = Infinity;
      kalan.forEach((g, i) => {
        const d = mesafeM(son!, merkez(g));
        if (d < enKisa) {
          enKisa = d;
          en = i;
        }
      });
    }
    const [g] = kalan.splice(en, 1);
    const dizi = enYakinKomsu(g, son);
    sira.push(...dizi);
    son = dizi[dizi.length - 1] ?? son;
  }
  sira.push(...konumsuz);
  return { sira, bolgeSayisi: gruplar.length };
}

/** Alt çubuk özeti (#139 KK4): "N mekan · K bölge · ~S saat" — S tek sırada ziyaret + yol, saate yuvarlanır (≈, en az 1). */
export function secimOzeti(mekanlar: PlanMekani[]): { mekan: number; bolge: number; saat: number } {
  if (mekanlar.length === 0) return { mekan: 0, bolge: 0, saat: 0 };
  const { dk, bolgeSayisi } = secimSuresi(mekanlar);
  return { mekan: mekanlar.length, bolge: bolgeSayisi, saat: Math.max(1, Math.round(dk / 60)) };
}

/** Tek gezme sırasında ziyaret + yol (dk). */
function secimSuresi(mekanlar: PlanMekani[]): { dk: number; bolgeSayisi: number } {
  const { sira, bolgeSayisi } = gezmeSirasi(mekanlar);
  let dk = 0;
  sira.forEach((m, i) => {
    dk += m.dakika + (i > 0 ? bacakVarsa(sira[i - 1], m).dk : 0);
  });
  return { dk, bolgeSayisi };
}

/**
 * #401 (`Ekran07cIlOnerileri` A–B alt çubuğu): seçimin kaç gün doldurduğu, bir ondalıkla ("2 günün 1,2'si dolu") ve gün
 * çubuklarının doluluğu (1. gün dolunca 2. gün; her biri 0–1). Gün kapasitesi `GUN_KAPASITESI_DK`.
 */
export function gunDolulugu(mekanlar: PlanMekani[], gunSayisi: number): { dolu: number; cubuklar: number[] } {
  const dk = mekanlar.length ? secimSuresi(mekanlar).dk : 0;
  const dolu = Math.round((dk / GUN_KAPASITESI_DK) * 10) / 10;
  const kesin = dk / GUN_KAPASITESI_DK;
  return { dolu, cubuklar: Array.from({ length: Math.max(0, gunSayisi) }, (_, i) => Math.min(1, Math.max(0, kesin - i))) };
}

// Son okunan sözcüğün ünlüsüne göre iyelik eki (bir → 'i, iki → 'si, üç → 'ü, altı → 'sı, dokuz → 'u …).
const BIRLER = ["'ı", "'i", "'si", "'ü", "'ü", "'i", "'sı", "'si", "'i", "'u"] as const;
const ONLAR = ['', "'u", "'si", "'u", "'ı", "'si", "'ı", "'i", "'i", "'ı"] as const;

/** "1,2'si", "1,6'sı", "1'i", "0,5'i", "10'u", "20'si": sayı Türkçe ondalıkla yazılır, ek okunuşa göre çekimlenir. */
export function gunEki(sayi: number): string {
  const metin = String(Math.round(sayi * 10) / 10).replace('.', ',');
  const rakamlar = metin.replace(/\D/g, '');
  const son = Number(rakamlar[rakamlar.length - 1] ?? 0);
  // Tam sayının son basamağı 0 ise onlar basamağı okunur (10 "on", 20 "yirmi"); 100 ve üstü "yüz" → 'ü.
  if (son === 0 && !metin.includes(',') && rakamlar.length >= 2) {
    if (rakamlar.length >= 3 && rakamlar.endsWith('00')) return `${metin}'ü`;
    return `${metin}${ONLAR[Number(rakamlar[rakamlar.length - 2])]}`;
  }
  return `${metin}${BIRLER[son]}`;
}

/** #582 KK2: mekan o gün kapalı mı (saat ya da tarih yoksa hayır). */
export function gundeKapali(m: Pick<PlanMekani, 'kapaliGunler'>, gun: Pick<PlanGunu, 'haftaGunu'>): boolean {
  return gun.haftaGunu != null && !!m.kapaliGunler?.includes(gun.haftaGunu);
}

/**
 * #582 KK1: dağıtım sırası — önce oy (çok → az), sonra il listesi sırası (listede olmayan sonda), eşitlikte gezme sırası
 * (yakınlık). Oy da il sırası da yoksa sıra değişmez (eski davranış).
 */
export function oncelikSirasi(sira: PlanMekani[]): { sira: PlanMekani[]; degisti: boolean } {
  const etkin = sira.some((m) => (m.oy ?? 0) > 0 || m.ilSira != null);
  if (!etkin) return { sira, degisti: false };
  const yer = new Map(sira.map((m, i) => [m.id, i]));
  const il = (m: PlanMekani) => m.ilSira ?? Infinity;
  const yeni = [...sira].sort((a, b) => (b.oy ?? 0) - (a.oy ?? 0) || il(a) - il(b) || yer.get(a.id)! - yer.get(b.id)!);
  return { sira: yeni, degisti: yeni.some((m, i) => m !== sira[i]) };
}

/**
 * KK5: dağıtım. `mevcut`: günlerde zaten olan duraklar (sırasıyla; kapasiteyi doldurur, yeni mekanlar arkalarına eklenir).
 * `baslangic`: günün başladığı otel (yoksa ilk duraktan başlar, ilk bacak yok).
 */
export function planKur(
  mekanlar: PlanMekani[],
  gunler: PlanGunu[],
  secenek: { kapasiteDk?: number; baslangic?: Konum | null; mevcut?: Map<string, PlanMekani[]> } = {},
): PlanSonucu {
  const kapasite = secenek.kapasiteDk ?? GUN_KAPASITESI_DK;
  const bas = secenek.baslangic ?? null;
  const sirali = [...gunler].sort((a, b) => a.index - b.index);
  const sonuc: PlanGunSonucu[] = sirali.map((g) => ({ gunId: g.id, index: g.index, mekanlar: [], ziyaretDk: 0, yolDk: 0, arabaBacagi: 0 }));
  // Mevcut duraklar: günün dolu kısmı (yol + ziyaret), sonra yeni mekanlar.
  const dolu = sirali.map((g) => {
    const liste = secenek.mevcut?.get(g.id) ?? [];
    let dk = 0;
    liste.forEach((m, i) => {
      const onceki = sonKonum(liste.slice(0, i), bas);
      dk += m.dakika + (onceki ? bacakVarsa(onceki, m).dk : 0);
    });
    return { dk, son: sonKonum(liste, bas) };
  });
  const gezme = gezmeSirasi(mekanlar, bas);
  const { bolgeSayisi } = gezme;
  const { sira, degisti } = oncelikSirasi(gezme.sira);
  const atanmamis: PlanMekani[] = [];
  const gunBasi = dolu.map((d) => d.son);
  const sayi = sirali.map((g) => secenek.mevcut?.get(g.id)?.length ?? 0);
  // #665: kota, hiçbir güne tek başına sığmayan mekanı saymaz (o atanmamış kalır, başka günden yer kapmaz).
  const enGenis = Math.max(0, ...sirali.map((g) => g.kapasiteDk ?? kapasite));
  const kota = gunKotalari(sayi, sira.filter((m) => m.dakika <= enGenis).length);
  /** Sığıyorsa `k`. güne ekler. */
  const yerlestir = (m: PlanMekani, k: number): boolean => {
    const onceki = dolu[k].son;
    const bacak = onceki ? bacakVarsa(onceki, m) : { dk: 0, araba: false };
    if (dolu[k].dk + bacak.dk + m.dakika > (sirali[k].kapasiteDk ?? kapasite)) return false;
    dolu[k] = { dk: dolu[k].dk + bacak.dk + m.dakika, son: konumu(m) ?? onceki };
    const s = sonuc[k];
    s.mekanlar.push(m);
    s.ziyaretDk += m.dakika;
    s.yolDk += bacak.dk;
    if (bacak.araba) s.arabaBacagi += 1;
    sayi[k] += 1;
    return true;
  };
  let g = 0;
  for (const m of sira) {
    let yerlesti = false;
    // İmleç yalnız mekan yerleşince ilerler: sığmayan mekan (boş güne bile) önceki günün kalan kapasitesini boşa harcatmaz.
    // #582 KK2: kapalı olduğu gün atlanır ama imleci ilerletmez (o gün başka mekanlara açık kalır).
    // #665: kotası dolan gün atlanır (gezme sırası günlere ardışık bölünür; küme günlere yayılır).
    let ilkKapali = -1;
    for (let k = g; k < sonuc.length; k++) {
      if (gundeKapali(m, sirali[k])) {
        if (ilkKapali < 0) ilkKapali = k;
        continue;
      }
      if (sayi[k] >= kota[k]) continue;
      if (yerlestir(m, k)) {
        yerlesti = true;
        g = ilkKapali >= 0 ? ilkKapali : k;
        break;
      }
      // Boş güne bile sığmıyorsa bu mekan hiçbir güne sığmaz → atanmamış.
      if (dolu[k].dk === 0) break;
    }
    // #665: kotalı günlere (kapalı gün ya da kapasite yüzünden) giremediyse kota aşılır: açık ve sığan, en az duraklı gün.
    if (!yerlesti && m.dakika <= enGenis) {
      const adaylar = sirali.map((_, k) => k).filter((k) => !gundeKapali(m, sirali[k])).sort((a, b) => sayi[a] - sayi[b] || a - b);
      yerlesti = adaylar.some((k) => yerlestir(m, k));
    }
    if (!yerlesti) atanmamis.push(m);
  }
  // #582 KK1: öncelik sırası yakınlığı bozduysa gün içi sıra yeniden en yakın komşu (günün son noktasından); kapasiteyi
  // aşarsa öncelik sırası kalır.
  if (degisti) sonuc.forEach((s, k) => gunIciYakinlik(s, gunBasi[k], sirali[k].kapasiteDk ?? kapasite, dolu[k].dk));
  return { gunler: sonuc, atanmamis, bolgeSayisi };
}

/**
 * #665: günlerin durak kotası (mevcut dahil son sayı üst sınırı). `yeni` durak sırayla en az duraklı güne (eşitlikte erken
 * gün) yazılır: 7 / 4 gün → 2-2-2-1, 10 / 3 → 4-3-3. Mevcut durağı çok olan güne yeni kota düşmez.
 */
export function gunKotalari(mevcutSayi: number[], yeni: number): number[] {
  const kota = [...mevcutSayi];
  if (kota.length === 0) return kota;
  for (let i = 0; i < yeni; i++) {
    let en = 0;
    kota.forEach((n, k) => {
      if (n < kota[en]) en = k;
    });
    kota[en] += 1;
  }
  return kota;
}

/** Yeni mekanları en yakın komşu sırasına dizer; yol yeniden hesaplanır. Toplam `kapasite`yi aşarsa dokunulmaz. */
function gunIciYakinlik(s: PlanGunSonucu, bas: Konum | null, kapasite: number, doluDk: number) {
  if (s.mekanlar.length < 2) return;
  const konumlu = s.mekanlar.filter((m): m is KonumluMekan => konumVar(m));
  const yeni = [...enYakinKomsu(konumlu, bas), ...s.mekanlar.filter((m) => !konumVar(m))];
  const yol = (liste: PlanMekani[]) => {
    let dk = 0;
    let araba = 0;
    let onceki: Konum | null = bas;
    for (const m of liste) {
      const b = onceki ? bacakVarsa(onceki, m) : { dk: 0, araba: false };
      dk += b.dk;
      if (b.araba) araba += 1;
      onceki = konumu(m) ?? onceki;
    }
    return { dk, araba };
  };
  const eski = yol(s.mekanlar);
  const y = yol(yeni);
  if (doluDk - eski.dk + y.dk > kapasite) return;
  s.mekanlar = yeni;
  s.yolDk = y.dk;
  s.arabaBacagi = y.araba;
}

/** stops.minutes 15–480 (DB kısıtı); #140: 15'in katına yuvarlanmaz, tam dakika. */
export function durakDakikasi(dk: number): number {
  return Math.min(480, Math.max(15, Math.round(dk)));
}
