// #347: otel seçiminde Autocomplete oturumunu places-light kapatır. Sahte Details ucu (Google içeriği yok; yalnız sayılar ve
// token'ın hangi isteğe bağlandığı) ile places-light'ın toplu okuma kuralı sınanır.
import { describe, expect, it } from '@jest/globals';

import { eksikSayisi, oturumAnahtari, topluOku } from '../../../../supabase/functions/_shared/oturum';

const TTL = 24 * 60 * 60 * 1000;
const SIMDI = 1_000_000_000;
const anahtar = (id: string) => `hafif:${id}`;

function sahteDetay() {
  const cagrilar: { id: string; oturum: string | undefined }[] = [];
  const detay = async (id: string, oturum: string | undefined) => {
    cagrilar.push({ id, oturum });
    return { place_id: id };
  };
  return { cagrilar, detay };
}

describe('#347 places-light oturumu kapatır', () => {
  it('KK1/KK4: önbellekteki yer token ile seçilince Google\'a 1 Details gider, token o isteğe bağlanır, cevap önbelleğe yazılır', async () => {
    const onbellek = new Map([[anahtar('otel1'), { zaman: SIMDI - 1000, deger: { place_id: 'otel1' } }]]);
    const { cagrilar, detay } = sahteDetay();
    const token = 'A'.repeat(32);
    expect(eksikSayisi(['otel1'], anahtar, onbellek, SIMDI, TTL, token)).toBe(1);
    const yerler = await topluOku(['otel1'], anahtar, onbellek, SIMDI, TTL, token, detay);
    expect(cagrilar).toEqual([{ id: 'otel1', oturum: token }]);
    expect(yerler).toEqual([{ place_id: 'otel1' }]);
    expect(onbellek.get(anahtar('otel1'))?.zaman).toBe(SIMDI);
  });

  it('token\'sız istek bugünkü gibi önbellekten okunur (Details yok)', async () => {
    const onbellek = new Map([[anahtar('otel1'), { zaman: SIMDI - 1000, deger: { place_id: 'otel1' } }]]);
    const { cagrilar, detay } = sahteDetay();
    expect(eksikSayisi(['otel1'], anahtar, onbellek, SIMDI, TTL, undefined)).toBe(0);
    await topluOku(['otel1'], anahtar, onbellek, SIMDI, TTL, undefined, detay);
    expect(cagrilar).toEqual([]);
  });

  it('token yalnız ilk kayda bağlanır; sonraki önbellekteki kimlikler önbellekten', async () => {
    const onbellek = new Map([
      [anahtar('a'), { zaman: SIMDI, deger: { place_id: 'a' } }],
      [anahtar('b'), { zaman: SIMDI, deger: { place_id: 'b' } }],
    ]);
    const { cagrilar, detay } = sahteDetay();
    const token = 'jeton12345678';
    expect(eksikSayisi(['a', 'b', 'c'], anahtar, onbellek, SIMDI, TTL, token)).toBe(2);
    await topluOku(['a', 'b', 'c'], anahtar, onbellek, SIMDI, TTL, token, detay);
    expect(cagrilar).toEqual([
      { id: 'a', oturum: token },
      { id: 'c', oturum: undefined },
    ]);
  });

  it('KK2: token 8–36 karakter, yalnız harf, rakam, _ ve -', () => {
    expect(oturumAnahtari('A'.repeat(36))).toBe('A'.repeat(36));
    expect(oturumAnahtari('A'.repeat(37))).toBeUndefined();
    expect(oturumAnahtari('kisa')).toBeUndefined();
    expect(oturumAnahtari('jeton 12345')).toBeUndefined();
    expect(oturumAnahtari(42)).toBeUndefined();
  });
});
