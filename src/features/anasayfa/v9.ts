// #569 ana sayfa v9 (UX önerileri kanvası, "Ana sayfa v9 · ONAYLI": `Ana_v9_GeziOncesi` · `Ana_v9_GeziSirasi` ·
// `Ana_v9_GeziYok`): saf kurallar. Hepsi bizim veritabanımızdan; Google isteği yok, Google fotoğrafı kullanılmaz.
import { kapakAtfiOku, type KapakAtfi } from '@/features/icerik/kapakAtfi';
import { sehirEslestir } from '@/features/icerik/sorgular';
import { bitmemis, type Siniflar } from '@/features/seyahatler/siniflandir';
import { gunFarki } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import type { Sehir, SeyahatOzet } from '@/lib/tipler';
import { kacinciGun, yerelTarih } from '@/lib/zaman';

/** KK2: kart ölçüleri (kanvas): 214 pt yükseklik, köşe 20; kartlar arası 10, kenar 16. */
export const KART_YUKSEKLIK = 214;
export const KART_KOSE = 20;
export const KART_ARALIK = 10;
/** Birden çok kartta sıradaki kartın görünen ucu (kanvas `Ana_v9_GeziOncesi`: 390 pt ekranda 318 pt kart + 60 pt uç). */
export const KART_UC = 40;

/**
 * KK2: kayan seyahat kartları — süren (aktif) seyahatler önce, sonra yaklaşanlar (Gezilerim › YAKLAŞAN ile aynı küme:
 * bitmemiş seyahatler, tarih sırası, taslaklar sonda). Biten seyahat kartta yok.
 */
export function kartSeyahatleri(s: Siniflar): SeyahatOzet[] {
  return bitmemis(s);
}

/** KK2: kart genişliği — tek kartta tam genişlik (kenarlar 16), birden çokta sıradaki kartın ucu görünür. */
export function kartGenisligi(ekran: number, adet: number): number {
  const tam = Math.max(0, ekran - 32);
  return adet > 1 ? Math.max(0, tam - KART_UC) : tam;
}

/** KK2: kaydırma konumundan görünen kartın sırası (0'dan). */
export function gorunenKart(x: number, kartGenislik: number, adet: number): number {
  if (adet <= 1 || kartGenislik <= 0) return 0;
  return Math.min(adet - 1, Math.max(0, Math.round(x / (kartGenislik + KART_ARALIK))));
}

/**
 * KK3: gezi öncesi kartın alt satırı — "N gün kaldı · K kişi". "Bugün" seyahatin diliminde (`trips.tz`), cihaz saatiyle değil.
 * Tarihsiz seyahatte yalnız "K kişi".
 */
export function geziOncesiAlt(sy: Pick<SeyahatOzet, 'start_date' | 'tz' | 'members'>, an: Date = new Date()): string {
  const k = Math.max(1, sy.members.length);
  if (!sy.start_date) return t('anasayfa.v9.kisi', { k });
  const kalan = gunFarki(yerelTarih(an, sy.tz), sy.start_date);
  return kalan <= 0 ? t('anasayfa.v9.kalanBugunKisi', { k }) : t('anasayfa.v9.kalanKisi', { n: kalan, k });
}

/** KK4: gezi sırasındaki kartın üst satırı — "Bugün N. gün" (`trips.tz`); süren seyahat değilse null. */
export function bugunSatiri(sy: Pick<SeyahatOzet, 'start_date' | 'end_date' | 'tz'>, an: Date = new Date()): string | null {
  const n = kacinciGun(sy, an);
  return n ? t('anasayfa.v9.bugunGun', { n }) : null;
}

/** KK4: "Sıradaki: durak · saat" (saat bilinmiyorsa yalnız durak). */
export function siradakiMetni(ad: string, saat: string | null): string {
  return saat ? t('anasayfa.v9.siradaki', { ad, saat }) : t('anasayfa.v9.siradakiSaatsiz', { ad });
}

export type Kapak = { url: string; atif: KapakAtfi | null };

/** Ad karşılaştırması için: Türkçe küçük harf, ı → i, aksanlar atılır ("Istanbul" = "İstanbul", "Eskisehir" = "Eskişehir"). */
function sade(ad: string): string {
  return ad
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * KK2: kartın kapağı. Seyahatin kendi kapağı (varsa) önce; yoksa şehrin BO kapağı. Şehir `sehirEslestir` ile bulunur (ad
 * eşitliği, yoksa merkeze 25 km — "Kapadokya" gibi etiketler, Göreme/Nevşehir koordinatı); o da yoksa aksansız ad. İkisi de
 * yoksa null (kanvastaki yer tutucu zemin). Google fotoğrafı hiçbir durumda kullanılmaz.
 */
export function seyahatKapagi(
  sy: Pick<SeyahatOzet, 'city_label' | 'lat' | 'lng'> & { kapak_url?: string | null; kapak_atif?: unknown },
  sehirler: readonly Sehir[] | undefined,
): Kapak | null {
  if (sy.kapak_url) return { url: sy.kapak_url, atif: kapakAtfiOku(sy.kapak_atif) };
  if (!sehirler) return null;
  const ad = sade(sy.city_label);
  const sehir = sehirEslestir([...sehirler], { ad: sy.city_label, lat: sy.lat ?? null, lng: sy.lng ?? null }) ?? sehirler.find((x) => sade(x.ad) === ad);
  return sehir?.kapak_url ? { url: sehir.kapak_url, atif: kapakAtfiOku(sehir.kapak_atif) } : null;
}

/** KK5: gezisi olmayan kartın yedek görseli — Eskişehir'in BO kapağı. */
export const YEDEK_SEHIR = 'eskisehir';

export function yedekKapak(sehirler: readonly Pick<Sehir, 'slug' | 'kapak_url' | 'kapak_atif'>[] | undefined): Kapak | null {
  const s = sehirler?.find((x) => x.slug === YEDEK_SEHIR);
  return s?.kapak_url ? { url: s.kapak_url, atif: kapakAtfiOku(s.kapak_atif) } : null;
}

/** Kart yüzlerinin sırası (kanvas): Mandalina, açık mavi, Gece. */
export const KART_YUZ_SAYISI = 3;

/** KK3 · KK4: karttaki yüzler — ben önce, en çok 3 kişi; adı boş üye atlanır. */
export function kartYuzleri(uyeler: readonly { user_id: string; display_name: string }[], benId: string | null | undefined): { id: string; ad: string }[] {
  return [...uyeler]
    .sort((x, y) => Number(y.user_id === benId) - Number(x.user_id === benId))
    .filter((u) => u.display_name.trim())
    .slice(0, KART_YUZ_SAYISI)
    .map((u) => ({ id: u.user_id, ad: u.display_name.trim() }));
}
