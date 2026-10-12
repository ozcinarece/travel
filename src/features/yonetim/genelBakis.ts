// #110 genel bakış — `yonetim_ozet()` cevabından kartlar, grafik geometrisi, tablo oranı ve CSV. Saf; testli.
import { AYLAR_KISA } from '@/lib/takvim';

import { binlik } from './yer';

export type Ozet = {
  aralik_gun: number;
  kullanici: { toplam: number; son7: number };
  seyahat: { toplam: number; bu_hafta: number; onceki_hafta: number };
  gezi_alindi: { toplam: number; onceki: number; tum: number; gunler: number; mekan: number };
  paylasim: { paylasildi: number; paylasildi_onceki: number; acildi: number; olay_var: boolean; katilim: number; katilim_onceki: number };
  google: { ay: number; onceki_ay: number; butce: number | null };
  haftalik: { hafta: string; kullanici: number; seyahat: number }[];
  en_cok_alinan: { id: string; baslik: string; sehir: string; gun_sayisi: number; goruntu: number; alindi: number; kalp: number }[];
  bugun: { kullanici: number; seyahat: number; gezi_alindi: number; kesfet: number; mekan_paneli: number; yorum: number };
};

type Metin = (anahtar: string, degerler?: Record<string, string | number>) => string;

/** Kanvas üst çubuğu "Son 30 gün": seçilebilir aralıklar. */
export const ARALIKLAR = [7, 30, 90] as const;

/** "18,4K", "25K", "1,2M"; 10.000'in altı "9.870". */
export function kisaSayi(n: number): string {
  const kisalt = (bolen: number, ek: string) => `${(Math.round((n / bolen) * 10) / 10).toString().replace('.', ',')}${ek}`;
  if (Math.abs(n) >= 1_000_000) return kisalt(1_000_000, 'M');
  if (Math.abs(n) >= 10_000) return kisalt(1_000, 'K');
  return binlik(n);
}

/** Önceki döneme göre değişim (%); önceki 0 ise hesaplanmaz. */
export function degisim(simdi: number, once: number): number | null {
  if (!once) return null;
  return ((simdi - once) / once) * 100;
}

/** "+8,1%", "+12%", "−3%" (10'un altı tek ondalık). */
export function yuzdeMetni(y: number): string {
  const mutlak = Math.abs(y);
  const sayi = mutlak < 10 ? (Math.round(mutlak * 10) / 10).toString().replace('.', ',') : String(Math.round(mutlak));
  return `${y < 0 ? '−' : '+'}${sayi}%`;
}

export type Kart = { anahtar: string; baslik: string; deger: string; degisim: number | null; alt: string };

/** KK1: beş KPI kartı (kanvas sırası: Kullanıcı, Seyahat, Gezi alındı, Paylaşım, Google API). */
export function kartlar(o: Ozet, metin: Metin): Kart[] {
  const p = o.paylasim;
  return [
    {
      anahtar: 'kullanici',
      baslik: metin('genel.kart.kullanici'),
      deger: binlik(o.kullanici.toplam),
      degisim: degisim(o.kullanici.toplam, o.kullanici.toplam - o.kullanici.son7),
      alt: metin('genel.kart.kullaniciAlt', { n: binlik(o.kullanici.son7) }),
    },
    {
      anahtar: 'seyahat',
      baslik: metin('genel.kart.seyahat'),
      deger: binlik(o.seyahat.toplam),
      degisim: degisim(o.seyahat.bu_hafta, o.seyahat.onceki_hafta),
      alt: metin('genel.kart.seyahatAlt', { n: binlik(o.seyahat.bu_hafta) }),
    },
    {
      anahtar: 'gezi',
      baslik: metin('genel.kart.gezi'),
      deger: binlik(o.gezi_alindi.toplam),
      degisim: degisim(o.gezi_alindi.toplam, o.gezi_alindi.onceki),
      alt: metin('genel.kart.geziAlt', { tum: binlik(o.gezi_alindi.tum), gunler: binlik(o.gezi_alindi.gunler), mekan: binlik(o.gezi_alindi.mekan) }),
    },
    p.olay_var
      ? {
          anahtar: 'paylasim',
          baslik: metin('genel.kart.paylasim'),
          deger: binlik(p.paylasildi),
          degisim: degisim(p.paylasildi, p.paylasildi_onceki),
          alt: metin('genel.kart.paylasimAlt', { n: binlik(p.acildi) }),
        }
      : {
          // Uygulama davet olaylarını yazana kadar: linkle katılan üye (sahip hariç).
          anahtar: 'paylasim',
          baslik: metin('genel.kart.paylasim'),
          deger: binlik(p.katilim),
          degisim: degisim(p.katilim, p.katilim_onceki),
          alt: metin('genel.kart.katilimAlt'),
        },
    {
      anahtar: 'google',
      baslik: metin('genel.kart.google'),
      deger: kisaSayi(o.google.ay),
      degisim: null,
      alt: o.google.butce ? metin('genel.kart.googleAlt', { butce: kisaSayi(o.google.butce) }) : metin('genel.kart.googleAltButcesiz'),
    },
  ];
}

