import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BosDurum } from '@/components/seyahatler/BosDurum';
import { Avatar } from '@/components/ui/Avatar';
import { useProfil } from '@/features/profil/sorgular';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

// PRD 3.1 Seyahatler; seyahat yoksa 0.5 boş durum (KK1). Dolu liste 3.1 PR'ında gelir (şimdilik iskelet).
export default function SeyahatlerEkrani() {
  const profil = useProfil();
  const seyahatler = useSeyahatler();

  return (
    <SafeAreaView style={s.ekran}>
      <View style={s.ust}>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('seyahatler.baslik')}
        </Text>
        <Link href="/(tabs)/profil" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={t('sekme.profil')} hitSlop={8}>
            <Avatar ad={profil.data?.name ?? '?'} url={profil.data?.photo_url} boyut={30} />
          </Pressable>
        </Link>
      </View>

      {seyahatler.isPending ? null : seyahatler.data && seyahatler.data.length > 0 ? (
        <View style={s.liste}>
          {seyahatler.data.map((sy) => (
            <View key={sy.id} style={s.satir}>
              <Text style={s.sehir}>{sy.city_label}</Text>
              <Text style={s.tarih}>
                {sy.start_date && sy.end_date ? `${sy.start_date} – ${sy.end_date}` : t('seyahatler.tarihsiz')}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <BosDurum />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ust: {
    paddingHorizontal: bosluk.kenar,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.9, color: renk.metin },
  liste: { paddingHorizontal: bosluk.kenar, paddingTop: 8 },
  satir: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: renk.ayrac, gap: 2 },
  sehir: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  tarih: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});
