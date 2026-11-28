// #580 KK1–KK6 (kanvas `Dalga1_DurakCekmecesi` · `Dalga1_GecikmeBandi` · `Dalga1_GeziModu`): Gezi sayfasında Bugünün planı
// satırları dokunulur, durak çekmecesi, gecikme bandı. Düzen bugunYerEkle579.test.tsx ile aynı.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { t } from '@/i18n';
import { durakCekmecesi } from '@/theme';

import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { hafifOnbellek } from '@/features/yerler/api';
import { tarihEkle } from '@/lib/takvim';
import { yerelSaatDk, yerelTarih } from '@/lib/zaman';

import GeziEkrani from '../../../app/seyahat/[id]/(sekmeler)/gezi';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
// Sentry içe aktarılınca zamanlayıcı kurar (jest kapanmaz).
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));
jest.mock('@/lib/oturum', () => ({
  useOturum: () => ({
    session: { user: { id: 'ben', is_anonymous: false } },
    hazir: true,
    hesapli: true,
  }),
}));
// #243: bağlantı durumu testte elle verilir.
let mockCevrimdisi = false;
jest.mock('@/lib/baglanti', () => ({ useCevrimdisi: () => mockCevrimdisi }));
// #580 KK4: gecikme yalnız konum açıkken (Plan'daki hesap).
let mockKonum: { lat: number; lng: number } | null = null;
jest.mock('@/features/konum/useKonum', () => ({
  useKonum: () => ({ konum: mockKonum, izin: mockKonum ? 'var' : 'yok' }),
  yakinDurakId: () => null,
}));
jest.mock('expo-router', () => ({
  router: {
    navigate: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  },
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
  useNavigationContainerRef: () => ({ getRootState: () => undefined }),
}));

type Tablolar = Record<string, unknown[]>;
let mockTablolar: Tablolar = {};
/** #243: bu tabloların sorgusu hiç yanıt vermez (bağlantı yok, cihazda kopya yok). */
const mockAsili = new Set<string>();
/** #580 öz-inceleme 2: `stops` yazımı hata döner. */
let mockYazimHatasi = false;
const mockSayac = {
  invoke: [] as string[],
  rpc: [] as string[],
  tablolar: [] as string[],
  yazim: [] as { tablo: string; ad: string; args: unknown[] }[],
};
/** PostgREST zincirini taklit eder: her çağrı aynı nesneyi döner; `await` tablonun satırlarını, `.single()` ilk satırı verir. */
function mockSorgu(tablo: string) {
  let tek = false;
  let yazim = false;
  const zincir: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_hedef, ad) {
        if (ad === 'then') {
          if (mockAsili.has(tablo)) return () => undefined;
          if (yazim && mockYazimHatasi && tablo === 'stops') return (coz: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'hata' } }).then(coz);
          const satirlar = mockTablolar[tablo] ?? [];
          const sonuc = tek
            ? {
                data: satirlar[0] ?? null,
                error: satirlar[0] ? null : { code: 'PGRST116' },
              }
            : { data: satirlar, error: null };
          return (coz: (v: unknown) => unknown, red: (e: unknown) => unknown) => Promise.resolve(sonuc).then(coz, red);
        }
        if (ad === 'single' || ad === 'maybeSingle') {
          return () => {
            tek = true;
            return zincir;
          };
        }
        return (...args: unknown[]) => {
          if (ad === 'update') yazim = true;
          if (ad === 'update' || ad === 'insert' || ad === 'delete' || ad === 'eq') mockSayac.yazim.push({ tablo, ad: String(ad), args });
          return zincir;
        };
      },
    },
  );
  return zincir;
}
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tablo: string) => {
      mockSayac.tablolar.push(tablo);
      return mockSorgu(tablo);
    },
    rpc: async (ad: string, args: { p_place_ids?: string[] }) => {
      mockSayac.rpc.push(ad);
      if (ad !== 'icerik_mekan_bilgileri') return { data: null, error: { message: `beklenmeyen rpc ${ad}` } };
      const db: Record<string, string> = { 'ChIJ-db-1': 'Odunpazarı Evleri' };
      return {
        data: (args.p_place_ids ?? [])
          .filter((id) => db[id])
          .map((id) => ({
            place_id: id,
            ad: db[id],
            kategori: 'tourist_attraction',
            lat: 39.77,
            lng: 30.52,
            kapak_url: null,
            foto_yol: null,
          })),
        error: null,
      };
    },
    functions: {
      invoke: async (ad: string) => {
        mockSayac.invoke.push(ad);
        return {
          data: null,
          error: { message: 'Google isteği beklenmiyordu' },
        };
      },
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => undefined,
  },
}));

