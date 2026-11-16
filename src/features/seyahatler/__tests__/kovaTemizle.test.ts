import { describe, expect, it } from '@jest/globals';

import { onekKur, parcala, silinecekler } from '../../../../supabase/functions/_shared/kovaTemizle';

const TRIP = '23400000-0000-4000-8000-000000000001';

describe('#234 kova-temizle: önek yalnız kuyruk satırından kurulur', () => {
  it('bilinen kova ve uuid ile önek `{trip_id}/` olur', () => {
    expect(onekKur({ kova: 'sohbet', trip_id: TRIP })).toEqual({
      kova: 'sohbet',
      onek: `${TRIP}/`,
    });
    expect(onekKur({ kova: 'fisler', trip_id: TRIP })).toEqual({
      kova: 'fisler',
      onek: `${TRIP}/`,
    });
  });

  it('başka kova ya da bozuk kimlik reddedilir', () => {
    expect(onekKur({ kova: 'avatars', trip_id: TRIP })).toBeNull();
    expect(onekKur({ kova: 'sohbet', trip_id: '' })).toBeNull();
    expect(onekKur({ kova: 'sohbet', trip_id: '../x' })).toBeNull();
    expect(onekKur({ kova: 'sohbet', trip_id: `${TRIP}/..` })).toBeNull();
    expect(
      onekKur({
        kova: 'sohbet',
        trip_id: 'ABCDEF00-0000-4000-8000-000000000001',
      }),
    ).toBeNull();
  });

  it('yalnız önekle başlayan adlar silinir; başka klasör, `..` ve klasörün kendisi elenir', () => {
    const onek = `${TRIP}/`;
    const adlar = [
      `${TRIP}/a.jpg`,
      `${TRIP}/alt/b.webp`,
      `23400000-0000-4000-8000-000000000002/c.jpg`,
      `${TRIP}/../d.jpg`,
      onek,
      `x${TRIP}/e.jpg`,
      42,
      null,
    ];
    expect(silinecekler(onek, adlar)).toEqual([`${TRIP}/a.jpg`, `${TRIP}/alt/b.webp`]);
    expect(silinecekler(onek, null)).toEqual([]);
  });

  it('silme çağrıları 100 adlık parçalara bölünür', () => {
    const liste = Array.from({ length: 250 }, (_, i) => `${TRIP}/${i}.jpg`);
    expect(parcala(liste).map((p) => p.length)).toEqual([100, 100, 50]);
    expect(parcala([])).toEqual([]);
  });
});
