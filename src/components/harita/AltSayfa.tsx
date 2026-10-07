import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { renk } from "@/theme";

/** #55 §B7: üç durma noktası. */
export type SayfaHali = "katli" | "yari" | "tam";

/** Görünür yükseklikler (px, ekranın altından). */
export type SayfaYukseklikleri = Record<SayfaHali, number>;

const SIRA: SayfaHali[] = ["katli", "yari", "tam"];
/** Hızlı kaydırmada (fling) konumun bu kadar ms sonrası tahmin edilir. */
const FLING_MS = 180;

/** Bırakılan konum + hız → en yakın durma noktası (öteleme cinsinden: 0 = tam açık). */
export function durmaNoktasi(
  oteleme: number,
  hiz: number,
  yukseklik: SayfaYukseklikleri,
): SayfaHali {
  const tahmin = oteleme + hiz * FLING_MS;
  let en: SayfaHali = "katli";
  let fark = Infinity;
  for (const h of SIRA) {
    const d = Math.abs(yukseklik.tam - yukseklik[h] - tahmin);
    if (d < fark) {
      fark = d;
      en = h;
    }
  }
  return en;
}

/** Gövdedeki liste kaydırmasını sayfaya bildirir: liste en üstteyken aşağı çekmek sayfayı indirir. */
const KaydirmaBaglami = createContext<
  (e: NativeSyntheticEvent<NativeScrollEvent>) => void
>(() => {});
export const useSayfaKaydirma = () => useContext(KaydirmaBaglami);

type Props = {
  hal: SayfaHali;
  onHal: (h: SayfaHali) => void;
  yukseklik: SayfaYukseklikleri;
  /** Üst şerit (tutamak + başlık): her halde görünür; buradan iki yöne sürüklenir. */
  ust: ReactNode;
  onUstYukseklik?: (h: number) => void;
  /** Gövde; liste en üstteyken aşağı çekince sayfa iner. */
  children?: ReactNode;
  /** Sayfanın hemen üstünde yüzen içerik (sayfayla birlikte hareket eder). */
  ustunde?: ReactNode;
  altDolgu?: number;
};

/**
 * #55 §B7 alt sayfa: katlı · yarı açık · tam ekran. Tutamaktan / başlıktan iki yöne, listenin en üstündeyken listeden
 * aşağı çekilir; bırakınca hız da hesaba katılarak en yakın noktaya yaylı (~250 ms) oturur. ≡ sürükleme tutamacı
 * sonlandırmayı reddettiği için sayfa onu bölmez.
 */
export function AltSayfa({
  hal,
  onHal,
  yukseklik,
  ust,
  onUstYukseklik,
  children,
  ustunde,
  altDolgu = 0,
}: Props) {
  const [oteleme] = useState(
    () => new Animated.Value(yukseklik.tam - yukseklik[hal]),
  );
  const durum = useRef({
    baslangic: yukseklik.tam - yukseklik[hal],
    simdi: yukseklik.tam - yukseklik[hal],
    listeY: 0,
    hal,
    yukseklik,
    onHal,
  });
  useEffect(() => {
    durum.current.hal = hal;
    durum.current.yukseklik = yukseklik;
    durum.current.onHal = onHal;
  });
  useEffect(() => {
    const id = oteleme.addListener(({ value }) => {
      durum.current.simdi = value;
    });
    return () => oteleme.removeListener(id);
  }, [oteleme]);

  // Hal (ya da ölçüler) değişince yaylı otur.
  const hedef = yukseklik.tam - yukseklik[hal];
  useEffect(() => {
    Animated.spring(oteleme, {
      toValue: hedef,
      useNativeDriver: true,
      tension: 140,
      friction: 20,
    }).start();
  }, [hedef, oteleme]);

  // Ortak sürükleme işleyicileri; üst şerit iki yöne, gövde yalnız aşağı (liste en üstteyken) yakalar.
  const isleyiciler = useMemo(
    () => ({
      onPanResponderGrant: () => {
        durum.current.baslangic = durum.current.simdi;
        oteleme.stopAnimation();
      },
      onPanResponderMove: (_: unknown, g: { dy: number }) => {
        const d = durum.current;
        const enFazla = d.yukseklik.tam - d.yukseklik.katli;
        oteleme.setValue(Math.max(0, Math.min(enFazla, d.baslangic + g.dy)));
      },
      onPanResponderRelease: (_: unknown, g: { vy: number }) => {
        const d = durum.current;
        const yeni = durmaNoktasi(d.simdi, g.vy, d.yukseklik);
        if (yeni === d.hal)
          Animated.spring(oteleme, {
            toValue: d.yukseklik.tam - d.yukseklik[yeni],
            useNativeDriver: true,
            tension: 140,
            friction: 20,
          }).start();
        else d.onHal(yeni);
      },
      onPanResponderTerminate: () => {
        const d = durum.current;
        Animated.spring(oteleme, {
          toValue: d.yukseklik.tam - d.yukseklik[d.hal],
          useNativeDriver: true,
          tension: 140,
          friction: 20,
        }).start();
      },
    }),
    [oteleme],
  );
  const dikey = (g: { dx: number; dy: number }) =>
    Math.abs(g.dy) >= 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2;
  // Ref'ler yalnız jest işleyicilerinin içinde okunur (render sırasında değil); lint kapanışı ayırt edemiyor.
  const ustCekme = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => dikey(g),
        ...isleyiciler,
      }),
    [isleyiciler],
  );
  const govdeCekme = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        // Liste en üstteyken aşağı çekiş listeden önce yakalanır (sayfa iner); yukarı ve diğer hareketler listeye kalır.
        onMoveShouldSetPanResponderCapture: (_, g) =>
          dikey(g) &&
          g.dy > 0 &&
          durum.current.listeY <= 0 &&
          durum.current.hal !== "katli",
        ...isleyiciler,
      }),
    [isleyiciler],
  );

  const kaydirma = useMemo(
    () => (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      durum.current.listeY = e.nativeEvent.contentOffset.y;
    },
    [],
  );

  return (
    <>
      {/* Sayfanın hemen üstünde yüzen içerik: kardeş katman, aynı ötelemeyle hareket eder (Android'de ebeveyn sınırı
          dışındaki görünüm dokunma almaz, bu yüzden sayfanın çocuğu değil). */}
      {ustunde ? (
        <Animated.View
          style={[
            s.ustunde,
            { bottom: yukseklik.tam, transform: [{ translateY: oteleme }] },
          ]}
          pointerEvents="box-none"
        >
          {ustunde}
        </Animated.View>
      ) : null}
      <Animated.View
        style={[
          s.sayfa,
          {
            height: yukseklik.tam,
            paddingBottom: altDolgu,
            transform: [{ translateY: oteleme }],
          },
        ]}
      >
        <View
          {...ustCekme.panHandlers}
          onLayout={(e) => onUstYukseklik?.(e.nativeEvent.layout.height)}
        >
          {ust}
        </View>
        <KaydirmaBaglami.Provider value={kaydirma}>
          <View {...govdeCekme.panHandlers} style={{ flex: 1 }}>
            {children}
          </View>
        </KaydirmaBaglami.Provider>
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  sayfa: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: renk.zemin,
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 12,
  },
  ustunde: { position: "absolute", left: 0, right: 0 },
});
