import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { durmaNoktasi } from '@/components/harita/AltSayfa';
import { CekmeTakibi, cekmeKarari, kapatilsinMi, useIcerikCekme } from '@/components/ui/sayfaCekme';

// Ekran 800: katlı 70 · yarı 360 · tam 740 → öteleme (0 = tam açık): katlı 670, yarı 380, tam 0.
const Y = { katli: 70, yari: 360, tam: 740 };

describe('#164 KK5 durmaNoktasi: adım adım', () => {
  it('küçükten yukarı hızlı fırlatma tama değil yarıma gider', () => {
    expect(durmaNoktasi(600, -5, Y)).toBe('tam');
    expect(durmaNoktasi(600, -5, Y, 'katli')).toBe('yari');
  });
  it('yarımdan yukarı tama, aşağı küçüğe; tamdan aşağı hızlı fırlatma yarımda durur', () => {
    expect(durmaNoktasi(200, -1, Y, 'yari')).toBe('tam');
    expect(durmaNoktasi(500, 1, Y, 'yari')).toBe('katli');
    expect(durmaNoktasi(300, 6, Y, 'tam')).toBe('yari');
  });
  it('kısa çekiş aynı halde kalır', () => {
    expect(durmaNoktasi(380 + 40, 0, Y, 'yari')).toBe('yari');
    expect(durmaNoktasi(670 - 30, 0, Y, 'katli')).toBe('katli');
  });
});

describe('#164 KK7 cekmeKarari: içerikten aşağı çekiş', () => {
  it('içerik en üstteyken aşağı çekiş sayfayı taşır', () => {
    expect(cekmeKarari({ dx: 0, dy: 12, icerikY: 0, kilitli: false })).toBe('basla');
  });
  it('içerik kaymışsa önce içerik kayar (beklenir); yukarı ve yatay hareket içeriğe bırakılır', () => {
    expect(cekmeKarari({ dx: 0, dy: 40, icerikY: 120, kilitli: false })).toBe('bekle');
    expect(cekmeKarari({ dx: 0, dy: -20, icerikY: 0, kilitli: false })).toBe('birak');
    expect(cekmeKarari({ dx: 40, dy: 10, icerikY: 0, kilitli: false })).toBe('birak');
    expect(cekmeKarari({ dx: 2, dy: 4, icerikY: 0, kilitli: false })).toBe('bekle');
  });
  it('aşağı çekmeyi kullanan başka işlev (≡ sıralama) öncelikli', () => {
    expect(cekmeKarari({ dx: 0, dy: 30, icerikY: 0, kilitli: true })).toBe('birak');
  });
});

describe('#164 KK8 kapatilsinMi: Modal alt sayfa', () => {
  it('yüksekliğin %25’i (en az 80 px) ya da hızlı fırlatma kapatır', () => {
    expect(kapatilsinMi({ dy: 130, vy: 0 }, 480)).toBe(true);
    expect(kapatilsinMi({ dy: 110, vy: 0 }, 480)).toBe(false);
    expect(kapatilsinMi({ dy: 70, vy: 0 }, 200)).toBe(false);
    expect(kapatilsinMi({ dy: 30, vy: 1.4 }, 480)).toBe(true);
    expect(kapatilsinMi({ dy: 10, vy: 2 }, 480)).toBe(false);
  });
});

describe('#166 inceleme 1: CekmeTakibi olay sırası', () => {
  it('aktifleştikten sonraki hareketler başlangıcı taşımaz; yol aktifleşme noktasından ölçülür', () => {
    const t = new CekmeTakibi();
    t.dokunma(100, 300);
    expect(t.hareket(100, 305)).toBe('bekle');
    expect(t.hareket(101, 312)).toBe('basla');
    expect(t.hareket(101, 330)).toBe('yok');
    expect(t.hareket(101, 400)).toBe('yok');
    expect(t.yol(330)).toBe(18);
    expect(t.yol(400)).toBe(88);
    expect(t.yol(305)).toBe(0);
    t.bitti();
    expect(t.aktif).toBe(false);
  });
  it('içerik kaymışken beklenir; içerik en üste varınca aynı hareketle o noktadan taşınır', () => {
    const t = new CekmeTakibi();
    t.icerikY = 120;
    t.dokunma(50, 200);
    expect(t.hareket(50, 260)).toBe('bekle');
    t.icerikY = 0;
    expect(t.hareket(50, 280)).toBe('basla');
    expect(t.yol(300)).toBe(20);
  });
});

