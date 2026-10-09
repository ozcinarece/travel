import { describe, expect, it } from '@jest/globals';

import { gizliEtiketler } from '../geo';
import { dokunusuIletir, isaretciPlani } from '../isaretciler';
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
});
