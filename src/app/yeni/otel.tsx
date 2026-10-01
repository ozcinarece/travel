import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Harita } from '@/components/harita/Harita';
import { Buton } from '@/components/ui/Buton';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { useOtelKaydet, useSeyahat } from '@/features/seyahatler/sorgular';
import { hafifYerler, linkCoz, linkGibiMi, useOtelOnerileri, yeniOturumJetonu, type Oneri } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { OtelSecimi, Seyahat } from '@/lib/tipler';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

// PRD 3.3 KK3: 20 dk yürüyüş ≈ 1,5 km.
const YURUME_YARICAPI_M = 1500;

/**
 * PRD 3.3 Otel. KK1 Autocomplete (lodging, şehir çevresi) + Google Maps linki (resolve-link);
 * KK2 sürüklenebilir pin; KK3 kesikli 20 dk dairesi; KK4 Atla → otel null (bölge önerisi metni 3.4 sonrası);
 * KK5 aynı ekran mevcut oteli yükler (3.7'den yeniden açılır).
 */
export default function OtelEkrani() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const seyahat = useSeyahat(trip);

  if (seyahat.isPending) {
    return (
      <SafeAreaView style={s.ekran}>
        <EkranBasligi baslik={t('otel.baslik')} geri={() => router.back()} />
        <ActivityIndicator color={renk.metin} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }
  if (seyahat.isError || !seyahat.data || !trip) {
    return (
      <SafeAreaView style={s.ekran}>
        <EkranBasligi baslik={t('otel.baslik')} geri={() => router.back()} />
        <Text style={[s.hata, { paddingTop: 20 }]}>{t('otel.bulunamadi')}</Text>
      </SafeAreaView>
    );
  }
  // Form, seyahat yüklendikten sonra kurulur: mevcut otel (KK5) başlangıç durumu olur, effect gerekmez.
  return <OtelFormu key={trip} trip={trip} sehir={seyahat.data} />;
}

