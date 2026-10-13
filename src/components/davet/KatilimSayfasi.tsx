// #137 KK1 (kanvas 3c · Davetle gelen): katılım sonrası alt sayfa — "Ayşe seni X'e ekledi · Katıldın ✓",
// Programa bak (Gece) / Mekan ekle (Mandalina). #136: AltPencere + Buton + Rozet.
import { StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { Rozet } from '@/components/ui/Rozet';
import { davetSeyahatAdi, yonelmeEki } from '@/features/davet/katilim';
import { t } from '@/i18n';
import type { Uye } from '@/lib/tipler';
import { olcek, renk, yazi, yuzRenkleri } from '@/theme';

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
    <AltPencere acik={acik} onKapat={onProgram} kapatEtiketi={t('davet.katildin.program')}>
      <View style={s.ustSatir}>
        <View style={s.yuzler}>
          {gorunen.map((u, i) => (
            <View key={u.user_id} style={[s.yuzCerceve, i > 0 && { marginLeft: -10 }]}>
              <Avatar ad={u.display_name} url={u.photo_url} boyut={44} arkaPlan={yuzRenkleri[i % yuzRenkleri.length]} />
            </View>
          ))}
          {kalan > 0 ? (
            <View style={[s.yuzCerceve, { marginLeft: -10 }]}>
              <Avatar ad={`+${kalan}`} boyut={44} arkaPlan={renk.anaAcik} />
            </View>
          ) : null}
        </View>
        <Rozet metin={t('davet.katildin.rozet')} tur="basari" />
      </View>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('davet.katildin.baslik', { ad: davetEden, seyahatEk: yonelmeEki(davetSeyahatAdi(seyahat)) })}
        </Text>
        <Text style={s.metin}>{t('davet.katildin.metin', { gun: gunSayisi, mekan: mekanSayisi })}</Text>
      </View>
      <View style={s.dugmeler}>
        <Buton baslik={t('davet.katildin.program')} onPress={onProgram} boy="buyuk" stil={{ flex: 1 }} />
        <Buton baslik={t('davet.katildin.mekanEkle')} onPress={onMekanEkle} tur="vurgu" boy="buyuk" stil={{ flex: 1 }} />
      </View>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  yuzler: { flexDirection: 'row' },
  yuzCerceve: { borderWidth: 3, borderColor: renk.zemin, borderRadius: 17 },
  baslik: { fontFamily: yazi.baslik, fontSize: olcek.kart + 1, lineHeight: 28, letterSpacing: -0.6, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  dugmeler: { flexDirection: 'row', gap: 10 },
});
