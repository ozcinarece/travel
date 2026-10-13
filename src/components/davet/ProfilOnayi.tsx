// #137 KK5 (kanvas 2 · Profil ilk davet): "Arkadaşların seni böyle görecek" — ilk davet paylaşımından önce bir kez. #136 bileşenleri.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { useProfil } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { kose, olcek, renk, yazi } from '@/theme';

type Props = { acik: boolean; onKapat: () => void; onGonder: () => void };

export function ProfilOnayi({ acik, onKapat, onGonder }: Props) {
  const profil = useProfil();
  const ad = profil.data?.name ?? '';
  const degistir = () => {
    onKapat();
    router.navigate('/(tabs)/profil');
  };
  return (
    <AltPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('genel.vazgec')}>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('davet.onay.baslik')}
        </Text>
        <Text style={s.metin}>{t('davet.onay.metin')}</Text>
      </View>
      <View style={s.kart}>
        <Avatar ad={ad || '?'} url={profil.data?.photo_url} boyut={64} arkaPlan={renk.vurgu} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.ad} numberOfLines={1}>
            {ad}
          </Text>
          <Text style={s.kullanici} numberOfLines={1}>
            @{profil.data?.username ?? ''}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={degistir} style={s.degistir}>
          <Text style={s.degistirMetin}>{t('davet.onay.degistir')}</Text>
        </Pressable>
      </View>
      <View style={{ gap: 10 }}>
        <Buton baslik={t('davet.onay.gonder')} onPress={onGonder} boy="buyuk" />
        <Text style={s.not}>{t('davet.onay.not')}</Text>
      </View>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  baslik: { fontFamily: yazi.baslik, fontSize: olcek.kart, lineHeight: 27, letterSpacing: -0.6, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: renk.yuzey },
  ad: { fontFamily: yazi.baslik, fontSize: 19, color: renk.metin },
  kullanici: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  degistir: { height: 40, paddingHorizontal: 14, borderRadius: kose.alan, backgroundColor: renk.zemin, justifyContent: 'center' },
  degistirMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 17, textAlign: 'center', color: renk.ikincil },
});
