// #184: metin girilen alt pencereler (Mekan seç, Oylama) — klavye açılınca içerik yukarı kayar; dışına dokununca ya da aşağı
// çekilince kapanır (AltPencere ile aynı görünüm).
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CekilenSayfa, modalKokuStili, SayfaKaydirici } from '@/components/ui/sayfaCekme';
import { renk } from '@/theme';

export function KlavyeliPencere({ acik, onKapat, kapatEtiketi, children }: { acik: boolean; onKapat: () => void; kapatEtiketi: string; children: ReactNode }) {
  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <KeyboardAvoidingView style={s.perde} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={kapatEtiketi} />
          <CekilenSayfa onKapat={onKapat} style={s.sayfa}>
            <View style={s.tutamac} />
            {acik ? (
              <SayfaKaydirici contentContainerStyle={s.icerik} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {children}
              </SayfaKaydirici>
            ) : null}
          </CekilenSayfa>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(14,20,48,0.45)', justifyContent: 'flex-end' },
  sayfa: { backgroundColor: renk.zemin, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, maxHeight: '90%' },
  tutamac: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  icerik: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, gap: 14 },
});
