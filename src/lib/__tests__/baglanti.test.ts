// #243 KK3: bağlantı durumu sorgu sonuçlarından çıkarılır (NetInfo yok).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';

import { agHatasi, baglantiyiIzle, baglantiyiSifirla, cevrimdisiMi } from '../baglanti';

const AG = { message: 'TypeError: Network request failed', details: '', hint: '', code: '' };

describe('ağ hatası sınıflandırması', () => {
  it('ulaşılamayan sunucu ağ hatasıdır; sunucunun döndüğü hata değildir', () => {
    expect(agHatasi(new TypeError('Network request failed'))).toBe(true);
    expect(agHatasi(AG)).toBe(true);
    expect(agHatasi(Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' }))).toBe(true);
    expect(agHatasi({ message: 'permission denied for table trips', code: '42501' })).toBe(false);
    expect(agHatasi(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(agHatasi(null)).toBe(false);
  });
});

describe('baglantiyiIzle', () => {
  let birak: (() => void) | null = null;
  afterEach(() => {
    birak?.();
    birak = null;
    baglantiyiSifirla();
  });

  it('ilk ağ hatasında (yeniden denemeleri beklemeden) çevrimdışı; ağdan başarı gelince çevrimiçi ve sorgular yenilenir', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
    let ag = false;
    const sorgu = () => (ag ? Promise.resolve('tamam') : Promise.reject(AG));
    await qc.fetchQuery({ queryKey: ['seyahat', 's1'], queryFn: sorgu }).catch(() => undefined);
    expect(cevrimdisiMi()).toBe(true);

    const yenile = jest.spyOn(qc, 'invalidateQueries');
    ag = true;
    await qc.fetchQuery({ queryKey: ['profil', 'u1'], queryFn: sorgu });
    expect(cevrimdisiMi()).toBe(false);
    expect(yenile).toHaveBeenCalledTimes(1);
    qc.clear();
  });

  it('elle yazılan veri (setQueryData) ve sunucu hatası durumu değiştirmez', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
    await qc.fetchQuery({ queryKey: ['a'], queryFn: () => Promise.reject({ message: 'JWT expired', code: 'PGRST301' }) }).catch(() => undefined);
    expect(cevrimdisiMi()).toBe(false);
    await qc.fetchQuery({ queryKey: ['b'], queryFn: () => Promise.reject(AG) }).catch(() => undefined);
    expect(cevrimdisiMi()).toBe(true);
    qc.setQueryData(['c'], 1);
    expect(cevrimdisiMi()).toBe(true);
    qc.clear();
  });

  it('başarısız işlem (mutation) ağ hatasıyla düşerse çevrimdışı', async () => {
    const qc = new QueryClient();
    birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
    qc.getMutationCache().notify({ type: 'updated', mutation: {} as never, action: { type: 'error', error: new TypeError('Network request failed') } } as never);
    expect(cevrimdisiMi()).toBe(true);
    qc.clear();
  });

  it('çevrimdışıyken profil sorgusu aralıkla yeniden denenir', () => {
    jest.useFakeTimers();
    const qc = new QueryClient();
    const yokla = jest.spyOn(qc, 'refetchQueries').mockResolvedValue(undefined);
    birak = baglantiyiIzle(qc, { yoklamaMs: 1000 });
    qc.getQueryCache().notify({ type: 'updated', query: qc.getQueryCache().build(qc, { queryKey: ['x'] }), action: { type: 'failed', failureCount: 1, error: AG } } as never);
    jest.advanceTimersByTime(2100);
    expect(yokla).toHaveBeenCalledWith({ queryKey: ['profil'] });
    expect(yokla.mock.calls.length).toBe(2);
    qc.clear();
    jest.useRealTimers();
  });
});
