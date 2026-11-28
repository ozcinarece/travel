// #599 (#598 küçükleri): Yer ekle bugün bağlamı takibi. KK1 Geri al hatası "Geri alınamadı."; KK2 Listem'in Geri al bandı açıkken
// bugüne ekleme bandı kapatır (çıkarma kesinleşir), tek bant; KK4 sekme açıkken gece yarısı geçince hap yeni günü gösterir;
// KK5 bugünün sırası `days`'te yoksa hap yok, ekleme listeye, bildirim "{ad} listene eklendi"; KK6 art arda iki ekleme aynı güne
// farklı `order_key` alır. Düzen #579 testiyle aynı (bugunEkle579.test.tsx).
// #621 (#618 küçükleri): KK1 Değiştir çekmecesinin saati; KK2 durak yenilemesi düşse de sıradaki "+" yeni `order_key`; KK3 aynı
// kısa bildirim iki kez → iki duyuru, süre baştan; KK6 seyahat değişince eski eklemenin bildirimi yok; KK7 bastırma yolları.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { kesfetDurumunuSifirla } from '@/features/yerler/kesfetDurumu';
import { hafifOnbellek, type HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { yonelmeEkli } from '@/lib/ek';
import { GUNLER, haftaGunu, tarihEkle } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';

import KesfetEkrani from '../../../app/seyahat/[id]/(sekmeler)/kesfet';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
let mockCevrimdisi = false;
jest.mock('@/lib/baglanti', () => ({
  useCevrimdisi: () => mockCevrimdisi,
  agHatasi: (e: unknown) => (e as { message?: string } | null)?.message === 'TypeError: Network request failed',
}));
let mockParametre: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParametre,
  useGlobalSearchParams: () => ({}),
  // #536 inceleme 4: gün bağlamı blur'da temizlenir; testte odak olayı yok.
  useFocusEffect: () => undefined,
}));

