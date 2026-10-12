import { StyleSheet, Text, View } from 'react-native';

import { yuzdeMetni, type Kart } from '@/features/yonetim/genelBakis';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

/**
 * KK1 (kanvas ekran 1 kartı): 16 × 18 iç boşluk, 14 yarıçap, 1 px #ebebeb; başlık 12 px 700 gri, değer 28 px 800,
 * alt satır 11,5 px 600 gri ve önünde yeşil (#1f8a4c) değişim. Düşüş kanvasta yok: hata rengiyle (#ff5a1f).
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
  kart: { flex: 1, minWidth: 0, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: yRenk.ayrac, gap: 6 },
  baslik: { fontFamily: yazi.kalin, fontSize: 12, color: yRenk.ikincil },
  deger: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.84, lineHeight: 28, color: yRenk.metin },
  alt: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  degisim: { fontFamily: yazi.ekstra, color: '#1f8a4c' },
  dusus: { color: '#ff5a1f' },
});
