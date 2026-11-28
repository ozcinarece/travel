// #199 KK1 · KK3 · KK4: önerilen gezi ekranı üç yayınlı geziyle (gerçek yapı: iki gezi repo JSON'undan — eskisehirde-uc-gun,
// odunpazarindan-sazovaya-uc-gun, 7/6/7 durak; eskisehir-iki-gun DB'deki biçimiyle 6/5 durak, place_id'siz) iki sekmede açılır.
// Supabase sahte; `geziler` sorgusu PostgREST gibi davranır: şema #192 sonrası haliyle (gezi_rota_onbellek iki tabloya anahtarlı)
// ipuçsuz `gezi_duraklari(…)` gömmesi PGRST201 döner — 14 Ekim akşamı telefonda olan buydu.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { GeziDetay } from '@/lib/tipler';

import GeziEkrani from '@/app/gezi/[slug]';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';

type Satir = Record<string, unknown>;
const mockDurum = {
  slug: '',
  geziler: {} as Record<string, GeziDetay>,
  /** #192 sonrası prod şeması: ipuçsuz gezi_gunleri → gezi_duraklari gömmesi belirsiz. */
  belirsizSema: true,
  /** Sonraki N gezi sorgusu ağ hatası döner. */
  hataVer: 0,
  secimler: [] as string[],
  olaylar: [] as Satir[],
  haritaPatlasin: false,
  yaziPatlasin: false,
  haritaCizgileri: 0,
  /** Haritaya giden pinlerin etiketleri (durak numarası). */
  haritaPinleri: [] as string[],
  cevrimdisi: false,
};

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ slug: mockDurum.slug }),
}));
jest.mock('@/lib/baglanti', () => ({
  ...jest.requireActual<object>('@/lib/baglanti'),
  useCevrimdisi: () => mockDurum.cevrimdisi,
}));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben', is_anonymous: false } }, hazir: true, hesapli: true }) }));
// Harita yerel modül ister; yerine koordinatları denetleyen basit bileşen (KK2: NaN koordinat haritaya gitmez).
jest.mock('@/components/harita/Harita', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    Harita: (p: { pinler?: { konum: { lat: number; lng: number }; etiket?: string }[]; cizgiler?: { noktalar: { lat: number; lng: number }[] }[] }) => {
      if (mockDurum.haritaPatlasin) throw new Error('harita bozuk');
      for (const k of [...(p.pinler ?? []).map((x) => x.konum), ...(p.cizgiler ?? []).flatMap((c) => c.noktalar)]) {
        if (!Number.isFinite(k.lat) || !Number.isFinite(k.lng)) throw new Error('NaN koordinat');
      }
      mockDurum.haritaCizgileri = p.cizgiler?.length ?? 0;
      mockDurum.haritaPinleri = (p.pinler ?? []).map((x) => x.etiket ?? '');
      return R.createElement(View, { testID: 'harita' });
    },
  };
});
jest.mock('@/components/icerik/MdYazi', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  const { MdYazi: Gercek } = jest.requireActual<{ MdYazi: (p: object) => null }>('@/components/icerik/MdYazi');
  return {
    MdYazi: (p: object) => {
      if (mockDurum.yaziPatlasin) throw new Error('yazı bozuk');
      return R.createElement(Gercek, p);
    },
  };
});
jest.mock('@/lib/supabase', () => {
  const sorgu = (tablo: string) => {
    let secim = '';
    const filtre: Record<string, unknown> = {};
    let tek = false;
    let yazma: Satir | null = null;
    const z: Record<string, unknown> = {};
    for (const k of ['order', 'in', 'gte', 'not', 'limit', 'match', 'delete', 'is', 'neq', 'gt', 'lt']) z[k] = () => z;
    z.select = (s = '') => ((secim = s), z);
    z.insert = (r: Satir) => ((yazma = r), z);
    z.eq = (k: string, v: unknown) => ((filtre[k] = v), z);
    z.single = () => ((tek = true), z);
    z.maybeSingle = () => ((tek = true), z);
    z.then = (coz: (v: unknown) => unknown, red: (e: unknown) => unknown) => {
      const cevap = (v: unknown) => Promise.resolve(v).then(coz, red);
      if (yazma) {
        if (tablo === 'olaylar') mockDurum.olaylar.push(yazma);
        return cevap({ data: null, error: null });
      }
      if (tablo === 'geziler' && tek) {
        mockDurum.secimler.push(secim);
        if (mockDurum.hataVer > 0) {
          mockDurum.hataVer--;
          return cevap({ data: null, error: { code: 'PGRST201', message: "Could not embed because more than one relationship was found for 'gezi_gunleri' and 'gezi_duraklari'" } });
        }
        if (mockDurum.belirsizSema && /gezi_duraklari\(/.test(secim)) {
          return cevap({ data: null, error: { code: 'PGRST201', message: "Could not embed because more than one relationship was found for 'gezi_gunleri' and 'gezi_duraklari'" } });
        }
        return cevap({ data: mockDurum.geziler[filtre.slug as string] ?? null, error: null });
      }
      return cevap({ data: tek ? null : [], error: null });
    };
    return z;
  };
  return {
    supabase: {
      from: sorgu,
      rpc: async (ad: string) => ({ data: ad === 'gezi_alinma_sayisi' ? 2 : [], error: null }),
      functions: {
        // gezi-rota: sunucu gibi günün bacakları (biri araç, biri yolu boş — KK2); diğer fonksiyonlar (Google) kapalı.
        invoke: async (ad: string, { body }: { body: { gezi_gun_id?: string } }) => {
          if (ad !== 'gezi-rota') return { data: null, error: new Error('kapalı') };
          const gun = Object.values(mockDurum.geziler)
            .flatMap((g) => g.gezi_gunleri)
            .find((g) => g.id === body.gezi_gun_id);
          const d = gun?.gezi_duraklari ?? [];
          const bacaklar = d.slice(1).map((b, i) => ({
            kimden_durak_id: d[i].id,
            kime_durak_id: b.id,
            mod: i === 2 ? 'DRIVE' : 'WALK',
            polyline: i === 1 ? '' : '_p~iF~ps|U_ulLnnqC',
            saniye: i === 2 ? 3000 : 540,
            metre: 700,
            arac_saniye: i === 2 ? 600 : null,
            arac_metre: null,
            arac_polyline: null,
            fetched_at: new Date().toISOString(),
          }));
          return { data: { bacaklar }, error: null };
        },
      },
    },
  };
});

// ---------------------------------------------------------------- KK1 verisi

const KATEGORILER = ['mosque', 'historical_landmark', 'shopping_mall', 'restaurant', 'art_museum', 'museum', 'park', 'zoo', 'bakery', 'kebab_shop', 'amusement_center', 'tourist_attraction'];
type JsonGezi = { gezi: { baslik: string; yazi_md: string; yazar_ad?: string }; gunler: { baslik: string; duraklar: { place_id: string | null; ad: string; sure_dk: number }[] }[] };

function geziKur(slug: string, j: JsonGezi): GeziDetay {
  let n = 0;
  const gunler = j.gunler.map((g, gi) => ({
    id: `${slug}:G${gi + 1}`,
    gezi_id: slug,
    sira: gi + 1,
    baslik: g.baslik,
    gezi_duraklari: g.duraklar.map((d, di) => {
      n += 1;
      return { id: `${slug}:D${n}`, gezi_gun_id: `${slug}:G${gi + 1}`, sira: di + 1, place_id: d.place_id, ad: d.ad, kategori: KATEGORILER[n % KATEGORILER.length], sure_dk: d.sure_dk, lat: 39.76 + n / 500, lng: 30.5 + di / 400 };
    }),
  }));
  return {
    id: slug,
    sehir_id: 'eskisehir',
    baslik: j.gezi.baslik,
    slug,
    kapak_url: null,
    ozet: 'özet',
    yazi_md: j.gezi.yazi_md,
    yazar_ad: j.gezi.yazar_ad ?? 'Editör',
    gun_sayisi: gunler.length,
    mekan_sayisi: n,
    sira: null,
    created_at: '2026-10-14T17:00:00Z',
    sehirler: { ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null },
    gezi_gunleri: gunler,
  } as unknown as GeziDetay;
}

const dosya = (slug: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../icerik/geziler', `${slug}.json`), 'utf8')) as JsonGezi;
// eskisehir-iki-gun repoda yok; DB'deki biçimi (#199 tanı: 2 gün 6 + 5 durak, place_id'lerin hepsi boş, alıntılı kısa yazı).
const IKI_GUN: JsonGezi = {
  gezi: { baslik: 'Eskişehir’de iki gün', yazi_md: '## Birinci gün\n\nOdunpazarı sokakları.\n\n> Porsuk kıyısında akşam.\n\n## İkinci gün\n\nSazova.' },
  gunler: [
    { baslik: 'Odunpazarı', duraklar: ['Kurşunlu', 'Odunpazarı Evleri', 'Atlıhan', 'Kahve', 'OMM', 'Seyir terası'].map((ad) => ({ place_id: null, ad, sure_dk: 45 })) },
    { baslik: 'Porsuk', duraklar: ['Sazova', 'Masal Şatosu', 'Lokanta', 'Kent Park', 'Köprü'].map((ad) => ({ place_id: null, ad, sure_dk: 60 })) },
  ],
};
const GEZILER: Record<string, JsonGezi> = {
  'odunpazarindan-sazovaya-uc-gun': dosya('odunpazarindan-sazovaya-uc-gun'),
  'eskisehirde-uc-gun': dosya('eskisehirde-uc-gun'),
  'eskisehir-iki-gun': IKI_GUN,
};

const istemciler: QueryClient[] = [];
afterEach(() => istemciler.splice(0).forEach((qc) => qc.clear()));

function ac(slug: string) {
  mockDurum.slug = slug;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  istemciler.push(qc);
  return render(
    <QueryClientProvider client={qc}>
      <GeziEkrani />
    </QueryClientProvider>,
  );
}
const bekle = () => act(async () => new Promise((r) => setTimeout(r, 30)));

describe('#199 önerilen gezi ekranı', () => {
  let konsol: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    mockDurum.geziler = Object.fromEntries(Object.entries(GEZILER).map(([slug, j]) => [slug, geziKur(slug, j)]));
    mockDurum.belirsizSema = true;
    mockDurum.hataVer = 0;
    mockDurum.secimler = [];
    mockDurum.olaylar = [];
    mockDurum.haritaPatlasin = false;
    mockDurum.yaziPatlasin = false;
    mockDurum.cevrimdisi = false;
    // Hata sınırı testlerinde React'in beklenen hata günlüğü.
    konsol = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => konsol.mockRestore());

  for (const slug of Object.keys(GEZILER)) {
    it(`KK1/KK4: ${slug} — Rota & plan (her gün) ve Gezi yazısı açılır, görüntülenme yazılır`, async () => {
      const g = mockDurum.geziler[slug];
      ac(slug);
      expect(await screen.findByText(g.baslik)).toBeTruthy();
      // Gün 1 durakları + harita; gerçek yol gelir (gezi-rota), bozuk / boş yollu bacak kuş uçuşunda kalır.
      expect(screen.getByText(g.gezi_gunleri[0].gezi_duraklari[0].ad)).toBeTruthy();
      expect(screen.getByTestId('harita')).toBeTruthy();
      await waitFor(() => expect(screen.getByText(/dk araç/)).toBeTruthy());
      for (const gun of g.gezi_gunleri.slice(1)) {
        fireEvent.press(screen.getByText(`${gun.sira}. gün · ${gun.gezi_duraklari.length}`));
        expect(await screen.findByText(gun.gezi_duraklari[gun.gezi_duraklari.length - 1].ad)).toBeTruthy();
        expect(mockDurum.haritaCizgileri).toBe(gun.gezi_duraklari.length - 1);
      }
      fireEvent.press(screen.getByText('Gezi yazısı'));
      await bekle();
      expect(screen.getAllByText(/dk okuma/).length).toBeGreaterThan(0);
      expect(screen.queryByTestId(/^bolum-hata/)).toBeNull();
      // #291 KK5 (Ekran 17): yazar logosu 18×11, kesik çizgi.
      const logo = screen.UNSAFE_getAllByType(Svg).find((x) => x.props.accessibilityLabel === 'Tripmate');
      expect([logo?.props.width, logo?.props.height]).toEqual([18, 10.8]);
      expect(logo?.findByType(Path).props.strokeDasharray).toBe('7 4.5');
      expect(mockDurum.olaylar).toEqual([expect.objectContaining({ tur: 'gezi_goruntulendi', hedef_id: g.id })]);
    });
  }

  it('kök neden: #192 şemasında gezi sorgusu durakları AÇIK ilişkiyle gömer (ipuçsuz gömme PGRST201)', async () => {
    ac('odunpazarindan-sazovaya-uc-gun');
    expect(await screen.findByText(mockDurum.geziler['odunpazarindan-sazovaya-uc-gun'].baslik)).toBeTruthy();
    expect(mockDurum.secimler[0]).toContain('gezi_duraklari!gezi_duraklari_gezi_gun_id_fkey(');
    expect(mockDurum.secimler[0]).not.toMatch(/gezi_duraklari\(/);
  });

  it('gezi yüklenemezse sebep görünür ve "Yeniden dene" sayfayı açar', async () => {
    mockDurum.hataVer = 1;
    ac('eskisehirde-uc-gun');
    expect(await screen.findByText(/PGRST201 · Could not embed/)).toBeTruthy();
    fireEvent.press(screen.getByText('Yeniden dene'));
    expect(await screen.findByText(mockDurum.geziler['eskisehirde-uc-gun'].baslik)).toBeTruthy();
  });

  it('KK3: harita hata verirse yalnız harita bölümü kart olur; başlık, gün çipleri ve duraklar çalışır', async () => {
    mockDurum.haritaPatlasin = true;
    const g = mockDurum.geziler['odunpazarindan-sazovaya-uc-gun'];
    ac(g.slug);
    expect(await screen.findByTestId('bolum-hata:gezi-harita')).toBeTruthy();
    expect(screen.getByText('harita bozuk')).toBeTruthy();
    expect(screen.getByText(g.baslik)).toBeTruthy();
    // #351 KK4: kapak başlığı en çok 2 satır, taşan kısım "…" ile biter.
    expect(screen.getByText(g.baslik).props.numberOfLines).toBe(2);
    expect(screen.getByText(g.baslik).props.ellipsizeMode).toBe('tail');
    expect(screen.getByText(g.gezi_gunleri[0].gezi_duraklari[6].ad)).toBeTruthy();
    expect(screen.getByText('Seyahatime al')).toBeTruthy();
    // Harita düzelince "Yeniden dene" bölümü geri getirir.
    mockDurum.haritaPatlasin = false;
    fireEvent.press(screen.getByText('Yeniden dene'));
    expect(await screen.findByTestId('harita')).toBeTruthy();
  });

  it('KK3: gezi yazısı hata verirse yalnız yazı bölümü kart olur; Rota & plan sekmesi çalışır', async () => {
    mockDurum.yaziPatlasin = true;
    const g = mockDurum.geziler['eskisehirde-uc-gun'];
    ac(g.slug);
    await screen.findByText(g.baslik);
    fireEvent.press(screen.getByText('Gezi yazısı'));
    expect(await screen.findByTestId('bolum-hata:gezi-yazi')).toBeTruthy();
    expect(screen.getByText(g.baslik)).toBeTruthy();
    fireEvent.press(screen.getByText('Rota & plan'));
    expect(await screen.findByText(g.gezi_gunleri[0].gezi_duraklari[0].ad)).toBeTruthy();
    expect(screen.queryByTestId('bolum-hata:gezi-plan')).toBeNull();
  });

  it('KK2: konumu bozuk durak haritaya girmez, sayfa açılır', async () => {
    const g = mockDurum.geziler['eskisehir-iki-gun'];
    g.gezi_gunleri[0].gezi_duraklari[2] = { ...g.gezi_gunleri[0].gezi_duraklari[2], lat: Number.NaN };
    ac(g.slug);
    expect(await screen.findByText(g.gezi_gunleri[0].gezi_duraklari[2].ad)).toBeTruthy();
    expect(screen.getByTestId('harita')).toBeTruthy();
    expect(screen.queryByTestId(/^bolum-hata/)).toBeNull();
  });
  it('#205 Parça 1 KK2: konumu boşalmış durak (lat/lng null) haritaya girmez, listede numarasıyla kalır; yol tarifi adla açılır', async () => {
    const g = geziKur('konumsuz-gezi', {
      gezi: { baslik: 'Konumsuz gezi', yazi_md: 'Kaleye çık.' },
      gunler: [
        {
          baslik: 'Gün',
          duraklar: [
            { place_id: 'ChIJkaleTest01', ad: 'Kale', sure_dk: 45 },
            { place_id: 'ChIJcarsiTest01', ad: 'Çarşı', sure_dk: 30 },
            { place_id: 'ChIJparkTest001', ad: 'Park', sure_dk: 30 },
          ],
        },
      ],
    });
    const d = g.gezi_gunleri[0].gezi_duraklari;
    d[1] = { ...d[1], lat: null, lng: null };
    mockDurum.geziler = { 'konumsuz-gezi': g };
    const ac2 = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    ac('konumsuz-gezi');
    expect(await screen.findByText('Çarşı')).toBeTruthy();
    await bekle();
    // Harita açılır; konumsuz 2. durağın pini ve iki yanındaki bacağın çizgisi yok, öbür duraklar numaralarını korur.
    expect(screen.getByTestId('harita')).toBeTruthy();
    expect(mockDurum.haritaPinleri).toEqual(['1', '3']);
    expect(mockDurum.haritaCizgileri).toBe(0);
    expect(screen.getByText('Kale')).toBeTruthy();
    expect(screen.getByText('Park')).toBeTruthy();
    expect(screen.queryByTestId(/^bolum-hata/)).toBeNull();
    // Durağa dokununca panel açılır; yol tarifi koordinat yerine adla (place_id ayrıca) gider, "null,null" olmaz.
    fireEvent.press(screen.getByText('Çarşı'));
    await bekle();
    const panelKok = screen.UNSAFE_getByType(MekanPaneli).findAll((n) => typeof (n.props as { onLayout?: unknown }).onLayout === 'function')[0];
    act(() => (panelKok.props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } }));
    fireEvent.press(screen.getByText('Yol tarifi'));
    expect(ac2).toHaveBeenCalledWith(expect.stringContaining(`destination=${encodeURIComponent('Çarşı')}&destination_place_id=ChIJcarsiTest01`));
    expect(String(ac2.mock.calls[0][0])).not.toContain('null');
    ac2.mockRestore();
  });
  it('#205 Parça 1: konumsuz uçlu bacak "Yol süresi bilinmiyor" (kanvas 24b-A), toplama ve mesafeye katılmaz; mesafe 0 ise özette yok', async () => {
    const duraklar = [
      { place_id: 'ChIJkaleTest01', ad: 'Kale', sure_dk: 45 },
      { place_id: 'ChIJcarsiTest01', ad: 'Çarşı', sure_dk: 30 },
      { place_id: 'ChIJparkTest001', ad: 'Park', sure_dk: 30 },
      { place_id: 'ChIJkopruTest01', ad: 'Köprü', sure_dk: 20 },
    ];
    const g = geziKur('yarim-konumsuz', { gezi: { baslik: 'Yarım konumsuz', yazi_md: 'x' }, gunler: [{ baslik: 'Gün', duraklar }] });
    const d = g.gezi_gunleri[0].gezi_duraklari;
    // 3. durağın konumu boşaldı; sahte gezi-rota önbellekte o bacakların eski yolunu yine döndürür (kullanılmamalı).
    d[2] = { ...d[2], lat: null, lng: null };
    const h = geziKur('hep-konumsuz', { gezi: { baslik: 'Hep konumsuz', yazi_md: 'x' }, gunler: [{ baslik: 'Gün', duraklar: duraklar.slice(0, 3) }] });
    h.gezi_gunleri[0].gezi_duraklari = h.gezi_gunleri[0].gezi_duraklari.map((x) => ({ ...x, lat: null, lng: null }));
    mockDurum.geziler = { 'yarim-konumsuz': g, 'hep-konumsuz': h };

    const r1 = ac('yarim-konumsuz');
    expect(await screen.findByText('Köprü')).toBeTruthy();
    await bekle();
    // 1→2 gerçek yol (9 dk · 700 m); 2→3 ve 3→4 bilinmiyor: "1 dk yürüyüş" yok, süre ve mesafeye eklenmez.
    expect(screen.getAllByText('Yol süresi bilinmiyor')).toHaveLength(2);
    expect(screen.getAllByTestId('gezi-bacak-bilinmiyor')).toHaveLength(2);
    expect(screen.getByText('9 dk yürüyüş')).toBeTruthy();
    expect(screen.queryByText(/^1 dk /)).toBeNull();
    expect(screen.queryByText(/dk araç/)).toBeNull();
    expect(screen.getByText('~2 sa 14 dk · 700 m yürüyüş')).toBeTruthy();
    r1.unmount();

    ac('hep-konumsuz');
    expect(await screen.findByText('Park')).toBeTruthy();
    await bekle();
    expect(screen.getAllByText('Yol süresi bilinmiyor')).toHaveLength(2);
    // Bütün duraklar konumsuz: özet yalnız süre ("0 m yürüyüş" yok).
    expect(screen.getByText('~1 sa 45 dk')).toBeTruthy();
    expect(screen.queryByText(/yürüyüş/)).toBeNull();
  });
  it('#388 KK5: çevrimdışıyken Gezi yazısındaki mekan kartı ve mekan panelindeki ekleme düğmesi pasif, ipucu var', async () => {
    const g = geziKur('cevrimdisi-gezi', {
      gezi: { baslik: 'Çevrimdışı gezi', yazi_md: 'Kaleye çık.\n\n::mekan[ChIJkaleTest01]' },
      gunler: [{ baslik: 'Gün', duraklar: [{ place_id: 'ChIJkaleTest01', ad: 'Kale', sure_dk: 45 }, { place_id: null, ad: 'Çarşı', sure_dk: 30 }] }],
    });
    mockDurum.geziler = { 'cevrimdisi-gezi': g };
    mockDurum.cevrimdisi = true;
    ac('cevrimdisi-gezi');
    expect(await screen.findByText('Çevrimdışı gezi')).toBeTruthy();
    fireEvent.press(screen.getByText('Gezi yazısı'));
    await bekle();
    const ipucu = 'Bağlantı yok; bağlanınca eklenebilir.';
    const kartDugmesi = screen.getAllByHintText(ipucu).find((d) => d.props.accessibilityLabel === 'Listeye ekle');
    expect(kartDugmesi?.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    // Karta dokununca mekan paneli açılır; ana eylemi de pasif ve ipuçlu.
    const once = screen.getAllByHintText(ipucu).length;
    fireEvent.press(screen.getAllByText('Kale').at(-1)!);
    await bekle();
    // Panel gövdesi yerleşim ölçülünce çizilir (MekanPaneli onLayout).
    const panelKok = screen.UNSAFE_getByType(MekanPaneli).findAll((n) => typeof (n.props as { onLayout?: unknown }).onLayout === 'function')[0];
    act(() => (panelKok.props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } }));
    expect(screen.getByText('Yol tarifi')).toBeTruthy();
    const sonra = screen.getAllByHintText(ipucu);
    expect(sonra.length).toBe(once + 1);
    expect(sonra.every((d) => d.props.accessibilityState?.disabled === true)).toBe(true);
  });
});
