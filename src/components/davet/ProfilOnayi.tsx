// #137 KK5 (kanvas 2 · Profil ilk davet): "Arkadaşların seni böyle görecek" — ilk davet paylaşımından önce bir kez.
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { useProfil } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { minDokunma, renk, yazi } from '@/theme';

type Props = { acik: boolean; onKapat: () => void; onGonder: () => void };

export function ProfilOnayi({ acik, onKapat, onGonder }: Props) {
  const profil = useProfil();
  const ad = profil.data?.name ?? '';
  const degistir = () => {
    onKapat();
    router.navigate('/(tabs)/profil');
  };
  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <Pressable style={s.perde} onPress={onKapat} accessibilityLabel={t('genel.vazgec')}>
        <Pressable style={s.sayfa} onPress={() => {}} accessibilityRole="none">
          <View style={s.tutamac} />
          <Text accessibilityRole="header" style={s.baslik}>
            {t('davet.onay.baslik')}
          </Text>
          <Text style={s.metin}>{t('davet.onay.metin')}</Text>
          <View style={s.kart}>
            <Avatar ad={ad || '?'} url={profil.data?.photo_url} boyut={64} arkaPlan={renk.vurgu} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.ad} numberOfLines={1}>
                {ad}
              </Text>
              <Text style={s.kullanici} numberOfLines={1}>
                @{profil.data?.username ?? ''}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={degistir} style={s.degistir}>
              <Text style={s.degistirMetin}>{t('davet.onay.degistir')}</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={onGonder} style={s.gonder}>
            <Text style={s.gonderMetin}>{t('davet.onay.gonder')}</Text>
          </Pressable>
          <Text style={s.not}>{t('davet.onay.not')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.45)', justifyContent: 'flex-end' },
  sayfa: { backgroundColor: renk.zemin, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 34, gap: 14 },
  tutamac: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  baslik: { fontFamily: yazi.ekstra, fontSize: 24, lineHeight: 27, letterSpacing: -0.6, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: renk.yuzey },
  ad: { fontFamily: yazi.ekstra, fontSize: 18, color: renk.metin },
  kullanici: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  degistir: { height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: renk.zemin, justifyContent: 'center' },
  degistirMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  gonder: { height: 54, minHeight: minDokunma, borderRadius: 999, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  gonderMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.zemin },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 17, textAlign: 'center', color: renk.ikincil },
});
