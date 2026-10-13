// #157 genel bakış (kanvas BO-0) — saf hesaplar: süre ve oran metinleri, Google tahmini harcaması, bu hafta grafiği,
// içerik sağlığı. Veri `yonetim_genel(p_gun)` tek çağrı. Testli.
import { AYLAR, GUNLER, GUNLER_KISA } from '@/lib/takvim';

/** getUTCDay (Pazar 0) → Pazartesi başlı dizin. */
const pztDizin = (gun: number) => (gun + 6) % 7;

export type Donem = 1 | 7 | 30;
export const DONEMLER: Donem[] = [1, 7, 30];

export type GoogleKalemi = 'mekan' | 'foto' | 'rota' | 'yorum';
export const GOOGLE_KALEMLERI: GoogleKalemi[] = ['mekan', 'foto', 'rota', 'yorum'];

export type IcerikSehri = { id: string; ad: string; kapak: boolean; genis_kapak: boolean; bolum: number; bos_bolum: number; mekan: number; gezi: number };

export type Genel = {
  donem: Donem;
  ilk_plan: { olay_var: boolean; n: number; medyan_sn: number | null };
  davet: { olay_var: boolean; kurulan: number; paylasilan: number; katilan: number; katilim_olay_var: boolean };
  plan: { olay_var: boolean; sayi: number; onceki: number };
  gezi: { olay_var: boolean; sayi: number; en_cok: string | null };
  hafta: { gun: string; plan: number; katilim: number }[];
  hafta_olay_var: boolean;
  google: Record<GoogleKalemi, number> & { butce: number | null; fiyat: Partial<Record<GoogleKalemi, number>> | null; yorum_sinir: number | null };
  en_cok_alinan: { id: string; baslik: string; kapak_url: string | null; sayi: number }[];
  icerik: IcerikSehri[];
};

/** İlk saatlik plan hedefi (#139): 3 dakika. */
export const PLAN_HEDEF_SN = 180;

/** "2 dk 40 sn", "45 sn", "1 sa 5 dk". */
export function sureMetni(sn: number): string {
  const s = Math.round(sn);
  if (s < 60) return `${s} sn`;
  if (s < 3600) {
    const dk = Math.floor(s / 60);
    const kalan = s % 60;
    return kalan ? `${dk} dk ${kalan} sn` : `${dk} dk`;
  }
  // Dakikaya yuvarlayıp sonra saate böl ("1 sa 60 dk" çıkmasın).
  const toplamDk = Math.round(s / 60);
  const sa = Math.floor(toplamDk / 60);
  const dk = toplamDk % 60;
  return dk ? `${sa} sa ${dk} dk` : `${sa} sa`;
}

/** "%38"; payda 0 ise null (oran yok, sıfır değil). */
export function yuzde(pay: number, payda: number): string | null {
  if (!payda) return null;
  return `%${Math.round((pay / payda) * 100)}`;
}

/** Önceki döneme göre değişim: "+%18", "−%5", "%0"; önceki 0 ise null. */
export function degisimMetni(simdi: number, once: number): string | null {
  if (!once) return null;
  const d = Math.round(((simdi - once) / once) * 100);
  return d > 0 ? `+%${d}` : d < 0 ? `−%${-d}` : '%0';
}

/** "$4,10" (Türkçe ondalık). */
export function dolarMetni(usd: number): string {
  return `$${usd.toFixed(2).replace('.', ',')}`;
}

export type GoogleOzeti = {
  toplam: number;
  butce: number | null;
  asildi: boolean;
  kalemler: { anahtar: GoogleKalemi; sayi: number; usd: number; oran: number }[];
  yorum: { sayi: number; sinir: number | null; oran: number };
};

/**
 * Bugünkü tahmini harcama: kalem isteği × birim fiyat (USD / 1000). Çubuk: kalemin bugünkü toplam harcamadaki payı
 * (mekan + foto + rota + yorum = %100; bütçeye yakınlığı üstteki "$4,10 / $10" gösterir); Google yorumları çubuğu
 * günlük sınıra göre. Fiyat yoksa 0 sayılır.
 */
