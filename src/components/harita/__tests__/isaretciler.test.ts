import { describe, expect, it } from '@jest/globals';

import { gizliEtiketler } from '../geo';
import { dokunusuIletir, isaretciPlani, planFarki } from '../isaretciler';
import type { HaritaPini } from '../tipler';

const roma = { lat: 41.9028, lng: 12.4964 };
const bolge = { merkez: roma, yaricapM: 1000, latDelta: 0.02, lngDelta: 0.01, zoom: 15 };
const ekran = { genislik: 400, yukseklik: 800 };
const p = (id: string, dLng: number, o: Partial<HaritaPini>): HaritaPini => ({ id, konum: { lat: roma.lat, lng: roma.lng + dLng }, renk: '#000', ad: `Yer ${id}`, ikon: 'muze', kategoriRenk: '#8a4fd6', ...o });

// #71 KK1: aynı place_id haritada her durumda en fazla bir pin + bir ad; durum değişince anahtar değişir (eski işaretçi kalkar).
describe('isaretciPlani (#71)', () => {
  const plan = (pinler: HaritaPini[]) => isaretciPlani(pinler, gizliEtiketler(pinler, bolge, ekran), bolge.zoom, true);
  const kimlikler = (pinler: HaritaPini[]) => plan(pinler).map((i) => i.anahtar);

  it('seçim / filtre / öne çıkan değişiminden sonra işaretçi anahtarlarında tekrar yok, pin başına ≤ 1 pin + 1 ad', () => {
    const durumlar: HaritaPini[][] = [
      [p('o:a', 0, { tur: 'oneri' }), p('m:b', 0.003, { tur: 'listede' })],
      [p('o:a', 0, { tur: 'oneri', secili: true }), p('m:b', 0.003, { tur: 'listede' })],
      [p('o:a', 0, { tur: 'oneri', oneCikan: true }), p('m:b', 0.003, { tur: 'listede', secili: true })],
      [p('m:b', 0.003, { tur: 'listede' })], // filtre o:a'yı gizledi
      [p('o:a', 0, { tur: 'oneri', kucuk: true, ad: undefined }), p('m:b', 0.003, { tur: 'listede' })],
    ];
    for (const d of durumlar) {
      const k = kimlikler(d);
      expect(new Set(k).size).toBe(k.length);
      for (const pin of d) {
        const pinin = plan(d).filter((i) => i.pin.id === pin.id);
        expect(pinin.filter((i) => i.tur !== 'ad').length).toBe(1);
        expect(pinin.filter((i) => i.tur === 'ad').length).toBeLessThanOrEqual(1);
      }
    }
    // Filtre gizleyince o pinin adı da gider.
    expect(kimlikler(durumlar[3]).some((k) => k.startsWith('o:a'))).toBe(false);
  });

  it('görünüm durumu anahtara girer: seçili / öne çıkan / küçük farklı anahtar, aynı durum aynı anahtar', () => {
    const a = p('o:a', 0, { tur: 'oneri' });
    const k0 = kimlikler([a])[0];
    expect(kimlikler([{ ...a }])[0]).toBe(k0);
    expect(kimlikler([{ ...a, secili: true }])[0]).not.toBe(k0);
    expect(kimlikler([{ ...a, oneCikan: true }])[0]).not.toBe(k0);
    expect(kimlikler([{ ...a, kucuk: true, ad: undefined }])[0]).not.toBe(k0);
    // Seçili pinin adı da ayrı anahtar (çapa değişir).
    expect(kimlikler([a])[1]).not.toBe(kimlikler([{ ...a, secili: true }])[1]);
  });

  it('aynı kimlik iki kez gelirse ikincisi çizilmez; görseller hazır değilken PNG işaretçisi yok, görünüm işaretçisi var', () => {
    const d = [p('o:a', 0, { tur: 'oneri' }), p('o:a', 0.001, { tur: 'oneri' }), p('d:1', 0.004, { tur: 'durak', etiket: '1' })];
    expect(plan(d).filter((i) => i.pin.id === 'o:a' && i.tur === 'png')).toHaveLength(1);
    const hazirDegil = isaretciPlani(d, gizliEtiketler(d, bolge, ekran), bolge.zoom, false);
    expect(hazirDegil.map((i) => i.tur)).toEqual(['gorunum']);
  });

  it('#71 KK2: öneri / küçük / listede / öne çıkan / seçili / durak / otel dokunuşu iletir (ad işaretçisi dahil); rota hapı ve konum iletmez', () => {
    const turler: Partial<HaritaPini>[] = [{ tur: 'oneri' }, { tur: 'oneri', kucuk: true }, { tur: 'listede' }, { tur: 'oneri', oneCikan: true }, { tur: 'listede', secili: true }, { tur: 'durak', etiket: '1' }, { tur: 'otel' }, { tur: 'bos' }];
    for (const o of turler) expect(dokunusuIletir(p('x', 0, o))).toBe(true);
    expect(dokunusuIletir(p('e', 0, { tur: 'etiket', etiket: '12 dk' }))).toBe(false);
    expect(dokunusuIletir(p('k', 0, { tur: 'konum' }))).toBe(false);
    // Planın her pin ve ad işaretçisi aynı pine bağlı: dokunuş hangisine gelirse gelsin aynı kimlik.
    const d = [p('o:a', 0, { tur: 'oneri' })];
    const plan = isaretciPlani(d, gizliEtiketler(d, bolge, ekran), bolge.zoom, true);
    expect(plan.map((i) => i.pin.id)).toEqual(['o:a', 'o:a']);
    expect(plan.every((i) => dokunusuIletir(i.pin))).toBe(true);
  });

  it('#75: seçim listeden ayrı — 300 pinde seçim değişince anahtarı değişen işaretçi ≤ 4, gizli hesabı seçimsiz, seçilinin adı hep görünür', () => {
    // 300 öneri, 10 px aralıkla (adlar çakışır → çoğu gizli).
    const d = Array.from({ length: 300 }, (_, i) => p(`o:${i}`, (i % 20) * 0.00025, { tur: 'oneri', konum: { lat: roma.lat + Math.floor(i / 20) * 0.0005, lng: roma.lng + (i % 20) * 0.00025 } }));
    const gizli = gizliEtiketler(d, bolge, ekran);
    const p0 = isaretciPlani(d, gizli, bolge.zoom, true, null);
    const p1 = isaretciPlani(d, gizli, bolge.zoom, true, 'o:7');
    const p2 = isaretciPlani(d, gizli, bolge.zoom, true, 'o:150');
    const p3 = isaretciPlani(d, gizli, bolge.zoom, true, null);
    // Seçim: yeni seçili pin + adı (≤ 2 eklenen, ≤ 2 kaldırılan).
    expect(planFarki(p0, p1)).toBeLessThanOrEqual(4);
    expect(planFarki(p1, p2)).toBeLessThanOrEqual(4);
    expect(planFarki(p2, p3)).toBeLessThanOrEqual(4);
    // Seçilinin adı çakışsa da görünür (gizli.etiket'te olsa bile), iğne PNG'si ve 's' anahtarı.
    expect(gizli.etiket.has('o:150')).toBe(true);
    expect(p2.some((i) => i.tur === 'ad' && i.pin.id === 'o:150' && i.pin.secili)).toBe(true);
    expect(p2.find((i) => i.tur === 'png' && i.pin.id === 'o:150')?.anahtar).toMatch(/\|igne-daire-muze\|s$/);
    // Diğer pinlerin anahtarları seçimden etkilenmez.
    const digerleri = (plan: typeof p0) => plan.filter((i) => i.pin.id !== 'o:7' && i.pin.id !== 'o:150').map((i) => i.anahtar);
    expect(digerleri(p1)).toEqual(digerleri(p0));
    expect(digerleri(p2)).toEqual(digerleri(p0));
  });

  it('#77: Program durakları — gün değişince / seçilince görünümlü işaretçinin anahtarı değişir (eski bitmap kalmaz), sayı sabit, tekrar yok', () => {
    const durak = (id: string, dLng: number, o: Partial<HaritaPini>): HaritaPini => ({ id, konum: { lat: roma.lat, lng: roma.lng + dLng }, renk: '#2f6fed', tur: 'durak', ad: `Yer ${id}`, puan: 4.5, ...o });
    // Cmt seçili: numaralı 28 px; sonra Paz seçili: Cmt durakları numarasız 20 px %45.
    const cmtSecili = [durak('m:a', 0, { etiket: '1' }), durak('m:b', 0.004, { etiket: '2' }), durak('m:c', 0.008, { etiket: '', opaklik: 0.45 })];
    const pazSecili = [durak('m:a', 0, { etiket: '', opaklik: 0.45 }), durak('m:b', 0.004, { etiket: '', opaklik: 0.45 }), durak('m:c', 0.008, { etiket: '1' })];
    const planla = (d: HaritaPini[], seciliId: string | null = null) => isaretciPlani(d, gizliEtiketler(d, bolge, ekran), bolge.zoom, true, seciliId);
    const p1 = planla(cmtSecili);
    const p2 = planla(pazSecili);
    expect(p1.every((i) => i.tur === 'gorunum')).toBe(true);
    expect(p1).toHaveLength(3);
    expect(p2).toHaveLength(3);
    // Her durağın anahtarı değişti → numaralı işaretçi kaldırılır, numarasız nokta kurulur.
    for (const id of ['m:a', 'm:b', 'm:c']) expect(p1.find((i) => i.pin.id === id)?.anahtar).not.toBe(p2.find((i) => i.pin.id === id)?.anahtar);
    expect(new Set(p2.map((i) => i.anahtar)).size).toBe(3);
    // Seçim: m:a iğne olur — anahtarı değişir, diğerleri aynı kalır, işaretçi sayısı değişmez (KK5).
    const p3 = planla(cmtSecili, 'm:a');
    expect(p3).toHaveLength(3);
    expect(p3.find((i) => i.pin.id === 'm:a')?.anahtar).not.toBe(p1.find((i) => i.pin.id === 'm:a')?.anahtar);
    expect(p3.find((i) => i.pin.id === 'm:a')?.pin.secili).toBe(true);
    expect(p3.filter((i) => i.pin.id !== 'm:a').map((i) => i.anahtar)).toEqual(p1.filter((i) => i.pin.id !== 'm:a').map((i) => i.anahtar));
    expect(planFarki(p1, p3)).toBe(1);
    // Program'da her durağın tek adı: görünüm işaretçisi adı kendi içinde taşır, ayrı ad işaretçisi yok (KK2).
    expect(p1.filter((i) => i.tur === 'ad')).toHaveLength(0);
  });
});