const IST = 'Europe/Istanbul';
const bugun = () => yerelTarih(new Date(), IST);
const mekan = (id: string, place_id: string, primary_type: string, created_at: string) => ({
  id,
  trip_id: 't1',
  place_id,
  primary_type,
  lat: 39.77,
  lng: 30.52,
  google_fetched_at: '',
  default_minutes: 60,
  added_by: 'ben',
  note: null,
  created_at,
});
const durak = (id: string, day_id: string, place_ref: string, order_key: string) => ({
  id,
  trip_id: 't1',
  day_id,
  place_ref,
  order_key,
  minutes: 60,
  arrived_at: null,
  arrived_by: null,
  completed_at: null,
  completed_by: null,
  auto_completed: false,
  skipped: false,
});

/** Eskişehir, 3 gün; 1. günde Odunpazarı Evleri (adı DB'de) + bir restoran (adı yalnız Google'da); park güne atanmamış; otel yok. */
function fikstur(baslangic: string): Tablolar {
  return {
    trips: [
      {
        id: 't1',
        name: 'Eskişehir Gezisi',
        city_label: 'Eskişehir',
        country_code: 'TR',
        lat: 39.7767,
        lng: 30.5206,
        tz: IST,
        start_date: baslangic,
        end_date: tarihEkle(baslangic, 2),
        hotel_place_id: null,
        hotel_lat: null,
        hotel_lng: null,
        hotel_label: null,
        day_start: '09:00:00',
        day_end: '20:00:00',
        invite_token: 'davet123',
      },
    ],
    days: [1, 2, 3].map((i) => ({
      id: `g${i}`,
      trip_id: 't1',
      index: i,
      date: tarihEkle(baslangic, i - 1),
      start_time: '09:30:00',
      end_time: null,
      order_manual: false,
      start_stay_id: null,
      end_stay_id: null,
    })),
    places: [
      mekan('m1', 'ChIJ-db-1', 'tourist_attraction', '2026-10-01T00:00:00Z'),
      mekan('m2', 'ChIJ-google-2', 'restaurant', '2026-10-02T00:00:00Z'),
      mekan('m3', 'ChIJ-google-3', 'park', '2026-10-03T00:00:00Z'),
    ],
    stops: [durak('d1', 'g1', 'm1', 'a0'), durak('d2', 'g1', 'm2', 'a1')],
    stays: [],
    members: [
      {
        trip_id: 't1',
        user_id: 'ben',
        guest: false,
        display_name: 'Ece',
        role: 'owner',
        joined_at: '2026-10-01T00:00:00Z',
      },
      {
        trip_id: 't1',
        user_id: 'ayse',
        guest: false,
        display_name: 'Ayşe',
        role: 'member',
        joined_at: '2026-10-02T00:00:00Z',
      },
    ],
    profiles: [],
    oylar: [
      { mekan: 'm3', kullanici: 'ayse' },
      { mekan: 'm3', kullanici: 'ben' },
      { mekan: 'm1', kullanici: 'ayse' },
    ],
    sehirler: [
      {
        id: 's1',
        ad: 'Eskişehir',
        slug: 'eskisehir',
        kapak_url: null,
        lat: 39.7767,
        lng: 30.5206,
        ozet: null,
        geziler: [{ count: 1 }],
      },
    ],
    yerler: [
      {
        id: 'y1',
        sehir_id: 's1',
        place_id: 'ChIJ-rehber-1',
        ad: 'Eti Arkeoloji Müzesi',
        kategori: 'museum',
        rehber_md: null,
        kapak_url: null,
        one_cikan_sira: 1,
        lat: 39.78,
        lng: 30.51,
      },
      {
        id: 'y2',
        sehir_id: 's1',
        place_id: 'ChIJ-db-1',
        ad: 'Odunpazarı Evleri',
        kategori: 'tourist_attraction',
        rehber_md: null,
        kapak_url: null,
        one_cikan_sira: 2,
        lat: 39.77,
        lng: 30.52,
      },
    ],
    geziler: [
      {
        id: 'gz1',
        sehir_id: 's1',
        baslik: "Eskişehir'de bir hafta sonu",
        slug: 'eskisehir-hafta-sonu',
        kapak_url: null,
        ozet: null,
        yazar_ad: 'Tripmate ekibi',
        gun_sayisi: 2,
        mekan_sayisi: 11,
        sira: 1,
        created_at: '',
        sehirler: { ad: 'Eskişehir', slug: 'eskisehir' },
      },
    ],
  };
}

