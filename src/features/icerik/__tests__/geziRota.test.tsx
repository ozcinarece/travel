// #192 KK8: önerilen gezinin gerçek yolu bir kez hesaplanır — ilk açılışta gün başına tek `gezi-rota` çağrısı (sunucu günü tek
// Routes isteğinde hesaplayıp tabloya yazar), sonraki açılışlar tablodan okur (Google isteği yok). Supabase sahte: tablo bellekte,
// `gezi-rota` sunucuyu taklit eder (tabloya yazar, Google isteğini sayar).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { GeziDuragi } from '@/lib/tipler';

import { gunTamMi, useGeziRotasi, type GeziRotaBacagi } from '../geziRota';

const mockDurum = { tablo: [] as (GeziRotaBacagi & { gezi_gun_id: string })[], invoke: 0, google: 0, hata: false };
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      let gunId = '';
      const zincir = {
        select: () => zincir,
        eq: (_s: string, v: string) => {
          gunId = v;
          return zincir;
        },
        then: (coz: (v: unknown) => unknown) => Promise.resolve({ data: mockDurum.tablo.filter((r) => r.gezi_gun_id === gunId), error: null }).then(coz),
      };
      return zincir;
    },
    functions: {
      invoke: async (_ad: string, { body }: { body: { gezi_gun_id: string } }) => {
        mockDurum.invoke++;
        if (mockDurum.hata) return { data: null, error: new Error('502') };
        // Sunucu: gün tek istekte (computeRoutes, ara noktalı) hesaplanır ve yazılır.
        mockDurum.google++;
        const duraklar = mockGunler[body.gezi_gun_id];
        const satirlar = duraklar.slice(1).map((d, i) => ({
          gezi_gun_id: body.gezi_gun_id,
          kimden_durak_id: duraklar[i].id,
          kime_durak_id: d.id,
          mod: 'WALK' as const,
          polyline: '_p~iF~ps|U_ulLnnqC',
          saniye: 600,
          metre: 800,
          arac_saniye: null,
          arac_metre: null,
          arac_polyline: null,
          fetched_at: new Date().toISOString(),
        }));
        mockDurum.tablo = [...mockDurum.tablo.filter((r) => r.gezi_gun_id !== body.gezi_gun_id), ...satirlar];
        return { data: { bacaklar: satirlar }, error: null };
      },
    },
  },
}));

const durak = (id: string, sira: number): GeziDuragi => ({ id, gezi_gun_id: 'G', sira, place_id: null, ad: id, kategori: 'museum', sure_dk: 60, lat: 39.7 + sira / 100, lng: 30.5 });
const mockGunler: Record<string, GeziDuragi[]> = {
  G1: [durak('a', 1), durak('b', 2), durak('c', 3), durak('d', 4)],
  G2: [durak('e', 1), durak('f', 2)],
};
const gun = (id: string) => ({ id, gezi_duraklari: mockGunler[id] });

/** Sorgunun 24 sa'lik gc zamanlayıcısı jest'i açık tutmasın: her testten sonra istemciler boşaltılır. */
const istemciler: QueryClient[] = [];
function sarmalayici() {
  const qc = new QueryClient();
  istemciler.push(qc);
  const Sarmal = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return Sarmal;
}

// Kök düzeyde: Testing Library'nin kendi temizliğinden (kancalar kalkar, gözlemcisiz sorgu gc zamanlayıcısı kurar) sonra çalışır.
afterEach(() => {
  istemciler.splice(0).forEach((qc) => qc.clear());
});

/** Her "açılış" yeni bir uygulama oturumu: React Query belleği boş. */
function ac(gunId: string) {
  return renderHook(() => useGeziRotasi(gun(gunId)), { wrapper: sarmalayici() });
}

describe('#192 gezi rotası önbelleği', () => {
  beforeEach(() => {
    mockDurum.tablo = [];
    mockDurum.invoke = 0;
    mockDurum.google = 0;
    mockDurum.hata = false;
  });

  it('KK8: ilk açılış gün başına 1 hesap isteği; ikinci açılış (başka kullanıcı / yeni oturum) 0 Google isteği', async () => {
    const ilk = ac('G1');
    await waitFor(() => expect(ilk.result.current.rotalar.size).toBe(3));
    expect(mockDurum.invoke).toBe(1);
    expect(mockDurum.google).toBe(1);
    ilk.unmount();

    const ikinci = ac('G1');
    await waitFor(() => expect(ikinci.result.current.rotalar.size).toBe(3));
    expect(mockDurum.invoke).toBe(1);
    expect(mockDurum.google).toBe(1);
    expect(ikinci.result.current.rotalar.get('a>b')?.saniye).toBe(600);
    ikinci.unmount();

    // Başka gün kendi hesabını yapar (o gün için yine tek istek).
    const diger = ac('G2');
    await waitFor(() => expect(diger.result.current.rotalar.size).toBe(1));
    expect(mockDurum.google).toBe(2);
  });

  it('KK6: 30 günden eski bacak varsa gün yeniden hesaplanır', async () => {
    const eski = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    mockDurum.tablo = [{ gezi_gun_id: 'G2', kimden_durak_id: 'e', kime_durak_id: 'f', mod: 'WALK', polyline: 'x', saniye: 1, metre: 1, arac_saniye: null, arac_metre: null, arac_polyline: null, fetched_at: eski }];
    const k = ac('G2');
    await waitFor(() => expect(k.result.current.rotalar.get('e>f')?.saniye).toBe(600));
    expect(mockDurum.google).toBe(1);
  });

  it('tek duraklı günde istek yok; hesap hatasında harita kuş uçuşunda kalır (boş rotalar)', async () => {
    const sarmal = sarmalayici();
    const tek = renderHook(() => useGeziRotasi({ id: 'G3', gezi_duraklari: [durak('z', 1)] }), { wrapper: sarmal });
    expect(tek.result.current.yukleniyor).toBe(false);
    expect(mockDurum.invoke).toBe(0);

    mockDurum.hata = true;
    const h = renderHook(() => useGeziRotasi(gun('G1')), { wrapper: sarmal });
    // Kancada bir yeniden deneme var (retry: 1, ~1 sn).
    await waitFor(() => expect(h.result.current.yukleniyor).toBe(false), { timeout: 4000 });
    expect(h.result.current.rotalar.size).toBe(0);
    expect(mockDurum.invoke).toBe(2);
    expect(mockDurum.google).toBe(0);
  });

  it('gunTamMi: bütün ardışık çiftler taze olmalı (sıra değişince eski çift sayılmaz)', () => {
    const simdi = Date.parse('2026-10-14T00:00:00Z');
    const satir = (k: string, z: string, gun = 1) =>
      ({ kimden_durak_id: k, kime_durak_id: z, fetched_at: new Date(simdi - gun * 24 * 60 * 60 * 1000).toISOString() }) as GeziRotaBacagi;
    const d = mockGunler.G1;
    expect(gunTamMi(d, [satir('a', 'b'), satir('b', 'c'), satir('c', 'd')], simdi)).toBe(true);
    expect(gunTamMi(d, [satir('a', 'b'), satir('b', 'c'), satir('c', 'd', 31)], simdi)).toBe(false);
    expect(gunTamMi(d, [satir('a', 'c'), satir('c', 'b'), satir('b', 'd')], simdi)).toBe(false);
  });
});
