// #432 2/3: "Geziyi paylaş" çekmecesi (kanvas `Sos_v6_Paylas`, `Sos_v6_PaylasAcik`). Önizleme metinleri, varsayılan kapalı
// "Kişi adlarını göster" ve KK-ek satırı, "Linki gönder" (link yoksa oluşturur, varsa aynısını gönderir), link açıkken
// "Link açık · N kez açıldı" ve onaylı "Paylaşımı kapat", KK9'daki "Arkadaş ekle ›" satırı.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { t } from '@/i18n';

import { PaylasimCekmecesi } from '../PaylasimCekmecesi';

type Link = { id: string; token: string; kisi_adlari_acik: boolean; acilma_sayisi: number } | null;
const mockDurum = { link: null as Link };
const mockOlustur = jest.fn(async (adlar: boolean) => ({ id: 'P1', token: 'A'.repeat(24), kisi_adlari_acik: adlar, acilma_sayisi: 0 }));
const mockGuncelle = jest.fn();
const mockGonder = jest.fn(async (_metin: string, _link: string) => 'paylasildi');
const mockOnay = jest.fn(async () => true);

jest.mock('@/components/seyahatler/SeyahatKapagi', () => ({ SeyahatKapagi: () => null }));
jest.mock('@/lib/onay', () => ({ onayIste: (...a: unknown[]) => mockOnay(...(a as [])) }));
jest.mock('@/features/paylasim/sorgular', () => ({
  useAcikPaylasim: () => ({ data: mockDurum.link, isLoading: false }),
  usePaylasimOlustur: () => ({ mutateAsync: mockOlustur, isPending: false }),
  usePaylasimGuncelle: () => ({ mutate: mockGuncelle, isPending: false }),
  paylasimLinki: (token: string) => `https://gezi-web.pages.dev/r/g/${token}`,
  linkiGonder: (metin: string, link: string) => mockGonder(metin, link),
}));

const onKapat = jest.fn();
const onArkadasEkle = jest.fn();
const cekmece = () =>
  render(
    <PaylasimCekmecesi
      acik
      onKapat={onKapat}
      seyahat={{ id: 'T1', city_label: 'Eskişehir' }}
      benimAdim="Ayşe"
      gunSayisi={3}
      durakSayisi={12}
      kisiSayisi={3}
      onArkadasEkle={onArkadasEkle}
      onBildirim={() => undefined}
    />,
  );

beforeEach(() => {
  mockDurum.link = null;
  jest.clearAllMocks();
});

describe('PaylasimCekmecesi (#432 2/3)', () => {
  it('önizleme: "Ayşe\'nin Eskişehir gezisi" ve "3 gün · 12 durak · 3 kişi gezdi"; anahtar kapalı, KK-ek satırı var', () => {
    cekmece();
    expect(screen.getByText("Ayşe'nin Eskişehir gezisi")).toBeTruthy();
    expect(screen.getByText('3 gün · 12 durak · 3 kişi gezdi')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: t('paylasim.kisiAdlari') }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByText('Kapalıyken yalnız “3 kişi gezdi” yazar')).toBeTruthy();
    expect(screen.getByText('Seyahatteki herkesin adı linki açan kişiye görünür.')).toBeTruthy();
    expect(screen.getByText('Hiçbir zaman paylaşılmaz')).toBeTruthy();
    expect(screen.getByText(t('paylasim.linkAlt'))).toBeTruthy();
    expect(screen.queryByText(t('paylasim.paylasimiKapat'))).toBeNull();
  });

  it('link yokken "Linki gönder" seçili anahtarla link oluşturur ve sistem paylaşımına linki verir', async () => {
    cekmece();
    fireEvent.press(screen.getByRole('checkbox', { name: t('paylasim.kisiAdlari') }));
    fireEvent.press(screen.getByText('Linki gönder'));
    await waitFor(() => expect(mockGonder).toHaveBeenCalled());
    expect(mockOlustur).toHaveBeenCalledWith(true);
    const [metin, link] = mockGonder.mock.calls[0];
    expect(link).toBe(`https://gezi-web.pages.dev/r/g/${'A'.repeat(24)}`);
    expect(metin).toBe(`Ayşe'nin Eskişehir gezisi · 3 gün · 12 durak\n${link}`);
  });

  it('link açıkken: durum satırı, aynı link gönderilir, anahtar linke yazılır, "Paylaşımı kapat" onayla kapatır', async () => {
    mockDurum.link = { id: 'P9', token: 'B'.repeat(24), kisi_adlari_acik: false, acilma_sayisi: 4 };
    cekmece();
    expect(screen.getByText(/4 kez açıldı/)).toBeTruthy();
    expect(screen.queryByText(t('paylasim.linkAlt'))).toBeNull();

    fireEvent.press(screen.getByText('Linki gönder'));
    await waitFor(() => expect(mockGonder).toHaveBeenCalled());
    expect(mockOlustur).not.toHaveBeenCalled();
    expect(mockGonder.mock.calls[0][1]).toContain('B'.repeat(24));

    fireEvent.press(screen.getByRole('checkbox', { name: t('paylasim.kisiAdlari') }));
    expect(mockGuncelle.mock.calls[0][0]).toEqual({ id: 'P9', degisiklik: { kisi_adlari_acik: true } });

    fireEvent.press(screen.getByText('Paylaşımı kapat'));
    await waitFor(() => expect(mockGuncelle).toHaveBeenCalledTimes(2));
    expect(mockOnay).toHaveBeenCalledWith('Paylaşımı kapat', 'Link kapanır, açan kişiler geziyi göremez.', 'Kapat', 'Vazgeç');
    expect(mockGuncelle.mock.calls[1][0]).toEqual({ id: 'P9', degisiklik: { acik: false } });
  });

  it('onay verilmezse link kapanmaz', async () => {
    mockDurum.link = { id: 'P9', token: 'B'.repeat(24), kisi_adlari_acik: true, acilma_sayisi: 0 };
    mockOnay.mockResolvedValueOnce(false);
    cekmece();
    fireEvent.press(screen.getByText('Paylaşımı kapat'));
    await waitFor(() => expect(mockOnay).toHaveBeenCalled());
    expect(mockGuncelle).not.toHaveBeenCalled();
  });

  it('KK9: "Arkadaş ekle ›" çekmeceyi kapatıp davet akışını açar', () => {
    cekmece();
    fireEvent.press(screen.getByRole('link'));
    expect(onKapat).toHaveBeenCalled();
    expect(onArkadasEkle).toHaveBeenCalled();
  });
});
