import { Linking, StyleSheet, Text, View } from 'react-native';

import { kapakAtfiOku, type KapakAtfi } from '@/features/icerik/kapakAtfi';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

import { Hap } from './Hap';
import { yRenk } from './tema';

/**
 * #345 KK3: editörde kapağın atıf satırı — "Foto: {yazar} · {lisans}" (uygulamadaki metin, tam lisans adıyla), Commons
 * kaynak sayfası bağlantısı ve "Kaldır". Onay için bir şey yapmaya gerek yok; değiştirmek = kendi fotoğrafında "Kapak yap".
 */
export function KapakAtifSatiri({ atif, onKaldir }: { atif: KapakAtfi | null; onKaldir?: () => void }) {
  const a = kapakAtfiOku(atif);
  return (
    <View style={s.satir}>
      <View style={s.metinler}>
        {a ? (
          <Text style={s.atif} numberOfLines={1}>
            {ty('kapakAtfi.atif', { yazar: a.yazar })}
            {a.lisans ? ty('kapakAtfi.lisans', { lisans: a.lisans }) : ''}
          </Text>
        ) : null}
        {a?.kaynak_url ? (
          <Text accessibilityRole="link" onPress={() => Linking.openURL(a.kaynak_url!)} style={s.kaynak}>
            {ty('kapakAtfi.kaynak')}
          </Text>
        ) : null}
      </View>
      {onKaldir ? <Hap kucuk baslik={ty('kapakAtfi.kaldir')} onPress={onKaldir} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metinler: { flex: 1, minWidth: 0, gap: 2 },
  atif: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.metin },
  kaynak: { fontFamily: yazi.kalin, fontSize: 11.5, color: yRenk.ana, textDecorationLine: 'underline' },
});