// Harita: pinler dokunulabilir satırlar (kimlik + tür).
jest.mock('@/components/harita/Harita', () => {
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Harita: ({ pinler, onPinBas }: { pinler: { id: string; tur: string }[]; onPinBas: (id: string) => void }) => (
      <View>
        {pinler.map((p) => (
          <Pressable key={p.id} testID={`pin-${p.id}`} onPress={() => onPinBas(p.id)}>
            <Text>{p.tur}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
// Mekan paneli: yalnız CTA (ekle / çıkar) ve meşgul hali.
jest.mock('@/components/mekan/MekanPaneli', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MekanPaneli: ({ icinde, mesgul, onCta, onKapat, ctaMetni }: { icinde: boolean; mesgul: boolean; onCta: () => void; onKapat: () => void; ctaMetni?: string | null }) => (
      <>
        <Pressable testID="panel-cta" onPress={onCta} accessibilityState={{ busy: mesgul }}>
          <Text>{icinde ? 'cikar' : 'ekle'}</Text>
          {ctaMetni ? <Text testID="panel-cta-metni">{ctaMetni}</Text> : null}
        </Pressable>
        <Pressable testID="panel-kapat" onPress={onKapat}>
          <Text>kapat</Text>
        </Pressable>
      </>
    ),
  };
});

// Arama: öneri listesi ve seçim (places-full) taklit edilir; seçim hatası testte ayarlanır.
let mockAramaSonuclari: { place_id: string; ana: string; ikincil: string }[] = [];
let mockSecimHatasi: unknown = null;
jest.mock('@/features/yerler/api', () => {
  const gercek = jest.requireActual<typeof import('@/features/yerler/api')>('@/features/yerler/api');
  return {
    ...gercek,
    useOneriler: () => ({ data: mockAramaSonuclari, isFetching: false, isError: false, error: null }),
    aramaSecimi: async () => {
      throw mockSecimHatasi ?? new Error('seçim beklenmiyordu');
    },
  };
});
const ONERI: HafifYer = { place_id: 'ChIJ-oneri-1', ad: 'Eti Arkeoloji Müzesi', lat: 39.78, lng: 30.48, primary_type: 'museum', tz: null, puan: 4.6, puan_sayisi: 900, acik: null, ulke_kodu: 'TR' };
let mockYakin = { hata: false, sinir: false };
// Liste kimliği sabit (ekran liste değişince çekmece durumunu sıfırlar).
const IKINCI: HafifYer = { ...ONERI, place_id: 'ChIJ-oneri-2', ad: 'Kurşunlu Külliyesi', lat: 39.79, lng: 30.5 };
// #621 KK3: adı ONERI ile aynı başka bir yer (aynı bildirim metni).
const ADASI: HafifYer = { ...ONERI, place_id: 'ChIJ-oneri-3', lat: 39.77, lng: 30.49 };
const mockYerler = [ONERI, IKINCI, ADASI];
const mockArananlar: never[] = [];
jest.mock('@/features/yerler/kesfetYukleme', () => ({
  useKesfetOnerileri: () => ({
    yerler: mockYerler,
    yukleniyor: false,
    hata: mockYakin.hata,
    sinir: mockYakin.sinir,
    sehirAlani: null,
    arananlar: mockArananlar,
    genisAlan: null,
    alanAraniyor: false,
    alandaAra: () => undefined,
  }),
  kesfetSayaci: { istek: 0, hata: 0 },
}));

// Supabase: tablolar fikstürden; `places` eklemesi bekletilebilir / hata verebilir; `olaylar` eklemesi kaydedilir.
const mockTablolar: Record<string, unknown[]> = {};
const mockEkleme: { hata: unknown; bekle: Promise<void> | null } = { hata: null, bekle: null };
const mockOlaylar: unknown[] = [];
const mockSilinen: Record<string, unknown>[] = [];
/** Günler sorgusu bekletilebilir (#579 inceleme 6). */
const mockGunKapisi: { bekle: Promise<void> | null } = { bekle: null };
const mockEklenen: { tablo: string; satir: unknown }[] = [];
/** #598: durak eklemesi (ata) hata verebilir. #599 KK6: bekletilebilir; eklenen durak `stops`'a yazılır (yeniden okumada görünsün). */
const mockDurakEkleme: { hata: unknown; bekle: Promise<void> | null } = { hata: null, bekle: null };
/** #621 KK2: durak okuması (yenileme) hata verebilir. */
const mockDurakOkuma: { hata: unknown } = { hata: null };
/** #599 KK1: silme hata verebilir. */
const mockSilme: { hata: unknown } = { hata: null };
jest.mock('@/lib/supabase', () => {
  const zincir = (tablo: string): unknown =>
    new Proxy(
      {},
      {
        get(_h, ad) {
          if (ad === 'then')
            return (coz: (v: unknown) => unknown) =>
              (tablo === 'days' && mockGunKapisi.bekle ? mockGunKapisi.bekle : Promise.resolve())
                .then(() => (tablo === 'stops' && mockDurakOkuma.hata ? { data: null, error: mockDurakOkuma.hata } : { data: [...(mockTablolar[tablo] ?? [])], error: null }))
                .then(coz);
          if (ad === 'single' || ad === 'maybeSingle')
            return () => ({ then: (coz: (v: unknown) => unknown) => Promise.resolve({ data: (mockTablolar[tablo] ?? [])[0] ?? null, error: null }).then(coz) });
          // Silme süzgeçleri (eq) toplanır; await'te kaydedilir.
          if (ad === 'delete')
            return () => {
              const suzgec: Record<string, unknown> = {};
              const c: Record<string, unknown> = {
                eq: (k: string, v: unknown) => {
                  suzgec[k] = v;
                  return c;
                },
                then: (coz: (v: unknown) => unknown) => {
                  if (mockSilme.hata) return Promise.resolve({ error: mockSilme.hata }).then(coz);
                  mockSilinen.push({ tablo, ...suzgec });
                  return Promise.resolve({ error: null }).then(coz);
                },
              };
              return c;
            };
          if (ad === 'insert')
            return async (satir: unknown) => {
              if (tablo === 'olaylar') {
                mockOlaylar.push(satir);
                return { error: null };
              }
              if (mockEkleme.bekle) await mockEkleme.bekle;
              if (tablo === 'stops' && mockDurakEkleme.bekle) await mockDurakEkleme.bekle;
              if (tablo === 'stops' && mockDurakEkleme.hata) return { error: mockDurakEkleme.hata };
              if (tablo === 'stops') (mockTablolar.stops ??= []).push({ id: `d-${mockEklenen.length}`, skipped: false, ...(satir as object) });
              mockEklenen.push({ tablo, satir });
              // Eklenen mekan listede bulunsun (listedekiMekan `places`'ın ilk satırını okur). 23505: aynı yeri az önce başkası eklemiş.
              if (tablo === 'places' && !mockEkleme.hata) (mockTablolar.places ??= []).unshift({ id: 'yeni1', ...(satir as object) });
              if (tablo === 'places' && (mockEkleme.hata as { code?: string } | null)?.code === '23505')
                (mockTablolar.places ??= []).unshift({ id: 'baskasi1', ...(satir as object), added_by: 'ayse' });
              return { error: tablo === 'places' ? mockEkleme.hata : null };
            };
          return () => zincir(tablo);
        },
      },
    );
  return {
    supabase: {
      from: (tablo: string) => zincir(tablo),
      rpc: async () => ({ data: [], error: null }),
      functions: { invoke: async () => ({ data: null, error: { message: 'Google isteği beklenmiyordu' } }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => undefined,
    },
  };
});

const IST = 'Europe/Istanbul';
const bugun = () => yerelTarih(new Date(), IST);
/** Seyahat dünden başlar: bugün 2. gün (4 gün). `tarihli: false` → tarihsiz seyahat (gezi günü yok). */
function fikstur(tarihli = true) {
  const bas = tarihEkle(bugun(), -1);
  Object.assign(mockTablolar, {
    trips: [{ id: 't1', name: 'Eskişehir Gezisi', city_label: 'Eskişehir', country_code: 'TR', lat: 39.7767, lng: 30.5206, tz: IST, start_date: tarihli ? bas : null, end_date: tarihli ? tarihEkle(bas, 3) : null, invite_token: 'd' }],
    stays: [],
    places: [],
    days: [1, 2, 3, 4].map((i) => ({ id: `g${i}`, trip_id: 't1', index: i, date: tarihli ? tarihEkle(bas, i - 1) : null, start_time: null, end_time: null, order_manual: false })),
    stops: [],
    members: [{ trip_id: 't1', user_id: 'ben', guest: false, display_name: 'Ece', role: 'owner', joined_at: '2026-10-01T00:00:00Z' }],
    profiles: [],
    sehirler: [],
  });
}
/** "Çarşamba'ya" — gün sırasındaki tarihin gün adı, yönelme ekiyle. */
const gunYonelmesi = (gunNo: number) => yonelmeEkli(GUNLER[haftaGunu(tarihEkle(tarihEkle(bugun(), -1), gunNo - 1))])!;

// Gerçek ağ isteği yok (açık soket jest'i kapatmaz).
const eskiFetch = globalThis.fetch;
const acik: { unmount: () => void; qc: QueryClient }[] = [];
beforeEach(() => {
  globalThis.fetch = (async () => {
    throw new Error('ağ isteği beklenmiyordu');
  }) as unknown as typeof fetch;
  hafifOnbellek.temizle();
  for (const k of Object.keys(mockTablolar)) delete mockTablolar[k];
  fikstur();
  mockEkleme.hata = null;
  mockEkleme.bekle = null;
  mockOlaylar.length = 0;
  mockSilinen.length = 0;
  mockEklenen.length = 0;
  mockGunKapisi.bekle = null;
  mockDurakEkleme.hata = null;
  mockDurakEkleme.bekle = null;
  mockSilme.hata = null;
  mockDurakOkuma.hata = null;
  mockSeyahatId = 't1';
  mockCevrimdisi = false;
  mockYakin = { hata: false, sinir: false };
  mockParametre = {};
  mockAramaSonuclari = [];
  mockSecimHatasi = null;
  kesfetDurumunuSifirla();
});
afterEach(async () => {
  while (acik.length) {
    const r = acik.pop()!;
    r.unmount();
    // Yolda kalan (yeniden denenen) sorgular durdurulur; yoksa bitince 24 sa'lik gc zamanlayıcısı jest'i açık tutar.
    await r.qc.cancelQueries();
    r.qc.clear();
  }
  globalThis.fetch = eskiFetch;
});

/** #621 KK6: açık seyahat (yeniden çizimde değiştirilebilir). */
let mockSeyahatId = 't1';
function ciz() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  const sarmal = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SeyahatIdSaglayici id={mockSeyahatId}>{children}</SeyahatIdSaglayici>
    </QueryClientProvider>
  );
  const r = render(<KesfetEkrani />, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}

/** Soğuk yüklemede ilk çizim CI'da 1 sn'yi aşabiliyor (#615); ilk bekleme uzun. */
const ILK = { timeout: 8000 };

const pindenEkle = async (yer: HafifYer) => {
  fireEvent.press(await screen.findByTestId(`pin-o:${yer.place_id}`));
  fireEvent.press(await screen.findByTestId('panel-cta'));
};

describe('#599 Yer ekle bugün bağlamı takibi', () => {
  it('KK1: Geri al hata verirse "Geri alınamadı." (ekleme hatası metni değil)', async () => {
    ciz();
    await screen.findByTestId('gun-hapi', {}, ILK);
    await pindenEkle(ONERI);
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    mockSilme.hata = { message: 'silinemedi' };
    fireEvent.press(bant.getByRole('button', { name: t('listem.geriAl') }));
    expect(await screen.findByText(t('kesfet.geriAlinamadi'))).toBeTruthy();
    expect(screen.queryByText(t('kesfet.ekleHata'))).toBeNull();
  });

  it('KK2: Listem\'in Geri al bandı açıkken bugüne ekleme → çıkarma kesinleşir, tek bant "{ad} bugüne eklendi"', async () => {
    mockTablolar.places = [{ id: 'm1', trip_id: 't1', place_id: 'ChIJ-liste-1', primary_type: 'museum', lat: 39.779, lng: 30.479, default_minutes: 60, added_by: 'ben', created_at: '2026-10-01T00:00:00Z' }];
    mockTablolar.stops = [{ id: 'd1', trip_id: 't1', day_id: 'g2', place_ref: 'm1', order_key: 'a0', skipped: false }];
    ciz();
    await screen.findByTestId('gun-hapi', {}, ILK);
    // m1 bugünde: panel "Listeden çıkar" → 5 sn Geri al bandı.
    fireEvent.press(await screen.findByTestId('pin-m:ChIJ-liste-1'));
    await waitFor(() => expect(screen.getByText('cikar')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('panel-cta-metni')).toBeNull());
    fireEvent.press(screen.getByTestId('panel-cta'));
    await screen.findByTestId('geri-al-bandi');
    expect(mockSilinen).toEqual([]);
    await pindenEkle(ONERI);
    await waitFor(() => expect(within(screen.getByTestId('geri-al-bandi')).getByText(' bugüne eklendi')).toBeTruthy());
    expect(screen.getAllByTestId('geri-al-bandi')).toHaveLength(1);
    // Çıkarma bandı kapandı: bekleyen silme hemen yapıldı (Geri al artık yalnız eklemeyi geri alır).
    await waitFor(() => expect(mockSilinen).toEqual([{ tablo: 'places', id: 'm1' }]));
  });

  it('KK5: bugünün sırası days\'te yoksa hap yok; ekleme yalnız listeye, bildirim "{ad} listene eklendi"', async () => {
    mockTablolar.days = (mockTablolar.days as { index: number }[]).filter((g) => g.index !== 2);
    ciz();
    await pindenEkle(ONERI);
    expect(await screen.findByText(t('kesfet.listeneEklendi', { ad: ONERI.ad }), {}, ILK)).toBeTruthy();
    expect(screen.queryByTestId('gun-hapi')).toBeNull();
    expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1);
    expect(mockEklenen.some((e) => e.tablo === 'stops')).toBe(false);
  });

  it('KK6: art arda iki ekleme aynı güne farklı order_key alır (ikinci, birincinin bitmesini bekler)', async () => {
    let ac: () => void = () => undefined;
    mockDurakEkleme.bekle = new Promise<void>((c) => (ac = c));
    ciz();
    await screen.findByTestId('gun-hapi', {}, ILK);
    await pindenEkle(ONERI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1));
    fireEvent.press(screen.getByTestId('panel-kapat'));
    await pindenEkle(IKINCI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(2));
    mockDurakEkleme.bekle = null;
    ac();
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'stops')).toHaveLength(2));
    const [bir, iki] = mockEklenen.filter((e) => e.tablo === 'stops').map((e) => e.satir as { day_id: string; order_key: string });
    expect(bir.day_id).toBe('g2');
    expect(iki.day_id).toBe('g2');
    expect(iki.order_key > bir.order_key).toBe(true);
    expect(await screen.findByText(IKINCI.ad)).toBeTruthy();
  });

  it('KK6: ikinci ekleme günü okuduktan sonra birincinin durağı biterse de anahtar onun ardından gelir', async () => {
    let durakAc: () => void = () => undefined;
    let yerAc: () => void = () => undefined;
    mockDurakEkleme.bekle = new Promise<void>((c) => (durakAc = c));
    ciz();
    await screen.findByTestId('gun-hapi', {}, ILK);
    await pindenEkle(ONERI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1));
    // İkinci basış günü okur; liste eklemesi bekletilir. Bu sırada birincinin durağı biter.
    mockEkleme.bekle = new Promise<void>((c) => (yerAc = c));
    fireEvent.press(screen.getByTestId('panel-kapat'));
    await pindenEkle(IKINCI);
    await new Promise((c) => setTimeout(c, 20));
    mockDurakEkleme.bekle = null;
    durakAc();
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'stops')).toHaveLength(1));
    mockEkleme.bekle = null;
    yerAc();
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'stops')).toHaveLength(2));
    const [bir, iki] = mockEklenen.filter((e) => e.tablo === 'stops').map((e) => e.satir as { order_key: string });
    expect(iki.order_key > bir.order_key).toBe(true);
  });

  it('KK2 (değişiklik 1): ekleme sürerken ✓ ile çıkarma → ekleme biter → çıkarma bandı açık kalır, silme gitmez', async () => {
    let ac: () => void = () => undefined;
    mockDurakEkleme.bekle = new Promise<void>((c) => (ac = c));
    mockTablolar.places = [{ id: 'm1', trip_id: 't1', place_id: 'ChIJ-liste-1', primary_type: 'museum', lat: 39.779, lng: 30.479, default_minutes: 60, added_by: 'ben', created_at: '2026-10-01T00:00:00Z' }];
    // m1 bugünde: panel düğmesi "Listeden çıkar".
    mockTablolar.stops = [{ id: 'd1', trip_id: 't1', day_id: 'g2', place_ref: 'm1', order_key: 'a0', skipped: false }];
    ciz();
    await screen.findByTestId('gun-hapi', {}, ILK);
    // "+" basılır, bant yokken; durak eklemesi bekletilir.
    await pindenEkle(ONERI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1));
    fireEvent.press(screen.getByTestId('panel-kapat'));
    // Ekleme sürerken m1 ✓ ile çıkarılır: Geri al bandı açılır.
    fireEvent.press(await screen.findByTestId('pin-m:ChIJ-liste-1'));
    await waitFor(() => expect(screen.getByText('cikar')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('panel-cta-metni')).toBeNull());
    fireEvent.press(screen.getByTestId('panel-cta'));
    await screen.findByTestId('geri-al-bandi');
    mockDurakEkleme.bekle = null;
    ac();
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'stops')).toHaveLength(1));
    await act(async () => {
      await new Promise((c) => setTimeout(c, 20));
    });
    // Çıkarma bandı kaldı, ekleme bildirimi yok, silme gönderilmedi; Geri al hâlâ çıkarmayı geri alır.
    expect(screen.getAllByTestId('geri-al-bandi')).toHaveLength(1);
    expect(screen.queryByText(' bugüne eklendi')).toBeNull();
    expect(mockSilinen).toEqual([]);
    fireEvent.press(within(screen.getByTestId('geri-al-bandi')).getByRole('button', { name: t('listem.geriAl') }));
    await waitFor(() => expect(screen.queryByTestId('geri-al-bandi')).toBeNull());
    expect(mockSilinen).toEqual([]);
  });

  it('KK2: kısa bildirim açıkken ✓ ile çıkarma → bildirim kapanır, yalnız çıkarma bandı', async () => {
    mockTablolar.days = (mockTablolar.days as { index: number }[]).filter((g) => g.index !== 2);
    mockTablolar.places = [{ id: 'm1', trip_id: 't1', place_id: 'ChIJ-liste-1', primary_type: 'museum', lat: 39.779, lng: 30.479, default_minutes: 60, added_by: 'ben', created_at: '2026-10-01T00:00:00Z' }];
    ciz();
    await pindenEkle(ONERI);
    await screen.findByText(t('kesfet.listeneEklendi', { ad: ONERI.ad }), {}, ILK);
    fireEvent.press(screen.getByTestId('panel-kapat'));
    fireEvent.press(await screen.findByTestId('pin-m:ChIJ-liste-1'));
    await waitFor(() => expect(screen.getByText('cikar')).toBeTruthy());
    fireEvent.press(screen.getByTestId('panel-cta'));
    await screen.findByTestId('geri-al-bandi');
    expect(screen.queryByText(t('kesfet.listeneEklendi', { ad: ONERI.ad }))).toBeNull();
  });
});

