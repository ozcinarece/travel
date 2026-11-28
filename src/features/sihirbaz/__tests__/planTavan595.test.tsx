// #595: Planı kur saat isteğine tavan (15), önizleme aynı kuralla, önbellek dolunca uyarı yeniden çizilir.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { planiHesapla, planOnceliginiOku, SAAT_TAVANI, usePlanOnizlemeOnceligi } from '@/features/sihirbaz/planUygula';
import { hafifOnbellek, useSaatOnbellegi, type HafifYer } from '@/features/yerler/api';
import { HafifOnbellek } from '@/features/yerler/hafifOnbellek';
import { t } from '@/i18n';
import type { Gun, Mekan } from '@/lib/tipler';
import type { Periyot } from '@/schedule/acilis';

const mockVeri: Record<string, unknown[]> = {};
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tablo: string) => {
      const sonuc = () => Promise.resolve({ data: mockVeri[tablo] ?? [], error: null });
      const q: Record<string, unknown> = {};
      for (const yontem of ['select', 'eq', 'in']) q[yontem] = () => q;
      q.maybeSingle = () => Promise.resolve({ data: (mockVeri[tablo] ?? [])[0] ?? null, error: null });
      q.then = (c: (v: unknown) => unknown, h?: (e: unknown) => unknown) => sonuc().then(c, h);
      return q;
    },
  },
}));

const mekan = (i: number): Mekan =>
  ({ id: `m${i}`, trip_id: 't', place_id: `P${i}`, primary_type: 'museum', lat: 39.76 + i * 0.001, lng: 30.52, google_fetched_at: '', default_minutes: 120, added_by: null, note: null, created_at: '' }) as Mekan;
/** Pazartesi kapalı: Sal–Paz 09:00–17:00. */
const pztKapali: Periyot[] = [0, 2, 3, 4, 5, 6].map((gun) => ({ gun, ac: '09:00', kapaGun: gun, kapa: '17:00' }));
const yer = (id: string, periyotlar: Periyot[] | null = pztKapali) => ({ place_id: id, ad: id, lat: 0, lng: 0, primary_type: null, tz: null, periyotlar }) as unknown as HafifYer;

