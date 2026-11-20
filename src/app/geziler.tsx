import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { GeziKarti } from '@/components/icerik/GeziKarti';
import { Cip } from '@/components/ui/Cip';
import { EklemeDurumSatiri } from '@/components/ui/EklemeDurumSatiri';
import { rafBul } from '@/features/anasayfa/raflar';
import { useKesfetAkisi } from '@/features/icerik/kesfetAkisi';
import { useGeziler, useSehirler } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import { useAnaSayfaBolumleri } from '@/lib/anaSayfa';
import { bosluk, renk, yazi } from '@/theme';

/**
 * #97 A KK4 "Tümü": gezi listesi — şehir + gün sayısı filtresi; büyük kartlar.
 * #406: `raf` verilirse Keşfet rafının "Tümü"sü (ya da raf hedefli banner): başlık rafın adı, rafın bütün gezileri, süzgeç yok.
 */
export default function GezilerEkrani() {
  const { sehir, raf } = useLocalSearchParams<{ sehir?: string; raf?: string }>();
  if (raf) return <RafListesi rafId={raf} />;
  return <GeziListesi sehir={sehir} />;
}

function RafListesi({ rafId }: { rafId: string }) {
  const bolumler = useAnaSayfaBolumleri();
  const akis = useKesfetAkisi();
  // #428 inceleme 3: bölümler ya da geziler yüklenirken gösterge (başlık bir an "Önerilen geziler" olmasın); okunamazsa
  // Tekrar dene; raf bulunamaz ya da boşsa "Bu rafta şu an gezi yok" (bu ekranda süzgeç yok).
  const yukleniyor = bolumler.isPending || akis.isPending;
  const bolumHatasi = bolumler.isError && !bolumler.data;
  const akisHatasi = akis.isError && !akis.data;
  const hata = !yukleniyor && (bolumHatasi || akisHatasi);
  const r = yukleniyor || hata ? null : rafBul(rafId, bolumler.data, akis.data ?? []);
  const tekrarDene = () => {
    if (bolumHatasi) bolumler.refetch();
    if (akisHatasi) akis.refetch();
  };
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <EkranBasligi baslik={r?.baslik ?? ''} geri={() => router.back()} />
      <ScrollView contentContainerStyle={s.icerik}>
        <View style={{ gap: 12, paddingTop: 6 }}>
          {yukleniyor ? (
            <ActivityIndicator color={renk.ana} style={s.yukleniyor} accessibilityLabel={t('genel.yukleniyor')} testID="raf-yukleniyor" />
          ) : hata ? (
            <EklemeDurumSatiri durum={{ metin: t('kesfetAkisi.agMetin'), tur: 'hata', tekrar: tekrarDene }} />
          ) : (
            <>
              {(r?.geziler ?? []).map((g, i) => (
                <GeziKarti key={g.id} gezi={g} buyuk sira={i} onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })} />
              ))}
              {!r || r.geziler.length === 0 ? <Text style={s.bos}>{t('anasayfa.v6.rafBos')}</Text> : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GeziListesi({ sehir }: { sehir?: string }) {
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
  yukleniyor: { paddingVertical: 24 },
});
