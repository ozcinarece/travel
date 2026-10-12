import { StyleSheet, Text, View } from 'react-native';

import { ARALIKLAR } from '@/features/yonetim/genelBakis';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

/**
 * KK6 "Son 30 gün" hapı (kanvas üst çubuk). Açık hali kanvasta yok (tasarım bekliyor): hapın üstünde görünmez bir
 * <select> — tıklanınca tarayıcının kendi listesi açılır, görünen yine kanvastaki hap.
 */
export function AralikSecici({ gun, onDegis }: { gun: number; onDegis: (g: number) => void }) {
  return (
    <View style={s.hap}>
      <Text style={s.metin}>{ty('genel.aralik', { gun })}</Text>
      <select
        aria-label={ty('genel.aralikSec')}
        value={gun}
        onChange={(e) => onDegis(Number(e.target.value))}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 0 }}>
        {ARALIKLAR.map((a) => (
          <option key={a} value={a}>
            {ty('genel.aralik', { gun: a })}
          </option>
        ))}
      </select>
    </View>
  );
}

const s = StyleSheet.create({
  hap: { height: 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: yRenk.cerceve, backgroundColor: yRenk.zemin, justifyContent: 'center' },
  metin: { fontFamily: yazi.ekstra, fontSize: 12.5, color: yRenk.metin },
});
