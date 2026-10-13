import { Pressable, StyleSheet, Text, View } from 'react-native';

import { kose, renk, yazi } from '@/theme';

type Secenek<T extends string> = { deger: T; etiket: string };

/** #136: segment seçici — Buz kap (köşe 12, 3 px dolgu), seçili beyaz dilim + Gece yazı. */
export function SegmentSecici<T extends string>({ secenekler, deger, onDeger }: { secenekler: Secenek<T>[]; deger: T; onDeger: (d: T) => void }) {
  return (
    <View style={s.kap} accessibilityRole="tablist">
      {secenekler.map((o) => {
        const secili = o.deger === deger;
        return (
          <Pressable key={o.deger} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => onDeger(o.deger)} style={[s.dilim, secili && s.secili]}>
            <Text style={[s.metin, secili && s.seciliMetin]} numberOfLines={1}>
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
  dilim: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secili: { backgroundColor: renk.zemin },
  metin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
  seciliMetin: { color: renk.ana },
});
