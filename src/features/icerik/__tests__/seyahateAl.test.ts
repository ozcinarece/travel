import { describe, expect, it, jest } from '@jest/globals';

import type { GeziDetay, GeziDuragi } from '@/lib/tipler';

import {
  grupHepsiSecili,
  gunSiniri,
  mekanGruplari,
  mekanSecimPlani,
  secilebilirler,
  varsayilanMekanSecimi,
  yeniSeyahatBilgisi,
  yeniSeyahatGovdesi,
  yeniSeyahatPlani,
  yeniSeyahatTarihleri,
} from '../seyahateAl';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const durak = (id: string, gun: string, sira: number, place_id: string | null, kategori = 'museum', sure_dk = 60): GeziDuragi => ({ id, gezi_gun_id: gun, sira, place_id, ad: id, kategori, sure_dk, lat: 39.7, lng: 30.5 });
// 3 gün · 6 durak; a2 = a (aynı yer iki günde), y = yemek.
const gezi = {
  gezi_gunleri: [
    { id: 'G1', gezi_id: 'z', sira: 1, baslik: 'Odunpazarı', gezi_duraklari: [durak('a', 'G1', 1, 'PA'), durak('y', 'G1', 2, 'PY', 'restaurant'), durak('b', 'G1', 3, null)] },
    { id: 'G2', gezi_id: 'z', sira: 2, baslik: 'Porsuk', gezi_duraklari: [durak('c', 'G2', 1, 'PC', 'park', 30), durak('a2', 'G2', 2, 'PA')] },
    { id: 'G3', gezi_id: 'z', sira: 3, baslik: null, gezi_duraklari: [durak('d', 'G3', 1, 'PD', 'tourist_attraction', 500)] },
  ],
} as unknown as Pick<GeziDetay, 'gezi_gunleri'>;
const kimlik = (d: GeziDuragi) => d.place_id ?? (d.id === 'b' ? 'PB' : null);

describe('#193 KK2–KK3 yeni seyahat planı', () => {
  it('gezinin günleri sırayla; tarihli seyahat başlangıçtan; gün sayısı 1–30', () => {
    const { gunler, plan, ozet } = yeniSeyahatPlani(gezi, 3, '2026-10-16');
    expect(gunler.map((g) => [g.index, g.date])).toEqual([
      [1, '2026-10-16'],
      [2, '2026-10-17'],
      [3, '2026-10-18'],
    ]);
    expect(plan.atamalar.map((a) => [a.gunId, a.duraklar.map((d) => d.id)])).toEqual([
      ['yeni:1', ['a', 'y', 'b']],
      ['yeni:2', ['c']],
      ['yeni:3', ['d']],
    ]);
    expect(ozet).toEqual({ gun: 3, durak: 5, listeye: 0 });
    expect(yeniSeyahatTarihleri('2026-10-16', 3)).toEqual({ start_date: '2026-10-16', end_date: '2026-10-18' });
    expect(yeniSeyahatTarihleri(null, 3)).toEqual({ start_date: null, end_date: null });
    expect([gunSiniri(0), gunSiniri(31), gunSiniri(4)]).toEqual([1, 30, 4]);
  });
  it('seyahat kısaysa fazla günün mekanları listeye; uzunsa son günler boş', () => {
    expect(yeniSeyahatPlani(gezi, 2, null).ozet).toEqual({ gun: 2, durak: 4, listeye: 1 });
    const uzun = yeniSeyahatPlani(gezi, 5, null);
    expect(uzun.gunler).toHaveLength(5);
    expect(uzun.gunler.every((g) => g.date === null)).toBe(true);
    expect(uzun.ozet).toEqual({ gun: 3, durak: 5, listeye: 0 });
  });
  it('RPC gövdesi: tekil mekanlar; gün içinde artan sıra anahtarı; çözülemeyen atlanır; süre 15–480', () => {
    const { gunler, plan } = yeniSeyahatPlani(gezi, 3, null);
    const k = new Map(plan.duraklar.map((d) => [d.id, d.id === 'b' ? null : kimlik(d)]));
    const g = yeniSeyahatGovdesi(plan, gunler, k);
    expect(g.mekanlar.map((m) => m.place_id)).toEqual(['PA', 'PY', 'PC', 'PD']);
    expect(g.mekanlar.find((m) => m.place_id === 'PD')?.dk).toBe(480);
    expect(g.duraklar.map((d) => [d.gun, d.place_id])).toEqual([
      [1, 'PA'],
      [1, 'PY'],
      [2, 'PC'],
      [3, 'PD'],
    ]);
    const birinci = g.duraklar.filter((d) => d.gun === 1).map((d) => d.order_key);
    expect([...birinci].sort()).toEqual(birinci);
    expect(new Set(birinci).size).toBe(birinci.length);
  });
  it('bilgi satırı: "{ad} adıyla yeni seyahat açılır, 3 günün 5 durağı aynı sırayla gelir."', () => {
    expect(yeniSeyahatBilgisi("Eskişehir'de üç gün", { gun: 3, durak: 5, listeye: 0 })).toBe("**Eskişehir'de üç gün** adıyla yeni seyahat açılır, 3 günün 5 durağı aynı sırayla gelir. Otel ve davet sonra.");
    expect(yeniSeyahatBilgisi('X', { gun: 2, durak: 4, listeye: 1 })).toBe("**X** adıyla yeni seyahat açılır, 2 günün 4 durağı aynı sırayla gelir. Kalan **1 mekan** Listem'e girer. Otel ve davet sonra.");
    expect(yeniSeyahatBilgisi('X', { gun: 3, durak: 5, listeye: 0 }, 4)).toBe("**X** adıyla yeni seyahat açılır; seçtiğin **4 mekan** güne atanmadan Listem'e girer.");
  });
});

describe('#193 KK8 yalnız mekanlar: kutucukla seçim', () => {
  it('günlere göre gruplu; aynı mekan yalnız ilk gününde; listede olan "Listende"; varsayılan yemek hariç hepsi', () => {
    const gruplar = mekanGruplari(gezi, kimlik, new Set(['PC']));
    expect(gruplar.map((g) => [g.gun.id, g.satirlar.map((s) => [s.durak.id, s.listede])])).toEqual([
      [
        'G1',
        [
          ['a', false],
          ['y', false],
          ['b', false],
        ],
      ],
      ['G2', [['c', true]]],
      ['G3', [['d', false]]],
    ]);
    // M: listede olmayanlar (4); varsayılan: yemek (y) hariç → 3.
    expect(secilebilirler(gruplar)).toHaveLength(4);
    const secili = varsayilanMekanSecimi(gruplar);
    expect([...secili].sort()).toEqual(['a', 'b', 'd']);
    expect(grupHepsiSecili(gruplar[0], secili)).toBe(false);
    expect(grupHepsiSecili(gruplar[0], new Set([...secili, 'y']))).toBe(true);
    // G2'de seçilebilen yok → "Hepsini seç" de yok (grupHepsiSecili false).
    expect(grupHepsiSecili(gruplar[1], secili)).toBe(false);
  });
  it('seçilenler → plan: güne atanmaz, hepsi listeye; listede olan seçili olsa da girmez', () => {
    const gruplar = mekanGruplari(gezi, kimlik, new Set(['PC']));
    const plan = mekanSecimPlani(gruplar, new Set(['a', 'c', 'd']));
    expect(plan.atamalar).toEqual([]);
    expect(plan.duraklar.map((d) => d.id)).toEqual(['a', 'd']);
    expect(plan.listeyeKalan.map((d) => d.id)).toEqual(['a', 'd']);
  });
});
