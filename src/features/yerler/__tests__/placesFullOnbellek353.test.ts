// #353: places-full'ın tek kayıtlık okuması sahte Details ucuyla sınanır (Google içeriği yok; yalnız sayılar).
// Önbellek isabetinde token gelse de Google'a gidilmez; ıskalamada token'lı tek istek gider ve oturumu kapatır.
import { describe, expect, it } from '@jest/globals';

import { tekOku } from '../../../../supabase/functions/_shared/oturum';

type Yer = { place_id: string };
const TOKEN = 'jeton12345678';

function kur(eski: { zaman: number; deger: Yer } | undefined, red: string | null = null) {
  const cagrilar: (string | undefined)[] = [];
  const yazilan: Yer[] = [];
  let sinirSayisi = 0;
  const calistir = () =>
    tekOku<Yer, string>({
      eski,
      gecerli: (k) => k.zaman > 0,
      oturum: TOKEN,
      sinir: async () => {
        sinirSayisi++;
        return red;
      },
      detay: async (o) => {
        cagrilar.push(o);
        return { place_id: 'yeni' };
      },
      yaz: (d) => yazilan.push(d),
    });
  return { calistir, cagrilar, yazilan, sinir: () => sinirSayisi };
}

describe('#353 places-full önbellek', () => {
  it('KK1/KK3: isabette token gelse de dışarı istek 0, sınır sayılmaz, önbellekteki kayıt döner', async () => {
    const t = kur({ zaman: 1, deger: { place_id: 'eski' } });
    expect(await t.calistir()).toEqual({ deger: { place_id: 'eski' } });
    expect(t.cagrilar).toEqual([]);
    expect(t.sinir()).toBe(0);
  });

  it('KK1/KK3: ıskalamada token\'lı tek istek gider ve cevap önbelleğe yazılır', async () => {
    const t = kur(undefined);
    expect(await t.calistir()).toEqual({ deger: { place_id: 'yeni' } });
    expect(t.cagrilar).toEqual([TOKEN]);
    expect(t.yazilan).toEqual([{ place_id: 'yeni' }]);
  });

  it('süresi geçmiş kayıt ıskalama sayılır', async () => {
    const t = kur({ zaman: 0, deger: { place_id: 'eski' } });
    await t.calistir();
    expect(t.cagrilar).toHaveLength(1);
  });

  it('sınır doluysa Google\'a gidilmez', async () => {
    const t = kur(undefined, 'sinir');
    expect(await t.calistir()).toEqual({ red: 'sinir' });
    expect(t.cagrilar).toEqual([]);
  });
});
