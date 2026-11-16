// #248 inceleme 2 (UX Ş3): oylama seçeneğinin adı. Mekan seçeneğinin metni boş kaydedilir (Google adı saklanmaz), ad ekranda
// canlı gelir: önce bizim içeriğimiz / oturum önbelleği, yoksa places-light. Sohbet ve Gezi aynı sorguyu kullanır (aynı anahtar,
// tek istek). Ad yüklenirken "…"; hiç gelemezse kategori, aynı oylamada aynı kategori birden çok kez geçiyorsa "Restoran 1 / 2".
import { useMemo } from 'react';

import { useBilinenMekanlar } from '@/features/gezi/bilinenMekanlar';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi } from '@/lib/kategori';

import type { Oylama, OylamaSecenegi } from './sohbet';

export const YUKLENIYOR = '…';

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
    else if (b.yukleniyor(sc.place_id)) sonuc.set(sc.id, YUKLENIYOR);
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

/**
 * Oylamalardaki mekan seçeneklerinin adları. `tipKaynagi`: listedeki mekanın türü (ad gelmezse kategori için).
 * Google'a etki: metni boş her mekan seçeneği için en çok 1 places-light (Pro maske) isteği; oturum önbelleğinde ya da bizim
 * içeriğimizde olan için istek yok (hafifOnbellek yalnız eksik kimlikleri ister).
 */
export function useOylamaAdlari(oylamalar: Oylama[], tipKaynagi: (placeId: string) => string | null | undefined = () => null) {
  const ids = useMemo(() => adiCanliYerler(oylamalar), [oylamalar]);
  const bilinen = useBilinenMekanlar(ids);
  // Bizim içeriğimizde adı olan için Google'a gidilmez; içerik sorgusu bitmeden istenmez (iki ekranda aynı anahtar).
  const istenecek = bilinen.yukleniyor ? [] : ids.filter((p) => !bilinen.icerikAdi(p));
  const hafif = useHafifYerler(istenecek, { puan: false });
  const bilgi: AdBilgisi = {
    ad: (p) => bilinen.ad({ place_id: p }) ?? hafif.data?.[p]?.ad ?? null,
    tip: (p) => tipKaynagi(p) ?? hafif.data?.[p]?.primary_type ?? null,
    // Çevrimdışıyken sorgu "paused" kalır, hata sonrası "idle": ikisinde de yedek ada düşülür.
    yukleniyor: (p) => bilinen.yukleniyor || (hafif.fetchStatus === 'fetching' && !hafif.data?.[p]),
  };
  return {
    /** Oylamanın seçenek adları (sıra numarası için bütün seçenekler birlikte değerlendirilir). */
    adlar: (o: Oylama) => secenekAdlari(o.oylama_secenekleri, bilgi),
  };
}
