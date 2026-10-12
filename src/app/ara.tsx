import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Ikon } from '@/components/ui/Ikon';
import { useGeziler, useSehirler, useTumYerler } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

/** #97 A KK2: arama — şehir / gezi / yer; sonuç üç gruplu liste (yerel süzme; içerik küçük). */
export default function AraEkrani() {
  const [sorgu, setSorgu] = useState('');
  const sehirler = useSehirler();
  const geziler = useGeziler();
  const yerler = useTumYerler();
  const q = sorgu.trim().toLocaleLowerCase('tr');
  const es = (m: string | null | undefined) => !!m && m.toLocaleLowerCase('tr').includes(q);
  const sonuc = useMemo(
    () =>
      q.length < 2
        ? null
        : {
            sehirler: (sehirler.data ?? []).filter((s) => es(s.ad)),
            geziler: (geziler.data ?? []).filter((g) => es(g.baslik) || es(g.ozet) || es(g.sehirler?.ad)),
            yerler: (yerler.data ?? []).filter((y) => es(y.ad) || es(y.sehirler?.ad)),
          },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, sehirler.data, geziler.data, yerler.data],
  );
  const bos = !!sonuc && sonuc.sehirler.length + sonuc.geziler.length + sonuc.yerler.length === 0;
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <EkranBasligi baslik={t('ara.baslik')} geri={() => router.back()} />
      <View style={s.arama}>
        <Ikon ad="ara" boyut={18} renk={renk.ikincil} kalinlik={2.2} />
        <TextInput accessibilityLabel={t('ara.yer')} placeholder={t('ara.yer')} placeholderTextColor={renk.soluk} value={sorgu} onChangeText={setSorgu} autoFocus autoCorrect={false} style={s.girdi} />
      </View>
      <ScrollView contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled">
        {bos ? <Text style={s.bos}>{t('ara.sonucYok')}</Text> : null}
        {sonuc && sonuc.sehirler.length > 0 ? (
          <Grup baslik={t('ara.sehirler')}>
            {sonuc.sehirler.map((x) => (
              <Satir key={x.id} ad={x.ad} alt={t('ara.geziSayisi', { n: x.gezi_sayisi ?? 0 })} onPress={() => router.push({ pathname: '/geziler', params: { sehir: x.id } })} />
            ))}
          </Grup>
        ) : null}
        {sonuc && sonuc.geziler.length > 0 ? (
          <Grup baslik={t('ara.geziler')}>
            {sonuc.geziler.map((x) => (
              <Satir key={x.id} ad={x.baslik} alt={`${x.sehirler?.ad ?? ''} · ${t('gezi.gunMekan', { gun: x.gun_sayisi, mekan: x.mekan_sayisi })}`} onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: x.slug } })} />
            ))}
          </Grup>
        ) : null}
        {sonuc && sonuc.yerler.length > 0 ? (
          <Grup baslik={t('ara.yerler')}>
            {sonuc.yerler.map((x) => (
              <Satir key={x.id} ad={x.ad} alt={x.sehirler?.ad ?? ''} onPress={() => router.push({ pathname: '/yerler', params: { sehir: x.sehir_id } })} />
            ))}
          </Grup>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Grup({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={s.grup}>{baslik}</Text>
      {children}
    </View>
  );
}
function Satir({ ad, alt, onPress }: { ad: string; alt: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.ad} numberOfLines={1}>
          {ad}
        </Text>
        <Text style={s.alt} numberOfLines={1}>
          {alt}
        </Text>
      </View>
      <Text style={s.ok}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  arama: { marginHorizontal: bosluk.kenar, marginTop: 10, height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 10 },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 14, paddingBottom: 24, gap: 16 },
  grup: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, paddingBottom: 4 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minDokunma, paddingVertical: 8, borderTopWidth: 1, borderTopColor: renk.ayrac },
  ad: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 22, color: '#c4c4c4' },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
});
