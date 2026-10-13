// #164 KK7: alt sayfalar içeriğin herhangi bir yerinden aşağı çekilir. Yerel ScrollView dikey sürüklemeyi JS PanResponder'dan önce
// yakaladığı için (özellikle Android) sayfa yalnız tutamaktan iniyordu. Çözüm: sayfa gövdesinde gesture-handler Pan'ı, içteki
// kaydırma görünümünün yerel jestiyle EŞZAMANLI çalışır; içerik en üstteyken aşağı çekiş sayfayı taşır, değilse önce içerik kayar.
// Sayfada aşağı çekmeyi kullanan başka bir işlev (ör. Program'da ≡ ile sıralama) `useSayfaKilidi` ile önceliği alır.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type NativeGesture, type PanGesture } from 'react-native-gesture-handler';

/** Jestin sayfayı taşımaya başlaması için gereken dikey yol (px). */
export const CEKME_ESIGI = 8;
/** Yatay hareket bundan büyük ve dikeyden baskınsa jest bırakılır (foto kaydırma, çip şeridi). */
const YATAY_ESIK = 15;

export type CekmeKarari = 'bekle' | 'basla' | 'birak';

/**
 * Gövdeden çekiş kararı (saf; test edilir): kilitliyse ya da yatay / yukarı hareketse bırakılır (içerik kayar); aşağı ve içerik en
 * üstteyse başlar; aşağı ama içerik henüz kaymış durumdaysa beklenir — içerik en üste varınca aynı hareketle sayfa taşınır.
 */
export function cekmeKarari(g: { dx: number; dy: number; icerikY: number; kilitli: boolean }): CekmeKarari {
  if (g.kilitli) return 'birak';
  if (Math.abs(g.dx) > YATAY_ESIK && Math.abs(g.dx) > Math.abs(g.dy)) return 'birak';
  if (g.dy < -CEKME_ESIGI) return 'birak';
  if (g.dy > CEKME_ESIGI) return g.icerikY <= 0 ? 'basla' : 'bekle';
  return 'bekle';
}

type Baglam = {
  /** Gövdedeki dikey kaydırmanın konumu buraya bildirilir. */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Gövdedeki dikey kaydırma görünümünün yerel jesti (sayfa jestiyle eşzamanlı). */
  jest: NativeGesture;
  /** Sayfada aşağı çekmeyi kullanan başka bir işlev başlayınca true, bitince false. */
  kilitle: (k: boolean) => void;
  /** Kaydırma görünümü kurulup kalkınca konum sıfırlanır (yeni liste en üstten başlar). */
  sifirla: () => void;
};

const SayfaBaglami = createContext<Baglam | null>(null);
const bosKaydirma = () => {};
const bosKilit = () => {};

/** Gövdedeki dikey listenin `onScroll`'u: içerik en üstteyken aşağı çekiş sayfayı taşır. Sayfa dışında boş işlev. */
export const useSayfaKaydirma = () => useContext(SayfaBaglami)?.onScroll ?? bosKaydirma;
/** Sayfada aşağı çekmeyi kullanan işlev (sıralama) önceliği alır: başlarken true, biterken false. */
export const useSayfaKilidi = () => useContext(SayfaBaglami)?.kilitle ?? bosKilit;

/**
 * Gövdedeki dikey kaydırma görünümünü (ScrollView / FlatList) sarar: yerel jestini sayfanın çekiş jestine bağlar. Görünüm ayrıca
 * `onScroll={useSayfaKaydirma()}` ve `bounces={false}` almalı. Sayfa dışında çocuğu olduğu gibi döner.
 */
export function SayfaKaydirmasi({ children }: { children: ReactElement }) {
  const b = useContext(SayfaBaglami);
  const sifirla = b?.sifirla;
  useEffect(() => {
    sifirla?.();
    return () => sifirla?.();
  }, [sifirla]);
  if (!b) return children;
  return <GestureDetector gesture={b.jest}>{children}</GestureDetector>;
}

/** Sayfa gövdesinin dikey ScrollView'u: konumunu bildirir ve sayfanın çekiş jestine bağlıdır (en üstteyken aşağı çekiş sayfayı taşır). */
export function SayfaKaydirici({ onScroll, ...p }: ScrollViewProps) {
  const kaydirma = useSayfaKaydirma();
  return (
    <SayfaKaydirmasi>
      <ScrollView
        {...p}
        onScroll={(e) => {
          kaydirma(e);
          onScroll?.(e);
        }}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
      />
    </SayfaKaydirmasi>
  );
}

/** Bırakılan çekişin hızı px/ms (PanResponder ile aynı birim). */
export type Birakis = { dy: number; vy: number };

/**
 * Gövde çekiş jesti + sağlayıcı değeri. `onBasla` sayfa taşınmaya başlarken, `onCek(dy)` taşınırken (dy: taşımanın başladığı
 * noktadan bu yana, aşağı pozitif), `onBirak` bırakınca, `onIptal` jest kesilince çağrılır. Hepsi JS iş parçacığında.
 */
