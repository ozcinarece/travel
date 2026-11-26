// #432 2/3: "Geziyi paylaş" çekmecesi (kanvas `Sos_v6_Paylas`, `Sos_v6_PaylasAcik`). Önizleme metinleri, KK-ek satırı
// (#510: "Kişi adlarını göster" anahtarı yok), "Linki gönder" (link yoksa oluşturur, varsa aynısını gönderir), link açıkken
// "Link açık · N kez açıldı" ve onaylı "Paylaşımı kapat", KK9'daki "Arkadaş ekle ›" satırı.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';

import { t } from '@/i18n';

import { PaylasimCekmecesi } from '../PaylasimCekmecesi';

type Link = { id: string; token: string; acilma_sayisi: number } | null;
const mockDurum = { link: null as Link, hata: false, yukleniyor: false };
const mockYenile = jest.fn();
const mockOlustur = jest.fn(async () => ({ id: 'P1', token: 'A'.repeat(24), acilma_sayisi: 0 }));
type GuncelleSecenek = { onSuccess?: () => void; onError?: () => void };
const mockGuncelle = jest.fn((_d: unknown, _s?: GuncelleSecenek) => undefined);
const mockGonder = jest.fn(async (_metin: string, _link: string) => 'paylasildi');
const mockOnay = jest.fn(async () => true);

jest.mock('@/components/seyahatler/SeyahatKapagi', () => ({ SeyahatKapagi: () => null }));
jest.mock('@/lib/onay', () => ({ onayIste: (...a: unknown[]) => mockOnay(...(a as [])) }));
jest.mock('@/features/paylasim/sorgular', () => ({
  useAcikPaylasim: () => ({ data: mockDurum.hata || mockDurum.yukleniyor ? undefined : mockDurum.link, isLoading: mockDurum.yukleniyor, isError: mockDurum.hata, isFetching: false, refetch: mockYenile }),
  usePaylasimOlustur: () => ({ mutateAsync: mockOlustur, isPending: false }),
  usePaylasimGuncelle: () => ({ mutate: mockGuncelle, isPending: false }),
  paylasimLinki: (token: string) => `https://gezi-web.pages.dev/r/g/${token}`,
  linkiGonder: (metin: string, link: string) => mockGonder(metin, link),
}));

const onKapat = jest.fn();
const onArkadasEkle = jest.fn();
const cekmeceOgesi = (cevrimdisi = false, acik = true) => (
  <PaylasimCekmecesi
    acik={acik}
    onKapat={onKapat}
    seyahat={{ id: 'T1', city_label: 'Eskişehir' }}
    benimAdim="Ayşe"
    gunSayisi={3}
    durakSayisi={12}
    kisiSayisi={3}
    kisiKip="gezdi"
    onArkadasEkle={onArkadasEkle}
    cevrimdisi={cevrimdisi}
  />
);
const cekmece = (cevrimdisi = false) =>
  render(
    <PaylasimCekmecesi
      acik
      onKapat={onKapat}
      seyahat={{ id: 'T1', city_label: 'Eskişehir' }}
      benimAdim="Ayşe"
      gunSayisi={3}
      durakSayisi={12}
      kisiSayisi={3}
      kisiKip="gezdi"
      onArkadasEkle={onArkadasEkle}
      cevrimdisi={cevrimdisi}
    />,
  );

beforeEach(() => {
  mockDurum.link = null;
  mockDurum.hata = false;
  mockDurum.yukleniyor = false;
  jest.clearAllMocks();
});

