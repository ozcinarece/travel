// #347: places-light'ın toplu okuma kuralı sahte Details ucuyla sınanır (Google içeriği yok; yalnız sayılar ve token'ın
// hangi isteğe bağlandığı). Önbellek isabetinde token gelse de Google'a gidilmez (#349 Ürün kararı).
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

describe('#347 places-light oturumu', () => {
  it('önbellek isabetinde token gelse de Google\'a istek gitmez (Ürün kararı #349)', async () => {
    const onbellek = new Map([[anahtar('otel1'), { zaman: SIMDI - 1000, deger: { place_id: 'otel1' } }]]);
    const { cagrilar, detay } = sahteDetay();
    const token = 'A'.repeat(32);
    expect(eksikSayisi(['otel1'], anahtar, onbellek, SIMDI, TTL)).toBe(0);
    const yerler = await topluOku(['otel1'], anahtar, onbellek, SIMDI, TTL, token, detay);
    expect(cagrilar).toEqual([]);
    expect(yerler).toEqual([{ place_id: 'otel1' }]);
  });

  it('önbellek ıskalanınca token yalnız Google\'a giden ilk kayda bağlanır ve cevap önbelleğe yazılır', async () => {
    const onbellek = new Map<string, { zaman: number; deger: { place_id: string } }>();
    const { cagrilar, detay } = sahteDetay();
    const token = 'jeton12345678';
    expect(eksikSayisi(['a', 'b'], anahtar, onbellek, SIMDI, TTL)).toBe(2);
    await topluOku(['a', 'b'], anahtar, onbellek, SIMDI, TTL, token, detay);
    expect(cagrilar).toEqual([
      { id: 'a', oturum: token },
      { id: 'b', oturum: undefined },
    ]);
    expect(onbellek.get(anahtar('a'))?.zaman).toBe(SIMDI);
  });

  it('KK2: token 8–36 karakter, yalnız harf, rakam, _ ve -', () => {
    expect(oturumAnahtari('A'.repeat(36))).toBe('A'.repeat(36));
    expect(oturumAnahtari('A'.repeat(37))).toBeUndefined();
    expect(oturumAnahtari('kisa')).toBeUndefined();
    expect(oturumAnahtari('jeton 12345')).toBeUndefined();
    expect(oturumAnahtari(42)).toBeUndefined();
  });
});
