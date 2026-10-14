// #183 Harcamalar (kanvas 25 · 25b · 25c): saf hesaplar — bölüşüm (eşit · tutar · pay), kurla ₺'ye çevirme, net bakiyeler,
// borç sadeleştirme (en az transfer), para biçimi, tutar ayrıştırma, IBAN denetimi. Tutarlar kuruş (tamsayı); yuvarlama farkı
// ödeyene yazılır (ödeyen bölüşümde yoksa ilk kişiye).
import { yerelAn } from '@/lib/zaman';

export const KATEGORILER = ['yemek', 'ulasim', 'konaklama', 'bilet', 'diger'] as const;
export type HarcamaKategorisi = (typeof KATEGORILER)[number];

export type HarcamaPayi = { user_id: string; pay_kurus: number };

export type Harcama = {
  id: string;
  trip_id: string;
  aciklama: string;
  tutar_kurus: number;
  para_birimi: string;
  tl_kurus: number;
  kategori: HarcamaKategorisi;
  odeyen_id: string;
  stop_id: string | null;
  fis_yolu: string | null;
  olusturan: string | null;
  created_at: string;
  updated_at: string;
  harcama_paylari: HarcamaPayi[];
};

export type Odesme = { id: string; trip_id: string; kimden: string; kime: string; tl_kurus: number; olusturan: string | null; created_at: string };

// ---------------------------------------------------------------- bölüşüm

export type BolusumModu = 'esit' | 'tutar' | 'pay';
/** Formdaki kişi: seçili mi; Tutar modunda kuruşu, Pay modunda ağırlığı (varsayılan 1). */
export type BolusumKisisi = { id: string; secili: boolean; tutar?: number | null; pay?: number | null };

/** Kalan kuruşun sahibi: ödeyen bölüşümdeyse o, değilse listedeki ilk kişi. */
function kalanSahibi(adaylar: string[], odeyen: string): string {
  return adaylar.includes(odeyen) ? odeyen : adaylar[0];
}

/**
 * KK4: harcamanın kendi para biriminde (kuruş) kişi payları. Eşit: toplam seçililere bölünür. Pay: ağırlığa göre. Tutar:
 * girilen tutarlar; toplamı harcamaya eşit olmalı. Geçersizse (kimse seçili değil, ağırlık sıfır, tutarlar tutmuyor) null.
 * Sıfır paylar listede yer almaz.
 */
export function paylariHesapla(toplam: number, mod: BolusumModu, kisiler: BolusumKisisi[], odeyen: string): Map<string, number> | null {
  if (!(toplam > 0)) return null;
  const secili = kisiler.filter((k) => k.secili);
  if (secili.length === 0) return null;
  const sonuc = new Map<string, number>();
  if (mod === 'tutar') {
    let top = 0;
    for (const k of secili) {
      const t = Math.max(0, Math.round(k.tutar ?? 0));
      top += t;
      if (t > 0) sonuc.set(k.id, t);
    }
    return top === toplam && sonuc.size > 0 ? sonuc : null;
  }
  const agirliklar = secili.map((k) => ({ id: k.id, w: mod === 'esit' ? 1 : Math.max(0, Math.round(k.pay ?? 1)) })).filter((x) => x.w > 0);
  const W = agirliklar.reduce((a, x) => a + x.w, 0);
  if (W === 0) return null;
  let dagitilan = 0;
  for (const { id, w } of agirliklar) {
    const p = Number((BigInt(toplam) * BigInt(w)) / BigInt(W));
    sonuc.set(id, p);
    dagitilan += p;
  }
  const kalan = toplam - dagitilan;
  if (kalan > 0) {
    const sahip = kalanSahibi(
      agirliklar.map((x) => x.id),
      odeyen,
    );
    sonuc.set(sahip, (sonuc.get(sahip) ?? 0) + kalan);
  }
  for (const [id, p] of sonuc) if (p === 0) sonuc.delete(id);
  return sonuc;
}

/**
 * KK5: harcama para birimindeki payları ₺ kuruşuna orantılı çevirir; toplamları tam `tlToplam` olur (kalan ödeyene). TRY'de
 * (toplam = tlToplam) paylar aynen döner.
 */
