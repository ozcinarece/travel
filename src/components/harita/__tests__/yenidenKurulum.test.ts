import { describe, expect, it } from '@jest/globals';

import { YENIDEN_BAGLANMA_ESIGI_MS, yenidenKurulsunMu } from '../yenidenKurulum';

describe('yenidenKurulsunMu (#79)', () => {
  it('ilk onMapReady yeniden kurmaz; aynı örnekten eşikten geç gelen ikincisi kurar', () => {
    expect(yenidenKurulsunMu(0, 10_000)).toBe(false);
    expect(yenidenKurulsunMu(10_000, 10_000 + YENIDEN_BAGLANMA_ESIGI_MS)).toBe(true);
    expect(yenidenKurulsunMu(10_000, 40_000)).toBe(true);
  });

  it('ilk kurulumda art arda gelen çift olay yeniden kurmaz (sonsuz döngü yok)', () => {
    expect(yenidenKurulsunMu(10_000, 10_050)).toBe(false);
    expect(yenidenKurulsunMu(10_000, 10_000 + YENIDEN_BAGLANMA_ESIGI_MS - 1)).toBe(false);
  });
});
