// #574 Gezi oluşturma v11 (UX önerileri kanvası "Gezi oluşturma v11 · ONAYLI"): açılış ve süzgeçler (KK2), şehir yazılınca
// (KK3), rota kartı ve "bu rotayla gitti" (KK4), "Bunu seç" çekmecesi (KK5), "Kimlerle?" (KK6), "Geziyi oluştur" (KK7),
// metinler (KK8) ve girişteki yol arkadaşı (KK-ek1).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, Modal, Text } from 'react-native';

import { Baslik } from '@/components/gezi/SeyahatV7';
import { GeziKurEkrani } from '@/components/geziKur/GeziKurEkrani';
import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import { CekilenSayfa } from '@/components/ui/sayfaCekme';
import type { ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import {
  arkadasRotalari,
  cekmeceSecimi,
  geziSuz,
  gidenArkadaslar,
  gittiMetni,
  kaynakRotaMetni,
  sehirEslesmesi,
  sehirGezileri,
  secimGunVeBaslangic,
  tarihSatiri,
} from '@/features/geziKur/geziKur';
import { giristekiler, kimlerleKisileri } from '@/features/geziKur/kimlerle';
import type { AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { t } from '@/i18n';
import tr from '@/i18n/tr.json';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/components/harita/Harita', () => ({ Harita: () => null }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
}));
const { router: mockRouter } = jest.requireMock<{ router: { replace: jest.Mock; navigate: jest.Mock } }>('expo-router');

const gezi = (id: string, sehirId: string, sehir: string, gun: number, amaclar: string[], baslik = `${sehir} rotası ${id}`): AkisGezisi => ({
  id,
  sehir_id: sehirId,
  baslik,
  slug: id,
  kapak_url: null,
  ozet: null,
  yazi_md: null,
  yazar_ad: null,
  gun_sayisi: gun,
  mekan_sayisi: 5,
  sira: null,
  created_at: '2026-11-01',
  amaclar,
  sehirler: { ad: sehir, slug: sehir.toLowerCase() },
  gunDuraklari: Array.from({ length: gun }, () => 4),
});
// Keşfet akışının sırası (sıra, sonra yeni): ekran bu sırayı korur.
const mockGeziler: AkisGezisi[] = [
  gezi('urla', 's-izm', 'İzmir', 2, ['lezzet'], 'Urla bağ rotası'),
  gezi('esk3', 's-esk', 'Eskişehir', 3, ['kultur_tarih']),
  gezi('bolu', 's-bolu', 'Bolu', 4, ['doga']),
  gezi('esk2', 's-esk', 'Eskişehir', 2, ['lezzet', 'kultur_tarih']),
];
const mockSehirListesi = [
  { id: 's-bolu', ad: 'Bolu', slug: 'bolu', kapak_url: null, lat: 40.7, lng: 31.6 },
  { id: 's-esk', ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null, lat: 39.8, lng: 30.5 },
  { id: 's-izm', ad: 'İzmir', slug: 'izmir', kapak_url: null, lat: 38.4, lng: 27.1 },
];
const paylasim = (id: string, paylasan: string, ad: string, sehir: string, isim: string | null, gun = 2): ArkadasPaylasimi => ({
  id,
  paylasan,
  paylasan_ad: ad,
  foto: null,
  sehir,
  ad: isim,
  olusturuldu: '2026-11-20',
  gun_sayisi: gun,
  durak_sayisi: 7,
  kisi_sayisi: 2,
  kisi_kip: 'gezdi',
  begendim: false,
});
let mockPaylasimlar: ArkadasPaylasimi[] = [];
let mockGeziYukleniyor = false;
jest.mock('@/features/icerik/kesfetAkisi', () => ({ useKesfetAkisi: () => ({ data: mockGeziler, isLoading: false, isError: false }) }));
jest.mock('@/features/arkadaslar/sorgular', () => ({
  useArkadasPaylasimlari: () => ({ data: mockPaylasimlar }),
  // arkadaslarim(): en son birlikte gezilen önde.
  useArkadaslarim: () => ({
    data: [
      // Misafir (anonim) yol arkadaşı: davet alamaz, "Kimlerle?"de görünmez (PR #612 inceleme 1).
      { user_id: 'u-misafir', ad: 'Misafir', foto: null, misafir: true },
      { user_id: 'u-ayse', ad: 'Ayşe', foto: null, misafir: false },
      { user_id: 'u-mert', ad: 'Mert', foto: null, misafir: false },
      { user_id: 'u-deniz', ad: 'Deniz', foto: null, misafir: false },
      { user_id: 'u-can', ad: 'Can', foto: null, misafir: false },
    ],
  }),
}));
const mockGeziDetay = { ...mockGeziler[0], gezi_gunleri: [] };
const mockSehirSecimi = { place_id: 'p-izm', ad: 'İzmir', ikincil: '', lat: 38.4, lng: 27.1, tz: 'Europe/Istanbul', country_code: 'TR' };
jest.mock('@/features/icerik/sorgular', () => ({
  useSehirler: () => ({ data: mockSehirListesi }),
  useGezi: (slug?: string) => ({ data: slug && !mockGeziYukleniyor ? { ...mockGeziDetay, slug } : undefined, isError: false }),
}));
jest.mock('@/features/sihirbaz/girisler', () => ({ useIcerikSehirSecimi: (k?: unknown) => ({ data: k ? mockSehirSecimi : undefined, isError: false }) }));
const mockYeni = jest.fn(async (_: unknown) => ({ seyahatId: 'yeni-gezi' as string | null, gun: 2, eklenenDurak: 8, eklenenMekan: 8, cozumsuz: 0, cozumsuzler: [] }));
jest.mock('@/features/icerik/aktarSorgu', () => ({ useGezidenSeyahatAc: () => ({ mutateAsync: mockYeni }) }));
const mockAl = jest.fn(async (_: string) => 'arkadastan');
jest.mock('@/features/paylasim/alici', () => ({ usePaylasimdanAl: () => ({ mutateAsync: mockAl }) }));
const mockTarih = jest.fn(async (_: unknown) => undefined);
jest.mock('@/features/sihirbaz/taslak', () => ({ useTaslakTarihi: () => ({ mutateAsync: mockTarih }) }));
// #573: uygulama içi davet (gönderim ve gönderilenlerin durumu).
const mockGonder = jest.fn(async (_: { tripId: string; kisiler: string[] }) => 1);
jest.mock('@/features/davet/uygulamaIci', () => ({
  ...jest.requireActual<object>('@/features/davet/uygulamaIci'),
  useDavetGonder: () => ({ mutateAsync: mockGonder }),
  useGonderilenDavetler: () => ({ data: new Map([['u-mert', 'katildi']]) }),
}));
jest.mock('@/features/seyahatler/sorgular', () => ({ useSeyahat: () => ({ data: undefined }) }));
// Takvim: sihirbazın bileşeni olduğu gibi kullanılır; burada dokunuşlar ve özet satırı gözlenir.
jest.mock('@/components/sihirbaz/AdimNeZaman', () => {
  const { Pressable: P, Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AdimNeZaman: (p: {
      aralik: { gidis: string; donus: string | null } | null;
      onAralik: (a: { gidis: string; donus: string | null } | null) => void;
      dokun?: (a: { gidis: string; donus: string | null } | null, gun: string) => { gidis: string; donus: string | null } | null;
      donusBekleniyor?: boolean;
      tarihsizGun: number | null;
      ozetSatiri?: string | null;
      enCokGun?: number;
      sinirAraligi?: { gidis: string; donus: string | null } | null;
    }) => (
      <>
        <P onPress={() => p.onAralik(p.dokun!(p.aralik, '2026-12-07'))}>
          <T>donus-dokun</T>
        </P>
        <T testID="takvim-aralik">{p.aralik ? `${p.aralik.gidis}/${p.aralik.donus ?? '-'}/${p.donusBekleniyor ? 'ipucu' : 'ipucusuz'}` : '-'}</T>
        <P onPress={() => p.onAralik({ gidis: '2026-12-05', donus: null })}>
          <T>gidis-sec</T>
        </P>
        <P onPress={() => p.onAralik({ gidis: '2026-12-05', donus: '2026-12-08' })}>
          <T>aralik-sec</T>
        </P>
        <T testID="takvim-sinir">{`${p.enCokGun ?? '-'}/${p.sinirAraligi ? `${p.sinirAraligi.gidis}/${p.sinirAraligi.donus ?? '-'}` : '-'}`}</T>
        <T testID="takvim-durum">{p.tarihsizGun === null ? `tarihli:${p.ozetSatiri ?? '-'}` : `tarihsiz:${p.tarihsizGun}`}</T>
      </>
    ),
  };
});

