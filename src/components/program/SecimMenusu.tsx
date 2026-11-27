import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CekilenSayfa, modalKokuStili } from '@/components/ui/sayfaCekme';
import { t } from '@/i18n';
import { minDokunma, renk, yazi } from '@/theme';

/** `ayrac`: satırın üstünde ince çizgi (#554 KK4: ⋯ menüsünde "Günü sil"). */
export type SecimSecenegi = { etiket: string; onPress: () => void; tehlike?: boolean; pasif?: boolean; ayrac?: boolean };

/** `v7p` (#554, kanvas `Plan_v7p_Haller` 4a): Plan çekmecesi — perde %38, 22 köşe, tutamak, 18/800 başlık, 48 px satırlar. */
type Props = { acik: boolean; baslik?: string; secenekler: SecimSecenegi[]; onKapat: () => void; gorunus?: 'v7p' };

/** Kanvas `Plan_v7p_Haller` 4a–4b ortak çekmece ölçüleri (`GunSilSayfasi` da kullanır). */
export const v7pCekmece = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(14,20,48,0.38)', justifyContent: 'flex-end' },
  kutu: { backgroundColor: renk.zemin, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 30 },
  tutamac: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DAE5', marginBottom: 14 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 18, color: renk.metin },
  vazgec: { height: 48, borderRadius: 24, backgroundColor: '#F2F4F8', alignItems: 'center', justifyContent: 'center' },
  vazgecMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
});

/** Alttan açılan seçenek menüsü (3.7 KK4 uzun basma menüsü, gün seçimi). Web ve mobilde aynı. #164: aşağı çekilerek kapanır. */
export function SecimMenusu({ acik, baslik, secenekler, onKapat, gorunus }: Props) {
  const v = gorunus === 'v7p';
  return (
    <Modal visible={acik} transparent animationType="fade" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={v ? v7pCekmece.perde : s.perde}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
          <CekilenSayfa onKapat={onKapat} style={v ? v7pCekmece.kutu : s.kutu}>
            {v ? <View style={v7pCekmece.tutamac} /> : null}
            {baslik ? (
              <Text accessibilityRole={v ? 'header' : undefined} style={v ? [v7pCekmece.baslik, { paddingBottom: 6 }] : s.baslik} numberOfLines={2}>
                {baslik}
              </Text>
            ) : null}
            {secenekler.map((o) => (
              <Pressable
                key={o.etiket}
                accessibilityRole="button"
                disabled={o.pasif}
                onPress={() => {
                  onKapat();
                  o.onPress();
                }}
                style={({ pressed }) => [s.satir, v && s.satirV7p, o.ayrac && s.ayrac, pressed && { backgroundColor: renk.yuzey }, o.pasif && { opacity: 0.4 }]}>
                <Text style={[s.satirMetin, o.tehlike && { color: renk.uyari }]}>{o.etiket}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={onKapat} style={v ? [v7pCekmece.vazgec, { marginTop: 8 }] : s.vazgec}>
              <Text style={v ? v7pCekmece.vazgecMetin : s.vazgecMetin}>{t('genel.vazgec')}</Text>
            </Pressable>
          </CekilenSayfa>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.35)', justifyContent: 'flex-end' },
  kutu: { backgroundColor: renk.zemin, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 12, paddingBottom: 28, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin, paddingHorizontal: 12, paddingVertical: 10 },
  satir: { minHeight: minDokunma, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  satirV7p: { minHeight: 48, paddingHorizontal: 0, borderRadius: 0 },
  ayrac: { borderTopWidth: 1, borderTopColor: '#E4E7EE', marginTop: 4 },
  satirMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  vazgec: { marginTop: 6, height: 48, borderRadius: 999, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  vazgecMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
});
