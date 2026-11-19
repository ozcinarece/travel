// #368 KK1/KK5: hat şehir kimliğini service_role ile `icerik-google` `islem: 'sehir'` üzerinden alır (places-* değil).
import { sehirIstegiAl, sehirYeriBul } from '../../../supabase/functions/_shared/icerikSehir';
import { sehirKimligiCoz } from '../sehir.mjs';

const IZMIR = { ad: 'İzmir', lat: 38.4237, lng: 27.1428 };
const ID = 'ChIJ_izmir_ornek_1234';
const yer = (ek = {}) => ({ place_id: ID, lat: 38.42, lng: 27.14, tz: 'Europe/Istanbul', ulke_kodu: 'TR', ...ek });

/** Hattın `google()`'ı gibi: service_role ile icerik-google'a sahte fetch; çağrılar kaydedilir. */
function sahteHat(cevap) {
  const istekler = [];
  const sahteFetch = jest.fn(async (url, secenek) => {
    istekler.push({ url, govde: JSON.parse(secenek.body), yetki: secenek.headers.authorization });
    return { ok: true, status: 200, json: async () => cevap };
  });
  const google = async (govde) => {
    const r = await sahteFetch('https://ornek.supabase.co/functions/v1/icerik-google', {
      method: 'POST',
      headers: { authorization: 'Bearer SERVIS', 'content-type': 'application/json' },
      body: JSON.stringify(govde),
    });
    return r.json();
  };
  return { google, istekler, sahteFetch };
}

describe('hat: sehirKimligiCoz (#368)', () => {
  it('place_id yokken tek istek: icerik-google islem sehir, ad ve merkez', async () => {
    const h = sahteHat({ islem: 'sehir', yer: yer() });
    await expect(sehirKimligiCoz(h.google, IZMIR)).resolves.toEqual({ place_id: ID, tz: 'Europe/Istanbul', ulke_kodu: 'TR' });
    expect(h.istekler).toHaveLength(1);
    expect(h.istekler[0].url).toMatch(/\/functions\/v1\/icerik-google$/);
    expect(h.istekler[0].url).not.toMatch(/places-/);
    expect(h.istekler[0].yetki).toBe('Bearer SERVIS');
    expect(h.istekler[0].govde).toEqual({ islem: 'sehir', ad: 'İzmir', merkez: { lat: 38.4237, lng: 27.1428 } });
  });

  it('place_id biliniyorsa gövdeye girer', async () => {
    const h = sahteHat({ islem: 'sehir', yer: yer() });
    await sehirKimligiCoz(h.google, IZMIR, ID);
    expect(h.istekler[0].govde.place_id).toBe(ID);
  });

  it('eşleşme yok ya da 50 km dışı → null', async () => {
    await expect(sehirKimligiCoz(sahteHat({ yer: null }).google, IZMIR)).resolves.toBeNull();
    await expect(sehirKimligiCoz(sahteHat({ yer: yer({ lat: 39.9, lng: 32.8 }) }).google, IZMIR)).resolves.toBeNull();
  });

  it('icerik-google hatası yutulmaz (çağırana fırlar)', async () => {
    const google = async () => {
      throw new Error('icerik-google 429: bütçe');
    };
    await expect(sehirKimligiCoz(google, IZMIR)).rejects.toThrow('429');
  });
});

describe('icerik-google sehir (#368)', () => {
  const temel = { islem: 'sehir', ad: 'İzmir', merkez: { lat: 38.4, lng: 27.1 } };

  it('istek denetimi: yalnız ad, merkez, place_id; maske gönderilemez', () => {
    expect(sehirIstegiAl(temel)).toEqual({ ad: 'İzmir', merkez: { lat: 38.4, lng: 27.1 }, place_id: null });
    expect(sehirIstegiAl({ ...temel, place_id: ID })).toMatchObject({ place_id: ID });
    expect(typeof sehirIstegiAl({ ...temel, maske: 'reviews' })).toBe('string');
    expect(typeof sehirIstegiAl({ ...temel, ad: ' ' })).toBe('string');
    expect(typeof sehirIstegiAl({ ...temel, merkez: { lat: 200, lng: 0 } })).toBe('string');
    expect(typeof sehirIstegiAl({ ...temel, place_id: 'x' })).toBe('string');
  });

  it('place_id yokken 1 kimlik + 1 Details; varken yalnız Details', async () => {
    const kimlik = jest.fn(async () => [ID, 'ChIJ_baska_1234567']);
    const detay = jest.fn(async () => yer());
    const r = await sehirYeriBul({ ad: 'İzmir', merkez: { lat: 38.4, lng: 27.1 }, place_id: null }, { kimlik, detay });
    expect(r).toEqual({ yer: yer(), kimlikAdet: 1 });
    expect(kimlik).toHaveBeenCalledTimes(1);
    expect(kimlik).toHaveBeenCalledWith('İzmir', { lat: 38.4, lng: 27.1 }, 50_000);
    expect(detay).toHaveBeenCalledTimes(1);
    expect(detay).toHaveBeenCalledWith(ID);

    kimlik.mockClear();
    detay.mockClear();
    const r2 = await sehirYeriBul({ ad: 'İzmir', merkez: { lat: 38.4, lng: 27.1 }, place_id: ID }, { kimlik, detay });
    expect(r2.kimlikAdet).toBe(0);
    expect(kimlik).not.toHaveBeenCalled();
    expect(detay).toHaveBeenCalledTimes(1);
  });

  it('kimlik araması boşsa Details yapılmaz', async () => {
    const detay = jest.fn(async () => yer());
    const r = await sehirYeriBul({ ad: 'Yok', merkez: { lat: 0, lng: 0 }, place_id: null }, { kimlik: async () => [], detay });
    expect(r).toEqual({ yer: null, kimlikAdet: 1 });
    expect(detay).not.toHaveBeenCalled();
  });
});
