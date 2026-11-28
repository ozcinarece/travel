// #182 KK7 · #667: Plan sekmesini açıp genel bakıştan günlere girip çıkmak Google isteği doğurmaz — sekme gerçek kancalarıyla çizilir (Supabase
// sahte; Edge Function çağrıları ve fetch sayılır). Harita "Haritayı aç" ile açılınca istek beklenir (yalnız orada).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Modal, Platform, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { gunEtiketi } from '@/features/gezi/geziOzeti';
import { gunBasligiV13 } from '@/features/plan/genelBakis';
import { t } from '@/i18n';
import { SeyahatIdSaglayici } from '@/features/seyahatler/baglam';
import { hafifOnbellek } from '@/features/yerler/api';
import { tarihEkle } from '@/lib/takvim';
import { yerelTarih } from '@/lib/zaman';
import { gunRengi } from '@/theme';
import { sahte, sahteSifirla, type Tablolar } from '@/testYardim/sahteSupabase';

import ProgramEkrani from '../../../app/seyahat/[id]/(sekmeler)/program';

let mockParametreler: Record<string, string> = {};
let mockOdakKaybi: (() => void) | null = null;
let mockSekmeBasma: (() => void) | null = null;
jest.mock('@/lib/supabase', () => jest.requireActual('@/testYardim/sahteSupabase'));
jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/hataRaporu', () => ({ izBirak: () => undefined }));
// Liste görünümünde harita çizilmez; yerel harita modülü jest'te yok.
jest.mock('react-native-maps', () => ({ __esModule: true, default: () => null, Marker: () => null, Polyline: () => null, Circle: () => null, PROVIDER_GOOGLE: 'google' }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/konum/useKonum', () => ({ useKonum: () => ({ konum: null, izin: 'yok' }), yakinDurakId: () => null }));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParametreler,
  useGlobalSearchParams: () => ({}),
  // #667: odak kaybı (sekmeden çıkış) testten tetiklenir — temizleme işlevi `mockOdakKaybi`'na yazılır.
  useFocusEffect: (cb: () => void | (() => void)) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(() => {
      const temizle = cb();
      mockOdakKaybi = temizle ?? null;
      return temizle;
    }, [cb]),
  // #667: açık sekmeye yeniden basma (`tabPress`) testten tetiklenir.
  useNavigation: () => ({
    addListener: (olay: string, f: () => void) => {
      if (olay === 'tabPress') mockSekmeBasma = f;
      return () => {
        if (mockSekmeBasma === f) mockSekmeBasma = null;
      };
    },
  }),
}));

const IST = 'Europe/Istanbul';
const mekan = (id: string, place_id: string, primary_type: string) => ({
  id,
  trip_id: 't1',
  place_id,
  primary_type,
  lat: 39.77 + id.length * 0.001,
  lng: 30.52,
  google_fetched_at: '',
  default_minutes: 60,
  added_by: id === 'm22' ? 'ayse' : 'ben',
  note: null,
  created_at: `2026-10-0${id.length}T00:00:00Z`,
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

/** 3 gün: 1. gün müze (adı DB'de) + restoran (adı yalnız Google'da, Ayşe ekledi), 2. gün park; elle sıralı günler. */
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
    days: [1, 2, 3].map((i) => ({ id: `g${i}`, trip_id: 't1', index: i, date: tarihEkle(baslangic, i - 1), start_time: '09:30:00', end_time: null, order_manual: true, start_stay_id: null, end_stay_id: null })),
    places: [mekan('m1', 'ChIJ-db-1', 'museum'), mekan('m22', 'ChIJ-google-2', 'restaurant'), mekan('m333', 'ChIJ-google-3', 'park')],
    stops: [durak('d1', 'g1', 'm1', 'a0'), durak('d2', 'g1', 'm22', 'a1'), durak('d3', 'g2', 'm333', 'a0')],
    stays: [],
    members: [
      { trip_id: 't1', user_id: 'ben', guest: false, display_name: 'Ece', role: 'owner', joined_at: '2026-10-01T00:00:00Z' },
      { trip_id: 't1', user_id: 'ayse', guest: false, display_name: 'Ayşe', role: 'member', joined_at: '2026-10-02T00:00:00Z' },
    ],
    profiles: [],
    oylar: [{ mekan: 'm1', kullanici: 'ayse' }],
    bacak_modlari: [],
    sehirler: [{ id: 's1', ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null, lat: 39.7767, lng: 30.5206, ozet: null, geziler: [{ count: 1 }] }],
    // Rehber: listede olmayan yakın yer (akşam önerisi) ve 2. günün parkının rehber yazısı.
    yerler: [
      { id: 'y1', sehir_id: 's1', place_id: 'ChIJ-rehber-1', ad: 'Sazova Bilim Müzesi', kategori: 'museum', rehber_md: null, kapak_url: null, one_cikan_sira: 1, lat: 39.775, lng: 30.521 },
      { id: 'y2', sehir_id: 's1', place_id: 'ChIJ-google-3', ad: 'Kent Parkı', kategori: 'park', rehber_md: 'Porsuk kıyısında…', kapak_url: null, one_cikan_sira: 2, lat: 39.774, lng: 30.52 },
    ],
  };
}