export function tlyeCevir(paylar: Map<string, number>, toplam: number, tlToplam: number, odeyen: string): Map<string, number> {
  if (toplam === tlToplam) return new Map(paylar);
  const sonuc = new Map<string, number>();
  let dagitilan = 0;
  for (const [id, p] of paylar) {
    const tl = Number((BigInt(p) * BigInt(tlToplam)) / BigInt(toplam));
    sonuc.set(id, tl);
    dagitilan += tl;
  }
  const kalan = tlToplam - dagitilan;
  if (kalan > 0 && sonuc.size > 0) {
    const sahip = kalanSahibi([...sonuc.keys()], odeyen);
    sonuc.set(sahip, (sonuc.get(sahip) ?? 0) + kalan);
  }
  for (const [id, p] of sonuc) if (p === 0) sonuc.delete(id);
  return sonuc;
}

/** Kur (1 birim = kaç ₺) on-binde-bir hassasiyetle; tutar × kur, kuruşa yuvarlanır. */
export function tlKarsiligi(tutarKurus: number, kur: number): number {
  const onBinde = Math.round(kur * 10_000);
  return Number((BigInt(tutarKurus) * BigInt(onBinde) + 5_000n) / 10_000n);
}

// ---------------------------------------------------------------- bakiyeler ve sadeleştirme

/** KK6: kişi başına net (₺ kuruş): + alacaklı, − borçlu. Ödeyen harcamanın tamamını alacaklanır, her pay sahibi payı kadar borçlanır;
 * ödeşmede veren alacaklanır, alan borçlanır. */
export function netBakiyeler(harcamalar: Pick<Harcama, 'odeyen_id' | 'tl_kurus' | 'harcama_paylari'>[], odesmeler: Pick<Odesme, 'kimden' | 'kime' | 'tl_kurus'>[]): Map<string, number> {
  const net = new Map<string, number>();
  const ekle = (id: string, n: number) => net.set(id, (net.get(id) ?? 0) + n);
  for (const h of harcamalar) {
    ekle(h.odeyen_id, h.tl_kurus);
    for (const p of h.harcama_paylari) ekle(p.user_id, -p.pay_kurus);
  }
  for (const o of odesmeler) {
    ekle(o.kimden, o.tl_kurus);
    ekle(o.kime, -o.tl_kurus);
  }
  return net;
}

export type Transfer = { kimden: string; kime: string; tutar: number };

/** Sıfır toplamlı bir küme içinde: en büyük borçlu en büyük alacaklıya öder (küme boyutu − 1 transferi geçmez). */
function acgozlu(kisiler: { id: string; n: number }[]): Transfer[] {
  const alacak = kisiler.filter((k) => k.n > 0).map((k) => ({ ...k }));
  const borc = kisiler.filter((k) => k.n < 0).map((k) => ({ id: k.id, n: -k.n }));
  const sirala = (a: { id: string; n: number }, b: { id: string; n: number }) => b.n - a.n || (a.id < b.id ? -1 : 1);
  const sonuc: Transfer[] = [];
  while (alacak.length && borc.length) {
    alacak.sort(sirala);
    borc.sort(sirala);
    const a = alacak[0];
    const b = borc[0];
    const t = Math.min(a.n, b.n);
    sonuc.push({ kimden: b.id, kime: a.id, tutar: t });
    a.n -= t;
    b.n -= t;
    if (a.n === 0) alacak.shift();
    if (b.n === 0) borc.shift();
  }
  return sonuc;
}

const TAM_ARAMA_SINIRI = 12;

/**
 * KK6 "Borçlar sadeleştirildi: herkes en az transferle ödeşir." Bakiyesi sıfır olmayan n kişi en çok k sıfır toplamlı kümeye
 * ayrılırsa en az n − k transfer gerekir. n ≤ 12 için kümeler alt küme DP'siyle tam bulunur (2^n); daha büyük grupta açgözlü
 * eşleme (en çok n − 1 transfer). Her küme içinde en büyük borçlu en büyük alacaklıya öder. Sonuç belirlenimci (kimliğe göre).
 */
