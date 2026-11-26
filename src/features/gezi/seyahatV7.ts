// #308 (kanvas UX önerileri › "#308 Seyahat sayfası · v7": `Sayfa_v7_Seyahat_PlanModu`, `_GeziModu`, `_TekBos`): seyahat
// sayfasının v7 metinleri ve sıralamaları. Saf hesaplar; veri eldekinden, Google'a istek yok. Zaman `trips.tz` ile.
import { mesafeM } from '@/components/harita/geo';
import { t } from '@/i18n';
import { bulunmaEkli } from '@/lib/ek';
import { GUNLER, haftaGunu, tarihAraligi } from '@/lib/takvim';
import type { Mekan, Seyahat, Uye, Yer } from '@/lib/tipler';
import { gunSayisi, yerelTarih } from '@/lib/zaman';

import type { GunKarti } from './geziOzeti';

type Tarihli = Pick<Seyahat, 'start_date' | 'end_date' | 'tz'>;
type Konum = { lat: number; lng: number };

/** "Çarşamba" (tarihli gün) ya da null. */
export function gunAdi(tarih: string | null): string | null {
  return tarih ? GUNLER[haftaGunu(tarih)] : null;
}

/**
 * KK2 başlık alt satırı.
 * - Plan modu: "24–29 Kasım · 4 gün kaldı" (başlangıç geldiyse ya da tarihsizse yalnız aralık / "tarih belli değil").
 * - Gezi modu: "2. gün · Çarşamba · 3 / 6 durak"; bugün durak yoksa (kanvas `TekBos`) "3. gün · Perşembe · 24–29 Kasım".
 */
export function baslikAltSatiri(p: {
  seyahat: Tarihli;
  mod: 'plan' | 'gezi' | 'bitti';
  an: Date;
  bugunIndex: number | null;
  bugunTarih: string | null;
  gezilen: number;
  toplam: number;
}): string {
  const { start_date: bas, end_date: bit } = p.seyahat;
  const aralik = bas && bit ? tarihAraligi(bas, bit) : null;
  if (p.mod === 'gezi' && p.bugunIndex !== null) {
    const parcalar = [t('geziSayfasi.gunNo', { n: p.bugunIndex }), gunAdi(p.bugunTarih)];
    parcalar.push(p.toplam > 0 ? t('seyahatV7.durakSayaci', { x: p.gezilen, y: p.toplam }) : aralik);
    return parcalar.filter(Boolean).join(' · ');
  }
  if (!aralik) return t('seyahatV7.tarihsiz');
  const bugun = yerelTarih(p.an, p.seyahat.tz);
  if (p.mod === 'plan' && bas && bas > bugun) return `${aralik} · ${t('geziSayfasi.gunKaldi', { n: gunSayisi(bugun, bas) - 1 })}`;
  return aralik;
}

/** KK3 grup: "Ece, Mert, Ayşe" (benim adım başta). */
export function kisiAdlari(uyeler: Pick<Uye, 'user_id' | 'display_name'>[], benId: string | null): string {
  const sirali = [...uyeler].sort((a, b) => Number(b.user_id === benId) - Number(a.user_id === benId));
  return sirali.map((u) => u.display_name?.trim() || t('seyahatV7.adsiz')).join(', ');
}

/**
 * KK3 gezi modu: bugünün son varılan durağına varmış kişiler → "Sen ve Mert Sazova'da", "Mert Sazova'da", "Sen Sazova'dasın".
 * Kimse yoksa null (satırda kişi adları yazar). Yer adı ek alamıyorsa "Sen ve Mert orada".
 */
export function varanlarMetni(p: { varanlar: Pick<Uye, 'user_id' | 'display_name'>[]; benId: string | null; yerAdi: string | null }): string | null {
  if (p.varanlar.length === 0) return null;
  const ben = p.varanlar.some((u) => u.user_id === p.benId);
  const digerleri = p.varanlar.filter((u) => u.user_id !== p.benId).map((u) => u.display_name?.trim() || t('seyahatV7.adsiz'));
  const yer = p.yerAdi ? bulunmaEkli(p.yerAdi) : null;
  // "Sazova'dasın", "Köprü'desin": ekin ünlüsüne göre -sın/-sin.
  if (ben && digerleri.length === 0) return yer ? t(yer.endsWith('a') ? 'seyahatV7.senDa' : 'seyahatV7.senDe', { yer }) : t('seyahatV7.senOrada');
  const kisiler = ben ? t('seyahatV7.senVe', { adlar: birlestir(digerleri) }) : birlestir(digerleri);
  return yer ? t('seyahatV7.vardilar', { kisiler, yer }) : t('seyahatV7.orada', { kisiler });
}