beforeEach(() => {
  mockPaylasimlar = [];
  mockGeziYukleniyor = false;
  jest.clearAllMocks();
});

const kartlar = () => screen.queryAllByTestId(/^rota-/).map((k) => k.props.testID as string);

describe('#574 saf yardımcılar', () => {
  it('KK2: gün süzgeçleri gün sayısıyla, diğerleri amaçlarla süzer; sıra korunur', () => {
    expect(geziSuz(mockGeziler, { gun: 'iki', amac: null }).map((g) => g.id)).toEqual(['urla', 'esk2']);
    expect(geziSuz(mockGeziler, { gun: 'ucBes', amac: null }).map((g) => g.id)).toEqual(['esk3', 'bolu']);
    expect(geziSuz(mockGeziler, { gun: null, amac: 'kultur_tarih' }).map((g) => g.id)).toEqual(['esk3', 'esk2']);
    expect(geziSuz(mockGeziler, { gun: 'iki', amac: 'lezzet' }).map((g) => g.id)).toEqual(['urla', 'esk2']);
    expect(geziSuz(mockGeziler, { gun: null, amac: null })).toHaveLength(4);
  });

  it('KK3: şehir aksansız ve harf harf bulunur; o şehrin gezileri ve arkadaş rotaları', () => {
    // Tam eşleşme (aksansız) şehri verir; önek yalnız listeyi süzer, şehir adı vermez.
    expect(sehirEslesmesi('Eskisehir', mockSehirListesi).tam?.id).toBe('s-esk');
    expect(sehirEslesmesi('eski', mockSehirListesi)).toEqual({ tam: undefined, sehirler: [expect.objectContaining({ id: 's-esk' })] });
    expect(sehirEslesmesi('İz', mockSehirListesi).tam).toBeUndefined();
    expect(sehirEslesmesi('İz', mockSehirListesi).sehirler.map((x) => x.id)).toEqual(['s-izm']);
    expect(sehirEslesmesi('Kars', mockSehirListesi)).toEqual({ tam: undefined, sehirler: [] });
    expect(sehirEslesmesi('  ', mockSehirListesi)).toEqual({ tam: undefined, sehirler: [] });
    expect(sehirGezileri(mockGeziler, [{ id: 's-esk' }]).map((g) => g.id)).toEqual(['esk3', 'esk2']);
    const p = [paylasim('p1', 'u1', 'Ayşe', 'Eskişehir', null), paylasim('p2', 'u2', 'Mert', 'Mardin', null)];
    expect(arkadasRotalari(p, 'eski', { ad: 'Eskişehir' }).map((x) => x.id)).toEqual(['p1']);
    expect(arkadasRotalari(p, 'Mar', undefined).map((x) => x.id)).toEqual(['p2']);
    expect(arkadasRotalari(p, '', undefined)).toHaveLength(2);
  });

  it('KK4: yüzler yalnız o geziyi seyahatine almış arkadaşlardan (adı ve şehri aynı paylaşım); kişi başına bir kez', () => {
    const p = [
      paylasim('p1', 'u-ayse', 'Ayşe Yılmaz', 'İzmir', 'Urla bağ rotası'),
      paylasim('p2', 'u-mert', 'Mert', 'Izmir', 'urla bag rotasi'),
      paylasim('p3', 'u-ayse', 'Ayşe Yılmaz', 'İzmir', 'Urla bağ rotası'),
      paylasim('p4', 'u-deniz', 'Deniz', 'Bolu', 'Urla bağ rotası'),
      paylasim('p5', 'u-can', 'Can', 'İzmir', 'İzmir gezisi'),
    ];
    expect(gidenArkadaslar(mockGeziler[0], p).map((g) => g.ad)).toEqual(['Ayşe', 'Mert']);
    expect(gidenArkadaslar(mockGeziler[1], p)).toEqual([]);
    expect(gittiMetni(['Mert'])).toBe('Mert bu rotayla gitti');
    expect(gittiMetni(['Ayşe', 'Mert'])).toBe('Ayşe ve Mert bu rotayla gitti');
    expect(gittiMetni(['Ayşe', 'Mert', 'Can', 'Su'])).toBe('Ayşe, Mert ve 2 kişi daha bu rotayla gitti');
    expect(gittiMetni([])).toBeNull();
  });

  it('KK5: yalnız gidiş seçiliyken dönüş rotanın gün sayısından; tarihsizde sayaç; özet satırı kanvastaki gibi', () => {
    const secim = cekmeceSecimi({ gidis: '2026-12-05', donus: null }, null, 2);
    expect(secim).toEqual({ tur: 'tarihli', gidis: '2026-12-05', donus: '2026-12-06' });
    expect(tarihSatiri(secim as Extract<typeof secim, { tur: 'tarihli' }>)).toBe('5–6 Aralık · Cumartesi–Pazar · 2 gün');
    expect(tarihSatiri({ tur: 'tarihli', gidis: '2026-10-30', donus: '2026-11-02' })).toBe('30 Ekim–2 Kasım · Cuma–Pazartesi · 4 gün');
    expect(tarihSatiri({ tur: 'tarihli', gidis: '2026-10-16', donus: '2026-10-16' })).toBe('16 Ekim · Cuma · 1 gün');
    expect(cekmeceSecimi({ gidis: '2026-12-05', donus: '2026-12-08' }, null, 2)).toEqual({ tur: 'tarihli', gidis: '2026-12-05', donus: '2026-12-08' });
    expect(cekmeceSecimi(null, 3, 2)).toEqual({ tur: 'tarihsiz', gun: 3 });
    expect(cekmeceSecimi(null, null, 2)).toBeNull();
    expect(secimGunVeBaslangic({ tur: 'tarihli', gidis: '2026-12-05', donus: '2026-12-08' })).toEqual({ gunSayisi: 4, baslangic: '2026-12-05' });
    expect(secimGunVeBaslangic({ tur: 'tarihsiz', gun: 3 })).toEqual({ gunSayisi: 3, baslangic: null });
  });

  it('KK8: yeni metinler tr.json\'da; "Kaçamak" kelimesi geçmez', () => {
    const metin = JSON.stringify(tr);
    expect(metin.toLocaleLowerCase('tr')).not.toContain('kaçamak');
    expect(tr.geziKur.baslik).toBe('Nasıl bir gezi?');
    expect(tr.geziKur.sehirYer).toBe('Hangi şehir?');
    expect(tr.geziKur.olustur).toBe('Geziyi oluştur');
  });
});

