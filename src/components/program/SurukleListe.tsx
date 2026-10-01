import { useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View, type GestureResponderHandlers } from 'react-native';

type Props<T> = {
  veriler: T[];
  anahtar: (t: T) => string;
  /** Sabit satır yüksekliği (sürükleme hesabı için). */
  yukseklik: number;
  /** Satır içeriği; `tutamac` sürükleme başlatan dokunma işleyicileridir. */
  cizim: (t: T, index: number, tutamac: GestureResponderHandlers, aktif: boolean) => ReactNode;
  onTasi: (from: number, to: number) => void;
};

/**
 * 3.7 KK2: tutamaçtan sürükleyerek yeniden sıralama. Bağımlılıksız (PanResponder), sabit yükseklikli satırlar;
 * sürüklenen satır kayar, bırakınca hedef konum `onTasi` ile bildirilir (tek order_key yazımı).
 */
export function SurukleListe<T>({ veriler, anahtar, yukseklik, cizim, onTasi }: Props<T>) {
  const [aktif, setAktif] = useState<number | null>(null);
  const [kayma] = useState(() => new Animated.Value(0));
  const uzunluk = veriler.length;

  const tutamacYap = (index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setAktif(index);
        kayma.setValue(0);
      },
      onPanResponderMove: (_, g) => kayma.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        setAktif(null);
        kayma.setValue(0);
        const to = Math.max(0, Math.min(uzunluk - 1, index + Math.round(g.dy / yukseklik)));
        if (to !== index) onTasi(index, to);
      },
      onPanResponderTerminate: () => {
        setAktif(null);
        kayma.setValue(0);
      },
    }).panHandlers;

  return (
    <View>
      {veriler.map((v, i) => {
        const surukleniyor = aktif === i;
        return (
          <Animated.View
            key={anahtar(v)}
            style={[s.satir, { height: yukseklik }, surukleniyor && [s.surukleniyor, { transform: [{ translateY: kayma }] }]]}>
            {cizim(v, i, tutamacYap(i), surukleniyor)}
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { shadowColor: '#0f0f0f' },
  surukleniyor: { zIndex: 10, elevation: 6, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
});
