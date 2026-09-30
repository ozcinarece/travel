import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Buton } from '@/components/ui/Buton';
import { t } from '@/i18n';
import { davetTokeni } from '@/lib/davetLinki';
import { bosluk, renk, yazi } from '@/theme';

// PRD 0.5: seyahati olmayan kullanıcı bunu görür. KK2: "İlk seyahatini planla" → 3.2, davet → link alanı.
export function BosDurum() {
  const [alanAcik, setAlanAcik] = useState(false);
  const [metin, setMetin] = useState('');
  const [hatali, setHatali] = useState(false);

  const katil = () => {
    const token = davetTokeni(metin);
    if (!token) {
      setHatali(true);
      return;
    }
    router.push({ pathname: '/r/[token]', params: { token } });
  };

  return (
    <View style={s.kart}>
      <View style={{ gap: 6 }}>
        <Text style={s.baslik}>{t('seyahatler.bos.baslik')}</Text>
        <Text style={s.alt}>{t('seyahatler.bos.alt')}</Text>
      </View>
      <Buton
        baslik={t('seyahatler.bos.planla')}
        onPress={() => router.push('/(tabs)/yeni')}
        ikon={
          <View style={s.arti}>
            <Text style={s.artiIsaret}>+</Text>
          </View>
        }
      />
      {alanAcik ? (
        <View style={{ gap: 8 }}>
          <View style={[s.linkKutu, hatali && s.linkKutuHata]}>
            <TextInput
              accessibilityLabel={t('seyahatler.bos.davet')}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={t('seyahatler.bos.davetYer')}
              placeholderTextColor={renk.soluk}
              value={metin}
              onChangeText={(v) => {
                setMetin(v);
                setHatali(false);
              }}
              onSubmitEditing={katil}
              style={s.linkGirdi}
            />
            <Pressable accessibilityRole="button" onPress={katil} hitSlop={8}>
              <Text style={s.linkGit}>{t('seyahatler.bos.davetGit')}</Text>
            </Pressable>
          </View>
          {hatali ? <Text style={s.hata}>{t('seyahatler.bos.davetHata')}</Text> : null}
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setAlanAcik(true)} hitSlop={8}>
          <Text style={s.davet}>{t('seyahatler.bos.davet')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kart: {
    marginHorizontal: bosluk.kenar,
    marginTop: 18,
    padding: 20,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: renk.yuzey,
    gap: 14,
  },
  baslik: { fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.7, lineHeight: 25, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 20, color: renk.ikincil },
  arti: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: renk.zemin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artiIsaret: { fontFamily: yazi.kalin, fontSize: 16, lineHeight: 18, color: renk.zemin },
  davet: { fontFamily: yazi.kalin, fontSize: 13, textAlign: 'center', color: renk.metin, paddingVertical: 4 },
  linkKutu: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: renk.zemin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  linkKutuHata: { borderColor: renk.uyari },
  linkGirdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  linkGit: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: renk.uyari },
});