const fetchSahte = jest.fn(async () => {
  throw new Error('ağ isteği beklenmiyordu');
});
const eskiFetch = globalThis.fetch;
/** Çizilen ağaçlar ve istemcileri: söküldükten sonra önbellek temizlenir (24 sa gc zamanlayıcıları jest'i açık tutmasın). */
const acik: { unmount: () => void; qc: QueryClient }[] = [];
beforeEach(() => {
  mockSayac.invoke = [];
  mockSayac.rpc = [];
  mockSayac.tablolar = [];
  mockSayac.yazim = [];
  mockKonum = null;
  mockYazimHatasi = false;
  fetchSahte.mockClear();
  globalThis.fetch = fetchSahte as unknown as typeof fetch;
  hafifOnbellek.temizle();
  mockCevrimdisi = false;
  mockAsili.clear();
});
afterEach(() => {
  while (acik.length) {
    const r = acik.pop()!;
    r.unmount();
    r.qc.clear();
  }
  globalThis.fetch = eskiFetch;
});

function ciz() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const sarmal = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SeyahatIdSaglayici id="t1">{children}</SeyahatIdSaglayici>
    </QueryClientProvider>
  );
  const r = render(<GeziEkrani />, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}
const sakinles = async (qc: QueryClient) => {
  await waitFor(() => expect(qc.isFetching()).toBe(0));
  await new Promise((c) => setTimeout(c, 10));
  await waitFor(() => expect(qc.isFetching()).toBe(0));
};

/** Bütün günler şu andan `oncesiDk` önce başlar (seyahat dilimiyle). */
const baslat = (oncesiDk = 5) => {
  const dk = Math.max(0, yerelSaatDk(new Date(), IST) - oncesiDk);
  for (const g of mockTablolar.days as { start_time: string }[]) g.start_time = `${String(Math.floor(dk / 60)).padStart(2, '0')}:${String(dk % 60).padStart(2, '0')}:00`;
};
const dakikaOnce = (dk: number) => new Date(Date.now() - dk * 60_000).toISOString();
const ODUN = 'Odunpazarı Evleri';

async function hazir(r: ReturnType<typeof ciz>) {
  await waitFor(() => r.getByText('Eskişehir Gezisi'));
  await sakinles(r.qc);
}
const satiriAc = (r: ReturnType<typeof ciz>, ad: string) => fireEvent.press(r.getByRole('button', { name: new RegExp(`^${ad}, `) }));
const minYukseklik = (el: { props: { [ad: string]: unknown } }) => {
  const st = el.props.style;
  return StyleSheet.flatten(typeof st === 'function' ? st({ pressed: false }) : st).minHeight as number;
};
const durakYazimi = () => mockSayac.yazim.findIndex((y) => y.tablo === 'stops' && y.ad === 'update');

