import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

export type ProgramGorunumu = 'harita' | 'cizelge';

/**
 * #39 KK2: Program görünüm anahtarı — tam genişlik beyaz hap, iki yarım: Harita (dünya) · Çizelge (saat).
 * Aktif yarım siyah; 48 px, gölgeli. İki görünümde de aynı yerde durur.
 */
export function GorunumAnahtari({ deger, onDegis }: { deger: ProgramGorunumu; onDegis: (g: ProgramGorunumu) => void }) {
  return (
    <View style={[s.kap, s.golge]} accessibilityRole="tablist">
      {(['harita', 'cizelge'] as const).map((g) => {
        const aktif = g === deger;
        return (
          <Pressable key={g} accessibilityRole="tab" accessibilityState={{ selected: aktif }} onPress={() => onDegis(g)} style={[s.parca, aktif && s.aktif]}>
            <Ikon ad={g === 'harita' ? 'dunya' : 'program'} boyut={18} renk={aktif ? renk.zemin : renk.metin} />
            <Text style={[s.metin, aktif && { color: renk.zemin }]}>{t(`program.gorunum.${g}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { alignSelf: 'stretch', flexDirection: 'row', height: 48, padding: 4, borderRadius: 999, backgroundColor: renk.zemin },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  parca: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999 },
  aktif: { backgroundColor: renk.metin },
  metin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
});
