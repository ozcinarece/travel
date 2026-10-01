import { Link, Redirect, router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AktifKart } from '@/components/seyahatler/AktifKart';
import { BosDurum } from '@/components/seyahatler/BosDurum';
import { GecmisKart } from '@/components/seyahatler/GecmisKart';
import { SeyahatSatiri } from '@/components/seyahatler/SeyahatSatiri';
import { Avatar } from '@/components/ui/Avatar';
import { useProfil } from '@/features/profil/sorgular';
import { siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import { useOturum } from '@/lib/oturum';
import { bosluk, renk, yazi } from '@/theme';

export default function SeyahatlerEkrani() {
  const { session } = useOturum();
  const profil = useProfil();
  const seyahatler = useSeyahatler();

  // 0.3 bir kez gösterilir: profil var ama yönlendirme damgası yoksa oraya.
  if (profil.data && !profil.data.onboarding_done_at) return <Redirect href="/ilk-seyahat" />;

  const ac = (id: string) => router.push({ pathname: '/seyahat/[id]', params: { id } });
  const { aktif, yaklasan, gecmis } = siniflandir(seyahatler.data ?? []);
  const bos = !seyahatler.isPending && !seyahatler.isError && (seyahatler.data?.length ?? 0) === 0;

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.icerik}
        refreshControl={<RefreshControl refreshing={seyahatler.isRefetching} onRefresh={() => seyahatler.refetch()} />}>
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

        {seyahatler.isError ? <Text style={s.hata}>{t('seyahatler.hata')}</Text> : null}
        {bos ? <BosDurum buyuk={profil.data?.next_trip_window === 'bu_ay'} /> : null}

        {aktif.map((sy) => (
          <View key={sy.id} style={s.aktif}>
            <AktifKart seyahat={sy} onAc={() => ac(sy.id)} />
          </View>
        ))}

        {yaklasan.length > 0 ? (
          <View style={s.bolum}>
            <Text style={s.bolumBaslik}>{t('seyahatler.yaklasan')}</Text>
            <View style={s.liste}>
              {yaklasan.map((sy) => (
                <SeyahatSatiri key={sy.id} seyahat={sy} benimId={session?.user.id ?? ''} onPress={() => ac(sy.id)} />
              ))}
            </View>
          </View>
        ) : null}

        {gecmis.length > 0 ? (
          <View style={s.bolum}>
            <View style={s.bolumSatir}>
              <Text style={s.bolumBaslik}>{t('seyahatler.gecmis')}</Text>
              <Text style={s.bolumSag}>{t('seyahatler.gecmisSayi', { n: gecmis.length })}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gecmisSerit}>
              {gecmis.map((sy, i) => (
                <GecmisKart key={sy.id} seyahat={sy} sira={i} onPress={() => ac(sy.id)} />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingBottom: 24 },
  ust: {
    paddingHorizontal: bosluk.kenar,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.9, color: renk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, paddingHorizontal: bosluk.kenar, paddingTop: 12 },
  aktif: { paddingHorizontal: bosluk.kenar, paddingTop: 18 },
  bolum: { paddingTop: 22 },
  bolumSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: bosluk.kenar },
  bolumBaslik: {
    fontFamily: yazi.ekstra,
    fontSize: 17,
    letterSpacing: -0.4,
    color: renk.metin,
    paddingHorizontal: bosluk.kenar,
    paddingBottom: 10,
  },
  bolumSag: { fontFamily: yazi.yari, fontSize: 13, color: renk.ikincil, paddingBottom: 10 },
  liste: { paddingHorizontal: bosluk.kenar },
  gecmisSerit: { paddingHorizontal: bosluk.kenar, gap: 12 },
});
