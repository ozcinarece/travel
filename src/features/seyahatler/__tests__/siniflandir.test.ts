import { describe, expect, it } from '@jest/globals';

import { acilisDurumu, biten, bitmemis, siniflandir } from '@/features/seyahatler/siniflandir';
import type { SeyahatOzet } from '@/lib/tipler';

const sy = (id: string, start: string | null, end: string | null, tz = 'Europe/Rome'): SeyahatOzet => ({
  id,
  name: null,
  city_label: id,
  start_date: start,
  end_date: end,
  tz,
  hotel_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
  members: [],
  places: [{ count: 0 }],
});

const idler = (l: SeyahatOzet[]) => l.map((s) => s.id);

describe('siniflandir (#276 KK1)', () => {
  // Roma'da 13 Ekim 2026, 12:00
  const an = new Date('2026-10-13T10:00:00Z');

  it('beş sınıfı ayırır', () => {
    const s = siniflandir(
      [
        sy('roma', '2026-10-12', '2026-10-15'),
        sy('paris', '2026-10-20', '2026-10-22'),
        sy('tokyo', '2027-03-03', '2027-03-12'),
        sy('bozcaada', null, null),
        sy('bari', '2026-10-05', '2026-10-08'),
        sy('lizbon', '2026-03-01', '2026-03-05'),
      ],
      an,
    );
    expect(idler(s.aktif)).toEqual(['roma']);
    expect(idler(s.yaklasan)).toEqual(['paris']);
    expect(idler(s.planlanan)).toEqual(['tokyo', 'bozcaada']);
    expect(idler(s.yeniBiten)).toEqual(['bari']);
    expect(idler(s.gecmis)).toEqual(['lizbon']);
  });

  it('başlangıca 14 gün kalan yaklaşan, 15 gün kalan planlanan', () => {
    const s = siniflandir([sy('on4', '2026-10-27', '2026-10-28'), sy('on5', '2026-10-28', '2026-10-29')], an);
    expect(idler(s.yaklasan)).toEqual(['on4']);
    expect(idler(s.planlanan)).toEqual(['on5']);
  });

  it('yarın başlayan yaklaşan; yaklaşanlar en yakın önce', () => {
    const s = siniflandir([sy('b', '2026-10-20', '2026-10-21'), sy('a', '2026-10-14', '2026-10-15')], an);
    expect(idler(s.yaklasan)).toEqual(['a', 'b']);
  });

  it("bitişin 7. günü yeniBiten, 8. günü geçmiş; bitişin ertesi günü artık aktif değil", () => {
    const s = siniflandir([sy('yedi', '2026-10-01', '2026-10-06'), sy('sekiz', '2026-10-01', '2026-10-05'), sy('dun', '2026-10-10', '2026-10-12')], an);
    expect(idler(s.yeniBiten)).toEqual(['dun', 'yedi']);
    expect(idler(s.gecmis)).toEqual(['sekiz']);
    expect(s.aktif).toHaveLength(0);
  });

  it('geçmiş yeniden eskiye sıralanır', () => {
    const { gecmis } = siniflandir([sy('a', '2025-05-01', '2025-05-04'), sy('b', '2026-03-01', '2026-03-05')], an);
    expect(idler(gecmis)).toEqual(['b', 'a']);
  });

  it('dönüş günü seyahat şehrinde bitene kadar aktiftir', () => {
    // 15 Ekim 22:30 UTC = Roma'da 16 Ekim 00:30 → yeni biten
    const s = siniflandir([sy('roma', '2026-10-12', '2026-10-15')], new Date('2026-10-15T22:30:00Z'));
    expect(s.aktif).toHaveLength(0);
    expect(idler(s.yeniBiten)).toEqual(['roma']);
  });

  it('gün hesabı cihazın değil seyahatin diliminde: aynı anda Tokyo için ertesi gün', () => {
    // 13 Ekim 20:00 UTC: Roma'da 13 Ekim 22:00, Tokyo'da 14 Ekim 05:00.
    const gece = new Date('2026-10-13T20:00:00Z');
    // 28 Ekim başlangıç: Roma'dan 15 gün (planlanan), Tokyo'dan 14 gün (yaklaşan).
    const s = siniflandir([sy('roma', '2026-10-28', '2026-10-29'), sy('tokyo', '2026-10-28', '2026-10-29', 'Asia/Tokyo')], gece);
    expect(idler(s.planlanan)).toEqual(['roma']);
    expect(idler(s.yaklasan)).toEqual(['tokyo']);
    // Bitişin 7./8. günü sınırı da dilime göre: 6 Ekim bitiş Roma'da 7. gün, Tokyo'da 8. gün.
    const b = siniflandir([sy('roma', '2026-10-05', '2026-10-06'), sy('tokyo', '2026-10-05', '2026-10-06', 'Asia/Tokyo')], gece);
    expect(idler(b.yeniBiten)).toEqual(['roma']);
    expect(idler(b.gecmis)).toEqual(['tokyo']);
  });

  it('bitmemiş = aktif + yaklaşan + planlanan; biten = yeniBiten + geçmiş', () => {
    const s = siniflandir([sy('t', null, null), sy('p', '2026-10-20', '2026-10-21'), sy('r', '2026-10-12', '2026-10-15'), sy('l', '2026-03-01', '2026-03-05'), sy('b', '2026-10-05', '2026-10-08')], an);
    expect(idler(bitmemis(s))).toEqual(['r', 'p', 't']);
    expect(idler(biten(s))).toEqual(['b', 'l']);
  });
});

describe('acilisDurumu (#276 KK2)', () => {
  const an = new Date('2026-10-13T10:00:00Z');

  it('seyahat yoksa yok', () => {
    expect(acilisDurumu([], an)).toEqual({ tur: 'yok' });
  });

  it('öncelik: aktif > yaklaşan > yeniBiten > planlanan', () => {
    const aktif = sy('aktif', '2026-10-12', '2026-10-15');
    const yak = sy('yak', '2026-10-20', '2026-10-21');
    const yeni = sy('yeni', '2026-10-05', '2026-10-08');
    const plan = sy('plan', null, null);
    expect(acilisDurumu([plan, yeni, yak, aktif], an)).toMatchObject({ tur: 'aktif', seyahat: { id: 'aktif' } });
    expect(acilisDurumu([plan, yeni, yak], an)).toMatchObject({ tur: 'yaklasan', seyahat: { id: 'yak' } });
    expect(acilisDurumu([plan, yeni], an)).toMatchObject({ tur: 'yeniBiten', seyahat: { id: 'yeni' } });
    expect(acilisDurumu([plan], an)).toMatchObject({ tur: 'planlanan', seyahat: { id: 'plan' } });
  });

  it('birden çok yaklaşan varsa en yakını', () => {
    expect(acilisDurumu([sy('b', '2026-10-25', '2026-10-26'), sy('a', '2026-10-16', '2026-10-17')], an)).toMatchObject({ seyahat: { id: 'a' } });
  });

  it('yalnız eski seyahat varsa eski (Keşfet, seyahat Gezilerim’de)', () => {
    expect(acilisDurumu([sy('l', '2026-03-01', '2026-03-05')], an)).toEqual({ tur: 'eski' });
  });
});
