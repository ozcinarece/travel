import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeziKarti } from '@/components/icerik/GeziKarti';
import { Buton } from '@/components/ui/Buton';
import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { useGeziler, useSehirRehberi, useSehirler } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import type { RehberBolumu } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

const BOLUM_IKONU: Record<RehberBolumu, IkonAdi> = { ulasim: 'araba', yemek: 'catal', mahalle: 'ev', ipucu: 'yildiz' };

/**
 * #100 B KK2 (kanvas SavedGuide16 ekran 3): şehir rehberi — kapak 240 px ("ŞEHİR REHBERİ" · şehir adı), 2 cümle özet,
 * bölüm satırları (Nasıl gidilir · Ne yenir · Mahalleler · İpuçları → yazı sayfası), altta "Bu şehirde önerilen geziler" şeridi.
 */
export default function RehberEkrani() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const kenar = useSafeAreaInsets();
  const sehirler = useSehirler();
  const sehir = sehirler.data?.find((x) => x.slug === slug);
  const rehber = useSehirRehberi(sehir?.id);
  const geziler = useGeziler(sehir?.id);
  if (sehirler.isPending || (sehir && rehber.isPending)) {
    return (
      <View style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.metin} />
      </View>
    );
  }
  if (!sehir || rehber.isError) {
    return (
      <View style={[s.ekran, s.ortala, { paddingTop: kenar.top }]}>
        <Text style={s.hata}>{t('rehber.hata')}</Text>
        <Buton baslik={t('genel.geri')} tur="ikincil" onPress={() => router.back()} />
      </View>
    );
  }
  return (
    <ScrollView style={s.ekran} contentContainerStyle={{ paddingBottom: Math.max(kenar.bottom, 16) + 8 }}>
      <View style={s.kapak}>
        {sehir.kapak_url ? <Image source={{ uri: sehir.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        <View style={s.kapakGolge} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={() => router.back()} style={[s.geri, { top: kenar.top + 10 }]}>
          <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.4} />
        </Pressable>
        <View style={s.kapakMetin}>
          <Text style={s.ustBaslik}>{t('rehber.ustBaslik')}</Text>
          <Text style={s.baslik}>{sehir.ad}</Text>
        </View>
      </View>
      {sehir.ozet ? <Text style={s.ozet}>{sehir.ozet}</Text> : null}
      {(rehber.data ?? []).map((b) => (
        <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/rehber/[slug]/[bolum]', params: { slug: sehir.slug, bolum: b.bolum } })} style={({ pressed }) => [s.bolum, pressed && { opacity: 0.8 }]}>
          <View style={s.bolumIkon}>
            <Ikon ad={BOLUM_IKONU[b.bolum] ?? 'kitap'} boyut={20} renk={renk.metin} kalinlik={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={s.bolumBaslik} numberOfLines={1}>
              {b.baslik}
            </Text>
            {b.ozet ? (
              <Text style={s.bolumAlt} numberOfLines={1}>
                {b.ozet}
              </Text>
            ) : null}
          </View>
          <Text style={s.ok}>›</Text>
        </Pressable>
      ))}
      {geziler.data && geziler.data.length > 0 ? (
        <>
          <Text style={s.seritBaslik}>{t('rehber.geziler')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.serit}>
            {geziler.data.map((g, i) => (
              <View key={g.id} style={{ width: 160 }}>
                <GeziKarti gezi={g} sira={i} onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })} />
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  kapak: { height: 240, backgroundColor: '#e58a5a', justifyContent: 'flex-end' },
  kapakGolge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,15,15,0.35)' },
  geri: { position: 'absolute', left: bosluk.kenar, width: 36, height: 36, borderRadius: 18, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  kapakMetin: { padding: bosluk.kenar, gap: 4 },
  ustBaslik: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: 0.9, color: 'rgba(255,255,255,0.9)' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 30, lineHeight: 32, letterSpacing: -0.9, color: renk.zemin },
  ozet: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 21, color: '#2a2a2a', paddingHorizontal: bosluk.kenar, paddingTop: 14, paddingBottom: 12 },
  bolum: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: bosluk.kenar, paddingVertical: 12, borderTopWidth: 1, borderTopColor: renk.ayrac },
  bolumIkon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f6f6f4', alignItems: 'center', justifyContent: 'center' },
  bolumBaslik: { fontFamily: yazi.ekstra, fontSize: 14.5, color: renk.metin },
  bolumAlt: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 20, color: renk.ikincil },
  seritBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingTop: 14, paddingBottom: 8 },
  serit: { paddingHorizontal: bosluk.kenar, gap: 10 },
  hata: { fontFamily: yazi.kalin, fontSize: 13, color: renk.uyari, textAlign: 'center' },
});
