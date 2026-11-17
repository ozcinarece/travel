// #266 KK4–KK5: Overpass istemcisi — süre sınırı, yalnız geçici hatada yeniden deneme, Retry-After, bütçe.
import { ISTEK_SURESI_MS, OverpassHatasi, overpassBirKez, overpassYeniden, retryAfterMs, SureBittiHatasi } from '../overpass.mjs';

const yanit = (status, govde = { elements: [] }, basliklar = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (a) => basliklar[a.toLowerCase()] ?? null },
  json: async () => govde,
});

/** Sırayla verilen yanıtları döndüren sahte fetch; Error verilirse atar. Çağrı sayısını ve sinyali tutar. */
const sahteFetch = (...sira) => {
  const f = jest.fn(async (_url, secenek) => {
    f.sinyaller.push(secenek.signal);
    const s = sira.shift();
    if (s instanceof Error) throw s;
    return s;
  });
  f.sinyaller = [];
  return f;
};

describe('retryAfterMs', () => {
  it('saniye ve HTTP tarihi okunur; yoksa null', () => {
    expect(retryAfterMs('30')).toBe(30_000);
    expect(retryAfterMs(new Date(10_000 + 7_000).toUTCString(), 10_000)).toBe(7_000);
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs('yarın')).toBeNull();
  });
});

describe('overpassBirKez (#266 KK4–KK5)', () => {
  it('her istekte süre sınırı sinyali gider', async () => {
    const f = sahteFetch(yanit(200));
    await overpassBirKez('q', { fetchFn: f });
    expect(ISTEK_SURESI_MS).toBe(120_000);
    expect(f.sinyaller[0]).toBeInstanceOf(AbortSignal);
  });

  it('ilk sunucu ağ hatası verirse ikincisi denenir', async () => {
    const f = sahteFetch(new TypeError('ağ'), yanit(200, { elements: [1] }));
    await expect(overpassBirKez('q', { fetchFn: f })).resolves.toEqual({ elements: [1] });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('geçici olmayan 4xx hemen durdurur; diğer sunucu denenmez', async () => {
    const f = sahteFetch(yanit(400), yanit(200));
    await expect(overpassBirKez('q', { fetchFn: f })).rejects.toMatchObject({ durum: 400, yeniden: false });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('429 geçicidir ve Retry-After taşınır', async () => {
    const f = sahteFetch(yanit(429, null, { 'retry-after': '12' }), yanit(429, null, { 'retry-after': '12' }));
    await expect(overpassBirKez('q', { fetchFn: f })).rejects.toMatchObject({ durum: 429, yeniden: true, bekleMs: 12_000 });
  });
});

describe('overpassYeniden (#266 KK5)', () => {
  const bekle = jest.fn(async () => undefined);
  beforeEach(() => bekle.mockClear());

  it('429/502/503/504 ve ağ hatasında yeniden dener', async () => {
    for (const d of [429, 502, 503, 504]) {
      const f = sahteFetch(yanit(d), yanit(d), yanit(200, { elements: [d] }));
      await expect(overpassYeniden('q', { fetchFn: f, bekle })).resolves.toEqual({ elements: [d] });
    }
    const ag = sahteFetch(new TypeError('a'), new TypeError('b'), yanit(200));
    await expect(overpassYeniden('q', { fetchFn: ag, bekle })).resolves.toEqual({ elements: [] });
  });

  it('400, 403 ve 500 yeniden denenmez', async () => {
    for (const d of [400, 403]) {
      const f = sahteFetch(yanit(d), yanit(d), yanit(200));
      await expect(overpassYeniden('q', { fetchFn: f, bekle })).rejects.toBeInstanceOf(OverpassHatasi);
      expect(f).toHaveBeenCalledTimes(1);
    }
    const f = sahteFetch(yanit(500), yanit(500), yanit(200));
    await expect(overpassYeniden('q', { fetchFn: f, bekle })).rejects.toMatchObject({ durum: 500 });
    expect(f).toHaveBeenCalledTimes(2); // iki sunucu bir kez; yeniden deneme yok
    expect(bekle).not.toHaveBeenCalled();
  });

  it('Retry-After varsa ona uyar, yoksa artan bekleme', async () => {
    const f = sahteFetch(yanit(503, null, { 'retry-after': '40' }), yanit(503, null, { 'retry-after': '40' }), yanit(503), yanit(503), yanit(200));
    await overpassYeniden('q', { fetchFn: f, bekle });
    expect(bekle.mock.calls.map((c) => c[0])).toEqual([40_000, 15_000]);
  });

  it('deneme sayısı dolunca son hata atılır', async () => {
    const f = sahteFetch(...Array(6).fill(yanit(504)));
    await expect(overpassYeniden('q', { fetchFn: f, bekle, deneme: 3 })).rejects.toMatchObject({ durum: 504 });
    expect(bekle).toHaveBeenCalledTimes(2);
  });

  it('bütçe doluysa istek atılmaz; bekleme bütçeyi aşacaksa SureBittiHatasi (KK4)', async () => {
    const f = sahteFetch(yanit(200));
    await expect(overpassYeniden('q', { fetchFn: f, bekle, simdi: () => 100, bitis: 100 })).rejects.toBeInstanceOf(SureBittiHatasi);
    expect(f).not.toHaveBeenCalled();
    const g = sahteFetch(yanit(429, null, { 'retry-after': '60' }), yanit(429, null, { 'retry-after': '60' }));
    await expect(overpassYeniden('q', { fetchFn: g, bekle, simdi: () => 0, bitis: 30_000 })).rejects.toBeInstanceOf(SureBittiHatasi);
    expect(bekle).not.toHaveBeenCalled();
  });
});
