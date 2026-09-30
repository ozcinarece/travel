import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { cikis } from '@/features/auth/giris';
import { useProfil } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

// PRD §4 v1 Profil: ad, kullanıcı adı, çıkış, hesap silme. Hesap silme (önizlemeli) ayrı PR'da.
export default function ProfilEkrani() {
  const profil = useProfil();
  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={t('profil.baslik')} />
      {profil.data ? (
        <View style={s.kimlik}>
          <Avatar ad={profil.data.name} url={profil.data.photo_url} boyut={72} />
          <View style={{ gap: 4 }}>
            <Text style={s.ad}>{profil.data.name}</Text>
            <Text style={s.kullaniciAdi}>@{profil.data.username}</Text>
          </View>
        </View>
      ) : null}
      <View style={s.altKisim}>
        <Buton baslik={t('profil.cikis')} tur="ikincil" onPress={cikis} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  kimlik: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: bosluk.kenar, paddingTop: 18 },
  ad: { fontFamily: yazi.ekstra, fontSize: 26, letterSpacing: -0.8, lineHeight: 28, color: renk.metin },
  kullaniciAdi: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ikincil },
  altKisim: { marginTop: 'auto', paddingHorizontal: bosluk.kenar, paddingBottom: 16 },
});
