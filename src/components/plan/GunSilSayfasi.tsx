// #554 KK5 (UX önerileri kanvası `Plan_v7p_Haller` 4b): gün silme onayı — sistem uyarısı yerine Plan çekmecesi. Başlık
// "{Gün} {gün no} silinsin mi?", metin "{n} durak Listem'e döner; yerler silinmez." (durak yoksa "Bu günde durak yok."),
// kırmızı "Günü sil", altta büyük "Vazgeç". Silmede günün durakları gider (stops cascade), mekanlar kalır → Listem'de bekler.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { v7pCekmece } from '@/components/program/SecimMenusu';
import { CekilenSayfa, modalKokuStili } from '@/components/ui/sayfaCekme';
import { t } from '@/i18n';
import type { Gun } from '@/lib/tipler';
import { anaV5, renk, yazi } from '@/theme';

type Props = {
  gun: Gun | null;
  baslik: string;
  durakSayisi: number;
  onSil: (g: Gun) => void;
  onKapat: () => void;
};

/** #554 KK5: onay metni (saf; test edilir). */
export function gunSilMetni(durakSayisi: number): string {
  return durakSayisi > 0 ? t('gunler.gunSilMetin', { n: durakSayisi }) : t('gunler.gunSilMetinBos');
}

export function GunSilSayfasi({ gun, baslik, durakSayisi, onSil, onKapat }: Props) {
  return (
    <Modal visible={!!gun} transparent animationType="fade" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <View style={v7pCekmece.perde}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
          <CekilenSayfa onKapat={onKapat} style={v7pCekmece.kutu}>
            <View style={v7pCekmece.tutamac} />
            <Text accessibilityRole="header" style={v7pCekmece.baslik}>
              {t('gunler.gunSilBaslik', { gun: baslik })}
            </Text>
            <Text style={s.metin}>{gunSilMetni(durakSayisi)}</Text>
            <Pressable accessibilityRole="button" onPress={() => gun && onSil(gun)} style={({ pressed }) => [s.sil, pressed && { opacity: 0.7 }]}>
              <Text style={s.silMetin}>{t('gunler.gunuSil')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onKapat} style={[v7pCekmece.vazgec, { marginTop: 6 }]}>
              <Text style={v7pCekmece.vazgecMetin}>{t('genel.vazgec')}</Text>
            </Pressable>
          </CekilenSayfa>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  metin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: anaV5.ikincil, paddingTop: 6, paddingBottom: 16 },
  sil: { height: 48, alignItems: 'center', justifyContent: 'center' },
  silMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.uyari },
});