describe('#580 KK1 · KK6 Bugünün planı satırları ve çekmece', () => {
  it('satır dokunulur (≥ 44 pt); çekmece: ad + "Şimdi · saat · süre", Gezdim, Yol tarifi, Atla, Yarına taşı (gün adı), Çıkar (#B42318); hepsi ≥ 44 pt', async () => {
    mockTablolar = fikstur(bugun());
    baslat();
    const r = ciz();
    await hazir(r);
    const satir = r.getByRole('button', { name: new RegExp(`^${ODUN}, `) });
    expect(minYukseklik(satir)).toBeGreaterThanOrEqual(44);
    satiriAc(r, ODUN);
    await waitFor(() => r.getByText(/^Şimdi · \d\d:\d\d · 1 sa$/));
    expect(r.getAllByText(ODUN).length).toBeGreaterThan(1);
    const gezdim = r.getByRole('button', { name: t('durakCekmecesi.gezdim') });
    expect(minYukseklik(gezdim)).toBeGreaterThanOrEqual(44);
    const yarin = r.getByRole('button', {
      name: new RegExp(`^${t('durakCekmecesi.yarinaTasi')}, .+, günün sonuna$`),
    });
    expect(yarin.props.accessibilityState).toEqual({ disabled: false });
    expect(minYukseklik(yarin)).toBeGreaterThanOrEqual(44);
    for (const ad of [t('durakCekmecesi.yolTarifi'), t('durakCekmecesi.atla'), t('durakCekmecesi.cikar')]) {
      // Çekmece en sonda çizilir (Yol tarifi Şimdi bölümünde de var).
      expect(minYukseklik(r.getAllByRole('button', { name: new RegExp(`^${ad}`) }).at(-1)!)).toBeGreaterThanOrEqual(44);
    }
    expect(StyleSheet.flatten(r.getByText(t('durakCekmecesi.cikar')).props.style).color).toBe(durakCekmecesi.cikar);
  });

  it('KK2: Gezdim durağı gezildi yazar (completed_at + ben)', async () => {
    mockTablolar = fikstur(bugun());
    baslat();
    const r = ciz();
    await hazir(r);
    satiriAc(r, ODUN);
    fireEvent.press(await waitFor(() => r.getByRole('button', { name: t('durakCekmecesi.gezdim') })));
    await waitFor(() => expect(durakYazimi()).toBeGreaterThan(-1));
    const i = durakYazimi();
    expect(mockSayac.yazim[i].args[0]).toEqual(
      expect.objectContaining({
        completed_by: 'ben',
        auto_completed: false,
        completed_at: expect.any(String),
      }),
    );
    expect(mockSayac.yazim[i + 1].args).toEqual(['id', 'd1']);
  });

  it('KK2: gezilmiş durakta düğme "Gezilmedi say" ve tamamlanmayı geri alır; Şimdi sıradaki durakta', async () => {
    mockTablolar = fikstur(bugun());
    baslat(90);
    (mockTablolar.stops[0] as { completed_at: string | null }).completed_at = dakikaOnce(20);
    const r = ciz();
    await hazir(r);
    expect(r.getByText(/^ŞİMDİ/)).toBeTruthy();
    satiriAc(r, ODUN);
    fireEvent.press(await waitFor(() => r.getByRole('button', { name: t('durakCekmecesi.gezilmediSay') })));
    expect(r.queryByRole('button', { name: t('durakCekmecesi.gezdim') })).toBeNull();
    await waitFor(() => expect(durakYazimi()).toBeGreaterThan(-1));
    expect(mockSayac.yazim[durakYazimi()].args[0]).toEqual({
      completed_at: null,
      completed_by: null,
      auto_completed: false,
    });
  });

  it('KK3: son günde Yarına taşı pasif, alt satır "Son gün"', async () => {
    mockTablolar = fikstur(tarihEkle(bugun(), -2));
    mockTablolar.stops = [durak('d1', 'g3', 'm1', 'a0'), durak('d2', 'g3', 'm2', 'a1')];
    baslat();
    const r = ciz();
    await hazir(r);
    satiriAc(r, ODUN);
    const yarin = await waitFor(() =>
      r.getByRole('button', {
        name: `${t('durakCekmecesi.yarinaTasi')}, ${t('durakCekmecesi.sonGun')}`,
      }),
    );
    expect(yarin.props.accessibilityState).toEqual({ disabled: true });
  });

  it('KK1: Yarına taşı ertesi günün sonuna atar', async () => {
    mockTablolar = fikstur(bugun());
    baslat();
    const r = ciz();
    await hazir(r);
    satiriAc(r, ODUN);
    fireEvent.press(
      await waitFor(() =>
        r.getByRole('button', {
          name: new RegExp(`^${t('durakCekmecesi.yarinaTasi')}`),
        }),
      ),
    );
    await waitFor(() => expect(durakYazimi()).toBeGreaterThan(-1));
    expect(mockSayac.yazim[durakYazimi()].args[0]).toEqual(expect.objectContaining({ day_id: 'g2', completed_at: null }));
  });

  it('KK1: Çıkar mevcut "Geri al" bandını gösterir; satır gizlenir, Geri al geri getirir', async () => {
    mockTablolar = fikstur(bugun());
    baslat();
    const r = ciz();
    await hazir(r);
    satiriAc(r, ODUN);
    fireEvent.press(await waitFor(() => r.getByRole('button', { name: t('durakCekmecesi.cikar') })));
    await waitFor(() => r.getByText(t('listem.gundenCikti', { ad: ODUN, n: 1 })));
    expect(r.queryByRole('button', { name: new RegExp(`^${ODUN}, `) })).toBeNull();
    fireEvent.press(r.getByRole('button', { name: t('listem.geriAl') }));
    await waitFor(() => r.getByRole('button', { name: new RegExp(`^${ODUN}, `) }));
    expect(mockSayac.yazim.some((y) => y.tablo === 'places' && y.ad === 'delete')).toBe(false);
  });
});