beforeEach(() => {
  hafifOnbellek.temizle();
  for (const k of Object.keys(mockVeri)) delete mockVeri[k];
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('#595 KK1 saat isteğine tavan', () => {
  it('40 yerde en çok 15 yer için saat istenir; sıra önce oy, sonra il sırası', async () => {
    expect(SAAT_TAVANI).toBe(15);
    const mekanlar = Array.from({ length: 40 }, (_, i) => mekan(i));
    // m39 iki oy, m38 bir oy; il listesinde P30 (sıra 1) ve P20 (sıra 2).
    mockVeri.oylar = [{ mekan: 'm39' }, { mekan: 'm39' }, { mekan: 'm38' }];
    mockVeri.il_oneriler = [
      { place_id: 'P20', sira: 2 },
      { place_id: 'P30', sira: 1 },
    ];
    const casus = jest.spyOn(hafifOnbellek, 'getirHepsi').mockImplementation(async (ids) => Object.fromEntries(ids.map((id) => [id, yer(id)])));
    const o = await planOnceliginiOku('t', mekanlar, [], true, { ilSlug: 'eskisehir' });
    expect(casus).toHaveBeenCalledTimes(1);
    const istenen = casus.mock.calls[0][0];
    expect(istenen).toHaveLength(15);
    expect(istenen.slice(0, 4)).toEqual(['P39', 'P38', 'P30', 'P20']);
    expect(istenen.slice(4)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10']);
    // Kalan 25 yerde saat yok → kural uygulanmaz.
    expect(o.saatler?.size).toBe(15);
    expect(o.saatler?.has('P11')).toBe(false);
  });

  it('önbellekte saati olan yer sayıya girmez ve istenmez; saati kullanılır', async () => {
    const mekanlar = Array.from({ length: 30 }, (_, i) => mekan(i));
    hafifOnbellek.yaz([0, 1, 2, 3, 4].map((i) => yer(`P${i}`)), 'saatli');
    const casus = jest.spyOn(hafifOnbellek, 'getirHepsi').mockImplementation(async (ids) => Object.fromEntries(ids.map((id) => [id, yer(id)])));
    const o = await planOnceliginiOku('t', mekanlar, [], true, { ilSlug: null });
    const istenen = casus.mock.calls[0][0];
    expect(istenen).toHaveLength(15);
    expect(istenen).not.toContain('P0');
    expect(istenen[0]).toBe('P5');
    expect(o.saatler?.size).toBe(20);
    expect(o.saatler?.get('P0')).toEqual(pztKapali);
  });

  it('hepsi önbellekteyse istek yok; süre aşılırsa önbellektekiler yine kullanılır', async () => {
    const mekanlar = [mekan(1), mekan(2)];
    hafifOnbellek.yaz([yer('P1')], 'saatli');
    const casus = jest.spyOn(hafifOnbellek, 'getirHepsi').mockReturnValue(new Promise(() => undefined));
    const o = await planOnceliginiOku('t', mekanlar, [], true, { ilSlug: null, saatSuresiMs: 20 });
    expect(casus.mock.calls[0][0]).toEqual(['P2']);
    expect(o.saatler?.get('P1')).toEqual(pztKapali);
    expect(o.saatler?.has('P2')).toBe(false);
    casus.mockClear();
    hafifOnbellek.yaz([yer('P2')], 'saatli');
    await planOnceliginiOku('t', mekanlar, [], true, { ilSlug: null });
    expect(casus).not.toHaveBeenCalled();
  });
});

describe('#595 KK2 metinler oyları da söyler', () => {
  it('sihirbaz ve Gezi adımı', () => {
    expect(t('sihirbaz.onerilenler.alt')).toBe('Seçtiklerini grubun oylarına ve yakınlığa göre günlere biz dağıtalım.');
    expect(t('geziSayfasi.adim.planKurAlt', { n: 4 })).toBe('Listendeki 4 mekanı günlere oylara ve yakınlığa göre dağıtalım');
  });
});

describe('#595 KK3 önizleme = Planı kur (aynı girdi)', () => {
  const sarici = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Sarici = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return Sarici;
  };
  // 2026-11-30 Pazartesi, 12-01 Salı; günde 240 dk → 2 gün × 2 yer sığar.
  const gunler = [
    { id: 'g1', trip_id: 't', index: 1, date: '2026-11-30' },
    { id: 'g2', trip_id: 't', index: 2, date: '2026-12-01' },
  ] as unknown as Gun[];

  it('oy, il sırası ve önbellekteki kapalı gün önizlemede de aynı; önizleme Google\'a istek atmaz', async () => {
    const mekanlar = Array.from({ length: 6 }, (_, i) => mekan(i));
    mockVeri.oylar = [{ mekan: 'm5' }, { mekan: 'm5' }, { mekan: 'm4' }];
    mockVeri.il_oneriler = [{ place_id: 'P3', sira: 1 }];
    hafifOnbellek.yaz([yer('P5'), yer('P0', null)], 'saatli');
    const casus = jest.spyOn(hafifOnbellek, 'getirHepsi');
    const { result } = renderHook(() => usePlanOnizlemeOnceligi('t', mekanlar, [], true, 'eskisehir'), { wrapper: sarici() });
    await waitFor(() => expect(result.current?.oylar).toBeDefined());
    expect(casus).not.toHaveBeenCalled();

    // Gerçek: diğerlerinin saati Google'dan "bilinmiyor" (null) gelsin → yalnız önbellektekiler kural uygular.
    casus.mockImplementation(async (ids) => Object.fromEntries(ids.map((id) => [id, yer(id, null)])));
    const gercek = await planOnceliginiOku('t', mekanlar, [], true, { ilSlug: 'eskisehir' });
    const onizleme = planiHesapla({ mekanlar, gunler, duraklar: [], oncelik: result.current });
    const plan = planiHesapla({ mekanlar, gunler, duraklar: [], oncelik: gercek });
    expect(onizleme.atanmamis.map((m) => m.id)).toEqual(plan.atanmamis.map((m) => m.id));
    expect(onizleme.gunler.map((g) => g.mekanlar.map((m) => m.id))).toEqual(plan.gunler.map((g) => g.mekanlar.map((m) => m.id)));
    // Pazartesi kapalı P5 (en çok oy) Salı'ya düşer; önceliksiz hesap bunu bilmez.
    expect(plan.gunler.find((g) => g.gunId === 'g2')?.mekanlar.map((m) => m.id)).toContain('m5');
  });

  it('önbelleğe saat girince önizleme yeniden hesaplanır', async () => {
    const mekanlar = [mekan(1)];
    const { result } = renderHook(() => usePlanOnizlemeOnceligi('t', mekanlar, [], true, null), { wrapper: sarici() });
    expect(result.current?.saatler).toBeUndefined();
    act(() => hafifOnbellek.yaz([yer('P1')], 'saatli'));
    expect(result.current?.saatler?.get('P1')).toEqual(pztKapali);
  });
});

describe('#595 KK4 önbellek dolunca yeniden çizim', () => {
  it('saat yazılınca aboneler haber alır; fotoğraf ve puan yazımı haber vermez', () => {
    const o = new HafifOnbellek(async () => []);
    const dinleyici = jest.fn();
    const birak = o.abone(dinleyici);
    const once = o.saatAnlik();
    o.yaz([yer('P1')], 'foto');
    o.yaz([yer('P1')], 'hafif');
    expect(dinleyici).not.toHaveBeenCalled();
    o.yaz([yer('P1')], 'saatli');
    expect(dinleyici).toHaveBeenCalledTimes(1);
    expect(o.saatAnlik()).toBe(once + 1);
    birak();
    o.yaz([yer('P1')], 'saatliFoto');
    expect(dinleyici).toHaveBeenCalledTimes(1);
  });

  it('useSaatOnbellegi önbelleğe saat girince yeniden çizer', () => {
    let cizim = 0;
    renderHook(() => {
      cizim += 1;
      return useSaatOnbellegi();
    });
    const once = cizim;
    act(() => hafifOnbellek.yaz([yer('P9')], 'saatli'));
    expect(cizim).toBe(once + 1);
  });
});
