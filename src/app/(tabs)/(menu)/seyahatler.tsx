import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SeyahatlerimListesi } from '@/components/seyahatler/SeyahatlerimListesi';
import { Buton } from '@/components/ui/Buton';
import { KisaBildirim, useKisaBildirim } from '@/components/ui/KisaBildirim';
import { biten, bitmemis, siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
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
  // #574 KK1: her girişte "Nasıl bir gezi?" temiz açılır (yeni `n`).
  const yeni = () => router.push({ pathname: '/(tabs)/yeni', params: { n: yeniGirisNo() } });
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
        {seyahatler.data ? (
          <SeyahatlerimListesi yaklasan={yaklasan} gecmis={gecmis} onBildirim={bildirim.goster} />
        ) : seyahatler.isError ? (
          // #405 inceleme 2: veri yokken boş başlık "seyahatlerim silindi" sanılmasın; #388 kalıbı, ham hata gösterilmez.
          <View style={s.hata}>
            <Text style={s.hataMetin}>{t('seyahatlerim.hata')}</Text>
            <Buton baslik={t('seyahatlerim.tekrarDene')} tur="ikincil" onPress={() => seyahatler.refetch()} yukleniyor={seyahatler.isFetching} />
          </View>
        ) : (
          <ActivityIndicator color={renk.ana} style={s.yukleniyor} accessibilityLabel={t('seyahatlerim.yukleniyor')} />
        )}
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
  yukleniyor: { marginTop: 24 },
  hata: { paddingTop: 24, gap: 12, alignItems: 'flex-start' },
  hataMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: renk.metin },
});
