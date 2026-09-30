import { describe, expect, it } from '@jest/globals';

import { siniflandir } from '@/features/seyahatler/siniflandir';
import type { SeyahatOzet } from '@/lib/tipler';

const sy = (id: string, start: string | null, end: string | null): SeyahatOzet => ({
  id,
  city_label: id,
  start_date: start,
  end_date: end,
  tz: 'Europe/Rome',
  hotel_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
  members: [],
  places: [{ count: 0 }],
});

describe('siniflandir', () => {
  const an = new Date('2026-10-13T10:00:00Z');

  it('aktif, yaklaşan ve geçmişi ayırır; tarihsiz yaklaşandadır', () => {
    const { aktif, yaklasan, gecmis } = siniflandir(
      [sy('roma', '2026-10-12', '2026-10-15'), sy('tokyo', '2027-03-03', '2027-03-12'), sy('bozcaada', null, null), sy('lizbon', '2026-03-01', '2026-03-05')],
      an,
    );
    expect(aktif.map((s) => s.id)).toEqual(['roma']);
    expect(yaklasan.map((s) => s.id)).toEqual(['tokyo', 'bozcaada']);
    expect(gecmis.map((s) => s.id)).toEqual(['lizbon']);
  });

  it('geçmiş yeniden eskiye sıralanır', () => {
    const { gecmis } = siniflandir([sy('a', '2025-05-01', '2025-05-04'), sy('b', '2026-03-01', '2026-03-05')], an);
    expect(gecmis.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('dönüş günü seyahat şehrinde bitene kadar aktiftir', () => {
    // 15 Ekim 22:30 UTC = Roma'da 16 Ekim 00:30 → geçmiş
    expect(siniflandir([sy('roma', '2026-10-12', '2026-10-15')], new Date('2026-10-15T22:30:00Z')).gecmis).toHaveLength(1);
  });
});
