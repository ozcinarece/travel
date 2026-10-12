// #137 KK1 (kanvas 3c · Davetle gelen): katılım sonrası alt sayfa — "Ayşe seni X'e ekledi · Katıldın ✓",
// Programa bak (kapat) / Mekan ekle (Keşfet). Mevcut görünüm; #136 ile yeni jetonlara geçer.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { davetSeyahatAdi, yonelmeEki } from '@/features/davet/katilim';
import { t } from '@/i18n';
import type { Uye } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  seyahat: { name: string | null; city_label: string };
  uyeler: Uye[];
  gunSayisi: number;
  mekanSayisi: number;
  onProgram: () => void;
  onMekanEkle: () => void;
};

export function KatilimSayfasi({ acik, seyahat, uyeler, gunSayisi, mekanSayisi, onProgram, onMekanEkle }: Props) {
  const davetEden = uyeler.find((u) => u.role === 'owner')?.display_name ?? t('davet.biri');
  const gorunen = uyeler.slice(0, 2);
  const kalan = uyeler.length - gorunen.length;
  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={onProgram}>
      <Pressable style={s.perde} onPress={onProgram} accessibilityLabel={t('davet.katildin.program')}>
        <Pressable style={s.sayfa} onPress={() => {}} accessibilityRole="none">
          <View style={s.tutamac} />
          <View style={s.ustSatir}>
            <View style={s.yuzler}>
              {gorunen.map((u, i) => (
                <View key={u.user_id} style={[s.yuzCerceve, i > 0 && { marginLeft: -10 }]}>
                  <Avatar ad={u.display_name} boyut={40} arkaPlan={i === 0 ? renk.vurgu : renk.metin} />
                </View>
              ))}
              {kalan > 0 ? (
                <View style={[s.yuzCerceve, s.kalan, { marginLeft: -10 }]}>
                  <Text style={s.kalanMetin}>+{kalan}</Text>
                </View>
              ) : null}
            </View>
            <View style={s.rozet}>
              <Text style={s.rozetMetin}>{t('davet.katildin.rozet')}</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('davet.katildin.baslik', { ad: davetEden, seyahatEk: yonelmeEki(davetSeyahatAdi(seyahat)) })}
          </Text>
          <Text style={s.metin}>{t('davet.katildin.metin', { gun: gunSayisi, mekan: mekanSayisi })}</Text>
          <View style={s.dugmeler}>
            <Pressable accessibilityRole="button" onPress={onProgram} style={[s.dugme, s.dugmeKoyu]}>
              <Text style={[s.dugmeMetin, { color: renk.zemin }]}>{t('davet.katildin.program')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onMekanEkle} style={[s.dugme, s.dugmeVurgu]}>
              <Text style={s.dugmeMetin}>{t('davet.katildin.mekanEkle')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.35)', justifyContent: 'flex-end' },
  sayfa: { backgroundColor: renk.zemin, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 34, gap: 14 },
  tutamac: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  yuzler: { flexDirection: 'row' },
  yuzCerceve: { borderWidth: 3, borderColor: renk.zemin, borderRadius: 23 },
  kalan: { width: 40, height: 40, borderRadius: 20, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  kalanMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  rozet: { height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#e3f5ee', justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.basari },
  baslik: { fontFamily: yazi.ekstra, fontSize: 24, lineHeight: 27, letterSpacing: -0.6, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  dugmeler: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  dugme: { flex: 1, height: 54, minHeight: minDokunma, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dugmeKoyu: { backgroundColor: renk.metin },
  dugmeVurgu: { backgroundColor: renk.vurgu },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
});
