// #407 KK3: Arkadaşlar akışındaki kart alıcı ekranını paylaşımın kimliğiyle açar; kimlikte `_kimlik` fonksiyonları çağrılır.
import { describe, expect, it, jest } from '@jest/globals';

import { haritaIzniAl, kimlikMi } from '../alici';

const mockRpc = jest.fn(async (_ad: string, _p: object) => ({ data: true, error: null }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (ad: string, p: object) => mockRpc(ad, p) } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

describe('#407 KK3 kimlikle alıcı ekranı', () => {
  it('uuid kimlik, 24 karakterlik token değil; harita izni kimlik fonksiyonuna gider', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(kimlikMi(id)).toBe(true);
    expect(kimlikMi('A'.repeat(24))).toBe(false);
    await haritaIzniAl(id);
    expect(mockRpc).toHaveBeenLastCalledWith('paylasim_harita_izni_kimlik', { p_id: id });
    await haritaIzniAl('A'.repeat(24));
    expect(mockRpc).toHaveBeenLastCalledWith('paylasim_harita_izni', { p_token: 'A'.repeat(24) });
  });
});
