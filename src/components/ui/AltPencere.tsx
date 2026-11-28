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
  /**
   * #432 (`Sos_v6_Paylas`): v6 çekmece — perde Lacivert %50, üst köşeler 24, tutamaç 40 × 5 `#E4E7EE` üstte 10 px, kenar payı
   * 16, alt 30, öğeler arası 16.
   */
  /**
   * #573 (`Davet_v1_Gonderildi`): perde Lacivert %38, üst köşeler 22, tutamaç 40 × 5 `#D5DAE5` üstte 10 px ve altında 16, kenar
   * payı 16, alt 30; öğeler kendi aralığını verir (gap yok).
   */
  /**
   * #574 (`Kur_v11_Cekmece`): `davet` ile aynı, yalnız tutamacın altı 12 (kanvas).
   */
  /**
   * #580 (`Dalga1_DurakCekmecesi`): `davet` ile aynı, yalnız tutamacın altı 14 (kanvas).
   */
  gorunus?: 'v5' | 'v6' | 'davet' | 'v11' | 'durak';
};

/**
 * #136 (kanvas 2 · 3c · 16): tutamaçlı alt sayfa — beyaz, üst köşeler 30, perde Lacivert %45; dışına dokununca kapanır.
 * #164 KK7: tutamaktan ya da içeriğin herhangi bir yerinden aşağı çekilerek de kapanır (kaydırılan içerik en üstteyken).
 */
export function AltPencere({ acik, onKapat, children, kaydirilir, kapatEtiketi, stil, gorunus }: Props) {
  const v5 = gorunus === 'v5';
  const v6 = gorunus === 'v6';
  const v11 = gorunus === 'v11';
  const durak = gorunus === 'durak';
  const dv = gorunus === 'davet' || v11 || durak;
  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={[s.perde, v5 && s.perdeYok, v6 && s.perdeV6, dv && s.perdeDavet]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={kapatEtiketi} />
          <CekilenSayfa onKapat={onKapat} style={[s.sayfa, v5 && s.sayfaV5, v6 && s.sayfaV6, dv && s.sayfaDavet, kaydirilir && s.sinirli]}>
            <View style={[s.tutamac, (v5 || v6) && s.tutamacV5, v6 && s.tutamacV6, dv && s.tutamacDavet, v11 && s.tutamacV11, durak && s.tutamacDurak]} />
            {kaydirilir ? (
              <SayfaKaydirici contentContainerStyle={[s.icerik, v6 && s.icerikV6, dv && s.icerikDavet, stil]} showsVerticalScrollIndicator={false}>
                {children}
              </SayfaKaydirici>
            ) : (
              <View style={[s.icerik, v6 && s.icerikV6, dv && s.icerikDavet, stil]}>{children}</View>
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
  perdeV6: { backgroundColor: 'rgba(14,20,48,0.5)' },
  sayfaV6: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  tutamacV6: { marginBottom: 0 },
  icerikV6: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
  perdeDavet: { backgroundColor: 'rgba(14,20,48,0.38)' },
  sayfaDavet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10 },
  tutamacDavet: { width: 40, backgroundColor: '#D5DAE5', marginBottom: 16 },
  icerikDavet: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 30, gap: 0 },
  tutamacV11: { marginBottom: 12 },
  tutamacDurak: { marginBottom: 14 },
});
