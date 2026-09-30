import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Buton } from '@/components/ui/Buton';
import { TarihSecici, type TarihAraligi } from '@/components/ui/TarihSecici';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { useSeyahatOlustur } from '@/features/seyahatler/sorgular';
import { hafifYerler, useSehirOnerileri, yeniOturumJetonu, type Oneri } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kisaTarih } from '@/lib/takvim';
import type { SehirSecimi } from '@/lib/tipler';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

// PRD 3.2 Nereye? — KK1 şehir Autocomplete (Edge Function, oturum token'ı, ilk 3), KK2 isteğe bağlı tarihler, KK3 Devam → 3.3.
export default function NereyeEkrani() {
  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [secili, setSecili] = useState<SehirSecimi | null>(null);
  const [secimYukleniyor, setSecimYukleniyor] = useState(false);
  const [tarihler, setTarihler] = useState<TarihAraligi>(null);
  const [takvimAcik, setTakvimAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const oneriler = useSehirOnerileri(secili ? '' : sorgu, jeton);
  const olustur = useSeyahatOlustur();

  // Seçim: hafif Details şehir maskesiyle (konum, tz, ülke) — aynı oturum token'ı, oturum kapanır; sonraki arama yeni token.
  const sec = async (o: Oneri) => {
    setHata(null);
    setSecimYukleniyor(true);
    try {
      const [yer] = await hafifYerler([o.place_id], { sehir: true, oturum: jeton });
      if (!yer?.tz) throw new Error('tz yok');
      setSecili({
        place_id: yer.place_id,
        ad: o.ana || yer.ad,
        ikincil: o.ikincil,
        lat: yer.lat,
        lng: yer.lng,
        tz: yer.tz,
        country_code: yer.ulke_kodu,
      });
      setSorgu(o.ana);
      setJeton(yeniOturumJetonu());
    } catch {
      setHata(t('yeni.secimHata'));
    } finally {
      setSecimYukleniyor(false);
    }
  };

  const yaz = (metin: string) => {
    setSorgu(metin);
    if (secili) setSecili(null);
  };

  const devam = async () => {
    if (!secili) return;
    setHata(null);
    try {
      const id = await olustur.mutateAsync({
        sehir: secili,
        start_date: tarihler?.gidis ?? null,
        end_date: tarihler?.donus ?? null,
      });
      router.push({ pathname: '/yeni/otel', params: { trip: id } });
    } catch {
      setHata(t('yeni.hata'));
    }
  };

  const listeAcik = !secili && sorgu.trim().length >= 2;

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled">
        <EkranBasligi baslik={t('yeni.baslik')} alt={t('yeni.alt')} geri={router.canGoBack() ? () => router.back() : undefined} />

        <View style={s.arama}>
          <Text style={s.buyutec}>⌕</Text>
          <TextInput
            accessibilityLabel={t('yeni.ara')}
            placeholder={t('yeni.araYer')}
            placeholderTextColor={renk.soluk}
            value={sorgu}
            onChangeText={yaz}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            style={s.girdi}
          />
          {secimYukleniyor || (listeAcik && oneriler.isFetching) ? <ActivityIndicator color={renk.ikincil} /> : null}
        </View>

        {listeAcik ? (
          <View style={s.liste}>
            {oneriler.isError ? <Text style={s.hata}>{t('yeni.araHata')}</Text> : null}
            {oneriler.data?.length === 0 ? <Text style={s.bos}>{t('yeni.sonucYok')}</Text> : null}
            {oneriler.data?.map((o) => (
              <Pressable
                key={o.place_id}
                accessibilityRole="button"
                disabled={secimYukleniyor}
                onPress={() => sec(o)}
                style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}>
                <View style={s.karo}>
                  <Text style={s.harf}>{o.ana.charAt(0).toLocaleUpperCase('tr')}</Text>
                </View>
                <View style={s.metinler}>
                  <Text style={s.ana} numberOfLines={1}>
                    {o.ana}
                  </Text>
                  <Text style={s.ikincil} numberOfLines={1}>
                    {o.ikincil}
                  </Text>
                </View>
                <Text style={s.ok}>›</Text>
              </Pressable>
            ))}
            {oneriler.data && oneriler.data.length > 0 ? <GoogleAtfi /> : null}
          </View>
        ) : null}

        {secili ? (
          <View style={s.liste}>
            <View style={s.satir}>
              <View style={[s.karo, s.karoSecili]}>
                <Text style={[s.harf, { color: renk.zemin }]}>{secili.ad.charAt(0).toLocaleUpperCase('tr')}</Text>
              </View>
              <View style={s.metinler}>
                <Text style={s.ana}>{secili.ad}</Text>
                <Text style={s.ikincil}>{secili.ikincil}</Text>
              </View>
              <Text style={s.tik}>✓</Text>
            </View>
            <GoogleAtfi />
          </View>
        ) : null}

        <Text style={s.bolum}>{t('yeni.tarihler')}</Text>
        <View style={s.tarihKutular}>
          <TarihKutusu etiket={t('yeni.gidis')} deger={tarihler?.gidis} onPress={() => setTakvimAcik(true)} />
          <TarihKutusu etiket={t('yeni.donus')} deger={tarihler?.donus} onPress={() => setTakvimAcik(true)} />
        </View>
        <Text style={s.not}>{t('yeni.tarihNot')}</Text>

        <Text style={s.bolum}>{t('yeni.kimlerle')}</Text>
        <Text style={s.not}>{t('yeni.kimlerleNot')}</Text>
      </ScrollView>

      <View style={s.altKisim}>
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        <Buton baslik={t('yeni.devam')} onPress={devam} pasif={!secili} yukleniyor={olustur.isPending} />
      </View>

      <TarihSecici acik={takvimAcik} deger={tarihler} onKapat={() => setTakvimAcik(false)} onSec={setTarihler} />
    </SafeAreaView>
  );
}

function TarihKutusu({ etiket, deger, onPress }: { etiket: string; deger?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiket} onPress={onPress} style={s.tarihKutu}>
      <Text style={s.tarihEtiket}>{etiket}</Text>
      <Text style={[s.tarihDeger, !deger && { color: renk.soluk }]}>{deger ? kisaTarih(deger) : t('yeni.sec')}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingBottom: 16 },
  arama: {
    marginHorizontal: bosluk.kenar,
    marginTop: 14,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: renk.yuzey,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buyutec: { fontSize: 18, color: renk.ikincil },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  liste: { paddingHorizontal: bosluk.kenar, paddingTop: 14 },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    minHeight: minDokunma,
    borderTopWidth: 1,
    borderTopColor: renk.ayrac,
  },
  karo: { width: 48, height: 48, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  karoSecili: { backgroundColor: renk.metin },
  harf: { fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin },
  metinler: { flex: 1, gap: 2 },
  ana: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  ikincil: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 22, color: '#c4c4c4' },
  tik: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  bolum: {
    fontFamily: yazi.ekstra,
    fontSize: 17,
    letterSpacing: -0.4,
    color: renk.metin,
    paddingHorizontal: bosluk.kenar,
    paddingTop: 22,
  },
  tarihKutular: { flexDirection: 'row', gap: 10, paddingHorizontal: bosluk.kenar, paddingTop: 10 },
  tarihKutu: { flex: 1, padding: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: renk.yuzey, gap: 2, minHeight: minDokunma },
  tarihEtiket: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  tarihDeger: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 18, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingTop: 8 },
  altKisim: { paddingHorizontal: bosluk.kenar, paddingBottom: 12, paddingTop: 8, gap: 10 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
