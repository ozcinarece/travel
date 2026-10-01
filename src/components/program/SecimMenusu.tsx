import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { t } from '@/i18n';
import { minDokunma, renk, yazi } from '@/theme';

export type SecimSecenegi = { etiket: string; onPress: () => void; tehlike?: boolean; pasif?: boolean };

type Props = { acik: boolean; baslik?: string; secenekler: SecimSecenegi[]; onKapat: () => void };

/** Alttan açılan seçenek menüsü (3.7 KK4 uzun basma menüsü, gün seçimi). Web ve mobilde aynı. */
export function SecimMenusu({ acik, baslik, secenekler, onKapat }: Props) {
  return (
    <Modal visible={acik} transparent animationType="fade" onRequestClose={onKapat}>
      <Pressable style={s.perde} onPress={onKapat} accessibilityLabel={t('genel.vazgec')}>
        <Pressable style={s.kutu} onPress={() => {}}>
          {baslik ? (
            <Text style={s.baslik} numberOfLines={2}>
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
              style={({ pressed }) => [s.satir, pressed && { backgroundColor: renk.yuzey }, o.pasif && { opacity: 0.4 }]}>
              <Text style={[s.satirMetin, o.tehlike && { color: renk.uyari }]}>{o.etiket}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onKapat} style={s.vazgec}>
            <Text style={s.vazgecMetin}>{t('genel.vazgec')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.35)', justifyContent: 'flex-end' },
  kutu: { backgroundColor: renk.zemin, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 12, paddingBottom: 28, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin, paddingHorizontal: 12, paddingVertical: 10 },
  satir: { minHeight: minDokunma, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  satirMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  vazgec: { marginTop: 6, height: 48, borderRadius: 999, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  vazgecMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
});
