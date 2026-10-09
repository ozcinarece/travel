import { describe, expect, it } from '@jest/globals';

import type { HafifYer } from '@/features/yerler/api';
import { BOS_FILTRE, filtreUygula, type Filtre } from '@/features/yerler/filtre';
import { kategoriPini } from '@/lib/pinIkonu';

import { gizliEtiketler, zoomaGorePinler } from '../geo';
import { isaretciPlani } from '../isaretciler';
import type { HaritaPini } from '../tipler';

// #71 KK6 (simülasyon): Keşfet'in pin kurma mantığı (kesfet.tsx ile aynı kurallar) + harita planı — (a) filtre aç/kapa,
// (b) 10 pine art arda dokunma (seçim), (c) seçimi kaldırma. Her adımda işaretçi sayıları ve tekrar kontrolü; tablo PR'a yazılır.
const roma = { lat: 41.9028, lng: 12.4964 };
const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 15 };
const ekran = { genislik: 400, yukseklik: 800 };
const yer = (i: number, n: number, tip: string): HafifYer => ({ place_id: `p${i}`, ad: `Mekan ${i}`, lat: roma.lat + (i % 4) * 0.003, lng: roma.lng + Math.floor(i / 4) * 0.003, primary_type: tip, tz: null, puan: 4.5, puan_sayisi: n, acik: null, ulke_kodu: null });
const oneriler = Array.from({ length: 10 }, (_, i) => yer(i, i % 2 ? 9000 : 300, i % 3 ? 'museum' : 'restaurant'));
const havuz = new Set(['p1', 'p2']);

function pinler(secim: string | null, filtre: Filtre): HaritaPini[] {
  const gecenler = filtreUygula(oneriler, filtre, new Set());
  const listede = oneriler.filter((y) => havuz.has(y.place_id)).map((y): HaritaPini => ({ id: `m:${y.place_id}`, konum: { lat: y.lat, lng: y.lng }, renk: '#000', ...kategoriPini(y.primary_type), ad: y.ad, puan: y.puan, yorumSayisi: y.puan_sayisi, tur: 'listede', secili: secim === y.place_id }));
  const gorulen = new Set(havuz);
  const oneri: HaritaPini[] = [];
  for (const y of [...gecenler, ...oneriler.filter((y) => y.place_id === secim)]) {
    if (gorulen.has(y.place_id)) continue;
    gorulen.add(y.place_id);
    oneri.push({ id: `o:${y.place_id}`, konum: { lat: y.lat, lng: y.lng }, renk: '#000', ad: y.ad, ...kategoriPini(y.primary_type), puan: y.puan, yorumSayisi: y.puan_sayisi, tur: 'oneri', secili: secim === y.place_id });
  }
  return [...listede, ...oneri];
}

describe('Keşfet senaryosu (#71 KK6 simülasyonu)', () => {
  it('filtre aç/kapa + 10 dokunma: her adımda pin başına ≤ 1 pin + 1 ad, anahtar tekrarı yok, seçili pin hep çizilir', () => {
    const satirlar: string[] = [];
    let onceki: Set<string> | null = null;
    const adim = (ad: string, secim: string | null, filtre: Filtre) => {
      const tum = zoomaGorePinler(pinler(secim, filtre), bolge.zoom);
      const gizli = gizliEtiketler(tum, bolge, ekran);
      const plan = isaretciPlani(tum, gizli, bolge.zoom, true);
      const anahtarlar = plan.map((i) => i.anahtar);
      expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
      const pinSayisi = new Map<string, number>();
      for (const i of plan) if (i.tur !== 'ad') pinSayisi.set(i.pin.id, (pinSayisi.get(i.pin.id) ?? 0) + 1);
      expect([...pinSayisi.values()].every((n) => n === 1)).toBe(true);
      if (secim) expect(plan.some((i) => i.tur === 'png' && i.pin.secili && i.pin.id.endsWith(secim))).toBe(true);
      const simdiki = new Set(anahtarlar);
      const kalkan = onceki ? [...onceki].filter((k) => !simdiki.has(k)).length : 0;
      const eklenen = onceki ? [...simdiki].filter((k) => !onceki!.has(k)).length : simdiki.size;
      onceki = simdiki;
      satirlar.push(`| ${ad} | ${tum.length} | ${plan.filter((i) => i.tur === 'png').length} | ${plan.filter((i) => i.tur === 'ad').length} | +${eklenen} / −${kalkan} |`);
    };
    adim('açılış', null, BOS_FILTRE);
    adim('5K+ aç', null, { ...BOS_FILTRE, yorum: 5000 });
    adim('5K+ kapa', null, BOS_FILTRE);
    for (let i = 0; i < 10; i++) adim(`dokun p${i}`, `p${i}`, BOS_FILTRE);
    adim('seçimi kaldır', null, BOS_FILTRE);
    adim('5K+ aç (p0 seçili)', 'p0', { ...BOS_FILTRE, yorum: 5000 });
    adim('seçimi kaldır (5K+)', null, { ...BOS_FILTRE, yorum: 5000 });
    console.log(['| adım | pin | png işaretçi | ad işaretçi | anahtar +/− |', '|---|---|---|---|---|', ...satirlar].join('\n'));
  });
});
