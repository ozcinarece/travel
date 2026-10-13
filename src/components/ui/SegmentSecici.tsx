import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { kose, renk, yazi } from '@/theme';

type Secenek<T extends string> = { deger: T; etiket: string; /** #143: dilimde etiketin solunda ikon (seçiliyse Gece, değilse ikincil). */ ikon?: (secili: boolean) => ReactNode };

/**
 * #136: segment seçici — Buz kap (köşe 12, 3 px dolgu), seçili beyaz dilim + Gece yazı.
 * #143 `buyuk` (kanvas 17–18 gezi sekmeleri): köşe 14, 4 px dolgu, 40 px dilim, 14 px yazı, seçili dilimde hafif gölge.
 */
export function SegmentSecici<T extends string>({ secenekler, deger, onDeger, buyuk }: { secenekler: Secenek<T>[]; deger: T; onDeger: (d: T) => void; buyuk?: boolean }) {
  return (
    <View style={[s.kap, buyuk && s.kapBuyuk]} accessibilityRole="tablist">
      {secenekler.map((o) => {
        const secili = o.deger === deger;
        return (
          <Pressable key={o.deger} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => onDeger(o.deger)} style={[s.dilim, buyuk && s.dilimBuyuk, secili && s.secili, secili && buyuk && s.seciliGolge]}>
            {o.ikon?.(secili)}
            <Text style={[s.metin, buyuk && s.metinBuyuk, secili && (buyuk ? s.seciliMetinBuyuk : s.seciliMetin)]} numberOfLines={1}>
              {o.etiket}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: kose.alan, backgroundColor: renk.yuzey },
  kapBuyuk: { gap: 4, padding: 4, borderRadius: 14 },
  dilim: { flex: 1, height: 36, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dilimBuyuk: { height: 40, borderRadius: 11 },
  secili: { backgroundColor: renk.zemin },
  seciliGolge: { shadowColor: renk.metin, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  metin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
  metinBuyuk: { fontSize: 14 },
  seciliMetin: { color: renk.ana },
  seciliMetinBuyuk: { color: renk.metin },
});
