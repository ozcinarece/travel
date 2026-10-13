import { StyleSheet, Text, View } from 'react-native';

import { yuzdeMetni, type Kart } from '@/features/yonetim/genelBakis';
import { yazi } from '@/theme';

import { yGolge, yRenk } from '../tema';

/**
 * KK1 (kanvas ekran 1 kartı): 16 × 18 iç boşluk, 14 yarıçap, 1 px #ebebeb; başlık 12 px 700 gri, değer 28 px 800,
 * alt satır 11,5 px 600 gri ve önünde yeşil değişim. Düşüş kanvasta yok: hata rengiyle.
 */
export function KpiKarti({ kart }: { kart: Kart }) {
  return (
    <View style={s.kart} accessibilityLabel={`${kart.baslik}: ${kart.deger}`}>
      <Text style={s.baslik}>{kart.baslik}</Text>
      <Text style={s.deger}>{kart.deger}</Text>
      <Text style={s.alt}>
        {kart.degisim !== null ? <Text style={[s.degisim, kart.degisim < 0 && s.dusus]}>{`${yuzdeMetni(kart.degisim)} `}</Text> : null}
        {kart.alt}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kart: { flex: 1, minWidth: 0, padding: 20, borderRadius: 22, backgroundColor: yRenk.zemin, boxShadow: yGolge, gap: 6 },
  baslik: { fontFamily: yazi.kalin, fontSize: 12, color: yRenk.ikincil },
  deger: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.84, lineHeight: 28, color: yRenk.metin },
  alt: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  degisim: { fontFamily: yazi.ekstra, color: yRenk.basari },
  dusus: { color: yRenk.hata },
});