describe('#574 KK2 açılış', () => {
  it('başlık, 56 pt şehir kutusu, çipler, hazır geziler Keşfet sırasıyla, Arkadaşlarından ve en altta Kendi rotanı kur', () => {
    mockPaylasimlar = [paylasim('p1', 'u-ayse', 'Ayşe', 'Mardin', null, 3)];
    const onKendi = jest.fn();
    render(<GeziKurEkrani onKendiRota={onKendi} />);
    expect(screen.getByText('Nasıl bir gezi?')).toBeTruthy();
    const kutu = screen.getByLabelText(t('geziKur.sehirEtiket'));
    expect(kutu.props.placeholder).toBe('Hangi şehir?');
    expect(kutu.parent?.parent?.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: 56 })]));
    for (const c of ['2 gün', '3–5 gün', 'Lezzet', 'Doğa', 'Kültür']) expect(screen.getByText(c)).toBeTruthy();
    expect(kartlar()).toEqual(['rota-urla', 'rota-esk3', 'rota-bolu', 'rota-esk2']);
    expect(screen.getByText('Arkadaşlarından')).toBeTruthy();
    expect(screen.getByText('Mardin, 3 gün')).toBeTruthy();
    expect(screen.getByText("Ayşe'nin rotası")).toBeTruthy();
    fireEvent.press(screen.getByText(t('anasayfa.tumu')));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/arkadaslar');
    fireEvent.press(screen.getByText('Kendi rotanı kur'));
    expect(onKendi).toHaveBeenCalledWith(null, undefined);
  });

  it('gün çipi gün sayısıyla, amaç çipi amaçlarla süzer; ikinci dokunuş kaldırır', () => {
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(screen.getByText('2 gün'));
    expect(kartlar()).toEqual(['rota-urla', 'rota-esk2']);
    fireEvent.press(screen.getByText('Kültür'));
    expect(kartlar()).toEqual(['rota-esk2']);
    fireEvent.press(screen.getByText('2 gün'));
    expect(kartlar()).toEqual(['rota-esk3', 'rota-esk2']);
    fireEvent.press(screen.getByText('Kültür'));
    fireEvent.press(screen.getByText('3–5 gün'));
    expect(kartlar()).toEqual(['rota-esk3', 'rota-bolu']);
    fireEvent.press(screen.getByText('Doğa'));
    expect(kartlar()).toEqual(['rota-bolu']);
  });
});

