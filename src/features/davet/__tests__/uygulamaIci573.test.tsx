// #573 Uygulama içi davet: metin kuralları (KK2, KK3, KK5, KK8), Hayır → 5 sn Geri al (KK4, bildirim yok) ve Katıl → üyelik +
// seyahatin içi "Katıldın" çekmecesiyle (KK4). Google'a istek yok (yalnız kendi RPC'lerimiz).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  adaYonelme,
  anaSayfaBasligi,
  davetAlt,
  davetEtiketi,
  deBaglaci,
  DAVETLERIM,
  GERI_CEVIR_MS,
  gezilerimAlt,
  gezilerimBasligi,
  gittiMetni,
  kisiDurumu,
  gonderilenDurumlari,
  useDavetEylemleri,
  useDavetGonder,
  type GelenDavet,
} from '../uygulamaIci';

const mockRpc = jest.fn<(ad: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>>();
const mockOlay = jest.fn();
const mockPush = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (ad: string, args?: unknown) => mockRpc(ad, args), from: () => ({}) } }));
jest.mock('@/features/icerik/sorgular', () => ({ olayYaz: (...a: unknown[]) => mockOlay(...a) }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const urla: GelenDavet = {
  id: 'd1',
  trip_id: 't1',
  davet_eden_ad: 'Ayşe',
  davet_eden_foto: null,
  ad: 'Urla bağ rotası',
  sehir: 'Urla',
  start_date: '2026-12-05',
  end_date: '2026-12-06',
  gun_sayisi: 2,
  kisiler: [
    { sira: 1, ad: 'Ayşe', foto: null },
    { sira: 2, ad: 'Mert', foto: null },
  ],
  olusturuldu: '2026-11-27T12:00:00Z',
};

describe('#573 metinler', () => {
  it('KK2: ana sayfa başlığı şehirle, KK3: Gezilerim başlığı gezinin tam adıyla', () => {
    expect(anaSayfaBasligi(urla)).toBe("Ayşe seni Urla'ya çağırıyor");
    expect(gezilerimBasligi(urla)).toBe('Ayşe seni Urla bağ rotasına çağırıyor');
    expect(gezilerimBasligi({ ...urla, ad: 'Kapadokya Gezisi' })).toBe("Ayşe seni Kapadokya Gezisi'ne çağırıyor");
    expect(gezilerimBasligi({ ...urla, ad: null, sehir: 'İzmir' })).toBe("Ayşe seni İzmir'e çağırıyor");
    expect(anaSayfaBasligi({ ...urla, davet_eden_ad: null })).toBe("Bir arkadaşın seni Urla'ya çağırıyor");
  });
  it('KK8: ekran okuyucu etiketi', () => {
    expect(davetEtiketi(urla)).toBe("Davet: Ayşe seni Urla'ya çağırıyor");
  });
  it('KK2: "{tarih} · {n} gün"; tarih yoksa yalnız gün', () => {
    expect(davetAlt(urla)).toBe('5–6 Aralık · 2 gün');
    expect(davetAlt({ ...urla, start_date: null, end_date: null, gun_sayisi: 3 })).toBe('3 gün');
  });
  it('KK3: alt satırda diğer katılanlar ("Mert de geliyor")', () => {
    expect(gezilerimAlt(urla)).toBe('5–6 Aralık · 2 gün · Mert de geliyor');
    expect(gezilerimAlt({ ...urla, kisiler: [urla.kisiler[0]] })).toBe('5–6 Aralık · 2 gün');
    expect(gezilerimAlt({ ...urla, kisiler: [...urla.kisiler, { sira: 3, ad: 'Can', foto: null }] })).toBe('5–6 Aralık · 2 gün · Mert ve Can da geliyor');
    expect(gezilerimAlt({ ...urla, kisiler: [...urla.kisiler, { sira: 3, ad: 'Can', foto: null }, { sira: 4, ad: 'Deniz', foto: null }] })).toBe('5–6 Aralık · 2 gün · Mert ve 2 kişi daha geliyor');
    expect(deBaglaci('Ayşe')).toBe('de');
    expect(deBaglaci('Okan')).toBe('da');
  });
  it('adaYonelme: cins isimle biten adda kesme yok, özel adda var', () => {
    expect(adaYonelme('Urla')).toBe("Urla'ya");
    expect(adaYonelme('Urla bağ rotası')).toBe('Urla bağ rotasına');
    expect(adaYonelme('Eskişehir Gezisi')).toBe("Eskişehir Gezisi'ne");
  });
  it('KK5: "{Adlar}\'e davet gitti." ve kişi durumu (linkle katılan da Katıldı)', () => {
    expect(gittiMetni(['Mert', 'Deniz'])).toBe("Mert ve Deniz'e davet gitti.");
    expect(gittiMetni(['Mert'])).toBe("Mert'e davet gitti.");
    expect(gittiMetni(['Ayşe', 'Can', 'Deniz'])).toBe("Ayşe, Can ve Deniz'e davet gitti.");
    expect(kisiDurumu('bekliyor', false)).toBe('bekliyor');
    expect(kisiDurumu('bekliyor', true)).toBe('katildi');
    expect(kisiDurumu('reddetti', false)).toBe('reddetti');
    expect(kisiDurumu(undefined, false)).toBe('bekliyor');
  });

  it('#605 öz-inceleme 2: kişinin en yeni satırı iptal ise kişi durum listesinde yok; eski satır öne çıkmaz', () => {
    const h = gonderilenDurumlari([
      { davet_edilen: 'd', durum: 'katildi' },
      { davet_edilen: 'd', durum: 'iptal' },
      { davet_edilen: 'm', durum: 'reddetti' },
      { davet_edilen: 'm', durum: 'bekliyor' },
      { davet_edilen: 'b', durum: 'iptal' },
      { davet_edilen: 'b', durum: 'bekliyor' },
    ]);
    expect([...h.entries()]).toEqual([['m', 'bekliyor'], ['b', 'bekliyor']]);
  });
});

function sarmal(qc: QueryClient) {
  return function Sarmal({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('#573 KK4 eylemler', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    mockRpc.mockReset();
    mockOlay.mockReset();
    mockPush.mockReset();
    mockRpc.mockImplementation(async (ad) => {
      if (ad === 'davetlerim') return { data: [urla], error: null };
      if (ad === 'davete_katil') return { data: { trip_id: 't1', zaten_uye: false, name: 'Urla bağ rotası', city_label: 'Urla', inviter_name: 'Ayşe', day_count: 2, place_count: 0 }, error: null };
      if (ad === 'daveti_reddet') return { data: null, error: null };
      if (ad === 'davet_gonder') return { data: 2, error: null };
      return { data: null, error: { message: `beklenmeyen rpc ${ad}` } };
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    qc.clear();
  });

  it('Hayır: satır hemen kalkar, 5 sn içinde Geri al sunucuya bir şey göndermeden geri koyar', async () => {
    const { result } = renderHook(() => useDavetEylemleri(jest.fn()), { wrapper: sarmal(qc) });
    await waitFor(() => expect(result.current.davetler).toHaveLength(1));
    jest.useFakeTimers();
    act(() => result.current.reddet(urla));
    expect(result.current.davetler).toHaveLength(0);
    expect(result.current.bekleyen?.id).toBe('d1');
    act(() => result.current.geriAl());
    expect(result.current.davetler).toHaveLength(1);
    expect(result.current.bekleyen).toBeNull();
    act(() => jest.advanceTimersByTime(GERI_CEVIR_MS + 100));
    expect(mockRpc.mock.calls.filter(([ad]) => ad === 'daveti_reddet')).toHaveLength(0);
  });

  it('#605 inceleme 2: Hayır\'a çift dokunuş ilk reddi göndermez; Geri al daveti geri getirir, daveti_reddet çağrılmaz', async () => {
    const { result } = renderHook(() => useDavetEylemleri(jest.fn()), { wrapper: sarmal(qc) });
    await waitFor(() => expect(result.current.davetler).toHaveLength(1));
    jest.useFakeTimers();
    // Aynı karede iki dokunuş: ikinci çağrı yeniden çizimden önce, aynı `reddet` ile.
    act(() => {
      result.current.reddet(urla);
      result.current.reddet(urla);
    });
    expect(mockRpc.mock.calls.filter(([ad]) => ad === 'daveti_reddet')).toHaveLength(0);
    expect(result.current.bekleyen?.id).toBe('d1');
    act(() => result.current.geriAl());
    expect(result.current.davetler).toHaveLength(1);
    act(() => jest.advanceTimersByTime(GERI_CEVIR_MS + 100));
    expect(mockRpc.mock.calls.filter(([ad]) => ad === 'daveti_reddet')).toHaveLength(0);
    expect(qc.getQueryData<GelenDavet[]>(DAVETLERIM)?.map((d) => d.id)).toEqual(['d1']);
  });

  it('Hayır: 5 sn sonra daveti_reddet (yalnız bir kez); davet edene bildirim yok (olay da yazılmaz)', async () => {
    const { result } = renderHook(() => useDavetEylemleri(jest.fn()), { wrapper: sarmal(qc) });
    await waitFor(() => expect(result.current.davetler).toHaveLength(1));
    jest.useFakeTimers();
    act(() => result.current.reddet(urla));
    act(() => jest.advanceTimersByTime(GERI_CEVIR_MS));
    expect(mockRpc.mock.calls.filter(([ad]) => ad === 'daveti_reddet')).toEqual([['daveti_reddet', { p_davet: 'd1' }]]);
    expect(result.current.bekleyen).toBeNull();
    expect(qc.getQueryData<GelenDavet[]>(DAVETLERIM)).toEqual([]);
    expect(mockOlay).not.toHaveBeenCalled();
  });

  it('Katıl: davete_katil, davet_katildi olayı, seyahatin içi "Katıldın" çekmecesiyle', async () => {
    const { result } = renderHook(() => useDavetEylemleri(jest.fn()), { wrapper: sarmal(qc) });
    await waitFor(() => expect(result.current.davetler).toHaveLength(1));
    await act(() => result.current.katil(urla));
    expect(mockRpc).toHaveBeenCalledWith('davete_katil', { p_davet: 'd1' });
    expect(mockOlay).toHaveBeenCalledWith('davet_katildi', 't1', { kanal: 'app', kaynak: 'uygulama_ici' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 't1', katildin: '1', davetEden: 'Ayşe' } });
  });

  it('Katıl: davet artık geçerli değilse kısa bildirim, gezi açılmaz', async () => {
    const bildirim = jest.fn();
    mockRpc.mockImplementation(async (ad) => (ad === 'davetlerim' ? { data: [urla], error: null } : { data: null, error: { code: 'P0002', message: 'davet yok' } }));
    const { result } = renderHook(() => useDavetEylemleri(bildirim), { wrapper: sarmal(qc) });
    await waitFor(() => expect(result.current.davetler).toHaveLength(1));
    await act(() => result.current.katil(urla));
    expect(bildirim).toHaveBeenCalledWith('Bu davet artık geçerli değil');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('#573 inceleme 3 · KK6: uygulama arka plandan dönünce kutu yeniden okunur', async () => {
    const dinleyiciler: ((d: string) => void)[] = [];
    // AppState jest'te zaten taklit; asıl işlevi saklayıp geri koy (spyOn + mockRestore taklidin dönüşünü siler).
    const asil = AppState.addEventListener;
    AppState.addEventListener = ((_t: string, f: (d: string) => void) => {
      dinleyiciler.push(f);
      return { remove: () => undefined };
    }) as never;
    const { result } = renderHook(() => useDavetEylemleri(jest.fn()), { wrapper: sarmal(qc) });
    await waitFor(() => expect(result.current.davetler).toHaveLength(1));
    const once = mockRpc.mock.calls.filter(([ad]) => ad === 'davetlerim').length;
    await act(async () => dinleyiciler.forEach((f) => f('active')));
    await waitFor(() => expect(mockRpc.mock.calls.filter(([ad]) => ad === 'davetlerim').length).toBeGreaterThan(once));
    AppState.addEventListener = asil;
  });

  it('#573 inceleme 10: reddi bekleyen davet öbür ekranda yenilemede de görünmez; Geri al ikisinde de geri koyar', async () => {
    const ana = renderHook(() => useDavetEylemleri(jest.fn()), { wrapper: sarmal(qc) });
    const gezilerim = renderHook(() => useDavetEylemleri(jest.fn()), { wrapper: sarmal(qc) });
    await waitFor(() => expect(gezilerim.result.current.davetler).toHaveLength(1));
    act(() => ana.result.current.reddet(urla));
    await act(async () => {
      await gezilerim.result.current.yenile();
    });
    expect(qc.getQueryData<GelenDavet[]>(DAVETLERIM)).toHaveLength(1);
    expect(gezilerim.result.current.davetler).toHaveLength(0);
    expect(gezilerim.result.current.bekleyen).toBeNull();
    act(() => ana.result.current.geriAl());
    expect(gezilerim.result.current.davetler).toHaveLength(1);
    expect(ana.result.current.davetler).toHaveLength(1);
  });

  it('#573 inceleme 11: daveti_reddet düşerse bir kez "Güncellenemedi", kutu yeniden okunur', async () => {
    const bildirim = jest.fn();
    mockRpc.mockImplementation(async (ad) => (ad === 'davetlerim' ? { data: [urla], error: null } : { data: null, error: { message: 'ağ' } }));
    const { result } = renderHook(() => useDavetEylemleri(bildirim), { wrapper: sarmal(qc) });
    await waitFor(() => expect(result.current.davetler).toHaveLength(1));
    jest.useFakeTimers();
    act(() => result.current.reddet(urla));
    await act(async () => {
      jest.advanceTimersByTime(GERI_CEVIR_MS);
    });
    // Sorgu bildirimlerinin (react-query toplu bildirim zamanlayıcısı) sahte saatte kalanlarını boşalt.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        jest.runOnlyPendingTimers();
      });
    }
    jest.useRealTimers();
    await waitFor(() => expect(bildirim).toHaveBeenCalledWith('Güncellenemedi'));
    expect(bildirim).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.davetler).toHaveLength(1));
  });

  it('KK1: davet_gonder kişileri tek çağrıda gönderir (#574 kullanır)', async () => {
    const { result } = renderHook(() => useDavetGonder(), { wrapper: sarmal(qc) });
    let n = -1;
    await act(async () => {
      n = await result.current.mutateAsync({ tripId: 't1', kisiler: ['b', 'c'] });
    });
    expect(n).toBe(2);
    expect(mockRpc).toHaveBeenCalledWith('davet_gonder', { p_trip: 't1', p_kisiler: ['b', 'c'] });
  });
});
