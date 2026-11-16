import { describe, expect, it, jest } from '@jest/globals';

// #253 KK1/KK4: route-matrix istek planı. matrisPlani.ts bir Deno modülü (uygulamanın tsc denetimine girmesin diye) — tipi
// burada yazılıp çalışma anında yüklenir.
type MatrisPlani = { istekler: { kaynaklar: string[]; hedefler: string[] }[]; eleman: number };
type Modul = { matrisPlani: (a: string[], onbellekte: (a: string, b: string) => boolean) => MatrisPlani };
const { matrisPlani } = jest.requireActual<Modul>('../../../../supabase/functions/_shared/matrisPlani');

const noktalar = (onek: string, n: number) => Array.from({ length: n }, (_, i) => `${onek}${i}`);

/** `eskiler` arasındaki bütün çiftler önbellekte. */
function onbellek(eskiler: string[]) {
  const s = new Set<string>();
  for (const a of eskiler) for (const b of eskiler) if (a !== b) s.add(`${a}>${b}`);
  return s;
}

/** Plan istenen çiftlerin listesi (kaynak ≠ hedef) ve kapsanan eksik çiftler. */
function istenenCiftler(plan: MatrisPlani) {
  const c: string[] = [];
  for (const p of plan.istekler) for (const a of p.kaynaklar) for (const b of p.hedefler) if (a !== b) c.push(`${a}>${b}`);
  return c;
}

function eksikler(hepsi: string[], s: Set<string>) {
  const c: string[] = [];
  for (const a of hepsi) for (const b of hepsi) if (a !== b && !s.has(`${a}>${b}`)) c.push(`${a}>${b}`);
  return c;
}

describe('matrisPlani (#253)', () => {
  it('24 noktası önbellekte olan güne 1 nokta: 2 × 25 − 1 = 49 eleman, iki istek', () => {
    const eski = noktalar('p', 24);
    const hepsi = [...eski, 'yeni'];
    const s = onbellek(eski);
    const plan = matrisPlani(hepsi, (a, b) => s.has(`${a}>${b}`));
    expect(plan.eleman).toBe(49);
    expect(plan.istekler).toHaveLength(2);
    expect(plan.istekler[0]).toEqual({ kaynaklar: ['yeni'], hedefler: hepsi });
    expect(plan.istekler[1]).toEqual({ kaynaklar: eski, hedefler: ['yeni'] });
    // Planın faturalanan eleman sayısı istekler toplamıyla aynı.
    expect(plan.istekler.reduce((t, p) => t + p.kaynaklar.length * p.hedefler.length, 0)).toBe(plan.eleman);
  });

  it.each([
    [24, 1],
    [10, 3],
    [20, 5],
    [2, 1],
    [3, 7],
  ])('önbellekte %i nokta + %i yeni: k × (n + k) + n × k eleman, önbellekteki çift tekrar istenmez, eksikler kapsanır', (n, k) => {
    const eski = noktalar('p', n);
    const hepsi = [...eski, ...noktalar('y', k)];
    const s = onbellek(eski);
    const plan = matrisPlani(hepsi, (a, b) => s.has(`${a}>${b}`));
    const beklenen = Math.min(k * (n + k) + n * k, (n + k) * (n + k));
    expect(plan.eleman).toBe(beklenen);
    expect(plan.istekler.length).toBeLessThanOrEqual(2);
    const istenen = istenenCiftler(plan);
    expect(istenen.filter((c) => s.has(c))).toEqual([]);
    expect(eksikler(hepsi, s).every((c) => istenen.includes(c))).toBe(true);
  });

  it('hiçbir çift önbellekte değilse tek istek (n × n)', () => {
    const hepsi = noktalar('p', 11);
    const plan = matrisPlani(hepsi, () => false);
    expect(plan.istekler).toEqual([{ kaynaklar: hepsi, hedefler: hepsi }]);
    expect(plan.eleman).toBe(121);
  });

  it('her şey önbellekteyse Google isteği yok', () => {
    const hepsi = noktalar('p', 5);
    const s = onbellek(hepsi);
    expect(matrisPlani(hepsi, (a, b) => s.has(`${a}>${b}`))).toEqual({ istekler: [], eleman: 0 });
  });

  it('eski noktalar arasındaki tek boşluk da kapsanır ve en ucuz plan seçilir', () => {
    const hepsi = noktalar('p', 10);
    const s = onbellek(hepsi);
    s.delete('p2>p5');
    const plan = matrisPlani(hepsi, (a, b) => s.has(`${a}>${b}`));
    expect(plan.eleman).toBe(1);
    expect(istenenCiftler(plan)).toEqual(['p2>p5']);
  });

  it('yeni nokta + eskiler arasında boşluk: bütün eksikler kapsanır, eleman tek dikdörtgenden az', () => {
    const eski = noktalar('p', 12);
    const hepsi = [...eski, 'yeni'];
    const s = onbellek(eski);
    s.delete('p1>p7');
    s.delete('p4>p0');
    const plan = matrisPlani(hepsi, (a, b) => s.has(`${a}>${b}`));
    expect(plan.istekler.length).toBeLessThanOrEqual(2);
    const istenen = istenenCiftler(plan);
    expect(eksikler(hepsi, s).every((c) => istenen.includes(c))).toBe(true);
    expect(plan.eleman).toBeLessThan(13 * 13);
  });
});