describe('#580 öz-inceleme', () => {
  it('1: kendiliğinden geçilmiş durakta (kayıt yok) düğme "Gezdim"; şimdinin değil planlanan ayrılışın anını yazar', async () => {
    mockTablolar = fikstur(bugun());
    // Gün 3 sa önce başladı; 1. durak (60 dk) çoktan bitti, kayıt yok → program "gecildi" (otomatik) sayar.
    baslat(180);
    const r = ciz();
    await hazir(r);
    satiriAc(r, ODUN);
    expect(r.queryByRole('button', { name: t('durakCekmecesi.gezilmediSay') })).toBeNull();
    fireEvent.press(await waitFor(() => r.getByRole('button', { name: t('durakCekmecesi.gezdim') })));
    await waitFor(() => expect(durakYazimi()).toBeGreaterThan(-1));
    const yazilan = mockSayac.yazim[durakYazimi()].args[0] as { completed_at: string };
    // Planlanan ayrılış ≈ başlangıç + 60 dk ≈ 2 sa önce; şimdinin saati değil.
    expect(Date.now() - Date.parse(yazilan.completed_at)).toBeGreaterThan(60 * 60_000);
    expect(mockSayac.yazim[durakYazimi() + 1].args).toEqual(['id', 'd1']);
  });

  it('2: Geri al bandı açıkken gelen hata kaybolmaz; bant kapanınca gösterilir, silme kesinleşmez', async () => {
    mockTablolar = fikstur(bugun());
    baslat(90);
    (mockTablolar.stops[0] as { completed_at: string | null }).completed_at = dakikaOnce(20);
    mockYazimHatasi = true;
    const r = ciz();
    await hazir(r);
    satiriAc(r, ODUN);
    fireEvent.press(await waitFor(() => r.getByRole('button', { name: t('durakCekmecesi.cikar') })));
    await waitFor(() => r.getByText(t('listem.gundenCikti', { ad: ODUN, n: 1 })));
    // Bant açıkken kalan durağın çekmecesinden Atla → yazım hatası ("Kaydedilemedi").
    const satir = r.getAllByRole('button').find((b) => b.props.accessibilityHint === t('durakCekmecesi.satirIpucu'))!;
    fireEvent.press(satir);
    fireEvent.press(await waitFor(() => r.getByRole('button', { name: t('durakCekmecesi.atla') })));
    await waitFor(() => expect(durakYazimi()).toBeGreaterThan(-1));
    // Normal bildirim süresinden (2,8 sn) uzun bekle: bant hâlâ açık, silme kesinleşmedi.
    await new Promise((c) => setTimeout(c, 3200));
    expect(r.getByText(t('listem.gundenCikti', { ad: ODUN, n: 1 }))).toBeTruthy();
    expect(mockSayac.yazim.some((y) => y.tablo === 'places' && y.ad === 'delete')).toBe(false);
    fireEvent.press(r.getByRole('button', { name: t('listem.geriAl') }));
    await waitFor(() => r.getByText(t('geziSayfasi.kaydedilemedi')));
  }, 15000);
});

