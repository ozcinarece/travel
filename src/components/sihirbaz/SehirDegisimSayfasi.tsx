// #581 KK3b: taslak seyahatin şehri değişince ve 3. adımda yer seçildiyse onay çekmecesi. Günü sil onayıyla aynı çekmece
// (`GunSilSayfasi`, `v7pCekmece`): başlık "Seçtiğin {n} yer listeden çıkar.", kırmızı "Devam et", altta büyük "Vazgeç".
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { v7pCekmece } from '@/components/program/SecimMenusu';
import { CekilenSayfa, modalKokuStili } from '@/components/ui/sayfaCekme';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Props = {
  /** Listeden çıkacak yer sayısı; null → kapalı. */
  yerSayisi: number | null;
  onDevam: () => void;
  onVazgec: () => void;
};

export function SehirDegisimSayfasi({ yerSayisi, onDevam, onVazgec }: Props) {
  return (
    <Modal visible={yerSayisi !== null} transparent animationType="fade" onRequestClose={onVazgec}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={v7pCekmece.perde}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onVazgec} accessibilityLabel={t('genel.vazgec')} />
          <CekilenSayfa onKapat={onVazgec} style={v7pCekmece.kutu}>
            <View style={v7pCekmece.tutamac} />
            <Text accessibilityRole="header" style={[v7pCekmece.baslik, s.baslik]}>
              {t('sihirbaz.nereye.sehirDegisti', { n: yerSayisi ?? 0 })}
            </Text>
            <Pressable accessibilityRole="button" onPress={onDevam} style={({ pressed }) => [s.devam, pressed && { opacity: 0.7 }]}>
              <Text style={s.devamMetin}>{t('sihirbaz.nereye.sehirDegistiDevam')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onVazgec} style={[v7pCekmece.vazgec, { marginTop: 6 }]}>
              <Text style={v7pCekmece.vazgecMetin}>{t('genel.vazgec')}</Text>
            </Pressable>
          </CekilenSayfa>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  baslik: { paddingBottom: 16 },
  devam: { height: 48, alignItems: 'center', justifyContent: 'center' },
  devamMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.uyari },
});