describe('#599 KK4: gece yarısı, sekme açıkken', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  it('gün değişince hap kendiliğinden yeni günü gösterir; Değiştir\'le seçilmiş gün olduğu gibi kalır', async () => {
    // Bugün 23:58 İstanbul (UTC+3): seyahatin 2. günü. İki dakika sonra 3. gün. Gün adları sahte saatten önce.
    const [g2, g3] = [gunYonelmesi(2), gunYonelmesi(3)];
    jest.useFakeTimers({ now: new Date(`${bugun()}T20:58:00Z`) });
    ciz();
    expect(within(await screen.findByTestId('gun-hapi', {}, ILK)).getByText(`2. gün · ${g2} ekleniyor`)).toBeTruthy();
    act(() => jest.advanceTimersByTime(60_000));
    expect(within(screen.getByTestId('gun-hapi')).getByText(`2. gün · ${g2} ekleniyor`)).toBeTruthy();
    act(() => jest.advanceTimersByTime(60_000));
    await waitFor(() => expect(within(screen.getByTestId('gun-hapi')).getByText(`3. gün · ${g3} ekleniyor`)).toBeTruthy());
  });

  it('açıkça seçilmiş gün (Plan\'dan 4. gün) gece yarısında değişmez', async () => {
    mockParametre = { gun: '4', n: '1' };
    const g4 = gunYonelmesi(4);
    jest.useFakeTimers({ now: new Date(`${bugun()}T20:58:00Z`) });
    ciz();
    expect(within(await screen.findByTestId('gun-hapi', {}, ILK)).getByText(`4. gün · ${g4} ekleniyor`)).toBeTruthy();
    act(() => jest.advanceTimersByTime(180_000));
    expect(within(screen.getByTestId('gun-hapi')).getByText(`4. gün · ${g4} ekleniyor`)).toBeTruthy();
  });
});