export function sadelestir(net: Map<string, number>): Transfer[] {
  const kisiler = [...net.entries()]
    .filter(([, n]) => n !== 0)
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const n = kisiler.length;
  if (n === 0) return [];
  if (n > TAM_ARAMA_SINIRI) return acgozlu(kisiler);

  const tam = (1 << n) - 1;
  const toplam = new Array<number>(1 << n).fill(0);
  for (let m = 1; m <= tam; m++) {
    const i = 31 - Math.clz32(m & -m);
    toplam[m] = toplam[m & (m - 1)] + kisiler[i].n;
  }
  const dp = new Array<number>(1 << n).fill(0);
  for (let m = 1; m <= tam; m++) {
    let en = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) en = Math.max(en, dp[m ^ (1 << i)]);
    dp[m] = en + (toplam[m] === 0 ? 1 : 0);
  }
  // Geriye: her adımda dp'yi koruyan bir kişi çıkarılır; ekleniş sırası kümeleri ardışık verir.
  const sira: number[] = [];
  let m = tam;
  while (m) {
    const z = toplam[m] === 0 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      if (m & (1 << i) && dp[m ^ (1 << i)] + z === dp[m]) {
        sira.push(i);
        m ^= 1 << i;
        break;
      }
    }
  }
  sira.reverse();
  const sonuc: Transfer[] = [];
  let kume: { id: string; n: number }[] = [];
  let kumeToplam = 0;
  for (const i of sira) {
    kume.push(kisiler[i]);
    kumeToplam += kisiler[i].n;
    if (kumeToplam === 0) {
      sonuc.push(...acgozlu(kume));
      kume = [];
    }
  }
  if (kume.length) sonuc.push(...acgozlu(kume));
  return sonuc.sort((a, b) => b.tutar - a.tutar || (a.kimden < b.kimden ? -1 : a.kimden > b.kimden ? 1 : a.kime < b.kime ? -1 : 1));
}

// ---------------------------------------------------------------- özet (kartlar, Sıradaki adım, hatırlatma)

export type HarcamaOzeti = {
  /** Harcamaların ₺ toplamı. */
  toplam: number;
  net: Map<string, number>;
  /** Sadeleştirilmiş "Kim kime". */
  transferler: Transfer[];
  benimNet: number;
  /** Ben alacaklıysam bana ödeyecekler, borçluysam ödeyeceğim kişiler (büyükten küçüğe). */
  karsilar: { id: string; tutar: number }[];
  /** Seyahat dilimine göre bugünün harcamaları ve en sonuncusu (gezi modu kartı). */
  bugunToplam: number;
  sonBugun: Harcama | null;
};

export function harcamaOzeti(p: { harcamalar: Harcama[]; odesmeler: Odesme[]; benId: string | null; bugun: string; gununTarihi: (iso: string) => string }): HarcamaOzeti {
  const net = netBakiyeler(p.harcamalar, p.odesmeler);
  const transferler = sadelestir(net);
  const benimNet = p.benId ? (net.get(p.benId) ?? 0) : 0;
  const karsilar =
    benimNet > 0
      ? transferler.filter((t) => t.kime === p.benId).map((t) => ({ id: t.kimden, tutar: t.tutar }))
      : benimNet < 0
        ? transferler.filter((t) => t.kimden === p.benId).map((t) => ({ id: t.kime, tutar: t.tutar }))
        : [];
  const bugunun = p.harcamalar.filter((h) => p.gununTarihi(h.created_at) === p.bugun).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return {
    toplam: p.harcamalar.reduce((a, h) => a + h.tl_kurus, 0),
    net,
    transferler,
    benimNet,
    karsilar,
    bugunToplam: bugunun.reduce((a, h) => a + h.tl_kurus, 0),
    sonBugun: bugunun[0] ?? null,
  };
}

/** KK7: gezi bitti hatırlatması — son günün akşamı 20:00'den (seyahat saat dilimi) sonra. Tarihsiz seyahatte yok. */
export const HATIRLATMA_DK = 20 * 60;
export function hatirlatmaVakti(seyahat: { end_date: string | null; tz: string }, an: Date): boolean {
  if (!seyahat.end_date) return false;
  return an.getTime() >= yerelAn(seyahat.end_date, HATIRLATMA_DK, seyahat.tz).getTime();
}

/** KK5: para birimi seçenekleri — TRY, seyahat ülkesinin parası, sonra yaygın olanlar. */
const ULKE_PARASI: Record<string, string> = {
  TR: 'TRY', GB: 'GBP', US: 'USD', CH: 'CHF', JP: 'JPY', CZ: 'CZK', HU: 'HUF', PL: 'PLN', DK: 'DKK', SE: 'SEK', NO: 'NOK',
  GE: 'GEL', AE: 'AED', EG: 'EGP', MA: 'MAD', RS: 'RSD', BA: 'BAM', MK: 'MKD', AL: 'ALL', RU: 'RUB', TH: 'THB', KR: 'KRW', CN: 'CNY',
  CA: 'CAD', AU: 'AUD', IS: 'ISK', RO: 'RON', BG: 'BGN', AZ: 'AZN', JO: 'JOD', IL: 'ILS', SA: 'SAR', QA: 'QAR', MX: 'MXN', BR: 'BRL',
  AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR', FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR',
  LT: 'EUR', LU: 'EUR', LV: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR', ME: 'EUR', XK: 'EUR',
};

