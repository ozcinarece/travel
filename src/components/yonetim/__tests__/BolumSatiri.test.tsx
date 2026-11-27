import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import type { TaslakBolum } from '@/features/yonetim/anaSayfa';

import { BolumSatiri } from '../anaSayfa/BolumSatiri';

// #586: banner'ın "Görsel yükle"si Storage'a yazar; bu testler yüklemeye girmez.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const bolum: TaslakBolum = { id: 'b1', tur: 'serit', baslik: 'Önerilen geziler', sira: 2, acik: true, kaynak: 'elle', icerik: { gezi_idler: ['g1'] }, baslangic_at: null, bitis_at: null };
const secenekler = { geziler: [{ id: 'g1', baslik: 'Bursa' }, { id: 'g2', baslik: 'İzmir' }], yerler: [], sehirler: [] };

// #109 KK3: satır — başlık · tür, özet, anahtar (açık/kapalı), Düzenle → içerik; içerikten çıkarma.
describe('BolumSatiri (#109 KK3)', () => {
  it('anahtar ve düzenleyici', () => {
    const onGuncelle = jest.fn();
    const onAcKapa = jest.fn();
    const { getByText, getByRole, rerender, getByLabelText } = render(
      <BolumSatiri bolum={bolum} indeks={0} secenekler={secenekler} acik={false} onAcKapa={onAcKapa} onGuncelle={onGuncelle} onSil={() => {}} onBirak={() => {}} />,
    );
    expect(getByText('· yatay şerit', { exact: false })).toBeTruthy();
    expect(getByText('Bursa (sıra: elle)')).toBeTruthy();
    const anahtar = getByRole('switch');
    expect(anahtar.props.accessibilityState).toEqual({ checked: true });
    fireEvent.press(anahtar);
    expect(onGuncelle).toHaveBeenCalledWith({ acik: false });
    fireEvent.press(getByRole('button', { name: 'Düzenle' }));
    expect(onAcKapa).toHaveBeenCalled();
    rerender(<BolumSatiri bolum={bolum} indeks={0} secenekler={secenekler} acik onAcKapa={onAcKapa} onGuncelle={onGuncelle} onSil={() => {}} onBirak={() => {}} />);
    fireEvent.press(getByLabelText('Bursa içerikten çıkar'));
    expect(onGuncelle).toHaveBeenLastCalledWith({ icerik: { gezi_idler: [] } });
  });
});