// #621: ortak fikstür — listede, bugünde (2. gün) duran m1 (panel düğmesi "Listeden çıkar").
const M1 = { id: 'm1', trip_id: 't1', place_id: 'ChIJ-liste-1', primary_type: 'museum', lat: 39.779, lng: 30.479, default_minutes: 60, added_by: 'ben', created_at: '2026-10-01T00:00:00Z' };
const M1_DURAK = { id: 'd1', trip_id: 't1', day_id: 'g2', place_ref: 'm1', order_key: 'a0', skipped: false };
const bekle = (ms: number) =>
  act(async () => {
    await new Promise((c) => setTimeout(c, ms));
  });
/** m1'i ✓ ile çıkarır: 5 sn'lik Geri al bandı açılır. */
const m1Cikar = async () => {
  fireEvent.press(await screen.findByTestId('pin-m:ChIJ-liste-1'));
  await waitFor(() => expect(screen.getByText('cikar')).toBeTruthy());
  await waitFor(() => expect(screen.queryByTestId('panel-cta-metni')).toBeNull());
  fireEvent.press(screen.getByTestId('panel-cta'));
  await screen.findByTestId('geri-al-bandi');
};

describe('#621 Yer ekle bugün takibi 2', () => {
  it('KK2: durak yenilemesi düşse de sıradaki "+" aynı order_key\'i almaz (son verilenin ardından)', async () => {
    ciz();
    await screen.findByTestId('gun-hapi', {}, ILK);
    // Duraklar yüklendi (boş); bundan sonra her yenileme düşer — eldeki liste eski kalır.
    mockDurakOkuma.hata = { message: 'yenilenemedi' };
    await pindenEkle(ONERI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'stops')).toHaveLength(1));
    await screen.findByTestId('geri-al-bandi');
    fireEvent.press(screen.getByTestId('panel-kapat'));
    await pindenEkle(IKINCI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'stops')).toHaveLength(2));
    const [bir, iki] = mockEklenen.filter((e) => e.tablo === 'stops').map((e) => e.satir as { day_id: string; order_key: string });
    expect(iki.day_id).toBe(bir.day_id);
    expect(iki.order_key > bir.order_key).toBe(true);
  });

  it('KK3: aynı kısa bildirim 2,8 sn içinde iki kez → iki iOS duyurusu, süre ikinciden başlar', async () => {
    // jest-expo'da duyuru zaten bir jest.fn (spyOn aynısını döndürür): önceki testlerin çağrıları silinir.
    const duyuru = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    duyuru.mockClear();
    try {
      mockTablolar.days = (mockTablolar.days as { index: number }[]).filter((g) => g.index !== 2);
      const metin = t('kesfet.listeneEklendi', { ad: ONERI.ad });
      ciz();
      await pindenEkle(ONERI);
      await screen.findByText(metin, {}, ILK);
      const sayi = () => duyuru.mock.calls.filter(([m]) => m === metin).length;
      expect(sayi()).toBe(1);
      fireEvent.press(screen.getByTestId('panel-kapat'));
      await bekle(1500);
      // Aynı adlı başka yer: aynı metin, ilki hâlâ ekranda.
      await pindenEkle(ADASI);
      await waitFor(() => expect(sayi()).toBe(2));
      // İlk bildirimden 2,8 sn sonra hâlâ görünür (zamanlayıcı ikinciyle baştan başladı); sonra kalkar.
      await bekle(1700);
      expect(screen.getByText(metin)).toBeTruthy();
      await waitFor(() => expect(screen.queryByText(metin)).toBeNull(), { timeout: 3000 });
    } finally {
      duyuru.mockRestore();
    }
  }, 15000);

  it('KK6: ekleme sürerken seyahat değişirse eski eklemenin bildirimi yeni seyahatte açılmaz', async () => {
    let ac: () => void = () => undefined;
    mockDurakEkleme.bekle = new Promise<void>((c) => (ac = c));
    const r = ciz();
    await screen.findByTestId('gun-hapi', {}, ILK);
    await pindenEkle(ONERI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1));
    // Başka seyahate geçilir (aynı ekran, yeni kimlik); eski eklemenin durağı sonra biter.
    mockTablolar.trips = [{ ...(mockTablolar.trips as object[])[0], id: 't2', name: 'Ankara Gezisi' }];
    mockSeyahatId = 't2';
    r.rerender(<KesfetEkrani />);
    await screen.findByTestId('gun-hapi', {}, ILK);
    mockDurakEkleme.bekle = null;
    ac();
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'stops')).toHaveLength(1));
    await bekle(50);
    expect(screen.queryByTestId('geri-al-bandi')).toBeNull();
    expect(screen.queryByText(' bugüne eklendi')).toBeNull();
  });

  it('KK7: tarihsiz günde bant ekleme sürerken açıldıysa kalır; "{n}. güne eklendi" gösterilmez, silme gitmez', async () => {
    fikstur(false);
    mockParametre = { gun: '2', n: '1' };
    mockTablolar.places = [M1];
    mockTablolar.stops = [M1_DURAK];
    let ac: () => void = () => undefined;
    mockDurakEkleme.bekle = new Promise<void>((c) => (ac = c));
    ciz();
    await screen.findByText(t('kesfet.guneEkliyorsun', { n: 2 }), {}, ILK);
    await pindenEkle(ONERI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1));
    fireEvent.press(screen.getByTestId('panel-kapat'));
    await m1Cikar();
    mockDurakEkleme.bekle = null;
    ac();
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'stops')).toHaveLength(1));
    await bekle(20);
    expect(screen.getAllByTestId('geri-al-bandi')).toHaveLength(1);
    expect(screen.queryByText(t('kesfet.guneEklendi', { ad: ONERI.ad, n: 2 }))).toBeNull();
    expect(mockSilinen).toEqual([]);
  });

  it('KK7: "listene eklendi" yolunda bant ekleme sürerken açıldıysa kalır; bildirim gösterilmez, silme gitmez', async () => {
    mockTablolar.days = (mockTablolar.days as { index: number }[]).filter((g) => g.index !== 2);
    mockTablolar.places = [M1];
    ciz();
    await screen.findByTestId('pin-m:ChIJ-liste-1', {}, ILK);
    let ac: () => void = () => undefined;
    mockEkleme.bekle = new Promise<void>((c) => (ac = c));
    await pindenEkle(ONERI);
    fireEvent.press(screen.getByTestId('panel-kapat'));
    await m1Cikar();
    mockEkleme.bekle = null;
    ac();
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1));
    await bekle(20);
    expect(screen.getAllByTestId('geri-al-bandi')).toHaveLength(1);
    expect(screen.queryByText(t('kesfet.listeneEklendi', { ad: ONERI.ad }))).toBeNull();
    expect(mockSilinen).toEqual([]);
  });

  it('KK7: ekleme sürerken açılan bant 5 sn dolup kapanırsa ekleme bitince bildirim görünür', async () => {
    mockTablolar.places = [M1];
    mockTablolar.stops = [M1_DURAK];
    let ac: () => void = () => undefined;
    mockDurakEkleme.bekle = new Promise<void>((c) => (ac = c));
    ciz();
    await screen.findByTestId('gun-hapi', {}, ILK);
    await pindenEkle(ONERI);
    await waitFor(() => expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1));
    fireEvent.press(screen.getByTestId('panel-kapat'));
    await m1Cikar();
    // 5 sn dolar: çıkarma kesinleşir, bant kapanır.
    await waitFor(() => expect(mockSilinen).toEqual([{ tablo: 'places', id: 'm1' }]), { timeout: 7000 });
    await waitFor(() => expect(screen.queryByTestId('geri-al-bandi')).toBeNull());
    mockDurakEkleme.bekle = null;
    ac();
    await waitFor(() => expect(within(screen.getByTestId('geri-al-bandi')).getByText(' bugüne eklendi')).toBeTruthy());
  }, 15000);
});