describe('PaylasimCekmecesi (#432 2/3)', () => {
  it('#515: seyahatin adı varsa kart başlığı o; adı olmayan paylaşanda "paylaştı" satırı yok', () => {
    render(
      <PaylasimCekmecesi
        acik
        onKapat={onKapat}
        seyahat={{ id: 'T1', city_label: 'Eskişehir', name: 'Kız kıza Eskişehir' }}
        benimAdim={null}
        gunSayisi={3}
        durakSayisi={12}
        kisiSayisi={3}
        kisiKip="gezdi"
        onArkadasEkle={onArkadasEkle}
        cevrimdisi={false}
      />,
    );
    expect(screen.getByText('Kız kıza Eskişehir')).toBeTruthy();
    expect(screen.queryByText(/paylaştı/)).toBeNull();
    // #517 KK-ek1: ad yoksa "Linkte senin adın görünür" satırı da yok.
    expect(screen.queryByText('Linkte senin adın görünür')).toBeNull();
    expect(screen.queryByTestId('paylasim-ad-satiri')).toBeNull();
  });

  it('#517 KK3–KK4, KK-ek2: plan kipinde "gidiyor", tek kişide sayı yok; bilgi ve kilit satırı tek seferde okunur', () => {
    const { rerender } = render(
      <PaylasimCekmecesi acik onKapat={onKapat} seyahat={{ id: 'T1', city_label: 'Eskişehir' }} benimAdim="Ayşe" gunSayisi={3} durakSayisi={12} kisiSayisi={3} kisiKip="gidiyor" onArkadasEkle={onArkadasEkle} cevrimdisi={false} />,
    );
    expect(screen.getByText('3 gün · 12 durak · 3 kişi gidiyor')).toBeTruthy();
    expect(screen.getByTestId('paylasim-ad-satiri').props.accessible).toBe(true);
    expect(screen.getByTestId('paylasim-ad-satiri').props.accessibilityLabel).toContain('Linkte senin adın görünür');
    expect(screen.getByTestId('paylasim-kilit-satiri').props.accessible).toBe(true);
    expect(screen.getByTestId('paylasim-kilit-satiri').props.accessibilityLabel).toContain('Hiçbir zaman paylaşılmaz');
    rerender(
      <PaylasimCekmecesi acik onKapat={onKapat} seyahat={{ id: 'T1', city_label: 'Eskişehir' }} benimAdim="Ayşe" gunSayisi={3} durakSayisi={12} kisiSayisi={1} kisiKip="gezdi" onArkadasEkle={onArkadasEkle} cevrimdisi={false} />,
    );
    expect(screen.getByText('3 gün · 12 durak')).toBeTruthy();
    expect(screen.queryByText(/kişi/)).toBeNull();
  });

  it('önizleme alıcı ekranıyla aynı: "Ayşe paylaştı", "Eskişehir gezisi", "3 gün · 12 durak · 3 kişi gezdi"; ad bilgi satırı ve KK-ek satırı var, anahtar yok (#510, #515)', () => {
    cekmece();
    expect(screen.getByText('Ayşe paylaştı')).toBeTruthy();
    expect(screen.getByText('Eskişehir gezisi')).toBeTruthy();
    expect(screen.queryByText("Ayşe'nin Eskişehir gezisi")).toBeNull();
    expect(screen.getByText('Linkte senin adın görünür')).toBeTruthy();
    expect(screen.getByText('Diğer üyelerin adı ve fotoğrafı görünmez')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText('3 gün · 12 durak · 3 kişi gezdi')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Kişi adlarını göster')).toBeNull();
    expect(screen.getByText('Hiçbir zaman paylaşılmaz')).toBeTruthy();
    expect(screen.getByText(t('paylasim.linkAlt'))).toBeTruthy();
    expect(screen.queryByText(t('paylasim.paylasimiKapat'))).toBeNull();
  });

  it('#530 inceleme 1: kartta ve mesajda yalnız ilk ad (sekme ve bölünmez boşluk dahil)', async () => {
    for (const ad of ['Ayşe Yılmaz', 'Ayşe\tYılmaz', '\u00a0Ayşe\u00a0Yılmaz ']) {
      mockGonder.mockClear();
      const { unmount } = render(
        <PaylasimCekmecesi acik onKapat={onKapat} seyahat={{ id: 'T1', city_label: 'Eskişehir' }} benimAdim={ad} gunSayisi={3} durakSayisi={12} kisiSayisi={3} kisiKip="gezdi" onArkadasEkle={onArkadasEkle} cevrimdisi={false} />,
      );
      expect(screen.getByText('Ayşe paylaştı')).toBeTruthy();
      expect(screen.queryByText(/Yılmaz/)).toBeNull();
      fireEvent.press(screen.getByText('Linki gönder'));
      await waitFor(() => expect(mockGonder).toHaveBeenCalled());
      expect(mockGonder.mock.calls[0][0]).toMatch(/^Ayşe'nin Eskişehir gezisi · /);
      expect(mockGonder.mock.calls[0][0]).not.toContain('Yılmaz');
      unmount();
    }
  });

  it('#530 inceleme 3 ve 5: gezi sürerken "geziyor"; üye listesi gelmeden "Linki gönder" pasif', () => {
    render(
      <PaylasimCekmecesi acik onKapat={onKapat} seyahat={{ id: 'T1', city_label: 'Eskişehir' }} benimAdim="Ayşe" gunSayisi={3} durakSayisi={12} kisiSayisi={null} kisiKip="geziyor" onArkadasEkle={onArkadasEkle} cevrimdisi={false} />,
    );
    const gonder = screen.getByRole('button', { name: t('paylasim.linkiGonder') });
    expect(gonder.props.accessibilityState.disabled).toBe(true);
    // #530 3. inceleme 2: beklerken soluk görünür.
    expect(StyleSheet.flatten(gonder.props.style).opacity).toBe(0.4);
    fireEvent.press(screen.getByText('Linki gönder'));
    expect(mockOlustur).not.toHaveBeenCalled();
    screen.rerender(
      <PaylasimCekmecesi acik onKapat={onKapat} seyahat={{ id: 'T1', city_label: 'Eskişehir' }} benimAdim="Ayşe" gunSayisi={3} durakSayisi={12} kisiSayisi={3} kisiKip="geziyor" onArkadasEkle={onArkadasEkle} cevrimdisi={false} />,
    );
    expect(screen.getByText('3 gün · 12 durak · 3 kişi geziyor')).toBeTruthy();
    expect(screen.getByRole('button', { name: t('paylasim.linkiGonder') }).props.accessibilityState.disabled).toBe(false);
  });

  it('link yokken "Linki gönder" link oluşturur ve sistem paylaşımına linki verir', async () => {
    cekmece();
    fireEvent.press(screen.getByText('Linki gönder'));
    await waitFor(() => expect(mockGonder).toHaveBeenCalled());
    expect(mockOlustur).toHaveBeenCalledTimes(1);
    const [metin, link] = mockGonder.mock.calls[0];
    expect(link).toBe(`https://gezi-web.pages.dev/r/g/${'A'.repeat(24)}`);
    // #517 KK3: linkin mesajı önizlemeyle aynı metni kullanır.
    expect(metin).toBe(`Ayşe'nin Eskişehir gezisi · 3 gün · 12 durak · 3 kişi gezdi\n${link}`);
  });

  it('link açıkken: durum satırı, aynı link gönderilir, "Paylaşımı kapat" onayla kapatır', async () => {
    mockDurum.link = { id: 'P9', token: 'B'.repeat(24), acilma_sayisi: 4 };
    cekmece();
    expect(screen.getByText(/4 kez açıldı/)).toBeTruthy();
    expect(screen.queryByText(t('paylasim.linkAlt'))).toBeNull();

    fireEvent.press(screen.getByText('Linki gönder'));
    await waitFor(() => expect(mockGonder).toHaveBeenCalled());
    expect(mockOlustur).not.toHaveBeenCalled();
    expect(mockGonder.mock.calls[0][1]).toContain('B'.repeat(24));

    fireEvent.press(screen.getByText('Paylaşımı kapat'));
    await waitFor(() => expect(mockGuncelle).toHaveBeenCalledTimes(1));
    expect(mockOnay).toHaveBeenCalledWith('Paylaşımı kapat', 'Link kapanır, açan kişiler geziyi göremez.', 'Kapat', 'Vazgeç');
    expect(mockGuncelle.mock.calls[0][0]).toEqual({ id: 'P9', degisiklik: { acik: false } });
  });

  it('onay verilmezse link kapanmaz', async () => {
    mockDurum.link = { id: 'P9', token: 'B'.repeat(24), acilma_sayisi: 0 };
    mockOnay.mockResolvedValueOnce(false);
    cekmece();
    fireEvent.press(screen.getByText('Paylaşımı kapat'));
    await waitFor(() => expect(mockOnay).toHaveBeenCalled());
    expect(mockGuncelle).not.toHaveBeenCalled();
  });

  it('KK9: "Arkadaş ekle ›" çekmeceyi kapatır, davet akışını kapanış bittikten sonra açar (iOS iki Modal)', () => {
    jest.useFakeTimers();
    try {
      cekmece();
      fireEvent.press(screen.getByRole('button', { name: new RegExp(t('paylasim.arkadasEkle')) }));
      expect(onKapat).toHaveBeenCalled();
      expect(onArkadasEkle).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(400));
      expect(onArkadasEkle).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('#454: link oluşturma hatası çekmecenin içinde, "Linki gönder"in üstünde görünür', async () => {
    mockOlustur.mockRejectedValueOnce(new Error('x'));
    cekmece();
    fireEvent.press(screen.getByText('Linki gönder'));
    expect(await screen.findByText(t('paylasim.hata'))).toBeTruthy();
    expect(screen.getByTestId('paylasim-mesaj').props.accessibilityRole).toBe('alert');
  });

  it('#454: web\'de panoya kopyalanınca "Link kopyalandı" çekmecede görünür', async () => {
    mockGonder.mockResolvedValueOnce('kopyalandi');
    cekmece();
    fireEvent.press(screen.getByText('Linki gönder'));
    expect(await screen.findByText(t('davet.linkKopyalandi'))).toBeTruthy();
    // 2. inceleme: başarı kırmızı kutuda değil, düz satırda.
    expect(screen.queryByTestId('paylasim-mesaj')).toBeNull();
    expect(screen.getByTestId('paylasim-bilgi')).toBeTruthy();
  });

  it('#454: kapatma hatası çekmecede; kapatılınca "Paylaşım kapatıldı"', async () => {
    mockDurum.link = { id: 'P9', token: 'B'.repeat(24), acilma_sayisi: 0 };
    cekmece();
    fireEvent.press(screen.getByText('Paylaşımı kapat'));
    await waitFor(() => expect(mockGuncelle).toHaveBeenCalledTimes(1));
    act(() => mockGuncelle.mock.calls[0][1]?.onError?.());
    expect(screen.getByText(t('paylasim.kapatHata'))).toBeTruthy();
    expect(screen.queryByText(t('paylasim.hata'))).toBeNull();

    fireEvent.press(screen.getByText('Paylaşımı kapat'));
    await waitFor(() => expect(mockGuncelle).toHaveBeenCalledTimes(2));
    act(() => mockGuncelle.mock.calls[1][1]?.onSuccess?.());
    expect(screen.getByText(t('paylasim.kapatildi'))).toBeTruthy();
    expect(screen.queryByTestId('paylasim-mesaj')).toBeNull();
  });

  it('#454: link okunamazsa hata satırı ve "Tekrar dene"; gönder pasif, yeni link denenmez', () => {
    mockDurum.hata = true;
    cekmece();
    expect(screen.getByText(t('paylasim.okumaHata'))).toBeTruthy();
    const gonder = screen.getByRole('button', { name: t('paylasim.linkiGonder') });
    expect(gonder.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(gonder);
    expect(mockOlustur).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: t('paylasim.tekrarDene') }));
    expect(mockYenile).toHaveBeenCalled();
  });

  it('#454: çevrimdışıyken "Linki gönder" ve "Paylaşımı kapat" pasif', () => {
    mockDurum.link = { id: 'P9', token: 'B'.repeat(24), acilma_sayisi: 0 };
    cekmece(true);
    const gonder = screen.getByRole('button', { name: t('paylasim.linkiGonder') });
    expect(gonder.props.accessibilityState.disabled).toBe(true);
    expect(gonder.props.accessibilityHint).toBe(t('geziSayfasi.cevrimdisi.baglantiYok'));
    expect(screen.getByRole('button', { name: t('paylasim.paylasimiKapat') }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByText('Paylaşımı kapat'));
    expect(mockOnay).not.toHaveBeenCalled();
  });

  it('#454 2. inceleme: çevrimdışı ve okuma hatası birlikte; kutuda çevrimdışı nedeni, "Tekrar dene" pasif', () => {
    mockDurum.hata = true;
    cekmece(true);
    expect(screen.getByText(t('geziSayfasi.cevrimdisi.baglantiYok'))).toBeTruthy();
    expect(screen.queryByText(t('paylasim.okumaHata'))).toBeNull();
    const tekrar = screen.getByRole('button', { name: t('paylasim.tekrarDene') });
    expect(tekrar.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(tekrar);
    expect(mockYenile).not.toHaveBeenCalled();
  });

  it('#454 3. inceleme: iOS duyurusu yalnız çekmece açıkken; çevrimdışıyken kapalı → açık geçişinde neden okunur', () => {
    const eskiOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const duyur = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    duyur.mockClear();
    try {
      // Çekmece kapalıyken bağlantı kesilir: VoiceOver bir şey demez.
      const { rerender } = render(cekmeceOgesi(false, false));
      rerender(cekmeceOgesi(true, false));
      expect(duyur).not.toHaveBeenCalled();
      // Çevrimdışıyken açılır: neden bir kez okunur.
      rerender(cekmeceOgesi(true, true));
      expect(duyur).toHaveBeenCalledTimes(1);
      expect(duyur).toHaveBeenCalledWith(t('geziSayfasi.cevrimdisi.baglantiYok'));
      // Kapanınca yeniden okunmaz.
      rerender(cekmeceOgesi(true, false));
      expect(duyur).toHaveBeenCalledTimes(1);
    } finally {
      duyur.mockRestore();
      Object.defineProperty(Platform, 'OS', { value: eskiOS, configurable: true });
    }
  });

  it('#454 3. inceleme: link okunurken "link yok" satırı yerine yükleniyor göstergesi', () => {
    mockDurum.yukleniyor = true;
    cekmece();
    expect(screen.getByTestId('paylasim-yukleniyor')).toBeTruthy();
    expect(screen.queryByText(t('paylasim.linkAlt'))).toBeNull();
    expect(screen.getByRole('button', { name: t('paylasim.linkiGonder') }).props.accessibilityState.disabled).toBe(true);
  });
});