export function paraSecenekleri(ulke: string | null | undefined): string[] {
  const yerel = ulke ? ULKE_PARASI[ulke] : undefined;
  return [...new Set(['TRY', ...(yerel ? [yerel] : []), 'EUR', 'USD', 'GBP'])];
}

/** Aynı para birimindeki son harcamanın kuru (1 birim = kaç ₺); yoksa null. */
export function sonKur(harcamalar: Pick<Harcama, 'para_birimi' | 'tutar_kurus' | 'tl_kurus' | 'created_at'>[], paraBirimi: string): number | null {
  const son = harcamalar.filter((h) => h.para_birimi === paraBirimi).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return son ? Math.round((son.tl_kurus / son.tutar_kurus) * 10_000) / 10_000 : null;
}

// ---------------------------------------------------------------- liste yardımcıları

/** KK2: harcamalar seyahat gününe (saat dilimi) göre gruplanır; günler ve gün içi yeniden eskiye. */
export function gunGruplari<T extends Pick<Harcama, 'created_at' | 'tl_kurus'>>(harcamalar: T[], gununTarihi: (iso: string) => string): { tarih: string; toplam: number; harcamalar: T[] }[] {
  const gruplar = new Map<string, T[]>();
  for (const h of [...harcamalar].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
    const t = gununTarihi(h.created_at);
    gruplar.set(t, [...(gruplar.get(t) ?? []), h]);
  }
  return [...gruplar.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([tarih, liste]) => ({ tarih, toplam: liste.reduce((a, h) => a + h.tl_kurus, 0), harcamalar: liste }));
}

/** KK1 Özet: kategori başına ₺ toplamı (büyükten küçüğe). */
export function kategoriOzeti(harcamalar: Pick<Harcama, 'kategori' | 'tl_kurus'>[]): { kategori: HarcamaKategorisi; toplam: number }[] {
  const m = new Map<HarcamaKategorisi, number>();
  for (const h of harcamalar) m.set(h.kategori, (m.get(h.kategori) ?? 0) + h.tl_kurus);
  return [...m.entries()].map(([kategori, toplam]) => ({ kategori, toplam })).sort((a, b) => b.toplam - a.toplam);
}

/**
 * Satırın bölüşüm özeti: herkes eşit → "3'e eşit"; bir kişi dışarıda, gerisi eşit → "{ad} hariç · 2'ye"; tek kişi → "yalnız …";
 * farklı paylar → "{n} kişiye farklı". Eşitlik: paylar arasındaki fark kişi sayısından az (yuvarlama farkı ödeyende).
 */
export type BolusumOzeti = { tur: 'esit'; n: number } | { tur: 'haric'; haric: string; n: number } | { tur: 'yalniz'; kisi: string } | { tur: 'farkli'; n: number };

export function bolusumOzeti(paylar: HarcamaPayi[], uyeIdleri: string[]): BolusumOzeti {
  const dolu = paylar.filter((p) => p.pay_kurus > 0);
  if (dolu.length === 1) return { tur: 'yalniz', kisi: dolu[0].user_id };
  const degerler = dolu.map((p) => p.pay_kurus);
  const esit = Math.max(...degerler) - Math.min(...degerler) < dolu.length;
  if (!esit) return { tur: 'farkli', n: dolu.length };
  const olanlar = new Set(dolu.map((p) => p.user_id));
  const disarida = uyeIdleri.filter((id) => !olanlar.has(id));
  if (disarida.length === 1 && dolu.every((p) => uyeIdleri.includes(p.user_id))) return { tur: 'haric', haric: disarida[0], n: dolu.length };
  return { tur: 'esit', n: dolu.length };
}

// ---------------------------------------------------------------- biçim

const SEMBOLLER: Record<string, string> = { TRY: '₺', EUR: '€', USD: '$', GBP: '£' };

