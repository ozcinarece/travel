// #573 kanvas ölçüleri: KK2 `Davet_v1_AnaSayfa` (214 pt kart, DAVET etiketi, tek satır 21/800 başlık, 44 pt Hayır/Katıl),
// KK3 `Davet_v1_Gezilerim` (#FFF3EA kutu, 44 pt yüz, davet yoksa bölüm yok), KK5 `Davet_v1_Gonderildi` (başlık, kişi durumları,
// 52 pt "Geziye git", "Linki de paylaş"), KK8 ekran okuyucu etiketi.
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { GelenDavet } from '@/features/davet/uygulamaIci';

import { DavetGonderildi } from '../DavetGonderildi';
import { DavetKarti } from '../DavetKarti';
import { KatilimSayfasi } from '../KatilimSayfasi';
import { DavetlerBolumu } from '../DavetlerBolumu';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/components/icerik/KapakAtfi', () => ({ KapakAtfi: () => null }));

const urla: GelenDavet = {
  id: 'd1',
  trip_id: 't1',
  davet_eden_ad: 'Ayşe',
  davet_eden_foto: null,
  ad: 'Urla bağ rotası',
  sehir: 'Urla',
  start_date: '2026-12-05',
  end_date: '2026-12-06',
  gun_sayisi: 2,
  kisiler: [
    { sira: 1, ad: 'Ayşe', foto: null },
    { sira: 2, ad: 'Mert', foto: null },
  ],
  olusturuldu: '2026-11-27T12:00:00Z',
};

const stil = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
/** En yakın atada `anahtar` stili (host/kompozit sarmalar atlanır). */
const ataStili = (el: unknown, anahtar: string): unknown => {
  let d = el as { props: { style?: unknown }; parent: unknown } | null;
  while (d) {
    const v = StyleSheet.flatten((d.props?.style ?? {}) as never) as Record<string, unknown>;
    if (v && anahtar in v) return v[anahtar];
    d = d.parent as typeof d;
  }
  return undefined;
};
/** Pressable'ın stili işlev olabilir: basılı değilken çözülür. */
const dugmeStili = (el: { props: { style?: unknown } }) => {
  const s = el.props.style;
  return StyleSheet.flatten((typeof s === 'function' ? s({ pressed: false }) : s) as never) as Record<string, unknown>;
};

