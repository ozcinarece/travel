// #143 KK2 (kanvas 17): önerilen gezinin "Rota & plan" hesapları — duraklar arası yürüyüş ve gün özeti ("5 sa 40 dk · 3,4 km
// yürüyüş"). #192: gerçek yol varsa (gezi_rota_onbellek) süre ve mesafe ondan; yoksa kestirim (kuş uçuşu × 1,3 ÷ 4,5 km/sa) ve özet
// "~" ile.
import { mesafeM } from '@/components/harita/geo';
import type { HaritaCizgisi, HaritaPini } from '@/components/harita/tipler';
import { rotaNoktalari } from '@/features/program/haritaVerisi';
import type { GeziDetay, GeziDuragi } from '@/lib/tipler';
import { kestirimYuruyusSn } from '@/schedule/tempo';
import { gunRengi, rotaRengi, yeniGunRengi } from '@/theme';

import { bacakAnahtari, type GeziRotaBacagi, type GeziRotalari } from './geziRota';

export type GeziGunOzeti = {
  /** Durak süreleri + bacaklar (dakika, yuvarlamasız toplam). */
  toplamDk: number;
  /** Toplam yürüyüş mesafesi (m; gerçek yol ya da dolambaç payıyla kestirim). */
  yuruyusM: number;
  /** i. durağa gelen bacak, dakika (ilk durak için yok). #205 Parça 1: null = bir ucu konumsuz, yol süresi bilinmiyor (kanvas
   * 24b-A); toplama ve mesafeye katılmaz. */
  bacakDk: (number | null)[];
  /** i. durağa gelen bacağın modu (yürüyüşü 40 dk'yı aşan bacak araçla — mevcut bacak modu kuralı). */
  bacakMod: ('WALK' | 'DRIVE')[];
  /** En az bir bacak kestirim (gerçek yolu henüz yok) → özet "~" ile. */
  kestirim: boolean;
};

type OzetDuragi = Pick<GeziDuragi, 'lat' | 'lng' | 'sure_dk'> & { id?: string };

const sayi = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
/** #199 KK2: konumu geçerli durak (haritaya pin / çizgi olarak girer). */
/** #205 Parça 1: gece temizliği 30 günü geçen Google konumunu boşaltır (lat/lng null); böyle durak da burada elenir. */
export const konumGecerli = <T extends { lat: number | null; lng: number | null }>(d: T): d is T & { lat: number; lng: number } =>
  sayi(d.lat) && sayi(d.lng) && Math.abs(d.lat) <= 90 && Math.abs(d.lng) <= 180;
/** #199 KK2: bacak satırı kullanılabilir mi (süre / mesafe sayı); değilse o bacak kestirimde / kuş uçuşunda kalır. */
const bacakGecerli = (r: GeziRotaBacagi) => sayi(r.saniye) && r.saniye > 0 && sayi(r.metre);
const aracGecerli = (r: GeziRotaBacagi) => r.mod === 'DRIVE' && sayi(r.arac_saniye) && r.arac_saniye > 0;

export function geziGunOzeti(duraklar: OzetDuragi[], rotalar?: GeziRotalari): GeziGunOzeti {
  const bacakDk: (number | null)[] = [];
  const bacakMod: ('WALK' | 'DRIVE')[] = [];
  let yuruyusM = 0;
  let kestirim = false;
  for (let i = 1; i < duraklar.length; i++) {
    const a = duraklar[i - 1];
    const b = duraklar[i];
    // #205 Parça 1: konumu bozuk ya da boşalmış uçta süre bilinmez (önbellekte eski yol kalmış olsa da kullanılmaz): bacak
    // "Yol süresi bilinmiyor", toplama ve mesafeye eklenmez; özet "~" ile (eksik).
    if (!konumGecerli(a) || !konumGecerli(b)) {
      kestirim = true;
      bacakDk.push(null);
      bacakMod.push('WALK');
      continue;
    }
    const r = a.id && b.id ? rotalar?.get(bacakAnahtari(a.id, b.id)) : undefined;
    if (r && bacakGecerli(r)) {
      const araba = aracGecerli(r);
      bacakDk.push(Math.max(1, Math.round((araba ? r.arac_saniye! : r.saniye) / 60)));
      bacakMod.push(araba ? 'DRIVE' : 'WALK');
      if (!araba) yuruyusM += r.metre;
      continue;
    }
    kestirim = true;
    bacakMod.push('WALK');
    const ka = { lat: a.lat, lng: a.lng };
    const kb = { lat: b.lat, lng: b.lng };
    bacakDk.push(Math.max(1, Math.round(kestirimYuruyusSn(ka, kb) / 60)));
    yuruyusM += mesafeM(ka, kb) * 1.3;
  }
  const toplamDk = duraklar.reduce((n, d) => n + (sayi(d.sure_dk) ? d.sure_dk : 0), 0) + bacakDk.reduce<number>((n, d) => n + (d ?? 0), 0);
  return { toplamDk, yuruyusM, bacakDk, bacakMod, kestirim };
}

