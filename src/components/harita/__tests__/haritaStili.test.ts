import { describe, expect, it } from '@jest/globals';

import { ACIK_HARITA_STILI } from '../haritaStili';

describe('harita stili (#51, #53)', () => {
  it('yalnız 6 haneli renk (Android 8 haneliyi #AARRGGBB okur)', () => {
    const renkler = ACIK_HARITA_STILI.flatMap((k) => k.stylers.map((s) => ('color' in s ? s.color : undefined))).filter((r): r is string => !!r);
    expect(renkler.length).toBeGreaterThan(0);
    for (const r of renkler) expect(r).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('bina blokları ve POI kapalı', () => {
    expect(ACIK_HARITA_STILI).toContainEqual({ featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] });
    expect(ACIK_HARITA_STILI).toContainEqual({ featureType: 'poi', stylers: [{ visibility: 'off' }] });
  });
});
