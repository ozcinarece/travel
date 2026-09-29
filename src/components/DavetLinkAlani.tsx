import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { davetTokeni } from '@/lib/davetLinki';
import { renk, yazi } from '@/theme';

type Props = { onToken: (token: string) => void };

// PRD 0.3 KK1 ve 0.5 KK2: davet linki yapıştırma alanı → 3.10. Link ya da çıplak 8 karakter kabul edilir.
export function DavetLinkAlani({ onToken }: Props) {
  const [metin, setMetin] = useState('');
  const [hatali, setHatali] = useState(false);

  const gonder = () => {
    const token = davetTokeni(metin);
    if (!token) {
      setHatali(true);
      return;
    }
    onToken(token);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={[s.kutu, hatali && s.kutuHata]}>
        <TextInput
          accessibilityLabel={t('davet.alan.yer')}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={t('davet.alan.yer')}
          placeholderTextColor={renk.soluk}
          value={metin}
          onChangeText={(v) => {
            setMetin(v);
            setHatali(false);
          }}
          onSubmitEditing={gonder}
          style={s.girdi}
        />
        <Pressable accessibilityRole="button" onPress={gonder} hitSlop={8}>
          <Text style={s.git}>{t('davet.alan.git')}</Text>
        </Pressable>
      </View>
      {hatali ? <Text style={s.hata}>{t('davet.alan.hata')}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  kutu: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: renk.zemin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: renk.ayrac,
  },
  kutuHata: { borderColor: renk.uyari },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  git: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: renk.uyari },
});