/**
 * #192 KK3: mini haritanın çizgileri. Gerçek yürüyüş yolu rota tonunda düz çizgi (Program'la aynı dil); araç bacağı kuş uçuşu
 * kesik (#136); yolu henüz gelmemiş ya da hesaplanamamış bacak bugünkü gibi gün renginde ince kesik kuş uçuşu. Kimlik bacak
 * bazlı ve rota gelsin gelmesin aynı (#77: çizgi yeniden kurulmaz, güncellenir).
 *
 * #408: `renk` verilirse (hazır gezi sayfası, #310 yeni gün renkleri) üç çizgi türü de o renkte; pin ve rota aynı ton.
 */
export function geziGunCizgileri(duraklar: Pick<GeziDuragi, 'id' | 'lat' | 'lng'>[], gunIndex: number, rotalar?: GeziRotalari, renk?: string): HaritaCizgisi[] {
  const rota = renk ?? rotaRengi(gunIndex);
  const kusUcusu = renk ?? gunRengi(gunIndex);
  // #199 KK2: konumu bozuk durağın bacakları çizilmez (harita NaN koordinatla düşmesin); yolu bozuk bacak kuş uçuşuna düşer.
  return duraklar.slice(1).flatMap((d, i): HaritaCizgisi[] => {
    const onceki = duraklar[i];
    if (!konumGecerli(onceki) || !konumGecerli(d)) return [];
    const a = { lat: onceki.lat, lng: onceki.lng };
    const z = { lat: d.lat, lng: d.lng };
    const id = `gc:${onceki.id}>${d.id}`;
    const r = rotalar?.get(bacakAnahtari(onceki.id, d.id));
    if (r && bacakGecerli(r) && aracGecerli(r)) return [{ id, noktalar: [a, z], renk: rota, opaklik: 0.9, kesik: true, arac: true }];
    if (r && bacakGecerli(r)) return [{ id, noktalar: rotaNoktalari(typeof r.polyline === 'string' ? r.polyline : '', a, z), renk: rota, opaklik: 0.9 }];
    return [{ id, noktalar: [a, z], renk: kusUcusu, opaklik: 0.9, kesik: true, ince: true }];
  });
}

// ---------------------------------------------------------------- #408 KK1: hazır gezi sayfasının üst haritası

/** Diğer günlerin noktası (docs/05 §2: %45 opak). */
const SOLUK = 0.45;

/** #408 KK1 (`Sayfa_v6_HazirGezi_Harita`) haritanın pinleri: seçili gün numaralı, diğer günler numarasız soluk nokta. Konumu bozuk durak girmez (#199 KK2). */
export function hazirGeziPinleri(gezi: Pick<GeziDetay, 'gezi_gunleri'>, gunSira: number): HaritaPini[] {
  return gezi.gezi_gunleri.flatMap((g, gi) => {
    const secili = gi === gunSira;
    const rengi = yeniGunRengi(g.sira);
    return g.gezi_duraklari.flatMap((d, i): HaritaPini[] =>
      konumGecerli(d) ? [{ id: `gd:${d.id}`, tur: 'durak', konum: { lat: d.lat, lng: d.lng }, renk: rengi, ...(secili ? { etiket: String(i + 1), ad: d.ad } : { opaklik: SOLUK }) }] : [],
    );
  });
}
