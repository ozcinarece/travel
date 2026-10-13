import { describe, expect, it } from '@jest/globals';

import { ogeMetni } from '../OneriCekmecesi';

describe('#165 KK3/KK7 satır ve kart alt satırı', () => {
  it('"Kategori · ★ puan · süre"; puan yoksa atlanır', () => {
    expect(ogeMetni({ primary_type: 'museum', puan: 4.6, dakika: 90 })).toBe('Müze · ★ 4,6 · 1 sa 30 dk');
    expect(ogeMetni({ primary_type: 'mosque', puan: null, dakika: 45 })).toBe('Cami · 45 dk');
  });
});
