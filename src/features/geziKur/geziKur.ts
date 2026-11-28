// #574 Gezi oluşturma v11 (UX önerileri kanvası "Gezi oluşturma v11 · ONAYLI": `Kur_v11_Acilis`, `Kur_v11_Sehir`,
// `Kur_v11_Cekmece`): saf yardımcılar (ekrandan ve ağdan bağımsız; test edilir). Veri yalnız kendi tablolarımızdan: hazır
// geziler (Keşfet akışı), arkadaşların açık paylaşımları (#533) ve rehberli şehirler. Google'a istek yok.
import { sade } from '@/features/anasayfa/v9';
import type { ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import type { Amac } from '@/features/icerik/amaclar';
import type { AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { ilkAd } from '@/features/paylasim/baslik';
import { gunFarki, gunSayisiSinirla, TARIH_EN_COK_GUN, type Aralik } from '@/features/sihirbaz/sihirbaz';
import type { TarihSecimi } from '@/features/sihirbaz/taslak';
import { t } from '@/i18n';
import { ilgiEkli } from '@/lib/ek';
import { AYLAR, GUNLER, haftaGunu, parcala, tarihEkle } from '@/lib/takvim';
import type { Sehir } from '@/lib/tipler';

export { sade };

/** KK2: süzgeç çipleri, kanvastaki sırayla. Gün süzgeçleri gezinin gün sayısıyla, diğerleri `amaclar` ile süzer. */
export const GUN_SUZGECLERI = ['iki', 'ucBes'] as const;
export type GunSuzgeci = (typeof GUN_SUZGECLERI)[number];
export const AMAC_SUZGECLERI = ['lezzet', 'doga', 'kultur_tarih'] as const satisfies readonly Amac[];
export type AmacSuzgeci = (typeof AMAC_SUZGECLERI)[number];
export type Suzgec = { gun: GunSuzgeci | null; amac: AmacSuzgeci | null };
export const BOS_SUZGEC: Suzgec = { gun: null, amac: null };

export function gunUyar(gun: GunSuzgeci, n: number): boolean {
  return gun === 'iki' ? n === 2 : n >= 3 && n <= 5;
}

/** KK2: gün ve amaç süzgeci birlikte (ikisi de seçiliyse ikisine de uyan). Sıra korunur (Keşfet akışının sırası). */
export function geziSuz<T extends Pick<AkisGezisi, 'gun_sayisi' | 'amaclar'>>(geziler: readonly T[], s: Suzgec): T[] {
  return geziler.filter((g) => (!s.gun || gunUyar(s.gun, g.gun_sayisi)) && (!s.amac || !!g.amaclar?.includes(s.amac)));
}

/** KK3: yazılan metnin rehberli şehirleri. `tam`: adı aynen yazılan şehir (aksansız, Türkçe küçük harf: "eskisehir" →
 * Eskişehir); `sehirler`: tam eşleşme varsa yalnız o, yoksa adı yazılanla başlayan şehirler ("iz" → İzmir). Boş metinde ikisi de boş. */
export type SehirEslesmesi = { tam: Pick<Sehir, 'id' | 'ad'> | undefined; sehirler: Pick<Sehir, 'id' | 'ad'>[] };

export function sehirEslesmesi(sorgu: string, sehirler: readonly Pick<Sehir, 'id' | 'ad'>[] | undefined): SehirEslesmesi {
  const q = sade(sorgu);
  if (!q || !sehirler) return { tam: undefined, sehirler: [] };
  const tam = sehirler.find((s) => sade(s.ad) === q);
  return { tam, sehirler: tam ? [tam] : sehirler.filter((s) => sade(s.ad).startsWith(q)) };
}

/** Lacivert satırdaki ve başlıktaki şehir adı: yalnız tam eşleşmede rehberli şehrin adı, yoksa yazılan metin (kırpılmış). */
export function sehirAdi(sorgu: string, tam: Pick<Sehir, 'ad'> | undefined): string {
  return tam?.ad ?? sorgu.trim();
}

/** KK3: eşleşen şehirlerin hazır gezileri (şehir kimliğiyle; Keşfet sırası). Her harfte süzülür. */
export function sehirGezileri<T extends Pick<AkisGezisi, 'sehir_id'>>(geziler: readonly T[], sehirler: readonly Pick<Sehir, 'id'>[]): T[] {
  const idler = new Set(sehirler.map((x) => x.id));
  return geziler.filter((g) => idler.has(g.sehir_id));
}

/** KK3: arkadaşların o şehirdeki rotaları — tam eşleşmede şehrin adı, yoksa yazılanla başlayan şehir etiketi. Boş metinde hepsi. */
export function arkadasRotalari(paylasimlar: readonly ArkadasPaylasimi[], sorgu: string, tam: Pick<Sehir, 'ad'> | undefined): ArkadasPaylasimi[] {
  const q = sade(sorgu);
  if (!q) return [...paylasimlar];
  if (tam) return paylasimlar.filter((p) => sade(p.sehir) === sade(tam.ad));
  return paylasimlar.filter((p) => sade(p.sehir).startsWith(q));
}

/** Rota kartının durak sayısı (günlerin durakları toplamı; Keşfet kartıyla aynı veri). */
export function durakSayisi(g: Pick<AkisGezisi, 'gunDuraklari' | 'mekan_sayisi'>): number {
  const n = g.gunDuraklari.reduce((a, b) => a + b, 0);
  return n > 0 ? n : g.mekan_sayisi;
}

export type GidenArkadas = { id: string; ad: string; foto: string | null };

/**
 * KK4: o hazır geziyi seyahatine almış gerçek arkadaşlar. Yeni veri yok: arkadaşların açık paylaşımlarından (#533) adı
 * gezinin başlığıyla ve şehri gezinin şehriyle aynı olanlar ("Seyahatime al" yeni seyahate gezinin başlığını ad verir).
 * Kişi başına bir kez, akış sırasıyla. Hiçbiri yoksa boş → satır gizlenir.
 */
export function gidenArkadaslar(gezi: Pick<AkisGezisi, 'baslik' | 'sehirler'>, paylasimlar: readonly ArkadasPaylasimi[] | undefined): GidenArkadas[] {
  const sehir = gezi.sehirler?.ad;
  if (!paylasimlar || !sehir) return [];
  const baslik = sade(gezi.baslik);
  const gorulen = new Set<string>();
  const sonuc: GidenArkadas[] = [];
  for (const p of paylasimlar) {
    if (!p.ad || sade(p.ad) !== baslik || sade(p.sehir) !== sade(sehir) || gorulen.has(p.paylasan)) continue;
    const ad = ilkAd(p.paylasan_ad);
    if (!ad) continue;
    gorulen.add(p.paylasan);
    sonuc.push({ id: p.paylasan, ad, foto: p.foto });
  }
  return sonuc;
}

/** Kartta en çok bu kadar yüz. */
export const YUZ_EN_COK = 3;

/** KK4: "Mert bu rotayla gitti" · "Ayşe ve Mert bu rotayla gitti" · "Ayşe, Mert ve 2 kişi bu rotayla gitti". */
export function gittiMetni(adlar: readonly string[]): string | null {
  if (adlar.length === 0) return null;
  if (adlar.length === 1) return t('geziKur.gitti1', { a: adlar[0] });
  if (adlar.length === 2) return t('geziKur.gitti2', { a: adlar[0], b: adlar[1] });
  return t('geziKur.gittiCok', { a: adlar[0], b: adlar[1], n: adlar.length - 2 });
}

/**
 * KK5: çekmecenin tarih seçimi. Yalnız gidiş seçiliyken dönüş rotanın gün sayısından gelir (3 dokunuş: Bunu seç → tarih →
 * Geziyi oluştur); dönüş gününe dokunulursa o. "Tarihim belli değil" → sayaçtaki gün sayısı.
 */
/**
 * #649 KK1: çekmecede seçilebilecek en uzun gezi, rotanın kaynağına göre. Hazır gezi `geziden_seyahat_ac`'a gider (en çok 30 gün,
 * `20261115000000_konum_kaynagi_korumalari.sql`); arkadaş rotası taslak tarih RPC'sine (`seyahat_tarihlerini_degistir`, en çok 60).
 */
export const HAZIR_GEZI_EN_COK_GUN = 30;
export function cekmeceEnCokGun(tur: 'gezi' | 'arkadas'): number {
  return tur === 'gezi' ? HAZIR_GEZI_EN_COK_GUN : TARIH_EN_COK_GUN;
}

/** #649 KK1: `enCok` rotanın kaynağının sınırı (`cekmeceEnCokGun`); tarihsiz sayı ve hesaplanan dönüş bunu aşmaz. */
export function cekmeceSecimi(aralik: Aralik, tarihsizGun: number | null, rotaGun: number, enCok: number = TARIH_EN_COK_GUN): TarihSecimi | null {
  const sinirla = (n: number) => Math.min(enCok, gunSayisiSinirla(n));
  if (tarihsizGun !== null) return { tur: 'tarihsiz', gun: sinirla(tarihsizGun) };
  if (!aralik) return null;
  return { tur: 'tarihli', gidis: aralik.gidis, donus: aralik.donus ?? tarihEkle(aralik.gidis, sinirla(rotaGun) - 1) };
}

/** Seçimin gün sayısı ve başlangıcı (`geziden_seyahat_ac` girdisi). */
export function secimGunVeBaslangic(secim: TarihSecimi): { gunSayisi: number; baslangic: string | null } {
  return secim.tur === 'tarihli' ? { gunSayisi: gunFarki(secim.gidis, secim.donus) + 1, baslangic: secim.gidis } : { gunSayisi: secim.gun, baslangic: null };
}

/** KK5 özeti (kanvas): "5–6 Aralık · Cumartesi–Pazar · 2 gün"; ay değişirse "30 Ekim–2 Kasım"; tek gün "16 Ekim · Cuma · 1 gün". */
export function tarihSatiri(secim: Extract<TarihSecimi, { tur: 'tarihli' }>): string {
  const g = parcala(secim.gidis);
  const d = parcala(secim.donus);
  const n = gunFarki(secim.gidis, secim.donus) + 1;
  const gunMetni = t('sihirbaz.nezaman.gunSayisi', { n });
  if (n === 1) return [`${g.gun} ${AYLAR[g.ay - 1]}`, GUNLER[haftaGunu(secim.gidis)], gunMetni].join(' · ');
  const aralik = g.ay === d.ay && g.yil === d.yil ? `${g.gun}–${d.gun} ${AYLAR[g.ay - 1]}` : `${g.gun} ${AYLAR[g.ay - 1]}–${d.gun} ${AYLAR[d.ay - 1]}`;
  return [aralik, `${GUNLER[haftaGunu(secim.gidis)]}–${GUNLER[haftaGunu(secim.donus)]}`, gunMetni].join(' · ');
}

/**
 * KK7: arkadaş rotasından kurulan seyahatin Gezi sayfasında "Ayşe'nin rotasından". Yeni veri yok: seyahatin `kaynak_paylasim`
 * kimliği #533 akışındaki paylaşımla eşleşir (paylaşanın ilk adı). Eşleşme yoksa (link kapandı, kişi artık arkadaş değil) null.
 */
export function kaynakRotaMetni(kaynak: string | null | undefined, paylasimlar: readonly Pick<ArkadasPaylasimi, 'id' | 'paylasan_ad'>[] | undefined): string | null {
  const p = kaynak ? paylasimlar?.find((x) => x.id === kaynak) : undefined;
  const ad = p ? ilkAd(p.paylasan_ad) : null;
  const ekli = ad ? ilgiEkli(ad) : null;
  return ekli ? t('geziKur.rotasindan', { ad: ekli }) : null;
}
