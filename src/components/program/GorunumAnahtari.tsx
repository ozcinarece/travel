import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

export type ProgramGorunumu = 'harita' | 'cizelge';

/** #34: Program sekmesi görünüm anahtarı — Harita (3.5 gün dağıtımı) | Çizelge (3.7 saat saat liste). */
export function GorunumAnahtari({ deger, onDegis, yuzen }: { deger: ProgramGorunumu; onDegis: (g: ProgramGorunumu) => void; yuzen?: boolean }) {
  return (
    <View style={[s.kap, yuzen && s.golge]} accessibilityRole="tablist">
      {(['harita', 'cizelge'] as const).map((g) => {
        const aktif = g === deger;
        return (
          <Pressable key={g} accessibilityRole="tab" accessibilityState={{ selected: aktif }} onPress={() => onDegis(g)} style={[s.parca, aktif && s.aktif]}>
            <Text style={[s.metin, aktif && { color: renk.zemin }]}>{t(`program.gorunum.${g}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { alignSelf: 'flex-start', flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: renk.yuzey },
  golge: { backgroundColor: renk.zemin, shadowColor: renk.metin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  parca: { height: 30, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center' },
  aktif: { backgroundColor: renk.metin },
  metin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
});
