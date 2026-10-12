import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { Buton } from '@/components/ui/Buton';
import { cikis } from '@/features/auth/giris';
import { useProfil } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

// PRD §4 v1 Profil: ad, kullanıcı adı, çıkış, hesap silme (önizlemeli, ayrı ekran).
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
      {/* #100 A KK1: Kaydettiklerim satırı → iki çipli sayfa. */}
      <Link href="/kaydettiklerim" asChild>
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.satir, pressed && { opacity: 0.8 }]}>
          <View style={s.satirIkon}>
            <Ikon ad="kalp" boyut={20} renk={renk.metin} kalinlik={2.2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.satirBaslik}>{t('profil.kaydettiklerim')}</Text>
            <Text style={s.satirAlt}>{t('profil.kaydettiklerimAlt')}</Text>
          </View>
          <Text style={s.ok}>›</Text>
        </Pressable>
      </Link>
      <View style={s.altKisim}>
        <Buton baslik={t('profil.cikis')} tur="ikincil" onPress={cikis} />
        <Link href="/hesap-sil" asChild>
          <Pressable accessibilityRole="button" hitSlop={10} style={s.silSatir}>
            <Text style={s.sil}>{t('profil.hesapSil')}</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  kimlik: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: bosluk.kenar, paddingTop: 18 },
  ad: { fontFamily: yazi.ekstra, fontSize: 26, letterSpacing: -0.8, lineHeight: 28, color: renk.metin },
  kullaniciAdi: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginHorizontal: bosluk.kenar, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: renk.ayrac },
  satirIkon: { width: 40, height: 40, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  satirBaslik: { fontFamily: yazi.ekstra, fontSize: 14.5, color: renk.metin },
  satirAlt: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 20, color: renk.ikincil },
  altKisim: { marginTop: 'auto', paddingHorizontal: bosluk.kenar, paddingBottom: 16, gap: 8 },
  silSatir: { alignItems: 'center', paddingVertical: 10 },
  sil: { fontFamily: yazi.kalin, fontSize: 13, color: renk.uyari },
});