export function useIcerikCekme(o: { etkin: boolean; onBasla: () => void; onCek: (dy: number) => void; onBirak: (b: Birakis) => void; onIptal: () => void }) {
  const isleyici = useRef(o);
  useEffect(() => {
    isleyici.current = o;
  });
  const durum = useRef({ icerikY: 0, kilit: false, x0: 0, y0: 0, tasimaY0: 0 });
  const [jest] = useState(() => Gesture.Native());
  const deger = useMemo<Baglam>(
    () => ({
      onScroll: (e) => {
        durum.current.icerikY = e.nativeEvent.contentOffset.y;
      },
      jest,
      kilitle: (k) => {
        durum.current.kilit = k;
      },
      sifirla: () => {
        durum.current.icerikY = 0;
      },
    }),
    [jest],
  );
  const etkin = o.etkin;
  // Ref'ler yalnız jest işleyicilerinin içinde okunur (render sırasında değil); lint zincirdeki kapanışları ayırt edemiyor.
  /* eslint-disable react-hooks/refs */
  const govde = useMemo<PanGesture>(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(etkin)
        .manualActivation(true)
        .simultaneousWithExternalGesture(jest)
        .onTouchesDown((e) => {
          const t = e.allTouches[0];
          if (!t) return;
          durum.current.x0 = t.absoluteX;
          durum.current.y0 = t.absoluteY;
        })
        .onTouchesMove((e, yonetici) => {
          const t = e.allTouches[0];
          if (!t || e.numberOfTouches > 1) {
            yonetici.fail();
            return;
          }
          const d = durum.current;
          const karar = cekmeKarari({ dx: t.absoluteX - d.x0, dy: t.absoluteY - d.y0, icerikY: d.icerikY, kilitli: d.kilit });
          if (karar === 'birak') yonetici.fail();
          else if (karar === 'basla') {
            // Sayfa bu noktadan taşınır (içerik az önce en üste vardıysa önceki yol sayılmaz).
            d.tasimaY0 = t.absoluteY - d.y0;
            yonetici.activate();
          }
        })
        .onStart(() => isleyici.current.onBasla())
        .onUpdate((e) => isleyici.current.onCek(Math.max(0, e.translationY - durum.current.tasimaY0)))
        .onEnd((e, basarili) => {
          if (basarili) isleyici.current.onBirak({ dy: Math.max(0, e.translationY - durum.current.tasimaY0), vy: e.velocityY / 1000 });
          else isleyici.current.onIptal();
        }),
    [jest, etkin],
  );
  /* eslint-enable react-hooks/refs */
  return { govde, deger };
}

export function SayfaCekmeSaglayici({ deger, children }: { deger: Baglam; children: ReactNode }) {
  return <SayfaBaglami.Provider value={deger}>{children}</SayfaBaglami.Provider>;
}

/** Modal alt sayfa: bu kadar aşağı çekilir ya da hızlı fırlatılırsa kapanır (sayfa yüksekliğinin %25'i, en az 80 px). */
export function kapatilsinMi(b: Birakis, yukseklik: number): boolean {
  return b.dy > Math.max(80, yukseklik * 0.25) || (b.vy > 1 && b.dy > 20);
}

const YAY = { useNativeDriver: true, tension: 140, friction: 20 } as const;

/**
 * #164 KK7–8: Modal alt sayfanın kendisi (beyaz kutu). Tutamaktan ya da içeriğin herhangi bir yerinden aşağı çekilince sayfa
 * parmağı izler; yeterince çekilince (ya da fırlatılınca) aşağı kayıp `onKapat` çağrılır, değilse yerine yaylanır. Modal'ın
 * kökü `GestureHandlerRootView` olmalı (Android'de Modal ayrı pencere).
 */
export function CekilenSayfa({ onKapat, style, children, accessibilityViewIsModal }: { onKapat: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; accessibilityViewIsModal?: boolean }) {
  const [y] = useState(() => new Animated.Value(0));
  const yukseklik = useRef(0);
  // Üst bileşen kapatmazsa (ör. işlem sürerken) sayfa ekran dışında kalmasın: kısa süre sonra hâlâ kuruluysa yerine döner.
  const geriDonus = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (geriDonus.current) clearTimeout(geriDonus.current);
    },
    [],
  );
  const { govde, deger } = useIcerikCekme({
    etkin: true,
    onBasla: () => y.stopAnimation(),
    onCek: (dy) => y.setValue(dy),
    onBirak: (b) => {
      if (kapatilsinMi(b, yukseklik.current))
        Animated.timing(y, { toValue: yukseklik.current + 40, duration: 180, useNativeDriver: true }).start(() => {
          onKapat();
          geriDonus.current = setTimeout(() => Animated.spring(y, { toValue: 0, ...YAY }).start(), 500);
        });
      else Animated.spring(y, { toValue: 0, ...YAY }).start();
    },
    onIptal: () => Animated.spring(y, { toValue: 0, ...YAY }).start(),
  });
  const olc = (e: LayoutChangeEvent) => {
    yukseklik.current = e.nativeEvent.layout.height;
  };
  return (
    <GestureDetector gesture={govde}>
      <Animated.View style={[style, { transform: [{ translateY: y }] }]} onLayout={olc} collapsable={false} accessibilityViewIsModal={accessibilityViewIsModal}>
        <SayfaCekmeSaglayici deger={deger}>{children}</SayfaCekmeSaglayici>
      </Animated.View>
    </GestureDetector>
  );
}

export const modalKokuStili = StyleSheet.create({ kok: { flex: 1 } }).kok;