describe('#580 KK4 · KK5 gecikme bandı', () => {
  // 1. durak 40 dk önce gezildi, sıradaki (aynı yerde) planda hemen ardından; konum ~2 km uzakta → 15 dk'dan çok geride.
  const geride = () => {
    mockTablolar = fikstur(bugun());
    baslat(90);
    (mockTablolar.stops[0] as { completed_at: string | null }).completed_at = dakikaOnce(40);
    mockKonum = { lat: 39.79, lng: 30.52 };
  };

  it('Şimdi\'nin üstünde bant: "N dk gerideyiz" (#8A3A00), Saatleri kaydır ≥ 44 pt; alt satır "Planda … · şimdi …\'te varırsın"', async () => {
    geride();
    const r = ciz();
    await hazir(r);
    const metin = r.getByText(/^\d+ dk gerideyiz$/);
    expect(Number(/^(\d+)/.exec(String(metin.props.children))![1])).toBeGreaterThan(15);
    expect(StyleSheet.flatten(metin.props.style).color).toBe(durakCekmecesi.bantMetin);
    expect(minYukseklik(r.getByRole('button', { name: t('durakCekmecesi.saatleriKaydir') }))).toBeGreaterThanOrEqual(44);
    expect(r.getByText(/^Planda \d\d:\d\d · şimdi \d\d:\d\d'(da|de|ta|te) varırsın$/)).toBeTruthy();
    const json = JSON.stringify(r.toJSON());
    expect(json.indexOf('gerideyiz')).toBeLessThan(json.indexOf('ŞİMDİ'));
  });

  it("Saatleri kaydır Plan'daki kaydırmayı yazar (önceki durağın ayrılışı) ve bant kalkar", async () => {
    geride();
    const r = ciz();
    await hazir(r);
    fireEvent.press(r.getByRole('button', { name: t('durakCekmecesi.saatleriKaydir') }));
    expect(r.queryByText(/dk gerideyiz$/)).toBeNull();
    await waitFor(() => expect(durakYazimi()).toBeGreaterThan(-1));
    const i = durakYazimi();
    expect(mockSayac.yazim[i].args[0]).toEqual(
      expect.objectContaining({
        completed_by: 'ben',
        auto_completed: false,
        completed_at: expect.any(String),
      }),
    );
    expect(mockSayac.yazim[i + 1].args).toEqual(['id', 'd1']);
  });

  it('konum yoksa bant yok, alt satır olağan', async () => {
    geride();
    mockKonum = null;
    const r = ciz();
    await hazir(r);
    expect(r.queryByText(/dk gerideyiz$/)).toBeNull();
    expect(r.queryByText(/^Planda/)).toBeNull();
  });
});
