import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CekilenSayfa, modalKokuStili, SayfaKaydirici } from '@/components/ui/sayfaCekme';
import { anaV5, renk } from '@/theme';

type Props = {
  acik: boolean;
  onKapat: () => void;
  children: ReactNode;
  /** İçerik uzunsa kaydırılır (en çok ekranın %88'i). */
  kaydirilir?: boolean;
  kapatEtiketi: string;
  stil?: StyleProp<ViewStyle>;
  /**
   * #396 (`Sayfa_v5_PlanHazir`): haritanın üstündeki v5 çekmece — perde yok (harita görünür), üst köşeler 24, tutamaç 40 × 5
   * `#E4E7EE`, üstte 10 px, yukarı hafif gölge.
   */
  gorunus?: 'v5';
};

/**
 * #136 (kanvas 2 · 3c · 16): tutamaçlı alt sayfa — beyaz, üst köşeler 30, perde Lacivert %45; dışına dokununca kapanır.
 * #164 KK7: tutamaktan ya da içeriğin herhangi bir yerinden aşağı çekilerek de kapanır (kaydırılan içerik en üstteyken).
 */
export function AltPencere({ acik, onKapat, children, kaydirilir, kapatEtiketi, stil, gorunus }: Props) {
  const v5 = gorunus === 'v5';
  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={[s.perde, v5 && s.perdeYok]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={kapatEtiketi} />
          <CekilenSayfa onKapat={onKapat} style={[s.sayfa, v5 && s.sayfaV5, kaydirilir && s.sinirli]}>
            <View style={[s.tutamac, v5 && s.tutamacV5]} />
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
  perdeYok: { backgroundColor: 'transparent' },
  sayfaV5: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, shadowColor: renk.metin, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 12 },
  tutamacV5: { width: 40, backgroundColor: anaV5.cizgi, marginBottom: 12 },
  icerik: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 34, gap: 16 },
});
