import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SeyahatlerimListesi } from '@/components/seyahatler/SeyahatlerimListesi';
import { KisaBildirim, useKisaBildirim } from '@/components/ui/KisaBildirim';
import { biten, bitmemis, siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

/**
 * #275 KK4 → #405 KK2 (UX önerileri kanvası, `Ana_v6_Seyahatlerim`): alt menünün Seyahatlerim sekmesi. Üstte "Seyahatlerim"
 * (28 px 800) ve turuncu "+ Seyahat"; altında YAKLAŞAN (en yakını büyük kapakla) ve GEÇMİŞ. Profil › Gezilerim buraya taşındı;
 * eski `/seyahatler` derin bağlantısı da bu sekmeyi açar.
 */
export default function SeyahatlerimEkrani() {
  const seyahatler = useSeyahatler();
  const bildirim = useKisaBildirim();
  // Bitmemiş = bugün süren + yaklaşan + planlanan (tarihsiz taslak dahil); tarih sırası, taslaklar sonda.
  // #276 KK1: GEÇMİŞ = yeniBiten + geçmiş (seyahat bitişin ertesi günü iner).
  const { yaklasan, gecmis } = useMemo(() => {
    const sinif = siniflandir(seyahatler.data ?? []);
    return { yaklasan: bitmemis(sinif), gecmis: biten(sinif) };
  }, [seyahatler.data]);
  const yeni = () => router.push('/(tabs)/yeni');
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik} refreshControl={<RefreshControl refreshing={seyahatler.isRefetching} onRefresh={() => seyahatler.refetch()} />}>
        <View style={s.ust}>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('seyahatlerim.baslik')}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v5.yeniSeyahatEtiket')} onPress={yeni} hitSlop={4} style={({ pressed }) => [s.seyahatDugme, pressed && { opacity: 0.85 }]}>
            <Text style={s.seyahatArti}>+</Text>
            <Text style={s.seyahatMetin}>{t('anasayfa.v5.seyahat')}</Text>
          </Pressable>
        </View>
        {seyahatler.data ? <SeyahatlerimListesi yaklasan={yaklasan} gecmis={gecmis} onBildirim={bildirim.goster} /> : null}
      </ScrollView>
      <KisaBildirim metin={bildirim.metin} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  ust: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.28, color: renk.metin },
  seyahatDugme: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', gap: 4 },
  seyahatArti: { fontFamily: yazi.kalin, fontSize: 18, lineHeight: 20, color: renk.metin },
  seyahatMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
});
