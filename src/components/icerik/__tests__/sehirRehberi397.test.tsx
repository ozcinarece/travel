// #397 şehir rehberi v5 (`Sayfa_v5_SehirRehberi`): kapak, 2 satır özet, gri "Seyahat listesine ekle" satırı yalnız seyahatte,
// altı çizili sekmeler (yalnız içi dolu bölümler), sade mekan satırı (ince + / tik), hazır geziler alt alta.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SehirRehberi } from '@/components/icerik/SehirRehberi';
import { t } from '@/i18n';

jest.mock('react-native-safe-area-context', () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), navigate: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/oturum', () => ({ useOturum: () => ({ session: { user: { id: 'ben' } }, hazir: true, hesapli: true }) }));
jest.mock('@/features/gunler/sorgular', () => ({ useGunler: () => ({ data: [] }), useDuraklar: () => ({ data: [] }) }));

jest.mock('@/features/mekanlar/sorgular', () => ({
  useMekanlar: (id?: string) => ({ data: id ? [{ id: 'm1', place_id: 'ChIJ-balaban-02', primary_type: 'restaurant', lat: 39.7, lng: 30.5, default_minutes: 60 }] : undefined }),
  useMekanSil: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
  useMekanEkle: () => ({ mutateAsync: jest.fn(async () => undefined) }),
  useMekanGuncelle: () => ({ mutate: jest.fn() }),
}));
const BOLUMLER = [
  { id: 'b1', bolum: 'ulasim', baslik: 'Nasıl gidilir, nasıl gezilir', yazi_md: '# Nasıl gezilir\n\nTramvayla gez.', sira: 1 },
  { id: 'b2', bolum: 'yemek', baslik: 'Ne yenir (uzun DB başlığı)', yazi_md: '# Ne yenir\n\nÇibörek ye.\n\n::mekan[ChIJ-ciborek-01]\n\n::mekan[ChIJ-balaban-02]', sira: 2 },
  { id: 'b3', bolum: 'mahalle', baslik: 'Mahalleler', yazi_md: '# Mahalleler', sira: 3 },
  { id: 'b4', bolum: null, baslik: 'Kış', yazi_md: '# Kış\n\nKat giy.', sira: 4 },
];
const GEZILER = [
  { id: 'g1', slug: 'eskisehirde-bir-gun', baslik: 'Eskişehir’de bir gün', ozet: null, kapak_url: null, gun_sayisi: 1, mekan_sayisi: 5, amaclar: ['lezzet'] },
  { id: 'g2', slug: 'odunpazari', baslik: 'Odunpazarı yürüyüşü', ozet: null, kapak_url: null, gun_sayisi: 1, mekan_sayisi: 4, amaclar: [] },
];
jest.mock('@/features/icerik/sorgular', () => ({
  useSehirRehberi: () => ({ data: BOLUMLER, isPending: false, isError: false }),
  useGeziler: () => ({ data: GEZILER }),
  useSehirYerleri: () => ({ data: new Array(18).fill(0).map((_, i) => ({ id: `y${i}` })) }),
  useKaydet: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/components/icerik/Kalp', () => ({ useKayitli: () => false }));
jest.mock('@/features/icerik/mekanBilgileri', () => ({
  useIcerikMekanlari: () => ({
    mekan: (id: string) => ({ 'ChIJ-ciborek-01': { ad: 'Öz Kırım Tatar Çibörek', kategori: 'restaurant', lat: 39.7, lng: 30.5 }, 'ChIJ-balaban-02': { ad: 'Köftes Balaban', kategori: 'restaurant', lat: 39.7, lng: 30.5 } })[id],
    foto: () => null,
  }),
}));
jest.mock('@/components/mekan/MekanPaneli', () => ({ MekanPaneli: () => null }));

const SEHIR = { id: 's1', ad: 'Eskişehir', slug: 'eskisehir', kapak_url: null, ozet: 'Öğrenci şehri, ahşap Odunpazarı evleri.', lat: 39.7, lng: 30.5 } as never;
const SEYAHAT = { id: 't1', ad: 'Eskişehir', tz: 'Europe/Istanbul' };

describe('#397 şehir rehberi v5', () => {
  it('KK2–KK3: ad, özet (2 satır) ve seyahatte gri satır', () => {
    const onRehber = jest.fn();
    render(<SehirRehberi sehir={SEHIR} sehirlerYukleniyor={false} onGeri={() => undefined} seyahat={SEYAHAT} onRehberMekanlari={onRehber} />);
    expect(screen.getByRole('header', { name: 'Eskişehir' })).toBeTruthy();
    expect(screen.getByText('Öğrenci şehri, ahşap Odunpazarı evleri.').props.numberOfLines).toBe(2);
    expect(screen.getByText('18 rehber mekânı')).toBeTruthy();
    fireEvent.press(screen.getByText(t('rehber.listeyeEkle')));
    expect(onRehber).toHaveBeenCalled();
    // Eski süsler ve çipler yok.
    expect(screen.queryByText('ŞEHİR REHBERİ')).toBeNull();
  });

  it('KK3: seyahat yoksa gri satır ve + yok', () => {
    render(<SehirRehberi sehir={SEHIR} sehirlerYukleniyor={false} onGeri={() => undefined} onRehberMekanlari={() => undefined} />);
    expect(screen.queryByText(t('rehber.listeyeEkle'))).toBeNull();
    fireEvent.press(screen.getByRole('tab', { name: 'Ne yenir' }));
    expect(screen.getByText('Öz Kırım Tatar Çibörek')).toBeTruthy();
    expect(screen.queryByLabelText(t('ui.ekle.ekle'))).toBeNull();
  });

  it('KK4: yalnız içi dolu bölüm sekme; ad bölüm türünden kısa ad (serbest bölümde başlık); sekme seçili bölümün yazısını gösterir', () => {
    render(<SehirRehberi sehir={SEHIR} sehirlerYukleniyor={false} onGeri={() => undefined} seyahat={SEYAHAT} />);
    const sekmeler = screen.getAllByRole('tab');
    expect(sekmeler.map((s) => s.props.accessibilityLabel)).toEqual(['Nasıl gezilir', 'Ne yenir', 'Kış']);
    expect(screen.getByText('Tramvayla gez.')).toBeTruthy();
    expect(screen.queryByText('Çibörek ye.')).toBeNull();
    fireEvent.press(screen.getByRole('tab', { name: 'Ne yenir' }));
    expect(screen.getByRole('tab', { name: 'Ne yenir' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('Çibörek ye.')).toBeTruthy();
    expect(screen.queryByText('Tramvayla gez.')).toBeNull();
  });

  it('KK5: mekan satırı ad + kategori, listede değilse ince +, listedeyse tik', () => {
    render(<SehirRehberi sehir={SEHIR} sehirlerYukleniyor={false} onGeri={() => undefined} seyahat={SEYAHAT} />);
    fireEvent.press(screen.getByRole('tab', { name: 'Ne yenir' }));
    expect(screen.getByText('Öz Kırım Tatar Çibörek')).toBeTruthy();
    expect(screen.getAllByLabelText(t('ui.ekle.ekle'))).toHaveLength(1);
    expect(screen.getAllByLabelText(t('ui.ekle.listede'))).toHaveLength(1);
  });

  it('KK6: hazır geziler alt alta ana sayfa kartıyla; dokununca gezi sayfası', () => {
    render(<SehirRehberi sehir={SEHIR} sehirlerYukleniyor={false} onGeri={() => undefined} seyahat={SEYAHAT} />);
    expect(screen.getByRole('header', { name: t('rehber.geziler') })).toBeTruthy();
    fireEvent.press(screen.getByText('Odunpazarı yürüyüşü'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/gezi/[slug]', params: { slug: 'odunpazari' } });
  });

  it('geri: seyahatte etikette seyahat adı', () => {
    const onGeri = jest.fn();
    render(<SehirRehberi sehir={SEHIR} sehirlerYukleniyor={false} onGeri={onGeri} seyahat={SEYAHAT} />);
    fireEvent.press(screen.getByLabelText(t('rehber.geriSeyahat', { seyahat: 'Eskişehir' })));
    expect(onGeri).toHaveBeenCalled();
  });
});