/** "Mert", "Mert ve Ayşe", "Mert, Ayşe ve Can". */
export function birlestir(adlar: string[]): string {
  if (adlar.length <= 1) return adlar.join('');
  return `${adlar.slice(0, -1).join(', ')} ${t('seyahatV7.ve')} ${adlar[adlar.length - 1]}`;
}

/** KK5 plan modu "Günler" satırı: "1. gün · Salı" ve "5 durak · 09:30 Kurşunlu Külliyesi" (boş günde "Durak yok"). */
export function gunSatiri(k: Pick<GunKarti, 'gun' | 'tema' | 'durakSayisi' | 'saat'>): { ust: string; alt: string } {
  const ust = [t('geziSayfasi.gunNo', { n: k.gun.index }), gunAdi(k.gun.date)].filter(Boolean).join(' · ');
  if (k.durakSayisi === 0) return { ust, alt: t('seyahatV7.durakYok') };
  const ilkSaat = k.saat ? k.saat.replace('~', '').split('–')[0] : null;
  const ilk = [ilkSaat, k.tema].filter(Boolean).join(' ');
  return { ust, alt: [t('seyahatV7.durakN', { n: k.durakSayisi }), ilk].filter(Boolean).join(' · ') };
}

/** KK5 gezi modu etiketi: "ŞİMDİ · 12 DK YÜRÜME"; süre bilinmiyorsa "ŞİMDİ". */
export function simdiEtiketi(dk: number | null, taksi: boolean): string {
  const metin = dk === null ? t('seyahatV7.simdi') : t(taksi ? 'seyahatV7.simdiTaksi' : 'seyahatV7.simdiYuruyus', { dk });
  return metin.toLocaleUpperCase('tr-TR');
}

/**
 * KK5 boş gün: #401 il listesinden (şehrin yayındaki yerleri) listede olmayan, konumu bilinen yerler; çıkış noktasına
 * (konum, yoksa otel, yoksa şehir merkezi) uzaklığa göre sıralı ilk 3.
 */
export function bosGunOnerileri<Y extends Pick<Yer, 'lat' | 'lng'> & { place_id: string | null }>(
  yerler: Y[],
  mekanlar: Pick<Mekan, 'place_id'>[],
  merkez: Konum | null,
  adet = 3,
): (Y & { place_id: string; mesafeM: number | null })[] {
  const listede = new Set(mekanlar.map((m) => m.place_id));
  return yerler
    .filter((y): y is Y & { place_id: string } => !!y.place_id && !listede.has(y.place_id) && Number.isFinite(y.lat) && Number.isFinite(y.lng))
    .map((y) => ({ ...y, mesafeM: merkez ? mesafeM(merkez, { lat: y.lat, lng: y.lng }) : null }))
    .sort((a, b) => (a.mesafeM ?? 0) - (b.mesafeM ?? 0))
    .slice(0, adet);
}

/** #522 inceleme 1 (kanvas `_GeziModu`): "Bugünün planı" gezilenleri ve sıradaki durağı gösterir; kalanlar "Planı aç ›". */
export function bugununPlaniSatirlari<T extends { numara: number | null; tamamlandi: boolean }>(kartlar: T[]): T[] {
  const numarali = kartlar.filter((k) => k.numara !== null);
  const ilkKalan = numarali.findIndex((k) => !k.tamamlandi);
  return numarali.filter((k, i) => k.tamamlandi || i === ilkKalan);
}

/** #522 inceleme 3: Şimdi bölümünün durağı. Sıradaki durak; duraktayken (`buradasin`) bir sonraki; durak kalmadıysa null. */
export function simdiHedefi<T extends { durum: string | null }>(odak: T | null, sonraki: T | null): T | null {
  if (odak?.durum === 'siradaki') return odak;
  if (odak?.durum === 'buradasin') return sonraki;
  return null;
}
