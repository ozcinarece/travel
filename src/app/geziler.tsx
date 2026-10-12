import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { GeziKarti } from '@/components/icerik/GeziKarti';
import { Cip } from '@/components/ui/Cip';
import { useGeziler, useSehirler } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

/** #97 A KK4 "Tümü": gezi listesi — şehir + gün sayısı filtresi; büyük kartlar. */
export default function GezilerEkrani() {
  const { sehir } = useLocalSearchParams<{ sehir?: string }>();
  const [sehirId, setSehirId] = useState<string | null>(sehir ?? null);
  const [gun, setGun] = useState<number | null>(null);
  const sehirler = useSehirler();
  const geziler = useGeziler();
  const liste = useMemo(() => (geziler.data ?? []).filter((g) => (!sehirId || g.sehir_id === sehirId) && (!gun || g.gun_sayisi === gun)), [geziler.data, sehirId, gun]);
  const gunSecenekleri = useMemo(() => [...new Set((geziler.data ?? []).map((g) => g.gun_sayisi))].sort((a, b) => a - b), [geziler.data]);
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <EkranBasligi baslik={t('gezi.listeBaslik')} geri={() => router.back()} />
      <ScrollView contentContainerStyle={s.icerik}>
        <Text style={s.filtreBaslik}>{t('gezi.filtreSehir')}</Text>
        <View style={s.cipler}>
          <Cip baslik={t('gezi.hepsi')} secili={!sehirId} onPress={() => setSehirId(null)} />
          {(sehirler.data ?? []).map((x) => (
            <Cip key={x.id} baslik={x.ad} secili={sehirId === x.id} onPress={() => setSehirId(x.id)} />
          ))}
        </View>
        <Text style={s.filtreBaslik}>{t('gezi.filtreGun')}</Text>
        <View style={s.cipler}>
          <Cip baslik={t('gezi.hepsi')} secili={!gun} onPress={() => setGun(null)} />
          {gunSecenekleri.map((n) => (
            <Cip key={n} baslik={t('gezi.gunAdet', { n })} secili={gun === n} onPress={() => setGun(n)} />
          ))}
        </View>
        <View style={{ gap: 12, paddingTop: 6 }}>
          {liste.map((g, i) => (
            <GeziKarti key={g.id} gezi={g} buyuk sira={i} onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })} />
          ))}
          {!geziler.isPending && liste.length === 0 ? <Text style={s.bos}>{t('gezi.bos')}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 8, paddingBottom: 24, gap: 10 },
  filtreBaslik: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
});
