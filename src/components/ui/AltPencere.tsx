import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CekilenSayfa, modalKokuStili, SayfaKaydirici } from '@/components/ui/sayfaCekme';
import { renk } from '@/theme';

type Props = {
  acik: boolean;
  onKapat: () => void;
  children: ReactNode;
  /** İçerik uzunsa kaydırılır (en çok ekranın %88'i). */
  kaydirilir?: boolean;
  kapatEtiketi: string;
  stil?: StyleProp<ViewStyle>;
};

/**
 * #136 (kanvas 2 · 3c · 16): tutamaçlı alt sayfa — beyaz, üst köşeler 30, perde Lacivert %45; dışına dokununca kapanır.
 * #164 KK7: tutamaktan ya da içeriğin herhangi bir yerinden aşağı çekilerek de kapanır (kaydırılan içerik en üstteyken).
 */
export function AltPencere({ acik, onKapat, children, kaydirilir, kapatEtiketi, stil }: Props) {
  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={s.perde}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={kapatEtiketi} />
          <CekilenSayfa onKapat={onKapat} style={[s.sayfa, kaydirilir && s.sinirli]}>
            <View style={s.tutamac} />
            {kaydirilir ? (
              <SayfaKaydirici contentContainerStyle={[s.icerik, stil]} showsVerticalScrollIndicator={false}>
                {children}
              </SayfaKaydirici>
            ) : (
              <View style={[s.icerik, stil]}>{children}</View>
            )}
          </CekilenSayfa>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(14,20,48,0.45)', justifyContent: 'flex-end' },
  sayfa: { backgroundColor: renk.zemin, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12 },
  sinirli: { maxHeight: '88%' },
  tutamac: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  icerik: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 34, gap: 16 },
});