function OtelFormu({ trip, sehir }: { trip: string; sehir: Seyahat }) {
  const kaydet = useOtelKaydet(trip);
  const [sorgu, setSorgu] = useState(sehir.hotel_label ?? '');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [otel, setOtel] = useState<OtelSecimi | null>(() =>
    sehir.hotel_lat !== null && sehir.hotel_lng !== null
      ? { place_id: sehir.hotel_place_id, ad: sehir.hotel_label ?? t('otel.adsiz'), lat: sehir.hotel_lat, lng: sehir.hotel_lng }
      : null,
  );
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const merkez = { lat: sehir.lat, lng: sehir.lng, yaricapM: 30_000 };
  const linkMi = linkGibiMi(sorgu);
  const oneriler = useOtelOnerileri(otel ? '' : sorgu, jeton, merkez, !linkMi);

  const sec = async (o: Oneri) => {
    setHata(null);
    setMesgul(true);
    try {
      const [yer] = await hafifYerler([o.place_id], { oturum: jeton });
      if (!yer) throw new Error('yer yok');
      setOtel({ place_id: yer.place_id, ad: o.ana || yer.ad, lat: yer.lat, lng: yer.lng });
      setSorgu(o.ana);
      setJeton(yeniOturumJetonu());
    } catch {
      setHata(t('otel.secimHata'));
    } finally {
      setMesgul(false);
    }
  };

  const linkiCoz = async () => {
    setHata(null);
    setMesgul(true);
    try {
      const { yer } = await linkCoz(sorgu.trim(), merkez);
      setOtel({ place_id: yer.place_id || null, ad: yer.ad || t('otel.adsiz'), lat: yer.lat, lng: yer.lng });
      setSorgu(yer.ad || sorgu);
    } catch (e) {
      setHata((e as Error).message === 'desteklenmeyen_link' ? t('otel.linkDesteksiz') : t('otel.linkHata'));
    } finally {
      setMesgul(false);
    }
  };

  const yaz = (metin: string) => {
    setSorgu(metin);
    if (otel) setOtel(null);
  };

  const bitir = async (secim: OtelSecimi | null) => {
    setHata(null);
    try {
      await kaydet.mutateAsync(secim);
      router.replace({ pathname: '/seyahat/[id]', params: { id: trip } });
    } catch {
      setHata(t('otel.kaydetHata'));
    }
  };

  const listeAcik = !otel && !linkMi && sorgu.trim().length >= 2;

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled">
        <EkranBasligi
          baslik={t('otel.baslik')}
          alt={t('otel.alt', { sehir: sehir.city_label })}
          geri={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        />

        <View style={s.arama}>
          <Text style={s.buyutec}>⌕</Text>
          <TextInput
            accessibilityLabel={t('otel.ara')}
            placeholder={t('otel.araYer')}
            placeholderTextColor={renk.soluk}
            value={sorgu}
            onChangeText={yaz}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType={linkMi ? 'go' : 'search'}
            onSubmitEditing={linkMi ? linkiCoz : undefined}
            style={s.girdi}
          />
          {mesgul || (listeAcik && oneriler.isFetching) ? <ActivityIndicator color={renk.ikincil} /> : null}
          {linkMi && !mesgul ? (
            <Pressable accessibilityRole="button" onPress={linkiCoz} hitSlop={10}>
              <Text style={s.linkDugme}>{t('otel.linkCoz')}</Text>
            </Pressable>
          ) : null}
        </View>

        {listeAcik ? (
          <View style={s.liste}>
            {oneriler.isError ? <Text style={s.hata}>{t('otel.araHata')}</Text> : null}
            {oneriler.data?.length === 0 ? <Text style={s.bos}>{t('otel.sonucYok')}</Text> : null}
            {oneriler.data?.map((o) => (
              <Pressable
                key={o.place_id}
                accessibilityRole="button"
                disabled={mesgul}
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

        <View style={s.haritaKutu}>
          <Harita
            // Merkez değişince yeniden kurulur (initialRegion/defaultCenter yalnız ilk kurulumda okunur).
            key={otel ? `${otel.lat},${otel.lng}` : 'sehir'}
            merkez={otel ? { lat: otel.lat, lng: otel.lng } : { lat: sehir.lat, lng: sehir.lng }}
            zoom={otel ? 14 : 12}
            pinler={otel ? [{ id: 'otel', konum: { lat: otel.lat, lng: otel.lng }, renk: renk.metin, surukle: true }] : []}
            daireler={otel ? [{ id: 'yurume', merkez: { lat: otel.lat, lng: otel.lng }, yaricapM: YURUME_YARICAPI_M, renk: renk.metin }] : []}
            onPinSuruklendi={(_, konum) => setOtel((o) => (o ? { ...o, lat: konum.lat, lng: konum.lng } : o))}
          />
          {otel ? (
            <View style={s.rozet} pointerEvents="none">
              <Text style={s.rozetMetin}>{t('otel.daire')}</Text>
            </View>
          ) : null}
        </View>
        {otel ? <Text style={s.not}>{t('otel.surukleNot')}</Text> : null}

        <View style={s.kartlar}>
          {otel ? (
            <View style={s.otelKart}>
              <Text style={s.otelAd} numberOfLines={2}>
                {otel.ad}
              </Text>
              <Text style={s.otelAlt}>{t('otel.herGun')}</Text>
              <GoogleAtfi />
            </View>
          ) : (
            <View style={s.yokKart}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.yokBaslik}>{t('otel.yokBaslik')}</Text>
                <Text style={s.yokAlt}>{t('otel.yokAlt')}</Text>
              </View>
              <Buton baslik={t('otel.atla')} tur="ikincil" onPress={() => bitir(null)} stil={s.atla} pasif={kaydet.isPending} />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={s.altKisim}>
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        <Buton baslik={t('otel.devam')} onPress={() => bitir(otel)} pasif={!otel} yukleniyor={kaydet.isPending} />
      </View>
    </SafeAreaView>
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
  linkDugme: { fontFamily: yazi.kalin, fontSize: 12, color: renk.vurgu, paddingVertical: 8 },
  liste: { paddingHorizontal: bosluk.kenar, paddingTop: 14 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: minDokunma, borderTopWidth: 1, borderTopColor: renk.ayrac },
  karo: { width: 48, height: 48, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  harf: { fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin },
  metinler: { flex: 1, gap: 2 },
  ana: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  ikincil: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 22, color: '#c4c4c4' },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  haritaKutu: { marginHorizontal: bosluk.kenar, marginTop: 14, height: 220, borderRadius: 20, overflow: 'hidden', backgroundColor: renk.yuzey },
  rozet: { position: 'absolute', left: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: renk.zemin },
  rozetMetin: { fontFamily: yazi.kalin, fontSize: 11, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingTop: 8 },
  kartlar: { paddingHorizontal: bosluk.kenar, paddingTop: 14, gap: 10 },
  otelKart: { padding: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: renk.yuzey, gap: 4 },
  otelAd: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  otelAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  yokKart: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c4c4c4' },
  yokBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  yokAlt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  atla: { height: 36, paddingHorizontal: 18 },
  altKisim: { paddingHorizontal: bosluk.kenar, paddingBottom: 12, paddingTop: 8, gap: 10 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari, paddingHorizontal: bosluk.kenar },
});
