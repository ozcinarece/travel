import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { YerKarosu } from '@/components/icerik/YerKarosu';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { Cip } from '@/components/ui/Cip';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { useSehirler, useTumYerler } from '@/features/icerik/sorgular';
import { hedefSeyahatler, useYereEkle } from '@/features/icerik/yerEkle';
import { useMekanlar, useMekanSil } from '@/features/mekanlar/sorgular';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

/** #97 A KK5 "Tümü": yerler listesi (şehre göre), 2 sütun mozaik, "+" yaklaşan seyahate. */
export default function YerlerEkrani() {
  const { sehir } = useLocalSearchParams<{ sehir?: string }>();
  const [sehirId, setSehirId] = useState<string | null>(sehir ?? null);
  const sehirler = useSehirler();
  const yerler = useTumYerler();
  const seyahatler = useSeyahatler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  const hedef = hedefler[0] ?? null;
  const hedefMekanlar = useMekanlar(hedef?.id);
  const hedefIdleri = useMemo(() => new Set((hedefMekanlar.data ?? []).map((m) => m.place_id)), [hedefMekanlar.data]);
  const liste = useMemo(() => (yerler.data ?? []).filter((y) => !sehirId || y.sehir_id === sehirId), [yerler.data, sehirId]);
  const canli = useIcerikCanli(liste, (y) => (y as (typeof liste)[number]).sehirler?.ad ?? '');
  const ekle = useYereEkle();
  const sil = useMekanSil(hedef?.id ?? '');
  const [secimYeri, setSecimYeri] = useState<(typeof liste)[number] | null>(null);
  const [mesgulId, setMesgulId] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);

  const yereEkle = async (y: (typeof liste)[number], seyahatId: string) => {
    const c = canli.data?.get(y.id);
    if (!c?.place_id) return setBildirim(t('anasayfa.ekleHata'));
    setMesgulId(y.id);
    try {
      await ekle.mutateAsync({ seyahatId, yerId: y.id, place_id: c.place_id, primary_type: c.hafif?.primary_type ?? y.kategori, lat: c.hafif?.lat ?? y.lat, lng: c.hafif?.lng ?? y.lng });
      const sy = hedefler.find((x) => x.id === seyahatId);
      setBildirim(t('anasayfa.eklendi', { seyahat: sy ? seyahatAdi(sy) : '' }));
      setTimeout(() => setBildirim(null), 2500);
    } catch {
      setBildirim(t('anasayfa.ekleHata'));
    } finally {
      setMesgulId(null);
    }
  };
  // ✓'ye dokununca listeden çıkar (hedef seyahatin listesi).
  const cikar = async (y: (typeof liste)[number]) => {
    const pid = canli.data?.get(y.id)?.place_id;
    const m = pid ? hedefMekanlar.data?.find((x) => x.place_id === pid) : undefined;
    if (!m) return;
    setMesgulId(y.id);
    try {
      await sil.mutateAsync(m.id);
    } finally {
      setMesgulId(null);
    }
  };
  const artiBas = (y: (typeof liste)[number]) => {
    if (hedefler.length === 0) return router.navigate('/(tabs)/yeni');
    if (hedefler.length === 1) return yereEkle(y, hedefler[0].id);
    setSecimYeri(y);
  };
  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <EkranBasligi baslik={t('yerler.listeBaslik')} geri={() => router.back()} />
      <ScrollView contentContainerStyle={s.icerik}>
        <View style={s.cipler}>
          <Cip baslik={t('gezi.hepsi')} secili={!sehirId} onPress={() => setSehirId(null)} />
          {(sehirler.data ?? []).map((x) => (
            <Cip key={x.id} baslik={x.ad} secili={sehirId === x.id} onPress={() => setSehirId(x.id)} />
          ))}
        </View>
        <View style={s.mozaik}>
          {[0, 1].map((sutun) => (
            <View key={sutun} style={s.sutun}>
              {liste
                .filter((_, i) => i % 2 === sutun)
                .map((y, i) => {
                  const c = canli.data?.get(y.id);
                  return (
                    <YerKarosu
                      key={y.id}
                      ad={y.ad}
                      sehir={y.sehirler?.ad ?? null}
                      kategori={c?.hafif?.primary_type ?? y.kategori}
                      fotoUri={c?.foto_uri ?? null}
                      puan={c?.hafif?.puan ?? null}
                      yorum={c?.hafif?.puan_sayisi ?? null}
                      yukseklik={(i + sutun) % 2 === 0 ? 190 : 150}
                      listede={!!c?.place_id && hedefIdleri.has(c.place_id)}
                      mesgul={mesgulId === y.id}
                      onEkle={() => artiBas(y)}
                      onCikar={() => cikar(y)}
                      onAc={() => {
                        if (hedef && c?.place_id) router.push({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: hedef.id, mekan: c.place_id } });
                      }}
                    />
                  );
                })}
            </View>
          ))}
        </View>
        {!yerler.isPending && liste.length === 0 ? <Text style={s.bos}>{t('yerler.bos')}</Text> : null}
      </ScrollView>
      {bildirim ? (
        <View style={s.bildirim} pointerEvents="none">
          <Text style={s.bildirimMetin}>{bildirim}</Text>
        </View>
      ) : null}
      <SecimMenusu acik={!!secimYeri} baslik={t('anasayfa.hangiSeyahat')} secenekler={hedefler.map((sy) => ({ etiket: seyahatAdi(sy), onPress: () => secimYeri && yereEkle(secimYeri, sy.id) }))} onKapat={() => setSecimYeri(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 8, paddingBottom: 24, gap: 12 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mozaik: { flexDirection: 'row', gap: 10 },
  sutun: { flex: 1, gap: 10 },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  bildirim: { position: 'absolute', left: bosluk.kenar, right: bosluk.kenar, bottom: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin, textAlign: 'center' },
});