export function googleOzeti(g: Genel['google']): GoogleOzeti {
  const fiyat = g.fiyat ?? {};
  const usd = (k: GoogleKalemi) => ((g[k] ?? 0) * (fiyat[k] ?? 0)) / 1000;
  const toplam = GOOGLE_KALEMLERI.reduce((t, k) => t + usd(k), 0);
  const butce = g.butce && g.butce > 0 ? g.butce : null;
  const oranla = (x: number, y: number | null) => (y ? Math.min(1, x / y) : 0);
  return {
    toplam,
    butce,
    asildi: butce !== null && toplam >= butce,
    kalemler: (['mekan', 'foto', 'rota'] as const).map((k) => ({ anahtar: k, sayi: g[k] ?? 0, usd: usd(k), oran: oranla(usd(k), toplam) })),
    yorum: { sayi: g.yorum ?? 0, sinir: g.yorum_sinir, oran: oranla(g.yorum ?? 0, g.yorum_sinir) },
  };
}

/** Kanvas BO-0 grafiği (660 × 272): taban 240, en yüksek çubuk 208 px; gün başına iki çubuk (30 px, 4 px ara), 88 px adım. */
export const HAFTA_GRAFIGI = { genislik: 660, yukseklik: 272, taban: 240, enYuksek: 208, ilkX: 40, adim: 88, cubuk: 30, ara: 4 } as const;

export function haftaCubuklari(hafta: Genel['hafta']): { gun: string; etiket: string; plan: { x: number; y: number; h: number }; katilim: { x: number; y: number; h: number }; deger: { plan: number; katilim: number } }[] {
  const G = HAFTA_GRAFIGI;
  const enBuyuk = Math.max(1, ...hafta.flatMap((h) => [h.plan, h.katilim]));
  const cubuk = (n: number, x: number) => {
    const h = n ? Math.max(4, Math.round((n / enBuyuk) * G.enYuksek)) : 0;
    return { x, y: G.taban - h, h };
  };
  return hafta.map((h, i) => {
    const x = G.ilkX + i * G.adim;
    const gun = new Date(`${h.gun}T12:00:00Z`).getUTCDay();
    return { gun: h.gun, etiket: GUNLER_KISA[pztDizin(gun)], plan: cubuk(h.plan, x), katilim: cubuk(h.katilim, x + G.cubuk + G.ara), deger: { plan: h.plan, katilim: h.katilim } };
  });
}

export type IcerikDurumu = { tamam: boolean; anahtar: 'tamam' | 'rehberYok' | 'bosBolum' | 'kapakYok' | 'genisKapakYok' | 'geziYok'; n?: number };

/** İçerik sağlığı: ilk eksik (rehber yok → boş bölüm → kapak → geniş kapak → hazır gezi); yoksa özet satırı. */
export function icerikDurumu(s: IcerikSehri): IcerikDurumu {
  if (!s.bolum) return { tamam: false, anahtar: 'rehberYok' };
  if (s.bos_bolum) return { tamam: false, anahtar: 'bosBolum', n: s.bos_bolum };
  if (!s.kapak) return { tamam: false, anahtar: 'kapakYok' };
  if (!s.genis_kapak) return { tamam: false, anahtar: 'genisKapakYok' };
  if (!s.gezi) return { tamam: false, anahtar: 'geziYok' };
  return { tamam: true, anahtar: 'tamam' };
}

/** Üst etiket tarihi: "13 EKİM SALI" (Türkiye saatiyle). */
export function tarihEtiketi(simdi: Date = new Date()): string {
  const p = istanbul(simdi);
  return `${p.gun} ${AYLAR[p.ay]} ${GUNLER[pztDizin(p.haftaGunu)]}`.toLocaleUpperCase('tr-TR');
}

/** Selam (Türkiye saatiyle): 05–12 Günaydın, 12–18 İyi günler, diğer İyi akşamlar. */
export function selam(simdi: Date = new Date()): 'gunaydin' | 'iyiGunler' | 'iyiAksamlar' {
  const s = istanbul(simdi).saat;
  return s >= 5 && s < 12 ? 'gunaydin' : s >= 12 && s < 18 ? 'iyiGunler' : 'iyiAksamlar';
}

/** Türkiye UTC+3 sabit (yaz saati yok). */
function istanbul(t: Date) {
  const d = new Date(t.getTime() + 3 * 3600 * 1000);
  return { gun: d.getUTCDate(), ay: d.getUTCMonth(), haftaGunu: d.getUTCDay(), saat: d.getUTCHours() };
}
