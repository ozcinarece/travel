import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import {
  SayfaCekmeSaglayici,
  useIcerikCekme,
  useSayfaKaydirma,
} from "@/components/ui/sayfaCekme";
import { renk } from "@/theme";

// #164: gövde kaydırması `sayfaCekme`de; eski içe aktarmalar bozulmasın.
export { useSayfaKaydirma };

/** #55 §B7: üç durma noktası. */
export type SayfaHali = "katli" | "yari" | "tam";

/** Görünür yükseklikler (px, ekranın altından). */
export type SayfaYukseklikleri = Record<SayfaHali, number>;

const SIRA: SayfaHali[] = ["katli", "yari", "tam"];
/** Hızlı kaydırmada (fling) konumun bu kadar ms sonrası tahmin edilir. */
const FLING_MS = 180;

/**
 * Bırakılan konum + hız → en yakın durma noktası (öteleme cinsinden: 0 = tam açık). #164 KK5: `baslangic` verilirse sonuç ona
 * komşu hallerle sınırlanır — küçükten yarıma, yarımdan tama; hızlı fırlatmada da tek adım (yarım hal atlanmaz).
 */
export function durmaNoktasi(
  oteleme: number,
  hiz: number,
  yukseklik: SayfaYukseklikleri,
  baslangic?: SayfaHali,
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
  if (!baslangic) return en;
  const b = SIRA.indexOf(baslangic);
  const i = SIRA.indexOf(en);
  return SIRA[Math.max(b - 1, Math.min(b + 1, i))];
}

const YAY = { useNativeDriver: true, tension: 140, friction: 20 } as const;

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
 * #55 §B7 alt sayfa: katlı · yarı açık · tam ekran. Tutamaktan / başlıktan iki yöne, #164 KK7: içeriğin herhangi bir yerinden
 * aşağı (içerik en üstteyken; değilse önce içerik kayar) çekilir; bırakınca hız da hesaba katılarak komşu hale (#164 KK5: tek
 * adım) yaylı (~250 ms) oturur. ≡ sürüklemesi `useSayfaKilidi` ile önceliği alır, sayfa onu bölmez.
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
    basHal: hal,
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
    Animated.spring(oteleme, { toValue: hedef, ...YAY }).start();
  }, [hedef, oteleme]);

  // Ortak sürükleme işleyicileri: üst şerit iki yöne, gövde yalnız aşağı (içerik en üstteyken) taşır. Ref'ler yalnız jest
  // işleyicilerinin içinde okunur.
  const isleyiciler = useMemo(
    () => ({
      basla: () => {
        oteleme.stopAnimation();
        durum.current.baslangic = durum.current.simdi;
        durum.current.basHal = durum.current.hal;
      },
      tasi: (dy: number) => {
        const d = durum.current;
        const enFazla = d.yukseklik.tam - d.yukseklik.katli;
        oteleme.setValue(Math.max(0, Math.min(enFazla, d.baslangic + dy)));
      },
      birak: (vy: number) => {
        const d = durum.current;
        const yeni = durmaNoktasi(d.simdi, vy, d.yukseklik, d.basHal);
        if (yeni === d.hal)
          Animated.spring(oteleme, {
            toValue: d.yukseklik.tam - d.yukseklik[yeni],
            ...YAY,
          }).start();
        else d.onHal(yeni);
      },
      iptal: () => {
        const d = durum.current;
        Animated.spring(oteleme, {
          toValue: d.yukseklik.tam - d.yukseklik[d.hal],
          ...YAY,
        }).start();
      },
    }),
    [oteleme],
  );
  // Ref'ler yalnız jest işleyicilerinin içinde okunur; lint zincirdeki kapanışları ayırt edemiyor.
  /* eslint-disable react-hooks/refs */
  const ustCekme = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetY([-8, 8])
        .failOffsetX([-20, 20])
        .onStart(isleyiciler.basla)
        .onUpdate((e) => isleyiciler.tasi(e.translationY))
        .onEnd((e, basarili) =>
          basarili ? isleyiciler.birak(e.velocityY / 1000) : isleyiciler.iptal(),
        ),
    [isleyiciler],
  );
  /* eslint-enable react-hooks/refs */
  const { govde: govdeCekme, deger: kaydirmaDegeri } = useIcerikCekme({
    etkin: hal !== "katli",
    onBasla: isleyiciler.basla,
    onCek: isleyiciler.tasi,
    onBirak: (b) => isleyiciler.birak(b.vy),
    onIptal: isleyiciler.iptal,
  });

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
        <GestureDetector gesture={ustCekme}>
          <View
            onLayout={(e) => onUstYukseklik?.(e.nativeEvent.layout.height)}
            collapsable={false}
          >
            {ust}
          </View>
        </GestureDetector>
        <SayfaCekmeSaglayici deger={kaydirmaDegeri}>
          <GestureDetector gesture={govdeCekme}>
            <View style={{ flex: 1 }} collapsable={false}>
              {children}
            </View>
          </GestureDetector>
        </SayfaCekmeSaglayici>
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
