import { describe, expect, it } from '@jest/globals';

import {
  anaSayfaGorselYolu,
  bannerAdresiGecerli,
  eskiTurMu,
  KARSILAMA_EN_COK,
  karsilamaEkle,
  karsilamaGuncelle,
  karsilamaKalan,
  karsilamaKapaklari,
  paneldeSirala,
  sabitSatirSayisi,
  yeniKarsilama,
  type TaslakBolum,
} from '../anaSayfa';

const b = (alan: Partial<TaslakBolum>): TaslakBolum => ({
  id: 'b1',
  tur: 'raf',
  baslik: 'x',
  sira: 1,
  acik: true,
  kaynak: 'elle',
  icerik: {},
  baslangic_at: null,
  bitis_at: null,
  ...alan,
});
const url = (n: number | string) => `https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/anasayfa/${n}.webp`;

describe('#586 karşılama görselleri', () => {
  it('KK2: panelde en üstte, banner\'lardan önce; sürükleme sabit satırların altında kalır', () => {
    const l = paneldeSirala([b({ id: 'r1', sira: 1 }), b({ id: 'bn', tur: 'banner', sira: 2 }), b({ id: 'k', tur: 'karsilama', sira: 9 })]);
    expect(l.map((x) => x.id)).toEqual(['k', 'bn', 'r1']);
    expect(sabitSatirSayisi(l)).toBe(2);
    expect(eskiTurMu('karsilama')).toBe(false);
  });

  it('KK1: en çok 8 görsel, aynı adres iki kez girmez', () => {
    const sekiz = Array.from({ length: KARSILAMA_EN_COK }, (_, i) => ({ url: url(i) }));
    expect(karsilamaEkle(sekiz.slice(0, 7), [{ url: url(0) }, { url: url(7) }, { url: url(8) }]).map((k) => k.url)).toEqual(sekiz.map((k) => k.url));
    expect(karsilamaKalan(sekiz)).toBe(0);
    expect(karsilamaKalan([])).toBe(8);
  });

  it('atıf ve kaynak alanı yazılır; boşalan alan anahtar olarak kalmaz', () => {
    const l = [{ url: url(1), kaynak: 'kendi' as const }, { url: url(2) }];
    const atifli = karsilamaGuncelle(l, url(2), { atif: { yazar: 'Ali', lisans: 'CC BY 4.0' } });
    expect(atifli[1]).toEqual({ url: url(2), atif: { yazar: 'Ali', lisans: 'CC BY 4.0' } });
    expect(atifli[0]).toBe(l[0]);
    expect(karsilamaGuncelle(atifli, url(2), { atif: undefined })[1]).toEqual({ url: url(2) });
    expect(karsilamaGuncelle(l, url(1), { kaynak: undefined })[0]).toEqual({ url: url(1) });
  });

  it('bozuk içerik boş liste; ilk görselde satır açık ve elle kurulur', () => {
    expect(karsilamaKapaklari(null)).toEqual([]);
    expect(karsilamaKapaklari(b({ icerik: { kapaklar: 'x' as never } }))).toEqual([]);
    const y = yeniKarsilama([{ sira: 3 }, { sira: 5 }], 'Karşılama görselleri', [{ url: url(1) }]);
    expect(y).toMatchObject({ tur: 'karsilama', sira: 6, acik: true, kaynak: 'elle', icerik: { kapaklar: [{ url: url(1) }] } });
  });

  it('yükleme yolu `anasayfa/` altında ve adres banner kuralından geçer', () => {
    const yol = anaSayfaGorselYolu('Kış Sabahı (2).JPG', '1a2b3c4d-9999');
    expect(yol).toBe('anasayfa/1a2b3c4d-kis-sabahi-2.webp');
    expect(anaSayfaGorselYolu('.png', 'abcdef12')).toBe('anasayfa/abcdef12-gorsel.webp');
    expect(bannerAdresiGecerli(`https://xwqeobelyeuzoxyuvauw.supabase.co/storage/v1/object/public/icerik/${yol}`)).toBe(true);
  });
});