/** Google bütçesinin aşılıp aşılmadığı (KK1 bütçe eşiği). */
export function butceAsildi(o: Ozet): boolean {
  return !!o.google.butce && o.google.ay >= o.google.butce;
}

/** "2026-07-20" → "20 Tem". */
export function haftaEtiketi(hafta: string): string {
  const [, ay, gun] = hafta.split('-').map(Number);
  return `${gun} ${AYLAR_KISA[ay - 1]}`;
}

/** Kanvas grafiği: 560 × 190; çizim alanı x 30–540, y 160 (0) – 20 (üst); 6 yatay çizgi. */
export const GRAFIK = { genislik: 560, yukseklik: 190, sol: 30, sag: 540, alt: 160, ust: 20, cizgi: 5 } as const;

/** Üst değeri kapsayan yuvarlak adım (1, 2, 5 × 10ⁿ); 5 adım. */
export function grafikAdimi(enBuyuk: number): number {
  const hedef = Math.max(enBuyuk, 1) / GRAFIK.cizgi;
  const us = 10 ** Math.floor(Math.log10(hedef));
  const adim = [1, 2, 5, 10].map((k) => k * us).find((a) => a >= hedef) ?? 10 * us;
  return Math.max(1, adim);
}

export type Grafik = {
  cizgiler: { y: number; etiket: string }[];
  xEtiketleri: { x: number; etiket: string }[];
  kullanici: { yol: string; son: { x: number; y: number } | null };
  seyahat: { yol: string; son: { x: number; y: number } | null };
};

const yuvarla = (n: number) => n.toFixed(1);

/** KK2: haftalık seri → çizgiler, x etiketleri (çift haftalar + son hafta, kanvas gibi), iki yol. */
export function grafik(seri: Ozet['haftalik']): Grafik {
  const adim = grafikAdimi(Math.max(0, ...seri.map((h) => Math.max(h.kullanici, h.seyahat))));
  const tepe = adim * GRAFIK.cizgi;
  const yukseklik = GRAFIK.alt - GRAFIK.ust;
  const x = (i: number) => (seri.length > 1 ? GRAFIK.sol + (i * (GRAFIK.sag - GRAFIK.sol)) / (seri.length - 1) : GRAFIK.sol);
  const y = (v: number) => GRAFIK.alt - (v / tepe) * yukseklik;
  const yol = (alan: 'kullanici' | 'seyahat') => ({
    yol: seri.map((h, i) => `${i ? 'L' : 'M'}${yuvarla(x(i))} ${yuvarla(y(h[alan]))}`).join(' '),
    son: seri.length ? { x: x(seri.length - 1), y: y(seri[seri.length - 1][alan]) } : null,
  });
  return {
    cizgiler: Array.from({ length: GRAFIK.cizgi + 1 }, (_, i) => ({ y: GRAFIK.alt - (i * yukseklik) / GRAFIK.cizgi, etiket: binlik(i * adim) })),
    xEtiketleri: seri.map((h, i) => ({ x: x(i), etiket: i % 2 === 0 || i === seri.length - 1 ? haftaEtiketi(h.hafta) : '' })),
    kullanici: yol('kullanici'),
    seyahat: yol('seyahat'),
  };
}

