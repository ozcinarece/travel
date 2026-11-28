import { describe, expect, it, jest } from '@jest/globals';

// #205 Parça 1: gezi-rota (Deno) konumu boşalmış durağı rotaya almaz. Modül saf; tipi burada yazılıp çalışma anında yüklenir.
type Durak = { id: string; sira: number; lat: number | null; lng: number | null };
type Modul = { geziRotaCiftleri: (d: Durak[]) => { konumlu: Durak[]; ciftler: { a: Durak; b: Durak; bacak: number }[] } };
const { geziRotaCiftleri } = jest.requireActual<Modul>('../../../../supabase/functions/_shared/geziRotaCiftleri');

const d = (id: string, sira: number, konumlu = true): Durak => ({ id, sira, lat: konumlu ? 39.7 + sira / 1000 : null, lng: konumlu ? 30.5 : null });

describe('#205 Parça 1 gezi-rota çiftleri', () => {
  it('hepsi konumluysa ardışık bütün çiftler, bacak sırası aynı (bugünkü davranış)', () => {
    const { konumlu, ciftler } = geziRotaCiftleri([d('C', 3), d('A', 1), d('B', 2)]);
    expect(konumlu.map((x) => x.id)).toEqual(['A', 'B', 'C']);
    expect(ciftler.map((c) => [c.a.id, c.b.id, c.bacak])).toEqual([
      ['A', 'B', 0],
      ['B', 'C', 1],
    ]);
  });
  it('konumsuz durak rotaya girmez; iki yanındaki bacak yok, öbür bacaklar rota cevabındaki doğru sırayla eşleşir', () => {
    const { konumlu, ciftler } = geziRotaCiftleri([d('A', 1), d('B', 2), d('X', 3, false), d('C', 4), d('D', 5)]);
    // Google'a giden noktalar: A, B, C, D (3 bacak: A→B, B→C, C→D); B→C ardışık değil, kullanılmaz.
    expect(konumlu.map((x) => x.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(ciftler.map((c) => [c.a.id, c.b.id, c.bacak])).toEqual([
      ['A', 'B', 0],
      ['C', 'D', 2],
    ]);
  });
  it('tek konumlu durak ya da hiç: çift yok (Google\'a gidilmez)', () => {
    expect(geziRotaCiftleri([d('A', 1), d('X', 2, false)]).ciftler).toEqual([]);
    expect(geziRotaCiftleri([d('X', 1, false), d('Y', 2, false)]).ciftler).toEqual([]);
    expect(geziRotaCiftleri([]).ciftler).toEqual([]);
  });
});