describe('#574 KK3 şehir yazılınca', () => {
  it('lacivert satır en üstte, "{Şehir} rotaları", sonra arkadaşların o şehirdeki rotaları; her harfte süzülür', () => {
    mockPaylasimlar = [paylasim('p1', 'u-ayse', 'Ayşe', 'Eskişehir', null), paylasim('p2', 'u-mert', 'Mert', 'Mardin', null)];
    const onKendi = jest.fn();
    render(<GeziKurEkrani onKendiRota={onKendi} />);
    const kutu = screen.getByLabelText(t('geziKur.sehirEtiket'));
    // Önek: liste süzülür ama satır ve başlık yazılan metni gösterir (tam eşleşme yok).
    fireEvent.changeText(kutu, 'Eski');
    expect(screen.getByText('Eski için kendi rotanı kur')).toBeTruthy();
    expect(screen.getByText('Eski rotaları')).toBeTruthy();
    expect(kartlar()).toEqual(['rota-esk3', 'rota-esk2']);
    fireEvent.press(screen.getByTestId('kendi-rota'));
    expect(onKendi).toHaveBeenLastCalledWith({ metin: 'Eski' }, undefined);
    fireEvent.changeText(kutu, 'Eskişehir');
    expect(screen.getByText('Eskişehir için kendi rotanı kur')).toBeTruthy();
    expect(screen.getByText('Eskişehir rotaları')).toBeTruthy();
    expect(kartlar()).toEqual(['rota-esk3', 'rota-esk2']);
    // Çipler şehir yazılınca gizli (kanvas `Kur_v11_Sehir`).
    expect(screen.queryByText('3–5 gün')).toBeNull();
    const raf = screen.getByTestId('arkadaslardan');
    expect(within(raf).getByText('Eskişehir, 2 gün')).toBeTruthy();
    expect(within(raf).queryByText('Mardin, 2 gün')).toBeNull();
    // Sıra: lacivert satır → şehir rotaları → arkadaşlar.
    const metinler = screen.UNSAFE_getAllByType(Text).map((x) => x.props.children).filter((c): c is string => typeof c === 'string');
    const i = (m: string) => metinler.indexOf(m);
    expect(i('Eskişehir için kendi rotanı kur')).toBeLessThan(i('Eskişehir rotaları'));
    expect(i('Eskişehir rotaları')).toBeLessThan(i('Arkadaşlarından'));
    fireEvent.press(screen.getByTestId('kendi-rota'));
    expect(onKendi).toHaveBeenLastCalledWith({ sehirId: 's-esk' }, undefined);
    fireEvent.changeText(kutu, 'İz');
    expect(screen.getByText('İz için kendi rotanı kur')).toBeTruthy();
    expect(screen.getByText('İz rotaları')).toBeTruthy();
    expect(kartlar()).toEqual(['rota-urla']);
    expect(screen.queryByTestId('arkadaslardan')).toBeNull();
  });

  it('hazır gezi yoksa yalnız lacivert satır ve "Bu şehir için hazır rota yok, kendi rotanı kur"; satır metni Nereye\'de arar', () => {
    const onKendi = jest.fn();
    render(<GeziKurEkrani onKendiRota={onKendi} />);
    fireEvent.changeText(screen.getByLabelText(t('geziKur.sehirEtiket')), 'Kars');
    expect(screen.getByText('Kars için kendi rotanı kur')).toBeTruthy();
    expect(screen.getByText('Bu şehir için hazır rota yok, kendi rotanı kur')).toBeTruthy();
    expect(kartlar()).toEqual([]);
    fireEvent.press(screen.getByTestId('kendi-rota'));
    expect(onKendi).toHaveBeenCalledWith({ metin: 'Kars' }, undefined);
    // ✕ kutuyu boşaltır; açılış geri gelir.
    fireEvent.press(screen.getByLabelText(t('geziKur.sehirTemizle')));
    expect(kartlar()).toHaveLength(4);
  });
});