describe('KK2 · DavetKarti (Davet_v1_AnaSayfa)', () => {
  it('214 pt, DAVET etiketi, tek satır başlık 21/800, alt satır; KK8 etiketi', () => {
    const ekran = render(<DavetKarti davet={urla} kapak={null} genislik={318} onHayir={() => {}} onKatil={() => {}} />);
    const kart = stil(ekran.getByTestId('davet-karti-d1'));
    expect(kart.height).toBe(214);
    expect(kart.width).toBe(318);
    expect(kart.borderRadius).toBe(20);
    const rozet = ekran.getByText('DAVET', { includeHiddenElements: true });
    expect(ataStili(rozet, 'backgroundColor')).toBe('#ff7a1a');
    expect(ataStili(rozet, 'height')).toBe(26);
    const baslik = ekran.getByText("Ayşe seni Urla'ya çağırıyor");
    expect(baslik.props.numberOfLines).toBe(1);
    expect(stil(baslik).fontSize).toBe(21);
    expect(stil(baslik).fontFamily).toBe('Figtree_800ExtraBold');
    expect(baslik.props.accessibilityLabel).toBe("Davet: Ayşe seni Urla'ya çağırıyor");
    expect(ekran.getByText('5–6 Aralık · 2 gün')).toBeTruthy();
  });
  it('Hayır çerçeveli, Katıl beyaz; ikisi de 44 pt ve dokununca çağrılır', () => {
    const onHayir = jest.fn();
    const onKatil = jest.fn();
    const ekran = render(<DavetKarti davet={urla} kapak={null} genislik={318} onHayir={onHayir} onKatil={onKatil} />);
    const hayir = dugmeStili(ekran.getByTestId('davet-hayir'));
    const katil = dugmeStili(ekran.getByTestId('davet-katil'));
    expect(hayir.height).toBe(44);
    expect(hayir.borderWidth).toBe(1.5);
    expect(hayir.backgroundColor).toBeUndefined();
    expect(katil.height).toBe(44);
    expect(katil.backgroundColor).toBe('#ffffff');
    fireEvent.press(ekran.getByTestId('davet-hayir'));
    fireEvent.press(ekran.getByTestId('davet-katil'));
    expect(onHayir).toHaveBeenCalledTimes(1);
    expect(onKatil).toHaveBeenCalledTimes(1);
  });
  it('#573 inceleme 9: bağlam ipuçları; katılırken Hayır da devre dışı (ekran okuyucuya söylenir)', () => {
    const ekran = render(<DavetKarti davet={urla} kapak={null} genislik={318} onHayir={() => {}} onKatil={() => {}} katiliyor />);
    expect(ekran.getByTestId('davet-hayir').props.accessibilityHint).toBe('Urla davetini geri çevirir');
    expect(ekran.getByTestId('davet-hayir').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(ekran.getByTestId('davet-katil').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
  });
  it('tarih yoksa yalnız gün', () => {
    const ekran = render(<DavetKarti davet={{ ...urla, start_date: null, end_date: null }} kapak={null} genislik={318} onHayir={() => {}} onKatil={() => {}} />);
    expect(ekran.getByText('2 gün')).toBeTruthy();
  });
});

describe('KK3 · DavetlerBolumu (Davet_v1_Gezilerim)', () => {
  it('davet yoksa bölüm görünmez', () => {
    const ekran = render(<DavetlerBolumu davetler={[]} onHayir={() => {}} onKatil={() => {}} />);
    expect(ekran.queryByTestId('davetler-bolumu')).toBeNull();
    expect(ekran.queryByText('DAVETLER')).toBeNull();
  });
  it('DAVETLER başlığı, #FFF3EA kutu, başlıkta gezinin tam adı, iki satır, Hayır / Katıl 44 pt', () => {
    const onHayir = jest.fn();
    const onKatil = jest.fn();
    const ekran = render(<DavetlerBolumu davetler={[urla]} onHayir={onHayir} onKatil={onKatil} />);
    expect(ekran.getByText('DAVETLER')).toBeTruthy();
    const kutu = stil(ekran.getByTestId('davet-satiri-d1'));
    expect(kutu.backgroundColor).toBe('#FFF3EA');
    expect(kutu.borderRadius).toBe(18);
    expect(kutu.padding).toBe(14);
    const baslik = ekran.getByText('Ayşe seni Urla bağ rotasına çağırıyor');
    expect(baslik.props.accessibilityLabel).toBe('Davet: Ayşe seni Urla bağ rotasına çağırıyor');
    expect(ekran.getByText('5–6 Aralık · 2 gün · Mert de geliyor')).toBeTruthy();
    expect(ekran.getByTestId('davet-hayir').props.accessibilityHint).toBe('Urla davetini geri çevirir');
    expect(ekran.getByTestId('davet-katil').props.accessibilityHint).toBe('Urla gezisine katılırsın');
    expect(dugmeStili(ekran.getByTestId('davet-hayir')).height).toBe(44);
    expect(dugmeStili(ekran.getByTestId('davet-katil')).height).toBe(44);
    expect(dugmeStili(ekran.getByTestId('davet-katil')).backgroundColor).toBe('#ff7a1a');
    fireEvent.press(ekran.getByTestId('davet-hayir'));
    fireEvent.press(ekran.getByTestId('davet-katil'));
    expect(onHayir).toHaveBeenCalledWith(urla);
    expect(onKatil).toHaveBeenCalledWith(urla);
  });
  it('44 pt yüz (davet eden)', () => {
    const ekran = render(<DavetlerBolumu davetler={[urla]} onHayir={() => {}} onKatil={() => {}} />);
    const harf = ekran.getByText('A', { includeHiddenElements: true });
    expect(ataStili(harf, 'width')).toBe(44);
    expect(ataStili(harf, 'borderRadius')).toBe(22);
  });
});

describe('KK5 · DavetGonderildi (Davet_v1_Gonderildi) — #574 bağlayacak', () => {
  it('"{Gezi} hazır", "{Adlar}\'e davet gitti.", kişi durumları, Geziye git 52 pt, Linki de paylaş', () => {
    const onGeziyeGit = jest.fn();
    const onLinkiPaylas = jest.fn();
    const ekran = render(
      <DavetGonderildi
        acik
        gezi="Urla bağ rotası"
        kisiler={[
          { id: 'm', ad: 'Mert', durum: 'bekliyor' },
          { id: 'd', ad: 'Deniz', durum: 'katildi' },
          { id: 'c', ad: 'Can', durum: 'reddetti' },
        ]}
        onGeziyeGit={onGeziyeGit}
        onLinkiPaylas={onLinkiPaylas}
        onKapat={() => {}}
      />,
    );
    expect(ekran.getByText('Urla bağ rotası hazır')).toBeTruthy();
    expect(ekran.getByText("Mert, Deniz ve Can'a davet gitti.")).toBeTruthy();
    expect(ekran.getByText('Bekliyor')).toBeTruthy();
    expect(ekran.getByText('Katıldı')).toBeTruthy();
    expect(ekran.getByText('Geri çevirdi')).toBeTruthy();
    expect(ekran.getByTestId('gonderilen-d').props.accessibilityLabel).toBe('Deniz, Katıldı');
    const git = dugmeStili(ekran.getByTestId('davet-geziye-git'));
    expect(git.height).toBe(52);
    expect(git.backgroundColor).toBe('#ff7a1a');
    expect(dugmeStili(ekran.getByTestId('davet-linki-paylas')).height).toBe(48);
    fireEvent.press(ekran.getByTestId('davet-geziye-git'));
    fireEvent.press(ekran.getByText('Linki de paylaş'));
    expect(onGeziyeGit).toHaveBeenCalledTimes(1);
    expect(onLinkiPaylas).toHaveBeenCalledTimes(1);
  });
});

describe('#573 inceleme 2 · KatilimSayfasi: davet edenin adı', () => {
  const uyeler = [
    { trip_id: 't1', user_id: 'o', display_name: 'Okan', role: 'owner', guest: false, joined_at: '', photo_url: null },
    { trip_id: 't1', user_id: 'a', display_name: 'Ayşe', role: 'member', guest: false, joined_at: '', photo_url: null },
  ] as never;
  it('uygulama içi davette ad davet edenden; verilmezse sahipten (davet linki)', () => {
    const ekran = render(<KatilimSayfasi acik seyahat={{ name: null, city_label: 'Urla' }} uyeler={uyeler} davetEden="Ayşe" gunSayisi={2} mekanSayisi={0} onProgram={() => {}} onMekanEkle={() => {}} />);
    expect(ekran.getByText("Ayşe seni Urla'ya ekledi")).toBeTruthy();
    const link = render(<KatilimSayfasi acik seyahat={{ name: null, city_label: 'Urla' }} uyeler={uyeler} gunSayisi={2} mekanSayisi={0} onProgram={() => {}} onMekanEkle={() => {}} />);
    expect(link.getByText("Okan seni Urla'ya ekledi")).toBeTruthy();
  });
});
