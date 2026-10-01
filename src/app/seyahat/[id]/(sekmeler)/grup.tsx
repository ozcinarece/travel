import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Avatar } from '@/components/ui/Avatar';
import { useUyeler } from '@/features/mekanlar/sorgular';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

// Grup paneli iskeleti (3.7 KK9 Sprint 3): üye listesi. Davet linki 3.10 ile.
export default function GrupEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uyeler = useUyeler(id);
  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={t('seyahat.grup.baslik')} />
      <Text style={s.bolum}>{t('seyahat.grup.uyeler')}</Text>
      {uyeler.data?.map((u) => (
        <View key={u.user_id} style={s.satir}>
          <Avatar ad={u.display_name} boyut={32} />
          <Text style={s.ad}>{u.display_name}</Text>
          <Text style={s.rol}>{u.role === 'owner' ? t('seyahat.grup.sahip') : u.guest ? t('seyahat.grup.misafir') : ''}</Text>
        </View>
      ))}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  bolum: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingTop: 20 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: bosluk.kenar, paddingVertical: 10 },
  ad: { flex: 1, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  rol: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});