describe('#574 KK4 rota kartı', () => {
  it('"N gün · M durak · Editör seçimi", beyaz "Bunu seç"; yüzler yalnız gerçek arkadaş aldıysa', () => {
    mockPaylasimlar = [paylasim('p1', 'u-ayse', 'Ayşe', 'İzmir', 'Urla bağ rotası'), paylasim('p2', 'u-mert', 'Mert', 'İzmir', 'Urla bağ rotası')];
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    const urla = screen.getByTestId('rota-urla');
    expect(within(urla).getByText('Urla bağ rotası')).toBeTruthy();
    expect(within(urla).getByText('2 gün · 8 durak · Editör seçimi')).toBeTruthy();
    expect(within(urla).getByText('Bunu seç')).toBeTruthy();
    expect(within(urla).getByText('Ayşe ve Mert bu rotayla gitti')).toBeTruthy();
    // Kimse almadıysa yüz satırı gizli.
    const bolu = screen.getByTestId('rota-bolu');
    expect(within(bolu).queryByTestId('gidenler-bolu')).toBeNull();
    expect(within(bolu).queryByText(/bu rotayla gitti/)).toBeNull();
  });
});

describe('#574 KK5–KK7 çekmece ve Geziyi oluştur', () => {
  it('3 dokunuş: Bunu seç → gidiş → Geziyi oluştur; "Seyahatime al" aktarımı, Gezi sayfası açılır', async () => {
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    // Özet: ad ve "N gün · M durak"; "Ne zaman?" ve "Tarihim belli değil".
    expect(screen.getByText('2 gün · 8 durak')).toBeTruthy();
    expect(screen.getByText('Ne zaman?')).toBeTruthy();
    expect(screen.getByText('Tarihim belli değil')).toBeTruthy();
    expect(screen.getByText('Kimlerle?')).toBeTruthy();
    expect(screen.getByTestId('takvim-durum').props.children).toBe('tarihli:-');
    fireEvent.press(screen.getByText('gidis-sec'));
    expect(screen.getByTestId('takvim-durum').props.children).toBe('tarihli:5–6 Aralık · Cumartesi–Pazar · 2 gün');
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'yeni-gezi' } }));
    expect(mockYeni).toHaveBeenCalledWith(expect.objectContaining({ sehir: mockSehirSecimi, gunSayisi: 2, baslangic: '2026-12-05', secim: { tur: 'plan' } }));
    expect((mockYeni.mock.calls[0][0] as { gezi: { id: string } }).gezi.id).toBe('urla');
  });

  it('takvim hesaplanan dönüşle bantlı seçili görünür; dönüş günü dokunuşu gerçek seçimle; ipucu yalnız dönüş beklenirken', () => {
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-esk3')).getByText('Bunu seç'));
    expect(screen.getByTestId('takvim-aralik').props.children).toBe('-');
    fireEvent.press(screen.getByText('gidis-sec'));
    // 3 günlük rota: 5 → 7 Aralık seçili görünür; dönüş henüz seçilmedi → ipucu.
    expect(screen.getByTestId('takvim-aralik').props.children).toBe('2026-12-05/2026-12-07/ipucu');
    // Gösterilen aralık dönüşlü olsa da dokunuş gerçek seçimle hesaplanır: 7 Aralık dönüş olur (yeni gidiş değil).
    fireEvent.press(screen.getByText('donus-dokun'));
    expect(screen.getByTestId('takvim-aralik').props.children).toBe('2026-12-05/2026-12-07/ipucusuz');
    expect(screen.getByTestId('takvim-durum').props.children).toBe('tarihli:5–7 Aralık · Cumartesi–Pazartesi · 3 gün');
  });

  it('gezi verisi yüklenirken Geziyi oluştur meşgul; hata yazmaz, istek gitmez', () => {
    mockGeziYukleniyor = true;
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    fireEvent.press(screen.getByText('gidis-sec'));
    const dugme = screen.getByTestId('geziyi-olustur');
    expect(dugme.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(dugme);
    expect(screen.queryByText(t('sihirbaz.nezaman.hata'))).toBeNull();
    expect(mockYeni).not.toHaveBeenCalled();
  });

  it('"Tarihim belli değil" gün sayacını açar (varsayılan rotanın gün sayısı); tarihsiz seyahat', async () => {
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-esk3')).getByText('Bunu seç'));
    fireEvent.press(screen.getByText('Tarihim belli değil'));
    expect(screen.getByTestId('takvim-durum').props.children).toBe('tarihsiz:3');
    expect(screen.queryByText('Tarihim belli değil')).toBeNull();
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockYeni).toHaveBeenCalledWith(expect.objectContaining({ gunSayisi: 3, baslangic: null })));
  });

  it('tarih seçilmeden Geziyi oluştur pasif', () => {
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    expect(mockYeni).not.toHaveBeenCalled();
  });

  it('hiçbir mekan çözülemezse çekmece açık kalır ve sebep yazılır', async () => {
    mockYeni.mockResolvedValueOnce({ seyahatId: null, gun: 2, eklenenDurak: 0, eklenenMekan: 0, cozumsuz: 3, cozumsuzler: [] });
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    fireEvent.press(screen.getByText('gidis-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    expect(await screen.findByText(t('gezi.hicEklenmedi'))).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('KK7: arkadaş rotası aynı çekmeceyi açar; paylaşımdan "Seyahatime al", seçilen tarih kurulur', async () => {
    mockPaylasimlar = [paylasim('p1', 'u-ayse', 'Ayşe', 'Mardin', 'Mardin taş evler', 3)];
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arkadas-rotasi-p1'));
    expect(screen.getByText('Mardin taş evler')).toBeTruthy();
    expect(screen.getByText('3 gün · 7 durak')).toBeTruthy();
    fireEvent.press(screen.getByText('aralik-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'arkadastan' } }));
    expect(mockAl).toHaveBeenCalledWith('p1');
    expect(mockTarih).toHaveBeenCalledWith({ seyahatId: 'arkadastan', secim: { tur: 'tarihli', gidis: '2026-12-05', donus: '2026-12-08' } });
    expect(mockYeni).not.toHaveBeenCalled();
  });

  it('KK7: arkadaş rotası tarihsiz ve aynı gün sayısıyla alınırsa tarih isteği gitmez', async () => {
    mockPaylasimlar = [paylasim('p1', 'u-ayse', 'Ayşe', 'Mardin', null, 3)];
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arkadas-rotasi-p1'));
    fireEvent.press(screen.getByText('Tarihim belli değil'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(mockTarih).not.toHaveBeenCalled();
  });
});

describe('#574 KK6 Kimlerle? · KK-ek1 yol arkadaşı', () => {
  it('kimlerleKisileri: son gezilen en çok 3; girişteki kişi ilk 3\'te değilse başa gelir; tanınmayan kişi eklenmez', () => {
    const a = ['ayse', 'mert', 'deniz', 'can'].map((x) => ({ user_id: x, ad: x, foto: null, misafir: false }));
    expect(kimlerleKisileri(a, []).map((k) => k.id)).toEqual(['ayse', 'mert', 'deniz']);
    expect(kimlerleKisileri(a, ['mert']).map((k) => k.id)).toEqual(['ayse', 'mert', 'deniz']);
    expect(kimlerleKisileri(a, ['can']).map((k) => k.id)).toEqual(['can', 'ayse', 'mert']);
    expect(kimlerleKisileri(a, ['yabanci']).map((k) => k.id)).toEqual(['ayse', 'mert', 'deniz']);
    expect(kimlerleKisileri(undefined, ['can'])).toEqual([]);
    expect(giristekiler('a, b,')).toEqual(['a', 'b']);
  });

  it('PR #612 inceleme 1: misafir yol arkadaşı yuvarlaklarda yok; girişte verilse de eklenmez, yeri sonrakine kalır', () => {
    const a = [
      { user_id: 'misafir', ad: 'Misafir', foto: null, misafir: true },
      ...['ayse', 'mert', 'deniz', 'can'].map((x) => ({ user_id: x, ad: x, foto: null, misafir: false })),
    ];
    expect(kimlerleKisileri(a, []).map((k) => k.id)).toEqual(['ayse', 'mert', 'deniz']);
    expect(kimlerleKisileri(a, ['misafir']).map((k) => k.id)).toEqual(['ayse', 'mert', 'deniz']);
    expect(kimlerleKisileri(a, ['misafir', 'can']).map((k) => k.id)).toEqual(['can', 'ayse', 'mert']);
  });

  it('PR #612 inceleme 1: misafir girişte verilse de seçili gelmez ve davet listesine girmez', async () => {
    render(<GeziKurEkrani arkadas="u-misafir,u-ayse" onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    expect(screen.queryByTestId('kimlerle-u-misafir')).toBeNull();
    fireEvent.press(screen.getByText('gidis-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockGonder).toHaveBeenCalledWith({ tripId: 'yeni-gezi', kisiler: ['u-ayse'] }));
  });

  it('PR #612 inceleme 2: gönderim sürerken arka plan, kaydırma ve geri tuşu çekmeceyi kapatmaz; bitince Gezi sayfası açılır', async () => {
    let bitir: (v: Awaited<ReturnType<typeof mockYeni>>) => void = () => undefined;
    mockYeni.mockImplementationOnce(() => new Promise((r) => (bitir = r)));
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    fireEvent.press(screen.getByText('gidis-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockYeni).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('geziyi-olustur').props.accessibilityState).toMatchObject({ busy: true });
    // Arka plan (perde), aşağı kaydırma (`CekilenSayfa`) ve Android geri tuşu (`onRequestClose`) aynı `onKapat`'ı çağırır.
    fireEvent.press(screen.getByLabelText(t('geziKur.kapat')));
    act(() => screen.UNSAFE_getByType(CekilenSayfa).props.onKapat());
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(screen.getByText('Ne zaman?')).toBeTruthy();
    expect(screen.getByTestId('takvim-durum').props.children).toBe('tarihli:5–6 Aralık · Cumartesi–Pazar · 2 gün');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => bitir({ seyahatId: 'yeni-gezi', gun: 2, eklenenDurak: 8, eklenenMekan: 8, cozumsuz: 0, cozumsuzler: [] }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'yeni-gezi' } }));
  });

  it('PR #612 inceleme 2: gönderim yokken arka plan çekmeceyi kapatır', () => {
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    expect(screen.getByText('Ne zaman?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(t('geziKur.kapat')));
    expect(screen.queryByText('Ne zaman?')).toBeNull();
  });

  it('son gezilen 3 arkadaş seçilebilir + "+"; Geziyi oluştur seçilenlere davet gönderir ve "{Gezi} hazır" çekmecesi açılır', async () => {
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    for (const id of ['u-ayse', 'u-mert', 'u-deniz']) expect(screen.getByTestId(`kimlerle-${id}`).props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.queryByTestId('kimlerle-u-can')).toBeNull();
    expect(screen.getByTestId('davet-arti')).toBeTruthy();
    const mert = screen.getByTestId('kimlerle-u-mert');
    // 40 pt yuvarlak + 4 pt hitSlop = 48 pt dokunma alanı.
    expect(mert.props.hitSlop).toBe(4);
    fireEvent.press(mert);
    expect(screen.getByTestId('kimlerle-u-mert').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('kimlerle-u-mert').props.accessibilityLabel).toBe(t('geziKur.yolArkadasi', { ad: 'Mert' }));
    fireEvent.press(screen.getByText('gidis-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockGonder).toHaveBeenCalledWith({ tripId: 'yeni-gezi', kisiler: ['u-mert'] }));
    // #573 KK5: davet eden taraf çekmecesi — kişiler ve durumları.
    await waitFor(() => expect(screen.getByText(t('davet.gonderildi.baslik', { gezi: 'Urla bağ rotası' }))).toBeTruthy());
    expect(within(screen.getByTestId('gonderilen-u-mert')).getByText('Katıldı')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('davet-geziye-git'));
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'yeni-gezi' } });
  });

  it('davet gönderilemezse seyahat yine açılır ve hata söylenir', async () => {
    const uyari = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockGonder.mockRejectedValueOnce(new Error('ağ'));
    render(<GeziKurEkrani arkadas="u-ayse" onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    fireEvent.press(screen.getByText('gidis-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'yeni-gezi' } }));
    expect(mockGonder).toHaveBeenCalledWith({ tripId: 'yeni-gezi', kisiler: ['u-ayse'] });
    expect(uyari).toHaveBeenCalledWith(t('genel.hataBaslik'), t('genel.hataMetin'));
    expect(mockYeni).toHaveBeenCalledTimes(1);
  });

  it('yalnız "+" seçilirse davet gitmez; Gezi sayfası link paylaşımıyla açılır', async () => {
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    fireEvent.press(screen.getByTestId('davet-arti'));
    expect(screen.getByTestId('davet-arti').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByText('gidis-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'yeni-gezi', davet: '1' } }));
    expect(mockGonder).not.toHaveBeenCalled();
  });

  it('`arkadas` verilmişse o kişi yuvarlaklarda seçili gelir (ilk 3\'te değilse başa), dokununca kalkar; şehir kutusu dolu', () => {
    render(<GeziKurEkrani sehirId="s-esk" arkadas="u-can" onKendiRota={jest.fn()} />);
    expect(screen.getByLabelText(t('geziKur.sehirEtiket')).props.value).toBe('Eskişehir');
    fireEvent.press(within(screen.getByTestId('rota-esk3')).getByText('Bunu seç'));
    const ids = screen.getAllByTestId(/^kimlerle-/).map((x) => x.props.testID as string);
    expect(ids).toEqual(['kimlerle-u-can', 'kimlerle-u-ayse', 'kimlerle-u-mert']);
    const can = screen.getByTestId('kimlerle-u-can');
    expect(can.props.accessibilityState).toMatchObject({ selected: true });
    expect(can.props.accessibilityLabel).toBe(t('geziKur.yolArkadasi', { ad: 'Can' }));
    fireEvent.press(can);
    expect(screen.getByTestId('kimlerle-u-can').props.accessibilityState).toMatchObject({ selected: false });
    // Seçim ekranda tutulur: çekmece kapanıp açılınca korunur.
    fireEvent.press(screen.getByTestId('kimlerle-u-ayse'));
    fireEvent.press(screen.getByLabelText(t('geziKur.kapat')));
    fireEvent.press(within(screen.getByTestId('rota-esk3')).getByText('Bunu seç'));
    expect(screen.getByTestId('kimlerle-u-ayse').props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('#574 KK5 takvim bileşeni: özet satırı', () => {
  it('özet satırı verilince kart yerine tek satır; null iken "Gidiş gününe dokun"', () => {
    const { AdimNeZaman: Gercek } = jest.requireActual<{ AdimNeZaman: typeof AdimNeZaman }>('@/components/sihirbaz/AdimNeZaman');
    const ortak = { onAralik: jest.fn(), tarihsizGun: null, onTarihsizGun: jest.fn() };
    const { rerender } = render(<Gercek {...ortak} aralik={null} ozetSatiri={null} />);
    expect(screen.getByText(t('sihirbaz.nezaman.ozetYok'))).toBeTruthy();
    rerender(<Gercek {...ortak} aralik={{ gidis: '2026-12-05', donus: null }} ozetSatiri="5–6 Aralık · Cumartesi–Pazar · 2 gün" />);
    expect(screen.getByText('5–6 Aralık · Cumartesi–Pazar · 2 gün')).toBeTruthy();
    // Dalga 1 dönüş günü ipucu da gelir.
    expect(screen.getByText(t('sihirbaz.nezaman.donusIpucu', { n: 60 }))).toBeTruthy();
    // Çekmece: aralık dönüşlü verilir (bant), ipucu yalnız istenirse.
    rerender(<Gercek {...ortak} aralik={{ gidis: '2026-12-05', donus: '2026-12-06' }} donusBekleniyor={false} ozetSatiri="5–6 Aralık · Cumartesi–Pazar · 2 gün" />);
    expect(screen.queryByText(t('sihirbaz.nezaman.donusIpucu', { n: 60 }))).toBeNull();
  });
});

describe('#574 KK7 Gezi sayfasında "Ayşe\'nin rotasından"', () => {
  it('seyahatin kaynak paylaşımı #533 akışındaki paylaşanın adıyla yazılır; yoksa satır yok', () => {
    const p = [paylasim('p1', 'u-ayse', 'Ayşe Yılmaz', 'Mardin', null), paylasim('p2', 'u-mert', 'Mert', 'Bolu', null)];
    expect(kaynakRotaMetni('p1', p)).toBe("Ayşe'nin rotasından");
    expect(kaynakRotaMetni('p2', p)).toBe("Mert'in rotasından");
    expect(kaynakRotaMetni('p9', p)).toBeNull();
    expect(kaynakRotaMetni(null, p)).toBeNull();
    const { rerender } = render(<Baslik ad="Mardin taş evler" alt="Tarih yok · 3 gün" kaynak={kaynakRotaMetni('p1', p)} />);
    expect(screen.getByText("Ayşe'nin rotasından")).toBeTruthy();
    rerender(<Baslik ad="Mardin taş evler" alt="Tarih yok · 3 gün" kaynak={null} />);
    expect(screen.queryByText(/rotasından/)).toBeNull();
  });
});

describe('#649 çekmecede sınır kaynağa göre, tarih hatası söylenir', () => {
  it('KK1: hazır gezide takvim 30, arkadaş rotasında 60 gün sınırıyla; sınır gerçek seçimden (yalnız gidiş)', () => {
    mockPaylasimlar = [paylasim('p1', 'u-ayse', 'Ayşe', 'Mardin', 'Mardin taş evler', 3)];
    const { unmount } = render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(within(screen.getByTestId('rota-urla')).getByText('Bunu seç'));
    expect(screen.getByTestId('takvim-sinir').props.children).toBe('30/-');
    fireEvent.press(screen.getByText('gidis-sec'));
    // Takvim hesaplanan dönüşü gösterir, sınır gerçek seçimden (dönüş bekleniyor) hesaplanır.
    expect(screen.getByTestId('takvim-sinir').props.children).toBe('30/2026-12-05/-');
    unmount();
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arkadas-rotasi-p1'));
    expect(screen.getByTestId('takvim-sinir').props.children).toBe('60/-');
    fireEvent.press(screen.getByText('gidis-sec'));
    expect(screen.getByTestId('takvim-sinir').props.children).toBe('60/2026-12-05/-');
  });

  it('KK2: arkadaş rotasında tarih kaydı düşerse uyarı çıkar ve seyahat yine açılır', async () => {
    const uyari = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockTarih.mockRejectedValueOnce(new Error('gün sayısı'));
    mockPaylasimlar = [paylasim('p1', 'u-ayse', 'Ayşe', 'Mardin', 'Mardin taş evler', 3)];
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arkadas-rotasi-p1'));
    fireEvent.press(screen.getByText('aralik-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: 'arkadastan' } }));
    expect(uyari).toHaveBeenCalledWith(t('genel.hataBaslik'), t('sihirbaz.nezaman.tarihHata'));
    expect(mockAl).toHaveBeenCalledTimes(1);
    uyari.mockRestore();
  });

  it('KK2: tarih kaydı başarılıysa uyarı çıkmaz', async () => {
    const uyari = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockPaylasimlar = [paylasim('p1', 'u-ayse', 'Ayşe', 'Mardin', 'Mardin taş evler', 3)];
    render(<GeziKurEkrani onKendiRota={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arkadas-rotasi-p1'));
    fireEvent.press(screen.getByText('aralik-sec'));
    fireEvent.press(screen.getByText('Geziyi oluştur'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(uyari).not.toHaveBeenCalled();
    uyari.mockRestore();
  });
});