/** KK3 oran: alındı / görüntü ("8%"); görüntü yoksa "—". */
export function oran(alindi: number, goruntu: number): string {
  return goruntu ? `${Math.round((alindi / goruntu) * 100)}%` : '—';
}

const hucre = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** KK6 "Dışa aktar": KPI'lar, haftalık seri, en çok alınan geziler ve günün özeti tek CSV'de (bölümler boş satırla). */
export function csvMetni(o: Ozet, metin: Metin): string {
  const satirlar: (string | number)[][] = [
    [metin('genel.csv.metrik'), metin('genel.csv.deger')],
    [metin('genel.csv.aralik'), o.aralik_gun],
    [metin('genel.kart.kullanici'), o.kullanici.toplam],
    [metin('genel.csv.kullanici7'), o.kullanici.son7],
    [metin('genel.kart.seyahat'), o.seyahat.toplam],
    [metin('genel.csv.seyahatHafta'), o.seyahat.bu_hafta],
    [metin('genel.kart.gezi'), o.gezi_alindi.toplam],
    [metin('genel.csv.geziTum'), o.gezi_alindi.tum],
    [metin('genel.csv.geziGunler'), o.gezi_alindi.gunler],
    [metin('genel.csv.geziMekan'), o.gezi_alindi.mekan],
    [metin('genel.csv.paylasildi'), o.paylasim.paylasildi],
    [metin('genel.csv.acildi'), o.paylasim.acildi],
    [metin('genel.csv.katilim'), o.paylasim.katilim],
    [metin('genel.csv.googleAy'), o.google.ay],
    [metin('genel.csv.butce'), o.google.butce ?? ''],
    [],
    [metin('genel.csv.hafta'), metin('genel.kullanici'), metin('genel.seyahat')],
    ...o.haftalik.map((h) => [h.hafta, h.kullanici, h.seyahat]),
    [],
    [metin('genel.tablo.gezi'), metin('genel.csv.sehir'), metin('genel.csv.gun'), metin('genel.tablo.goruntu'), metin('genel.tablo.alindi'), metin('genel.tablo.kalp'), metin('genel.tablo.oran')],
    ...o.en_cok_alinan.map((g) => [g.baslik, g.sehir, g.gun_sayisi, g.goruntu, g.alindi, g.kalp, oran(g.alindi, g.goruntu)]),
    [],
    [metin('genel.csv.bugun'), metin('genel.csv.deger')],
    [metin('genel.kullanici'), o.bugun.kullanici],
    [metin('genel.seyahat'), o.bugun.seyahat],
    [metin('genel.kart.gezi'), o.bugun.gezi_alindi],
    [metin('genel.csv.kesfet'), o.bugun.kesfet],
    [metin('genel.csv.mekanPaneli'), o.bugun.mekan_paneli],
    [metin('genel.csv.yorum'), o.bugun.yorum],
  ];
  return satirlar.map((s) => s.map(hucre).join(',')).join('\r\n');
}

/** Dosya adı: "genel-bakis-30-gun-2026-10-12.csv" (panel kullanıcısının yerel günü). */
export function csvDosyaAdi(gun: number, simdi = new Date()): string {
  const iki = (n: number) => String(n).padStart(2, '0');
  return `genel-bakis-${gun}-gun-${simdi.getFullYear()}-${iki(simdi.getMonth() + 1)}-${iki(simdi.getDate())}.csv`;
}