/** Hook'un ürettiği gerçek Pan nesnesinin geri çağrıları (runOnJS: düz işlev), RNGH'nin JS'e verdiği sırayla çağrılır. */
type Isleyiciler = Record<string, (...a: unknown[]) => void>;
const dokunus = (x: number, y: number) => ({ allTouches: [{ absoluteX: x, absoluteY: y }], numberOfTouches: 1 });

describe('#166 inceleme 1–2: useIcerikCekme olay sırası', () => {
  const kur = () => {
    const onBasla = jest.fn();
    const onCek = jest.fn();
    const onBirak = jest.fn();
    const onIptal = jest.fn();
    const r = renderHook(() => useIcerikCekme({ etkin: true, onBasla, onCek, onBirak, onIptal }));
    const yonetici = { activate: jest.fn(), fail: jest.fn(), begin: jest.fn(), end: jest.fn() };
    const h = () => (r.result.current.govde as unknown as { handlers: Isleyiciler }).handlers;
    return { r, h, yonetici, onBasla, onCek, onBirak, onIptal };
  };

  it('touchesMove → activate → start → update: sayfa parmağı izler, aktifken hareketler yeniden aktifleştirmez', () => {
    const { h, yonetici, onBasla, onCek, onBirak } = kur();
    h().onTouchesDown(dokunus(100, 300), yonetici);
    h().onTouchesMove(dokunus(100, 304), yonetici);
    expect(yonetici.activate).not.toHaveBeenCalled();
    h().onTouchesMove(dokunus(100, 312), yonetici);
    expect(yonetici.activate).toHaveBeenCalledTimes(1);
    h().onStart({ absoluteY: 312 });
    expect(onBasla).toHaveBeenCalledTimes(1);
    // Android'de translationY aktifleşmede 0'dan başlar, iOS'ta dokunuştan; ikisi de kullanılmaz.
    h().onTouchesMove(dokunus(100, 340), yonetici);
    h().onUpdate({ absoluteY: 340, translationY: 28 });
    h().onTouchesMove(dokunus(100, 420), yonetici);
    h().onUpdate({ absoluteY: 420, translationY: 108 });
    expect(yonetici.activate).toHaveBeenCalledTimes(1);
    expect(yonetici.fail).not.toHaveBeenCalled();
    expect(onCek.mock.calls.map((c) => c[0])).toEqual([28, 108]);
    h().onEnd({ absoluteY: 430, velocityY: 600 }, true);
    expect(onBirak).toHaveBeenCalledWith({ dy: 118, vy: 0.6 });
    h().onFinalize();
    // Yeni dokunuş temiz başlar.
    h().onTouchesDown(dokunus(100, 500), yonetici);
    h().onTouchesMove(dokunus(100, 520), yonetici);
    expect(yonetici.activate).toHaveBeenCalledTimes(2);
  });

  it('liste kaymışken önce liste kayar; kilitliyken (≡ sıralama) jest bırakılır', () => {
    const { r, h, yonetici, onCek } = kur();
    act(() => r.result.current.deger.onScroll({ nativeEvent: { contentOffset: { y: 150 } } } as never));
    h().onTouchesDown(dokunus(0, 100), yonetici);
    h().onTouchesMove(dokunus(0, 160), yonetici);
    expect(yonetici.activate).not.toHaveBeenCalled();
    act(() => r.result.current.deger.onScroll({ nativeEvent: { contentOffset: { y: 0 } } } as never));
    h().onTouchesMove(dokunus(0, 170), yonetici);
    expect(yonetici.activate).toHaveBeenCalledTimes(1);
    h().onStart({ absoluteY: 170 });
    h().onUpdate({ absoluteY: 200 });
    expect(onCek).toHaveBeenLastCalledWith(30);
    h().onEnd({ absoluteY: 200, velocityY: 0 }, false);
    h().onFinalize();
    act(() => r.result.current.deger.kilitle(true));
    h().onTouchesDown(dokunus(0, 100), yonetici);
    h().onTouchesMove(dokunus(0, 140), yonetici);
    expect(yonetici.fail).toHaveBeenCalledTimes(1);
  });

  it('kaydırma görünümü yeniden bağlanınca Pan yeniden kurulur (yerel jestin yeni etiketiyle eşzamanlılık)', () => {
    const { r } = kur();
    const ilk = r.result.current.govde;
    r.rerender({});
    expect(r.result.current.govde).toBe(ilk);
    act(() => r.result.current.deger.baglandi());
    expect(r.result.current.govde).not.toBe(ilk);
  });
});
