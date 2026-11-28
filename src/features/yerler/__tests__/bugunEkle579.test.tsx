// #579 KK1–KK3: gezi sırasında Yer ekle bugünü bilir. Gezi günlerinde (trips.tz) sekme bugün seçili açılır; beyaz hap "2. gün ·
// Çarşamba'ya ekleniyor · Değiştir"; Değiştir → Hangi güne? çekmecesi, seçilen gün hapta; ekleme seçili günün sonuna, Gece bildirim
// "{ad} bugüne eklendi · Geri al" (başka gün "{ad} Cuma'ya eklendi"), 4 sn; Geri al eklenen yeri siler. Düzen #387 testiyle aynı.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { kesfetDurumunuAl, kesfetDurumunuSifirla } from '@/features/yerler/kesfetDurumu';
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
const mockYerler = [ONERI];
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
/** #598: durak eklemesi (ata) hata verebilir. */
const mockDurakEkleme: { hata: unknown } = { hata: null };
jest.mock('@/lib/supabase', () => {
  const zincir = (tablo: string): unknown =>
    new Proxy(
      {},
      {
        get(_h, ad) {
          if (ad === 'then')
            return (coz: (v: unknown) => unknown) =>
              (tablo === 'days' && mockGunKapisi.bekle ? mockGunKapisi.bekle : Promise.resolve())
                .then(() => ({ data: mockTablolar[tablo] ?? [], error: null }))
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
              if (tablo === 'stops' && mockDurakEkleme.hata) return { error: mockDurakEkleme.hata };
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

function ciz() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  const sarmal = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SeyahatIdSaglayici id="t1">{children}</SeyahatIdSaglayici>
    </QueryClientProvider>
  );
  const r = render(<KesfetEkrani />, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}



describe('#579 Yer ekle: gezi sırasında bugüne ekle', () => {
  it('KK1–KK2: gezi gününde bugün seçili; beyaz hap "2. gün · …\'ya ekleniyor" ve Değiştir (44 pt)', async () => {
    ciz();
    // Dosyanın ilk çizimi CI'da modülleri soğuk yüklüyor; varsayılan 1 sn bekleme yetmiyor (main b43bfec, #612 86392df).
    const hap = within(await screen.findByTestId('gun-hapi', {}, { timeout: 8000 }));
    expect(hap.getByText(`2. gün · ${gunYonelmesi(2)} ekleniyor`)).toBeTruthy();
    const degistir = hap.getByRole('button', { name: t('kesfet.gunDegistirEtiket') });
    expect(hap.getByText(t('kesfet.gunDegistir'))).toBeTruthy();
    expect(StyleSheet.flatten(degistir.props.style).minHeight).toBeGreaterThanOrEqual(44);
    // Gezi gününde eski renkli "{n}. güne ekliyorsun ✕" hapı yok.
    expect(screen.queryByText(t('kesfet.guneEkliyorsun', { n: 2 }))).toBeNull();
  }, 15000);

  it('KK2: Değiştir → Hangi güne? (bugün en üstte, "listede kalsın" yok) → 4. gün seçilince hap o güne döner', async () => {
    ciz();
    const hap = within(await screen.findByTestId('gun-hapi'));
    fireEvent.press(hap.getByRole('button', { name: t('kesfet.gunDegistirEtiket') }));
    expect(await screen.findByText(t('mekan.gunSecBaslik'))).toBeTruthy();
    // Bugün (seçili gün) en üstte; dünkü gün "Geçti" en altta.
    const gunSatirlari = screen.getAllByRole('button').filter((b) => /, Boş gün|, geçti$/.test(String(b.props.accessibilityLabel)));
    expect(String(gunSatirlari[0].props.accessibilityLabel)).toMatch(/^Bugün, /);
    expect(String(gunSatirlari[gunSatirlari.length - 1].props.accessibilityLabel)).toMatch(/, geçti$/);
    expect(gunSatirlari).toHaveLength(4);
    expect(screen.queryByText(t('listem.guneEkle.kalsin'))).toBeNull();
    const gun4 = screen.getAllByRole('button').find((b) => /^\S+ \d+, Boş gün, dönüş$/.test(String(b.props.accessibilityLabel)));
    expect(gun4).toBeTruthy();
    fireEvent.press(gun4!);
    await waitFor(() => expect(within(screen.getByTestId('gun-hapi')).getByText(`4. gün · ${gunYonelmesi(4)} ekleniyor`)).toBeTruthy());
  });

  it('KK3: ekleme bugünün sonuna; Gece bildirim "{ad} bugüne eklendi · Geri al"; Geri al eklenen yeri siler', async () => {
    mockTablolar.stops = [{ id: 'd0', trip_id: 't1', day_id: 'g2', place_ref: 'eski', order_key: 'a0', skipped: false }];
    ciz();
    await screen.findByTestId('gun-hapi');
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    expect(bant.getByLabelText(`${ONERI.ad} bugüne eklendi`)).toBeTruthy();
    const durak = mockEklenen.find((e) => e.tablo === 'stops')?.satir as { day_id: string; place_ref: string; order_key: string };
    expect(durak.day_id).toBe('g2');
    expect(durak.place_ref).toBe('yeni1');
    // Günün sonuna: mevcut son anahtardan sonra.
    expect(durak.order_key > 'a0').toBe(true);
    fireEvent.press(bant.getByRole('button', { name: t('listem.geriAl') }));
    expect(screen.queryByTestId('geri-al-bandi')).toBeNull();
    // Önce bu eklemenin durağı, sonra (bu ekleme oluşturduğu için) mekan satırı.
    await waitFor(() =>
      expect(mockSilinen).toEqual([
        { tablo: 'stops', trip_id: 't1', day_id: 'g2', place_ref: 'yeni1', order_key: durak.order_key },
        { tablo: 'places', id: 'yeni1' },
      ]),
    );
  });

  it('KK3: başka gün seçiliyse "{ad} Cuma\'ya eklendi"; bildirim 4 sn sonra kalkar', async () => {
    mockParametre = { gun: '3', n: '1' };
    ciz();
    expect(within(await screen.findByTestId('gun-hapi')).getByText(`3. gün · ${gunYonelmesi(3)} ekleniyor`)).toBeTruthy();
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    jest.useFakeTimers();
    fireEvent.press(await screen.findByTestId('panel-cta'));
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    expect(bant.getByLabelText(`${ONERI.ad} ${gunYonelmesi(3)} eklendi`)).toBeTruthy();
    expect((mockEklenen.find((e) => e.tablo === 'stops')?.satir as { day_id: string }).day_id).toBe('g3');
    act(() => jest.advanceTimersByTime(3900));
    expect(screen.getByTestId('geri-al-bandi')).toBeTruthy();
    act(() => jest.advanceTimersByTime(200));
    jest.useRealTimers();
    expect(screen.queryByTestId('geri-al-bandi')).toBeNull();
    expect(mockSilinen).toEqual([]);
  });

  it('gezi günü dışında (tarihsiz seyahat) hap yok, ekleme yalnız listeye', async () => {
    for (const k of Object.keys(mockTablolar)) delete mockTablolar[k];
    fikstur(false);
    ciz();
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    await waitFor(() => expect(mockEklenen.some((e) => e.tablo === 'places')).toBe(true));
    expect(screen.queryByTestId('gun-hapi')).toBeNull();
    expect(mockEklenen.some((e) => e.tablo === 'stops')).toBe(false);
  });
});

describe('#579 inceleme düzeltmeleri', () => {
  it('1: yer zaten eklenmişse (23505) Geri al yalnız bu durağı siler, mekan satırına dokunmaz', async () => {
    mockEkleme.hata = { code: '23505', message: 'duplicate' };
    ciz();
    await screen.findByTestId('gun-hapi');
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    const durak = mockEklenen.find((e) => e.tablo === 'stops')?.satir as { place_ref: string; order_key: string };
    expect(durak.place_ref).toBe('baskasi1');
    fireEvent.press(bant.getByRole('button', { name: t('listem.geriAl') }));
    await waitFor(() => expect(mockSilinen).toEqual([{ tablo: 'stops', trip_id: 't1', day_id: 'g2', place_ref: 'baskasi1', order_key: durak.order_key }]));
    await new Promise((c) => setTimeout(c, 20));
    expect(mockSilinen.some((x) => x.tablo === 'places')).toBe(false);
  });

  it('2: gün bağlamında panel düğmesi "Bugüne ekle"', async () => {
    ciz();
    await screen.findByTestId('gun-hapi');
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    expect((await screen.findByTestId('panel-cta-metni')).props.children).toBe(t('kesfet.bugunEkle'));
  });

  it('2: başka gün (Plan\'dan 3. gün) seçiliyse panel "{gün}\'e ekle"', async () => {
    mockParametre = { gun: '3', n: '1' };
    ciz();
    await screen.findByTestId('gun-hapi');
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    expect((await screen.findByTestId('panel-cta-metni')).props.children).toBe(t('kesfet.gunEkle', { gun: gunYonelmesi(3) }));
  });

  it('3: uzun adda yalnız ad kesilir; "bugüne eklendi" ayrı ve sabit', async () => {
    ciz();
    await screen.findByTestId('gun-hapi');
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    const ad = bant.getByText(ONERI.ad);
    expect(ad.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(ad.props.style).flexShrink).toBe(1);
    const ek = bant.getByText(' bugüne eklendi');
    expect(StyleSheet.flatten(ek.props.style).flexShrink).toBe(0);
    // 7: sekme çubuğunun 12 pt üstünde.
    expect(StyleSheet.flatten(screen.getByTestId('geri-al-bandi').props.style).bottom).toBe(12);
  });

  it('6: günler yüklenmeden + basılırsa ekleme günleri bekler, yer yine bugüne eklenir', async () => {
    let ac: () => void = () => undefined;
    mockGunKapisi.bekle = new Promise<void>((c) => (ac = c));
    ciz();
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    await new Promise((c) => setTimeout(c, 20));
    expect(mockEklenen).toEqual([]);
    ac();
    await screen.findByTestId('geri-al-bandi');
    expect((mockEklenen.find((e) => e.tablo === 'stops')?.satir as { day_id: string }).day_id).toBe('g2');
  });

  it('5: Değiştir çekmecesinde bugünün satırı "N durak gezildi" (Plan\'daki #553 metni)', async () => {
    mockTablolar.places = [{ id: 'm9', trip_id: 't1', place_id: 'ChIJ-gezilen', primary_type: 'museum', lat: 39.77, lng: 30.52, default_minutes: 30, added_by: 'ben', created_at: '2026-10-01T00:00:00Z' }];
    mockTablolar.stops = [{ id: 'd9', trip_id: 't1', day_id: 'g2', place_ref: 'm9', order_key: 'a0', skipped: false, completed_at: new Date().toISOString(), completed_by: 'ben', arrived_at: null, arrived_by: null, auto_completed: false, minutes: 30 }];
    ciz();
    const hap = within(await screen.findByTestId('gun-hapi'));
    fireEvent.press(hap.getByRole('button', { name: t('kesfet.gunDegistirEtiket') }));
    await screen.findByText(t('mekan.gunSecBaslik'));
    await waitFor(() => expect(screen.getByText(new RegExp(t('listem.guneEkle.gezildi', { n: 1 })))).toBeTruthy());
  });
});

describe('#579 inceleme 4: gece yarısı', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  it('sekme dün açılmış olsa da ekleme anındaki bugüne gider', async () => {
    const yarin = tarihEkle(bugun(), 1);
    // Dün 23:58 İstanbul (UTC+3) — sekme o an açıldı; seyahat bugünü 2. gün sayar, ekleme anı yarın → 3. gün.
    const gece = new Date(`${bugun()}T20:58:00Z`);
    const sabah = new Date(`${yarin}T06:00:00Z`);
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'] });
    jest.setSystemTime(gece);
    ciz();
    expect(within(await screen.findByTestId('gun-hapi')).getByText(`2. gün · ${gunYonelmesi(2)} ekleniyor`)).toBeTruthy();
    jest.setSystemTime(sabah);
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    expect(bant.getByText(' bugüne eklendi')).toBeTruthy();
    expect((mockEklenen.find((e) => e.tablo === 'stops')?.satir as { day_id: string }).day_id).toBe('g3');
  });
});

describe('#598 değişiklik: listedeki yer güne atanır, yarım kalan ekleme tekrar denenir', () => {
  const LISTEDEKI = { id: 'm1', trip_id: 't1', place_id: ONERI.place_id, primary_type: 'museum', lat: ONERI.lat, lng: ONERI.lng, default_minutes: 60, added_by: 'ayse', created_at: '2026-10-01T00:00:00Z' };

  it('1: listedeki yer gün bağlamında panelde "Bugüne ekle"; dokununca güne eklenir, listeden çıkmaz; Geri al yalnız durağı siler', async () => {
    mockTablolar.places = [LISTEDEKI];
    ciz();
    await screen.findByTestId('gun-hapi');
    fireEvent.press(await screen.findByTestId(`pin-m:${ONERI.place_id}`));
    expect((await screen.findByTestId('panel-cta-metni')).props.children).toBe(t('kesfet.bugunEkle'));
    fireEvent.press(screen.getByTestId('panel-cta'));
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    expect(bant.getByText(' bugüne eklendi')).toBeTruthy();
    // Yeni `ekle` yok; durak listedeki satırla bugünün sonuna.
    expect(mockEklenen.filter((e) => e.tablo === 'places')).toEqual([]);
    const durak = mockEklenen.find((e) => e.tablo === 'stops')?.satir as { day_id: string; place_ref: string; order_key: string };
    expect(durak).toMatchObject({ day_id: 'g2', place_ref: 'm1' });
    fireEvent.press(bant.getByRole('button', { name: t('listem.geriAl') }));
    await waitFor(() => expect(mockSilinen).toEqual([{ tablo: 'stops', trip_id: 't1', day_id: 'g2', place_ref: 'm1', order_key: durak.order_key }]));
    await new Promise((c) => setTimeout(c, 20));
    expect(mockSilinen.some((x) => x.tablo === 'places')).toBe(false);
  });

  it('1: yer zaten seçili gündeyse panel "Listeden çıkar" (gün metni yok), atama yapılmaz', async () => {
    mockTablolar.places = [LISTEDEKI];
    mockTablolar.stops = [{ id: 'd1', trip_id: 't1', day_id: 'g2', place_ref: 'm1', order_key: 'a0', skipped: false }];
    ciz();
    await screen.findByTestId('gun-hapi');
    fireEvent.press(await screen.findByTestId(`pin-m:${ONERI.place_id}`));
    await screen.findByTestId('panel-cta');
    await waitFor(() => expect(screen.queryByTestId('panel-cta-metni')).toBeNull());
    expect(screen.getByText('cikar')).toBeTruthy();
  });

  it('1–2: çekmecede ✓ gün bağlamında listeden çıkarmaz; ata hata verince "Güne eklenemedi", ikinci dokunuş güne ekler', async () => {
    mockDurakEkleme.hata = { message: 'durak eklenemedi' };
    // Görünür bölge öneriyi içerir (çekmece satırları bölgeye göre süzülür).
    kesfetDurumunuAl('t1').bolge = { merkez: { lat: ONERI.lat, lng: ONERI.lng }, yaricapM: 3000, latDelta: 0.05, lngDelta: 0.05, zoom: 13 };
    ciz();
    await screen.findByTestId('gun-hapi');
    // Çekmece ekran ölçülünce çizilir.
    const kok = screen.UNSAFE_root.findAll((n) => typeof n.props.onLayout === 'function')[0];
    fireEvent(kok, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
    fireEvent.press(await screen.findByRole('button', { name: t('kesfet.cekmece.ac') }));
    fireEvent.press(await screen.findByLabelText(t('kesfet.bugunEkle')));
    expect(await screen.findByText(t('kesfet.guneEklenemedi'))).toBeTruthy();
    expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1);
    expect(mockEklenen.some((e) => e.tablo === 'stops')).toBe(false);
    // Yer listede ✓ kaldı; ✓ atamayı tekrar dener (listeden çıkarma bandı yok, yeni `ekle` yok).
    mockDurakEkleme.hata = null;
    fireEvent.press(await screen.findByLabelText(t('ui.ekle.listede')));
    const bant = within(await screen.findByTestId('geri-al-bandi'));
    expect(bant.getByText(' bugüne eklendi')).toBeTruthy();
    expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1);
    expect((mockEklenen.find((e) => e.tablo === 'stops')?.satir as { day_id: string; place_ref: string })).toMatchObject({ day_id: 'g2', place_ref: 'yeni1' });
    expect(mockSilinen).toEqual([]);
  });

  it('2: panelden ekleme yarıda kalırsa yer listede kalır; panel yine "Bugüne ekle", ikinci dokunuş güne ekler', async () => {
    mockDurakEkleme.hata = { message: 'durak eklenemedi' };
    ciz();
    await screen.findByTestId('gun-hapi');
    fireEvent.press(await screen.findByTestId(`pin-o:${ONERI.place_id}`));
    fireEvent.press(await screen.findByTestId('panel-cta'));
    expect(await screen.findByText(t('kesfet.guneEklenemedi'))).toBeTruthy();
    await waitFor(() => expect(screen.getByText('cikar')).toBeTruthy());
    expect(screen.getByTestId('panel-cta-metni').props.children).toBe(t('kesfet.bugunEkle'));
    mockDurakEkleme.hata = null;
    fireEvent.press(screen.getByTestId('panel-cta'));
    await screen.findByTestId('geri-al-bandi');
    expect(mockEklenen.filter((e) => e.tablo === 'places')).toHaveLength(1);
    expect((mockEklenen.find((e) => e.tablo === 'stops')?.satir as { place_ref: string }).place_ref).toBe('yeni1');
    expect(mockSilinen).toEqual([]);
  });
});