describe('#621 KK1: Değiştir çekmecesinin saati', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  /** Bugün (2. gün) sabah gezilmiş tek durak: çekmecede "1 durak gezildi" (21.00'e kadar "· akşam boş"). */
  const gezilenDurak = () => {
    mockTablolar.places = [{ ...M1, id: 'm9', place_id: 'ChIJ-gezilen', default_minutes: 30 }];
    mockTablolar.stops = [{ id: 'd9', trip_id: 't1', day_id: 'g2', place_ref: 'm9', order_key: 'a0', skipped: false, completed_at: `${bugun()}T07:00:00Z`, completed_by: 'ben', arrived_at: null, arrived_by: null, auto_completed: false, minutes: 30 }];
  };
  const gezildi = t('listem.guneEkle.gezildi', { n: 1 });
  const aksamBos = `${gezildi} · ${t('listem.guneEkle.aksamBos')}`;

  it('çekmece açıkken dakikalık yenileme alt satırı günceller (20.59 "akşam boş" → 21.00 yalnız "gezildi")', async () => {
    gezilenDurak();
    // 20.59 İstanbul (UTC+3).
    jest.useFakeTimers({ now: new Date(`${bugun()}T17:59:00Z`) });
    ciz();
    fireEvent.press(within(await screen.findByTestId('gun-hapi', {}, ILK)).getByRole('button', { name: t('kesfet.gunDegistirEtiket') }));
    await screen.findByText(t('mekan.gunSecBaslik'));
    await waitFor(() => expect(screen.getByText(aksamBos)).toBeTruthy());
    act(() => jest.advanceTimersByTime(60_000));
    await waitFor(() => expect(screen.getByText(gezildi)).toBeTruthy());
    expect(screen.queryByText(aksamBos)).toBeNull();
  });

  it('çekmece kapalıyken saat ilerlerse Değiştir\'e basınca saat tazelenir', async () => {
    gezilenDurak();
    // 20.50'de sekme açılır; çekmece kapalıyken (gün değişmediği için ekran saati yenilenmez) 21.05 olur.
    jest.useFakeTimers({ now: new Date(`${bugun()}T17:50:00Z`) });
    ciz();
    const hap = within(await screen.findByTestId('gun-hapi', {}, ILK));
    act(() => jest.advanceTimersByTime(15 * 60_000));
    fireEvent.press(hap.getByRole('button', { name: t('kesfet.gunDegistirEtiket') }));
    await screen.findByText(t('mekan.gunSecBaslik'));
    await waitFor(() => expect(screen.getByText(gezildi)).toBeTruthy());
    expect(screen.queryByText(aksamBos)).toBeNull();
  });
});
