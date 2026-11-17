// #248 inceleme 2 (UX Ş3): oylama seçeneğinin adı. Mekan seçeneğinin metni boş kaydedilir (Google adı saklanmaz), ad ekranda
// canlı gelir: önce bizim içeriğimiz / oturum önbelleği, yoksa places-light (ortak `hafifOnbellek`: aynı kimlik oturumda bir
// kez istenir). Ad yüklenirken "…" (oylanamaz); hiç gelemezse kategori, aynı oylamada aynı kategori birden çok kez geçiyorsa
// "Restoran 1 / 2".
import { useMemo } from 'react';

import { useBilinenMekanlar } from '@/features/gezi/bilinenMekanlar';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi } from '@/lib/kategori';

import type { Oylama, OylamaSecenegi } from './sohbet';

/** Ad yüklenirken görünen yer tutucu (`tr.json`). */
export const yukleniyorMetni = () => t('sohbet.oylama.adYukleniyor');

/** Adı canlı gösterilecek seçeneklerin `place_id`'leri (metni boş mekan seçenekleri), sıralı ve tekil. */
export function adiCanliYerler(oylamalar: Oylama[]): string[] {
  const ids = new Set<string>();
  for (const o of oylamalar) for (const sc of o.oylama_secenekleri) if (sc.place_id && !sc.metin.trim()) ids.add(sc.place_id);
  return [...ids].sort();
}

export type AdBilgisi = {
  ad: (placeId: string) => string | null;
  tip: (placeId: string) => string | null;
  yukleniyor: (placeId: string) => boolean;
};

/** Bir oylamanın bütün seçenek adları (seçenek kimliği → görünen ad). */
export function secenekAdlari(secenekler: OylamaSecenegi[], b: AdBilgisi): Map<string, string> {
  const sonuc = new Map<string, string>();
  const yedekler: { id: string; etiket: string }[] = [];
  for (const sc of [...secenekler].sort((a, c) => a.sira - c.sira)) {
    const metin = sc.metin.trim();
    if (metin || !sc.place_id) {
      sonuc.set(sc.id, metin);
      continue;
    }
    const ad = b.ad(sc.place_id);
    if (ad) sonuc.set(sc.id, ad);
    else if (b.yukleniyor(sc.place_id)) sonuc.set(sc.id, yukleniyorMetni());
    else yedekler.push({ id: sc.id, etiket: kategoriEtiketi(b.tip(sc.place_id)) });
  }
  const sayi = new Map<string, number>();
  for (const y of yedekler) sayi.set(y.etiket, (sayi.get(y.etiket) ?? 0) + 1);
  const sira = new Map<string, number>();
  for (const y of yedekler) {
    if ((sayi.get(y.etiket) ?? 0) < 2) {
      sonuc.set(y.id, y.etiket);
      continue;
    }
    const n = (sira.get(y.etiket) ?? 0) + 1;
    sira.set(y.etiket, n);
    sonuc.set(y.id, t('sohbet.oylama.secenekSirali', { ad: y.etiket, n }));
  }
  return sonuc;
}

/** Adı henüz yüklenen seçeneklerin kimlikleri (bu seçenekler oylanamaz). */
export function yuklenenSecenekler(secenekler: OylamaSecenegi[], b: AdBilgisi): Set<string> {
  const sonuc = new Set<string>();
  for (const sc of secenekler) {
    if (sc.metin.trim() || !sc.place_id) continue;
    if (!b.ad(sc.place_id) && b.yukleniyor(sc.place_id)) sonuc.add(sc.id);
  }
  return sonuc;
}

/**
 * Oylamalardaki mekan seçeneklerinin adları. `tipKaynagi`: listedeki mekanın türü (ad gelmezse kategori için).
 * Google'a etki: metni boş her mekan seçeneği için en çok 1 places-light (Pro maske) isteği; oturum önbelleğinde ya da bizim
 * içeriğimizde olan için istek yok (hafifOnbellek yalnız eksik kimlikleri ister).
 * `fotoIle`: ekranın aynı kimliği fotoğrafla da istediği kimlikler (Sohbet'te listede olmayan mekan kartları). Bunlar burada da
 * fotoğraf grubuyla istenir; böylece önbellek hangi sırayla gelirse gelsin o kimlik için tek istek (Pro + foto) gider, fotoğrafsız
 * Pro'dan sonra ikinci bir fotoğraflı istek gitmez (#248 inceleme 3, madde 2). `null`: küme henüz belli değil (liste
 * yükleniyor); o sırada istek gitmez, adlar "…" görünür.
 * `cevrimdisi` (#293 KK4, Bugün kartındaki kural): bağlantı yokken oturumdaki Google adı gösterilmez ve istek gitmez; ad yalnız
 * bizim içeriğimizden, yoksa yedek ad (kategori ya da sıra) kullanılır.
 */
export function useOylamaAdlari(
  oylamalar: Oylama[],
  tipKaynagi: (placeId: string) => string | null | undefined = () => null,
  fotoIle: ReadonlySet<string> | null = BOS,
  cevrimdisi = false,
) {
  const ids = useMemo(() => adiCanliYerler(oylamalar), [oylamalar]);
  const bilinen = useBilinenMekanlar(ids, cevrimdisi);
  // Bizim içeriğimizde adı olan için Google'a gidilmez; içerik sorgusu bitmeden istenmez. Çevrimdışıyken hiç istenmez.
  const bekle = !cevrimdisi && (bilinen.yukleniyor || fotoIle === null);
  const istenecek = bekle || cevrimdisi ? [] : ids.filter((p) => !bilinen.icerikAdi(p));
  const hafif = useHafifYerler(
    istenecek.filter((p) => !fotoIle?.has(p)),
    { puan: false },
  );
  const hafifFoto = useHafifYerler(
    istenecek.filter((p) => !!fotoIle?.has(p)),
    { puan: false, foto: true },
  );
  const veri = (p: string) => (fotoIle?.has(p) ? hafifFoto : hafif);
  const bilgi: AdBilgisi = {
    ad: (p) => bilinen.ad({ place_id: p }) ?? (cevrimdisi ? null : (veri(p).data?.[p]?.ad ?? null)),
    tip: (p) => tipKaynagi(p) ?? veri(p).data?.[p]?.primary_type ?? null,
    // Çevrimdışıyken sorgu "paused" kalır, hata sonrası "idle": ikisinde de yedek ada düşülür.
    yukleniyor: (p) => !cevrimdisi && (bekle || (veri(p).fetchStatus === 'fetching' && !veri(p).data?.[p])),
  };
  return {
    /** Oylamanın seçenek adları (sıra numarası için bütün seçenekler birlikte değerlendirilir). */
    adlar: (o: Oylama) => secenekAdlari(o.oylama_secenekleri, bilgi),
    /** Adı yüklenen (henüz oylanamayan) seçenekler. */
    yuklenenler: (o: Oylama) => yuklenenSecenekler(o.oylama_secenekleri, bilgi),
  };
}

const BOS: ReadonlySet<string> = new Set();