const fetchSahte = jest.fn(async () => {
  throw new Error('ağ isteği beklenmiyordu');
});
const eskiFetch = globalThis.fetch;
const acik: { unmount: () => void; qc: QueryClient }[] = [];
beforeEach(() => {
  fetchSahte.mockClear();
  globalThis.fetch = fetchSahte as unknown as typeof fetch;
  hafifOnbellek.temizle();
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const sarmal = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SeyahatIdSaglayici id="t1">{children}</SeyahatIdSaglayici>
    </QueryClientProvider>
  );
  const r = render(<ProgramEkrani />, { wrapper: sarmal });
  acik.push({ unmount: r.unmount, qc });
  return { ...r, qc };
}
const sakinles = async (qc: QueryClient) => {
  await waitFor(() => expect(qc.isFetching()).toBe(0));
  await new Promise((c) => setTimeout(c, 10));
  await waitFor(() => expect(qc.isFetching()).toBe(0));
};

describe('#182 KK7 · #667: Plan sekmesi (genel bakış → gün detayı) Google isteği doğurmaz', () => {
  it('genel bakış: başlık, ⋯, gün lejantı, gün kartları (K durak · X / 8 sa, dolgu), boş gün + Doldur', async () => {
    const bas = tarihEkle(yerelTarih(new Date(), IST), 12);
    const f = fikstur(bas);
    // Güne konmamış bir yer: "Güne konmamış 1 yer · Yerleştir ›".
    f.places = [...f.places, mekan('m4444', 'ChIJ-google-4', 'cafe')];
    sahteSifirla(f, { 'ChIJ-db-1': { ad: 'Eti Arkeoloji Müzesi', kategori: 'museum' } });
    const { getByText, getByLabelText, getByTestId, queryByText, qc } = ciz();
    await waitFor(() => getByLabelText(t('plan.diger')));
    await sakinles(qc);

    // KK3 üst: "Plan", yüzler (Grup penceresi) ve ⋯; v7p'nin gün sekmeleri ve harita düğmesi yok.
    expect(getByText('Plan')).toBeTruthy();
    expect(getByLabelText(t('seyahat.grup.baslik'))).toBeTruthy();
    expect(queryByText(gunEtiketi({ index: 2, date: tarihEkle(bas, 1) }))).toBeNull();
    expect(queryByText('Haritada gör')).toBeNull();
    // Harita: lejantta yalnız durağı olan günler; dokununca tam harita.
    expect(getByText('1. gün')).toBeTruthy();
    expect(getByText('2. gün')).toBeTruthy();
    expect(queryByText('3. gün')).toBeNull();
    expect(getByLabelText(t('planV13.haritayiAc'))).toBeTruthy();
    // "Güne konmamış N yer · Yerleştir ›" → Listem.
    expect(getByText('Güne konmamış 1 yer')).toBeTruthy();
    fireEvent.press(getByLabelText('Güne konmamış 1 yer. Yerleştir'));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/listem', params: { id: 't1' } });

    // Gün kartları: "1. gün · Per 7 Ocak", "2 durak · X / 8 sa" ve dolgu çubuğu (gün renginde).
    expect(getByText(gunBasligiV13({ index: 1, date: bas }))).toBeTruthy();
    expect(getByText(/^2 durak · [\d,]+ \/ 8 sa$/)).toBeTruthy();
    expect(getByText(/^1 durak · [\d,]+ \/ 8 sa$/)).toBeTruthy();
    const dolgu = StyleSheet.flatten(getByTestId('dolgu:g1').props.style);
    expect(dolgu.backgroundColor).toBe(gunRengi(1));
    expect(String(dolgu.width)).toMatch(/^\d+%$/);
    // Boş gün: kesik çerçeve, "Boş gün" ve "+ Doldur" → Yer ekle o gün seçili.
    expect(getByText(t('planV13.bosGun'))).toBeTruthy();
    fireEvent.press(getByText(t('planV13.doldur')));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: expect.objectContaining({ id: 't1', gun: '3' }) });

    expect(sahte.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
  });

  it('gün detayı: geri, başlık, Düzenle, özet satırı, otel satırı, saatli satırlar, ekleyenin yüzü, + Durak ekle', async () => {
    const bas = tarihEkle(yerelTarih(new Date(), IST), 12);
    sahteSifirla(fikstur(bas), { 'ChIJ-db-1': { ad: 'Eti Arkeoloji Müzesi', kategori: 'museum' } });
    const { getByText, getByLabelText, getAllByText, queryByText, getAllByRole, qc, UNSAFE_root } = ciz();
    await waitFor(() => getByLabelText(t('plan.diger')));
    await sakinles(qc);
    const baslik1 = gunBasligiV13({ index: 1, date: bas });
    fireEvent.press(getByLabelText(new RegExp(`^${baslik1}, 2 durak`)));
    await waitFor(() => getByText(t('planV13.duzenle')));
    await sakinles(qc);

    // KK4 üst: geri + "1. gün · …" + "Düzenle".
    expect(getByLabelText(t('planV13.geri'))).toBeTruthy();
    expect(getByText(baslik1)).toBeTruthy();
    // Özet: "2 durak · 09:30–HH:MM · km".
    expect(getByText(/^2 durak · 09:30–\d\d:\d\d · [\d,]+ (m|km)$/)).toBeTruthy();
    // Otel yok → "Otel ekle" satırı.
    expect(getByText(t('plan.otelEkle'))).toBeTruthy();
    // Satırlar: saat sütunu, DB'deki ad, Google'da kalan ad yerine kategori; alt satır "tür · süre".
    expect(getByText('09:30')).toBeTruthy();
    expect(getByText('Eti Arkeoloji Müzesi')).toBeTruthy();
    expect(getByText('Restoran')).toBeTruthy();
    expect(getByText(/^Müze · \d+ (dk|sa)/)).toBeTruthy();
    // Bacak "süre · mesafe" (yürüme).
    expect(getAllByText(/^~?\d+ dk · [\d,]+ (m|km)$/).length).toBe(1);
    // Sağda ekleyenin yüzü: ekran okuyucu "Sen ekledin" / "Ayşe ekledi".
    const etiketler = getAllByRole('button').map((b) => String(b.props.accessibilityLabel ?? ''));
    expect(etiketler.some((e) => e.includes('Eti Arkeoloji Müzesi') && e.endsWith(t('planV13.sen')))).toBe(true);
    expect(etiketler.some((e) => e.includes('Restoran') && e.endsWith('Ayşe ekledi'))).toBe(true);
    // Sabit turuncu "+ Durak ekle" → Yer ekle bu gün seçili; v7p'nin "Bu güne yer ekle" satırı yok.
    expect(queryByText(t('plan.buGuneEkle'))).toBeNull();
    fireEvent.press(getByText(t('planV13.durakEkle')));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: expect.objectContaining({ id: 't1', gun: '1' }) });

    // Bugün olmayan gün: "Akşam için yakında" yok (KK4: yalnız bugünün detayında).
    fireEvent.press(getByLabelText(t('planV13.geri')));
    fireEvent.press(getByLabelText(new RegExp(`^${gunBasligiV13({ index: 2, date: tarihEkle(bas, 1) })}, 1 durak`)));
    await waitFor(() => getByText('Park'));
    await sakinles(qc);
    expect(queryByText('Restoran')).toBeNull();
    expect(queryByText(t('plan.aksamYakinda'))).toBeNull();

    // Boş gün detayı: "{gün} henüz boş" ve açıklama; Düzenle yok, "+ Durak ekle" var.
    fireEvent.press(getByLabelText(t('planV13.geri')));
    fireEvent.press(getByLabelText(new RegExp(`^${gunBasligiV13({ index: 3, date: tarihEkle(bas, 2) })}, Boş gün`)));
    await waitFor(() => getByText(/ henüz boş$/));
    expect(queryByText(/0 durak/)).toBeNull();
    expect(getByText(t('plan.bosGunMetinListemBos'))).toBeTruthy();
    expect(queryByText(t('planV13.duzenle'))).toBeNull();
    expect(getByText(t('planV13.durakEkle'))).toBeTruthy();
    await sakinles(qc);

    // ⋯ (genel bakış) → en altta "Günü sil" → onay çekmecesi; seçili gün (boş 3. gün) → "Bu günde durak yok.".
    fireEvent.press(getByLabelText(t('planV13.geri')));
    fireEvent.press(getByLabelText(t('plan.diger')));
    fireEvent.press(getByText(t('gunler.gunuSil')));
    // #570 KK8: iOS'ta onay, ⋯ Modal'ı kapandıktan sonra (`onDismiss`) açılır; jest'in Modal'ı onDismiss'i kendisi çağırmaz.
    if (Platform.OS === 'ios') {
      act(() => {
        for (const m of UNSAFE_root.findAllByType(Modal)) (m.props as { onDismiss?: () => void }).onDismiss?.();
      });
    }
    await waitFor(() => getByText(/ silinsin mi\?$/));
    expect(getByText(t('gunler.gunSilMetinBos'))).toBeTruthy();
    fireEvent.press(getAllByText(t('genel.vazgec')).at(-1)!);

    expect(sahte.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
  });

  it('gezi modu: bugünün detayında geçilen durak ✓, sıradaki vurgulu; durağa dokununca durak çekmecesi — yine Google isteği yok', async () => {
    const bas = yerelTarih(new Date(), IST);
    const f = fikstur(bas);
    f.stops = [
      { ...durak('d1', 'g1', 'm1', 'a0'), arrived_at: new Date(Date.now() - 40 * 60_000).toISOString(), completed_at: new Date(Date.now() - 10 * 60_000).toISOString() },
      durak('d2', 'g1', 'm22', 'a1'),
      durak('d3', 'g2', 'm333', 'a0'),
    ];
    sahteSifirla(f, { 'ChIJ-db-1': { ad: 'Eti Arkeoloji Müzesi', kategori: 'museum' } });
    const { getByText, getByLabelText, getAllByRole, qc } = ciz();
    await waitFor(() => getByLabelText(t('plan.diger')));
    await sakinles(qc);
    fireEvent.press(getByLabelText(new RegExp(`^${gunBasligiV13({ index: 1, date: bas })}, `)));
    await waitFor(() => getByText(t('planV13.duzenle')));
    await sakinles(qc);
    // KK5: gezilen durağın alt satırında "· gezildi".
    expect(getByText('Eti Arkeoloji Müzesi')).toBeTruthy();
    expect(getByText(/^Müze · .* · gezildi$/)).toBeTruthy();
    // #553 KK2: sıradaki durak etiketinde "sıradaki durak".
    const vurgulu = getAllByRole('button').filter((b) => String(b.props.accessibilityLabel ?? '').includes(`, ${t('plan.siradakiDurak')}`));
    expect(vurgulu.length).toBe(1);
    expect(within(vurgulu[0]).queryByText('Restoran')).toBeTruthy();
    // KK5: durağa dokununca #580 durak çekmecesi (Gezdim · Yol tarifi · Atla · Yarına taşı · Çıkar).
    fireEvent.press(vurgulu[0]);
    await waitFor(() => getByText(t('durakCekmecesi.gezdim')));
    expect(getByText(t('durakCekmecesi.yolTarifi'))).toBeTruthy();
    expect(getByText(t('durakCekmecesi.atla'))).toBeTruthy();
    expect(getByText(t('durakCekmecesi.yarinaTasi'))).toBeTruthy();
    expect(getByText(t('durakCekmecesi.cikar'))).toBeTruthy();
    expect(sahte.invoke).toEqual([]);
    expect(fetchSahte).not.toHaveBeenCalled();
  });

  it('Gezi sayfasının gün kartından (gun parametresi) doğrudan o günün detayı açılır', async () => {
    const bas = tarihEkle(yerelTarih(new Date(), IST), 12);
    sahteSifirla(fikstur(bas), { 'ChIJ-db-1': { ad: 'Eti Arkeoloji Müzesi', kategori: 'museum' } });
    mockParametreler = { gun: '2' };
    const { getByText, qc } = ciz();
    await waitFor(() => getByText(gunBasligiV13({ index: 2, date: tarihEkle(bas, 1) })));
    await sakinles(qc);
    expect(getByText(t('planV13.duzenle'))).toBeTruthy();
    expect(getByText('Park')).toBeTruthy();
    mockParametreler = {};
  });
  it('KK3: sekmeden çıkınca ve açık sekmeye yeniden basınca gün detayı kapanır, Plan genel bakışla açılır', async () => {
    const bas = tarihEkle(yerelTarih(new Date(), IST), 12);
    sahteSifirla(fikstur(bas), { 'ChIJ-db-1': { ad: 'Eti Arkeoloji Müzesi', kategori: 'museum' } });
    const { getByText, getByLabelText, queryByText, qc } = ciz();
    await waitFor(() => getByLabelText(t('plan.diger')));
    await sakinles(qc);
    const kart = new RegExp(`^${gunBasligiV13({ index: 1, date: bas })}, 2 durak`);
    fireEvent.press(getByLabelText(kart));
    await waitFor(() => getByText(t('planV13.duzenle')));
    // Sekmeden çıkış (odak kaybı) → genel bakış.
    act(() => mockOdakKaybi?.());
    await waitFor(() => getByLabelText(t('plan.diger')));
    expect(queryByText(t('planV13.duzenle'))).toBeNull();
    // Açık Plan sekmesine yeniden basma → genel bakış.
    fireEvent.press(getByLabelText(kart));
    await waitFor(() => getByText(t('planV13.duzenle')));
    act(() => mockSekmeBasma?.());
    await waitFor(() => getByLabelText(t('plan.diger')));
    expect(queryByText(t('planV13.duzenle'))).toBeNull();
    await sakinles(qc);
  });

  it('boş gün kartında "Doldur" ayrı bir düğme (ekran okuyucu ayrı odaklanır); "+ Durak ekle" etiketi "Durak ekle"', async () => {
    const bas = tarihEkle(yerelTarih(new Date(), IST), 12);
    sahteSifirla(fikstur(bas), { 'ChIJ-db-1': { ad: 'Eti Arkeoloji Müzesi', kategori: 'museum' } });
    const { getByText, getByLabelText, qc } = ciz();
    await waitFor(() => getByLabelText(t('plan.diger')));
    await sakinles(qc);
    const baslik3 = gunBasligiV13({ index: 3, date: tarihEkle(bas, 2) });
    const doldur = getByLabelText(t('planV13.doldurEtiket', { gun: baslik3 }));
    const kart = getByLabelText(new RegExp(`^${baslik3}, Boş gün`));
    // İç içe değil: Doldur kartın torunu değil.
    expect(within(kart).queryByText(t('planV13.doldur'))).toBeNull();
    expect(within(doldur).getByText(t('planV13.doldur'))).toBeTruthy();
    fireEvent.press(kart);
    await waitFor(() => getByText(t('planV13.durakEkle')));
    expect(getByLabelText(t('planV13.durakEkleEtiket'))).toBeTruthy();
    // Başlık geri düğmesinden ayrı, başlık rolüyle.
    expect(getByText(baslik3).props.accessibilityRole).toBe('header');
    await sakinles(qc);
  });

  it('gün detayı açıkken gün silinince genel bakışa döner (başka günün detayına düşmez)', async () => {
    const bas = tarihEkle(yerelTarih(new Date(), IST), 12);
    sahteSifirla(fikstur(bas), { 'ChIJ-db-1': { ad: 'Eti Arkeoloji Müzesi', kategori: 'museum' } });
    const { getByText, getByLabelText, getAllByText, queryByText, qc } = ciz();
    await waitFor(() => getByLabelText(t('plan.diger')));
    // 2. günün detayı açılır.
    // 2. günün detayı açılır, genel bakışa dönmeden aynı gün seçili kalır; ⋯ genel bakışta, detay durumu korunarak sil.
    fireEvent.press(getByLabelText(new RegExp(`^${gunBasligiV13({ index: 2, date: tarihEkle(bas, 1) })}, 1 durak`)));
    await waitFor(() => getByText('Park'));
    await sakinles(qc);
    // Detaydan "Düzenle" → sıralama haritası; gün seçicide 2. güne uzun bas → "Günü sil" onayı (gün detayı durumu açıkken).
    fireEvent.press(getByText(t('planV13.duzenle')));
    await waitFor(() => getByLabelText('2. gün · 1 durak'));
    fireEvent(getByLabelText('2. gün · 1 durak'), 'longPress');
    await waitFor(() => getByText(/ silinsin mi\?$/));
    fireEvent.press(getAllByText(t('gunler.gunuSil')).at(-1)!);
    await waitFor(() => expect(queryByText(/ silinsin mi\?$/)).toBeNull());
    // Haritadan listeye dönünce genel bakış (silinen günün yerine başka günün detayı değil).
    fireEvent.press(getByLabelText(t('genel.geri')));
    await waitFor(() => getByLabelText(t('plan.diger')));
    expect(queryByText(t('planV13.duzenle'))).toBeNull();
    // Harita açıldığı için Google istekleri (sahte, başarısız) burada beklenir; sakinleşme beklenmez.
  });
});
