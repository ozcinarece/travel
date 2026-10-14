// places-nearby — Nearby Search (New), POPULARITY. 3.4 KK4 öneri çipleri (en fazla 20) ve
// #17 otel adayları (`cip: 'otel'`, en fazla 12). #164: öneri istekleri konaklamayı dışlar (excludedPrimaryTypes). #178: Turistik
// çipinde turistik değeri olmayan ibadet yerleri süzülür. Cevap yalnız bellekte; veritabanına yazılmaz (PRD §7).
// #189: kalite süzgeci — birincil tip çipin kümesinde olmalı, yorum / puan alt sınırı (Ayarlar: kesfet_esikleri), elle gizlenen
// yerler (kesfet_gizli) çıkar. Ek Google isteği yok; süzgeç önbellekten SONRA uygulanır, ayar değişikliği hemen geçerli olur.
// Önbellek: (çip, 0,0001° hücre, yarıçap, adet) anahtarıyla izolat belleğinde 24 sa (teknik not §3). #66: karo
// merkezleri 125 m'ye kadar inebildiğinden hücre 4 ondalık, yarıçap en az 100 m.
import { CIP_TIPLERI, GoogleHatasi, hafifYer, kesfetSuzgeci, KONAKLAMA_TIPLERI, yakinAra, type YakinYer } from '../_shared/google.ts';
import { govde, hata, json, onKontrol } from '../_shared/http.ts';
import { kesfetAyari } from '../_shared/kesfetAyari.ts';
import { sayacli } from '../_shared/sayac.ts';

type Istek = { merkez: { lat: number; lng: number }; yaricapM?: number; cip: string; enFazla?: number };

const TTL_MS = 24 * 60 * 60 * 1000;
/** Önbellek izolat belleğinde (kullanıcılar arasında yalnız aynı izolat paylaşır); en çok bu kadar anahtar, en eski silinir (#68 incelemesi). */
const ONBELLEK_EN_FAZLA = 5000;
const onbellek = new Map<string, { zaman: number; deger: YakinYer[] }>();
function onbellekYaz(anahtar: string, deger: YakinYer[]) {
  const simdi = Date.now();
  if (onbellek.size >= ONBELLEK_EN_FAZLA) {
    for (const [k, v] of onbellek) if (simdi - v.zaman >= TTL_MS) onbellek.delete(k);
    while (onbellek.size >= ONBELLEK_EN_FAZLA) onbellek.delete(onbellek.keys().next().value!);
  }
  onbellek.set(anahtar, { zaman: simdi, deger });
}

Deno.serve(sayacli('places-nearby', async (istek) => {
  const on = onKontrol(istek);
  if (on) return on;

  const g = await govde<Istek>(istek);
  const lat = Number(g.merkez?.lat);
  const lng = Number(g.merkez?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return hata('merkez geçersiz');
  const tipler = typeof g.cip === 'string' ? CIP_TIPLERI[g.cip] : undefined;
  if (!tipler) return hata('cip geçersiz');
  const yaricapM = Math.min(Math.max(Number(g.yaricapM) || 3000, 100), 15_000);
  const enFazla = Math.min(Math.max(Math.trunc(Number(g.enFazla) || 20), 1), 20);

  const cip = g.cip;
  const cevapla = async (ham: YakinYer[], onbellekten: boolean) => {
    const ayar = await kesfetAyari();
    return json({ yerler: kesfetSuzgeci(ham, cip, ayar.esikler, ayar.gizli).map(hafifYer), onbellek: onbellekten });
  };

  const anahtar = `${cip}:${lat.toFixed(4)},${lng.toFixed(4)}:${yaricapM}:${enFazla}`;
  const eski = onbellek.get(anahtar);
  if (eski && Date.now() - eski.zaman < TTL_MS) return cevapla(eski.deger, true);
  if (eski) onbellek.delete(anahtar);

  try {
    // #164 KK2: otel adayları dışındaki tüm istekler (Turistik, Tümü, kategoriler) konaklamayı dışlar.
    const haric = cip === 'otel' ? undefined : KONAKLAMA_TIPLERI;
    // #178 KK2: Turistik'te mahalle camisi yok — ibadet yeri yalnız turistik tip ya da ≥ 1.000 yorumla.
    const yerler = await yakinAra({ merkez: { lat, lng }, yaricapM, tipler, enFazla, haric, ibadetSuzgeci: cip === 'turistik' });
    onbellekYaz(anahtar, yerler);
    return await cevapla(yerler, false);
  } catch (e) {
    if (e instanceof GoogleHatasi) {
      console.error('places-nearby google', e.durum, e.message);
      return hata('öneriler şu an alınamıyor', 502);
    }
    console.error('places-nearby', e);
    return hata('sunucu hatası', 500);
  }
}));
