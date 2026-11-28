// #361 KK7 (UX önerileri kanvası, `Ana_v5_Amaclar` · `Ana_v5_Var`): kapaksız gezi kartının yeri. Amaca göre zemin, %85
// opak tepe deseni, sol altta 14 px içeride 44 px daire, içinde 26 px beyaz ikon (2,2 px çizgi). Yollar panodan birebir.
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { amacTonlari, renk, type AmacTonu } from '@/theme';

/** Panodaki ikon yolları (24×24 görünüm kutusu). */
export const AMAC_IKON_YOLLARI: Record<AmacTonu, string> = {
  kultur_tarih: 'M4 9.5L12 4l8 5.5M5.5 10v8M10 10v8M14 10v8M18.5 10v8M3.5 20.5h17',
  lezzet: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1.5-2 6 0 8v10',
  doga: 'M12 3l5.5 8h-3.5l4.5 7h-13l4.5-7H6.5zM12 18v3.5',
  yavas: 'M5 9.5h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M9 6.5c-1-1 1-2 0-3.5M12.5 6.5c-1-1 1-2 0-3.5',
  gece: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  cocuklu: 'M12 2.5c-3.6 0-6.5 2.7-6.5 6.2 0 3.6 3 6.8 6.5 6.8s6.5-3.2 6.5-6.8c0-3.5-2.9-6.2-6.5-6.2zM10.5 17.5h3L12 15.5zM12 17.5c-1.5 1.2 1.5 2.3 0 3.5s1 1.5 0 2',
  yok: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM15.5 8.5l-2 5-5 2 2-5z',
};

/** Tepe deseni (358×230 görünüm kutusu, kartla birlikte esner). */
const TEPE = 'M0 230 L0 138 L70 87 L140 143 L220 69 L300 127 L358 97 L358 230 Z';

/**
 * #408 KK2 · KK4: hazır gezi başlığındaki 64 / 36 px kare kapakta `kose` küçülür ve `daire` yok (44 px daire o kutuya sığmaz);
 * zemin ve tepe deseni aynı.
 */
export function AmacKapagi({ ton, yukseklik = 230, kose = 16, daire = true }: { ton: AmacTonu; yukseklik?: number; kose?: number; daire?: boolean }) {
  const r = amacTonlari[ton];
  return (
    <View testID={`amac-kapagi-${ton}`} style={[s.kutu, { height: yukseklik, borderRadius: kose }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={yukseklik} viewBox="0 0 358 230" preserveAspectRatio="none">
        <Rect width={358} height={230} fill={r.zemin} />
        <Path d={TEPE} fill={r.tepe} opacity={0.85} />
      </Svg>
      {daire ? (
        <View style={[s.daire, { backgroundColor: r.daire }]}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={renk.zemin} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d={AMAC_IKON_YOLLARI[ton]} />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kutu: { borderRadius: 16, overflow: 'hidden' },
  daire: { position: 'absolute', left: 14, bottom: 14, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