// #406 2/2 KK4: v6 düzenleyici — raf türü, elle seçim, banner hedefi ve görsel adresi (KK-ek1, KK-ek2); eski tür gri.
describe('BolumSatiri v6 (#406 2/2)', () => {
  const v6Secenekler = { ...secenekler, sehirler: [{ id: 's1', ad: 'Bursa' }], raflar: [{ id: 'r1', ad: 'Hafta sonu' }] };
  const satir = (b: TaslakBolum, onGuncelle = jest.fn()) =>
    render(<BolumSatiri bolum={b} indeks={0} secenekler={v6Secenekler} acik onAcKapa={() => {}} onGuncelle={onGuncelle} onSil={() => {}} onBirak={() => {}} />);
  const sec = (el: { props: { onChange: (e: unknown) => void } }, value: string) => act(() => el.props.onChange({ target: { value } }));

  it('eski tür gri ve "v6\'da görünmez"', () => {
    const { getByText } = satir(bolum);
    expect(getByText("v6'da görünmez")).toBeTruthy();
  });

  it('raf: tür amaç olunca içerik yalnız amaç; elle seçimde gezi eklenir', () => {
    const onGuncelle = jest.fn();
    const raf: TaslakBolum = { ...bolum, tur: 'raf', icerik: { raf_turu: 'elle', gezi_idler: ['g1'] } };
    const { getByLabelText, queryByText } = satir(raf, onGuncelle);
    expect(queryByText("v6'da görünmez")).toBeNull();
    sec(getByLabelText('EKLE') as never, 'g2');
    expect(onGuncelle).toHaveBeenLastCalledWith({ icerik: { raf_turu: 'elle', gezi_idler: ['g1', 'g2'] } });
    sec(getByLabelText('RAF TÜRÜ') as never, 'amac');
    expect(onGuncelle).toHaveBeenLastCalledWith({ icerik: { raf_turu: 'amac' } });
  });

  it('#438: dolu içerikte tür değişimi ikinci seçimle onaylanır', () => {
    const onGuncelle = jest.fn();
    const { getByLabelText, getByText } = satir({ ...bolum, tur: 'raf', icerik: { raf_turu: 'amac', amac: 'lezzet' } }, onGuncelle);
    sec(getByLabelText('TÜR') as never, 'banner');
    expect(onGuncelle).not.toHaveBeenCalled();
    expect(getByText(/yeniden seç/)).toBeTruthy();
    sec(getByLabelText('TÜR') as never, 'banner');
    expect(onGuncelle).toHaveBeenLastCalledWith({ tur: 'banner', kaynak: 'elle', icerik: {} });
  });

  it('#438: banner uyarısı, ikinci banner gri ve tutamaçsız; gezi listesi yüklenirken not', () => {
    const banner: TaslakBolum = { ...bolum, tur: 'banner', icerik: { hedef: { tur: 'gezi', id: 'g9' } } };
    const ortak = { indeks: 0, secenekler: v6Secenekler, acik: false, onAcKapa: () => {}, onGuncelle: () => {}, onSil: () => {}, onBirak: () => {} };
    const r = render(<BolumSatiri bolum={banner} uyari="hedefYayinda" {...ortak} />);
    expect(r.getByText('Uygulamada görünmüyor: hedef yayında değil')).toBeTruthy();
    r.rerender(<BolumSatiri bolum={banner} uyari="rafAz" {...ortak} />);
    expect(r.getByText("Uygulamada görünmüyor: rafta 3'ten az yayındaki gezi var")).toBeTruthy();
    r.rerender(<BolumSatiri bolum={banner} uyari="ikinci" {...ortak} />);
    expect(r.getByText('görünmez')).toBeTruthy();
    const raf: TaslakBolum = { ...bolum, tur: 'raf', icerik: { raf_turu: 'elle', gezi_idler: [] } };
    const y = render(<BolumSatiri bolum={raf} {...ortak} acik secenekler={{ ...v6Secenekler, gezilerYukleniyor: true }} />);
    expect(y.getByText('Geziler yükleniyor')).toBeTruthy();
  });

  it('#438: kaydedilmemiş görsel satırda yazar, kapatınca da kalır', () => {
    const onKirli = jest.fn();
    const banner: TaslakBolum = { ...bolum, tur: 'banner', icerik: {} };
    const ortak = { indeks: 0, secenekler: v6Secenekler, onAcKapa: () => {}, onGuncelle: () => {}, onSil: () => {}, onBirak: () => {}, onKirli };
    const r = render(<BolumSatiri bolum={banner} acik {...ortak} />);
    fireEvent.changeText(r.getByLabelText('GÖRSEL ADRESİ (boşsa hedefin kapağı)'), 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa.jpg');
    expect(r.getByText('Görsel kaydedilmedi')).toBeTruthy();
    expect(onKirli).toHaveBeenLastCalledWith(true);
    r.rerender(<BolumSatiri bolum={banner} acik={false} {...ortak} />);
    expect(r.getByText('Görsel kaydedilmedi')).toBeTruthy();
    expect(r.getByLabelText('GÖRSEL ADRESİ (boşsa hedefin kapağı)', { includeHiddenElements: true }).props.value).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa.jpg');
  });

  it('#438 3. inceleme: kirliyken "Görseli kaldır" görünür; tür rafa dönünce kaydedilmemiş bilgisi temizlenir', () => {
    const onKirli = jest.fn();
    const onGuncelle = jest.fn();
    const banner: TaslakBolum = { ...bolum, tur: 'banner', icerik: {} };
    const ortak = { indeks: 0, secenekler: v6Secenekler, onAcKapa: () => {}, onGuncelle, onSil: () => {}, onBirak: () => {}, onKirli };
    const r = render(<BolumSatiri bolum={banner} acik {...ortak} />);
    expect(r.queryByRole('button', { name: 'Görseli kaldır' })).toBeNull();
    fireEvent.changeText(r.getByLabelText('GÖRSEL ADRESİ (boşsa hedefin kapağı)'), 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa.jpg');
    expect(onKirli).toHaveBeenLastCalledWith(true);
    // Kaydedilmemiş yazıyı silen "Görseli kaldır" görünür ve kirliliği kaldırır.
    fireEvent.press(r.getByRole('button', { name: 'Görseli kaldır' }));
    expect(onKirli).toHaveBeenLastCalledWith(false);
    expect(r.queryByText('Görsel kaydedilmedi')).toBeNull();
    // Yeniden yaz, kaydetmeden tür Raf: içerik boş olduğu için onay sorulmaz; kirli bilgisi sıfırlanır.
    fireEvent.changeText(r.getByLabelText('GÖRSEL ADRESİ (boşsa hedefin kapağı)'), 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa.jpg');
    expect(onKirli).toHaveBeenLastCalledWith(true);
    sec(r.getByLabelText('TÜR') as never, 'raf');
    expect(onGuncelle).toHaveBeenLastCalledWith({ tur: 'raf', kaynak: 'elle', icerik: { raf_turu: 'elle', gezi_idler: [] } });
    r.rerender(<BolumSatiri bolum={{ ...banner, tur: 'raf', icerik: { raf_turu: 'elle', gezi_idler: [] } }} acik {...ortak} />);
    expect(onKirli).toHaveBeenLastCalledWith(false);
    expect(r.queryByText('Görsel kaydedilmedi')).toBeNull();
  });

  it('#438: hata yalnız ait olduğu alanı kırmızı yapar', () => {
    const banner: TaslakBolum = { ...bolum, tur: 'banner', icerik: {} };
    const { getByLabelText, getByRole } = satir(banner);
    fireEvent.changeText(getByLabelText('GÖRSEL ADRESİ (boşsa hedefin kapağı)'), 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa.jpg');
    fireEvent.press(getByRole('button', { name: 'Görseli kaydet' }));
    expect(getByRole('alert')).toBeTruthy();
    // Hatalı alanın stili diğerlerinden ayrışır (kırmızı kenar); `false`/`null` boş stil sayılır.
    const kenar = (etiket: string) => JSON.stringify(getByLabelText(etiket).props.style).replace(/false/g, 'null');
    expect(kenar('FOTOĞRAFIN YAZARI')).not.toEqual(kenar('LİSANS'));
    expect(kenar('GÖRSEL ADRESİ (boşsa hedefin kapağı)')).toEqual(kenar('LİSANS'));
  });

  it('tür değişince içerik sıfırlanır (banner ↔ raf)', () => {
    const onGuncelle = jest.fn();
    const { getByLabelText } = satir({ ...bolum, tur: 'raf', icerik: { raf_turu: 'elle', gezi_idler: [] } }, onGuncelle);
    sec(getByLabelText('TÜR') as never, 'banner');
    expect(onGuncelle).toHaveBeenLastCalledWith({ tur: 'banner', kaynak: 'elle', icerik: {} });
  });

  it('banner: hedef raf seçilir; sekmeli adres anlaşılır hatayla reddedilir, geçerli adres atıfla yazılır', () => {
    const onGuncelle = jest.fn();
    const banner: TaslakBolum = { ...bolum, tur: 'banner', icerik: { ust_yazi: 'Bu kış' } };
    const { getByLabelText, getByRole, getByText, queryByRole } = satir(banner, onGuncelle);
    sec(getByLabelText('HEDEF TÜRÜ') as never, 'raf');
    sec(getByLabelText('HEDEF') as never, 'r1');
    expect(onGuncelle).toHaveBeenLastCalledWith({ icerik: { ust_yazi: 'Bu kış', hedef: { tur: 'raf', id: 'r1' } } });
    onGuncelle.mockClear();

    fireEvent.changeText(getByLabelText('GÖRSEL ADRESİ (boşsa hedefin kapağı)'), 'https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/.\t./avatars/u1/a.jpg');
    fireEvent.press(getByRole('button', { name: 'Görseli kaydet' }));
    expect(getByText(/Görsel Wikimedia Commons'tan olmalı\./)).toBeTruthy();
    expect(onGuncelle).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText('GÖRSEL ADRESİ (boşsa hedefin kapağı)'), 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa.jpg');
    fireEvent.press(getByRole('button', { name: 'Görseli kaydet' }));
    expect(getByText('Görselin atfı için fotoğrafın yazarını yaz.')).toBeTruthy();
    expect(onGuncelle).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText('FOTOĞRAFIN YAZARI'), 'Ali Veli');
    fireEvent.changeText(getByLabelText('LİSANS'), 'CC BY-SA 4.0');
    fireEvent.press(getByRole('button', { name: 'Görseli kaydet' }));
    expect(queryByRole('alert')).toBeNull();
    expect(onGuncelle).toHaveBeenLastCalledWith({
      icerik: { ust_yazi: 'Bu kış', kapak_url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bursa.jpg', kapak_atif: { yazar: 'Ali Veli', lisans: 'CC BY-SA 4.0' } },
    });
  });
});