/** "2.340", "183,33" — kuruş sıfırsa ondalık yazılmaz (simgesiz; "Ayşe 250 · Mert 160"). */
export function sayiBicimi(kurus: number): string {
  const mutlak = Math.abs(Math.round(kurus));
  const binlik = String(Math.floor(mutlak / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const kesir = mutlak % 100;
  return kesir ? `${binlik},${String(kesir).padStart(2, '0')}` : binlik;
}

/** "2.340 ₺", "183,33 ₺", "45 €", "120 CHF". `isaret`: artıda "+", eksi her zaman "−". */
export function paraMetni(kurus: number, paraBirimi = 'TRY', isaret = false): string {
  const r = Math.round(kurus);
  const on = r < 0 ? '−' : isaret && r > 0 ? '+' : '';
  return `${on}${sayiBicimi(r)} ${SEMBOLLER[paraBirimi] ?? paraBirimi}`;
}

/** Ortalama gibi yaklaşık tutarlar: tam liraya yuvarlanır ("kişi başı 780 ₺"). */
export function yaklasikPara(kurus: number): string {
  return paraMetni(Math.round(kurus / 100) * 100);
}

/** Para biriminin simgesi ("₺", "€"; simgesi olmayanlarda kodu). */
export function paraSimgesi(paraBirimi: string): string {
  return SEMBOLLER[paraBirimi] ?? paraBirimi;
}

/**
 * Elle girilen tutar → kuruş: "550", "1.234,56", "12,5", "12.50". Virgül varsa ondalık virgüldür (noktalar binlik); yalnız nokta
 * varsa ve ardından 1–2 basamak geliyorsa ondalık. Geçersiz ya da sıfır → null.
 */
export function tutarAyristir(metin: string): number | null {
  const s = metin.replace(/\s/g, '');
  if (!s) return null;
  let tam: string;
  let kesir = '';
  if (s.includes(',')) {
    const [a, b, ...fazla] = s.split(',');
    if (fazla.length) return null;
    tam = a.replace(/\./g, '');
    kesir = b;
  } else {
    const son = s.lastIndexOf('.');
    if (son >= 0 && s.length - son - 1 <= 2 && s.indexOf('.') === son) {
      tam = s.slice(0, son);
      kesir = s.slice(son + 1);
    } else tam = s.replace(/\./g, '');
  }
  if (!/^\d*$/.test(tam) || !/^\d{0,2}$/.test(kesir) || (!tam && !kesir)) return null;
  const k = Number(tam || '0') * 100 + Number(kesir.padEnd(2, '0') || '0');
  return k > 0 && Number.isSafeInteger(k) ? k : null;
}

/** Kuruşu düzenlenebilir metne çevirir: 55000 → "550", 1250 → "12,50". */
export function tutarMetni(kurus: number): string {
  const tam = Math.floor(kurus / 100);
  const kesir = kurus % 100;
  return kesir ? `${tam},${String(kesir).padStart(2, '0')}` : String(tam);
}

/** Kur girişi ("36,25", "36.2512") → sayı; geçersizse null. */
export function kurAyristir(metin: string): number | null {
  const s = metin.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return null;
  const k = Number(s);
  return k > 0 ? k : null;
}

// ---------------------------------------------------------------- IBAN

/** Boşluksuz, büyük harf. */
export function ibanTemizle(metin: string): string {
  return metin.replace(/\s/g, '').toUpperCase();
}

/** Biçim + ISO 13616 mod-97 denetimi; TR IBAN'ı 26 karakter. */
export function ibanGecerli(metin: string): boolean {
  const iban = ibanTemizle(metin);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('TR') && iban.length !== 26) return false;
  const dizilmis = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (h) => String(h.charCodeAt(0) - 55));
  let kalan = 0;
  for (const c of dizilmis) kalan = (kalan * 10 + Number(c)) % 97;
  return kalan === 1;
}

/** "TR33 0006 1005 1978 6457 8413 26" */
export function ibanBicimle(metin: string): string {
  return ibanTemizle(metin).replace(/(.{4})(?=.)/g, '$1 ');
}

// ---------------------------------------------------------------- sayı ekleri

const YONELME_BIR = ['', 'e', 'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a'];
const YONELME_ON = ['', 'a', 'ye', 'a', 'a', 'ye', 'a', 'e', 'e', 'a'];

/** "3'e", "2'ye", "6'ya", "10'a", "100'e": son okunan basamağın sesine göre. */
export function sayiYonelme(n: number): string {
  const bir = n % 10;
  const on = Math.floor(n / 10) % 10;
  const ek = bir ? YONELME_BIR[bir] : on ? YONELME_ON[on] : n >= 1000 ? 'e' : n >= 100 ? 'e' : 'a';
  return `${n}'${ek}`;
}
