import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { t } from '@/i18n';

import { birKezDene, GunlukSinir, hafifYerler, linkCoz, placesHatasi } from '../api';
import { kesfetBelleginiSifirla, useKesfetOnerileri } from '../kesfetYukleme';

// #226 KK4: Places fonksiyonu 429 dönünce istemci GunlukSinir fırlatır; mesaj tr.json'daki metin, sorgu yeniden denemez.
type Cevap = { data: unknown; error: unknown };
const mockInvoke = jest.fn<(ad: string, secenek: unknown) => Promise<Cevap>>();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (ad: string, secenek: unknown) => mockInvoke(ad, secenek) } } }));
jest.mock('@/lib/hataRaporu', () => ({ izBirak: jest.fn() }));

/** supabase-js FunctionsHttpError taklidi: gövde context'te (Response). */
const httpHatasi = (durum: number, govde: unknown) => ({ message: 'Edge Function returned a non-2xx status code', context: { status: durum, json: async () => govde } });

describe('#226 günlük Places sınırı (istemci)', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    kesfetBelleginiSifirla();
  });

  it('429 → GunlukSinir, mesaj tr.json metni; diğer hatalar olduğu gibi', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpHatasi(429, { hata: 'gunluk_sinir' }) });
    const e = await hafifYerler(['p1']).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(GunlukSinir);
    expect((e as Error).message).toBe(t('yerler.gunlukSinir'));
    expect(t('yerler.gunlukSinir')).toBe('Bugünlük arama sınırına ulaştın, yarın yeniden dene.');

    mockInvoke.mockResolvedValueOnce({ data: null, error: httpHatasi(502, { hata: 'x' }) });
    expect(await hafifYerler(['p1']).catch((x: unknown) => x)).not.toBeInstanceOf(GunlukSinir);
  });

  it('linkCoz da 429 → GunlukSinir; 422 desteklenmeyen_link aynı kalır', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpHatasi(429, { hata: 'gunluk_sinir' }) });
    expect(await linkCoz('https://maps.app.goo.gl/x').catch((x: unknown) => x)).toBeInstanceOf(GunlukSinir);
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpHatasi(422, { hata: 'desteklenmeyen_link' }) });
    expect(((await linkCoz('https://x').catch((x: unknown) => x)) as Error).message).toBe('desteklenmeyen_link');
  });

  it('sorgu 429 sonrası yeniden denemez (sonsuz deneme yok); diğer hatada bir kez', () => {
    expect(birKezDene(0, new GunlukSinir())).toBe(false);
    expect(birKezDene(0, new Error('502'))).toBe(true);
    expect(birKezDene(1, new Error('502'))).toBe(false);
  });

  it('placesHatasi: sınırda sınır metni, değilse ekranın kendi metni', () => {
    expect(placesHatasi(new GunlukSinir(), 'ekran')).toBe(t('yerler.gunlukSinir'));
    expect(placesHatasi(new Error('502'), 'ekran')).toBe('ekran');
    expect(placesHatasi(null, 'ekran')).toBe('ekran');
  });

  it('Keşfet: şehir isteği 429 → hata ve sinir', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpHatasi(429, { hata: 'gunluk_sinir' }) });
    const { result } = renderHook(() => useKesfetOnerileri('s226', { lat: 39.77, lng: 30.52 }, ['turistik_muze']));
    await waitFor(() => expect(result.current.hata).toBe(true));
    expect(result.current.sinir).toBe(true);
    await act(async () => undefined);
  });

  it('Keşfet: başka hata → sinir false', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpHatasi(502, { hata: 'x' }) });
    const { result } = renderHook(() => useKesfetOnerileri('s226b', { lat: 39.8, lng: 30.5 }, ['turistik_muze']));
    await waitFor(() => expect(result.current.hata).toBe(true));
    expect(result.current.sinir).toBe(false);
    await act(async () => undefined);
  });
});
