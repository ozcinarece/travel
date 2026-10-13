// #98 KK4: sihirbazın otel seçme alt sayfası — arama (lodging Autocomplete) / Google Maps linki / Haritadan (3.3 harita
// seçimi, secim=1) + seyahatte kullanılan oteller + "Otel yok". GunOteliSayfasi'nın (#56) gün/kapsam mantığı olmayan hali.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CekilenSayfa, modalKokuStili, SayfaKaydirici } from '@/components/ui/sayfaCekme';
import { Ikon } from '@/components/ui/Ikon';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { haritadanSecimBekle, haritaSeciminiBirak } from '@/features/konaklama/haritaSecimi';
import type { Konaklama } from '@/features/konaklama/plan';
import type { OtelSecimiVeyaKayitli } from '@/features/konaklama/sorgular';
import { hafifYerler, linkCoz, linkGibiMi, useOtelOnerileri, yeniOturumJetonu, type Oneri } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { OtelSecimi, Seyahat } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  baslik: string;
  seyahat: Seyahat;
  konaklamalar: Konaklama[];
  onKapat: () => void;
  onSec: (otel: OtelSecimiVeyaKayitli) => void;
};

export function OtelSecSayfasi({ acik, baslik, seyahat, konaklamalar, onKapat, onSec }: Props) {
  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [haritada, setHaritada] = useState(false);
  const merkez = { lat: seyahat.lat, lng: seyahat.lng, yaricapM: 30_000 };
  const linkMi = linkGibiMi(sorgu);
  const listeAcik = !linkMi && sorgu.trim().length >= 2;
  const oneriler = useOtelOnerileri(listeAcik ? sorgu : '', jeton, merkez, listeAcik && acik);

  useFocusEffect(
    useCallback(() => {
      setHaritada(false);
      haritaSeciminiBirak();
    }, []),
  );

  const bitir = (otel: OtelSecimiVeyaKayitli) => {
    setSorgu('');
    onSec(otel);
  };
  const oneriSec = async (o: Oneri) => {
    setHata(null);
    setMesgul(true);
    try {
      // #172 KK3: puan gösterilmez — Pro maske (oturum token'ı yine seçimle kapanır).
      const [yer] = await hafifYerler([o.place_id], { oturum: jeton, puansiz: true });
      if (!yer) throw new Error('yer yok');
      setJeton(yeniOturumJetonu());
      bitir({ place_id: yer.place_id, ad: o.ana || yer.ad, lat: yer.lat, lng: yer.lng });
    } catch {
      setHata(t('gunOteli.secimHata'));
    } finally {
      setMesgul(false);
    }
  };
  const linkiCoz = async () => {
    setHata(null);
    setMesgul(true);
    try {
      const { yer } = await linkCoz(sorgu.trim(), merkez);
      bitir({ place_id: yer.place_id || null, ad: yer.ad || t('otel.adsiz'), lat: yer.lat, lng: yer.lng });
    } catch (e) {
      setHata((e as Error).message === 'desteklenmeyen_link' ? t('otel.linkDesteksiz') : t('otel.linkHata'));
    } finally {
      setMesgul(false);
    }
  };
  const haritadan = () => {
    haritadanSecimBekle((otel: OtelSecimi) => bitir(otel));
    setHaritada(true);
    router.push({ pathname: '/yeni/otel', params: { trip: seyahat.id, secim: '1' } });
  };

  return (
    <Modal visible={acik && !haritada} transparent animationType="slide" onRequestClose={onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        {/* #117 KK5a: Android'de de klavye kadar yukarı kalk (Modal içinde pencere yeniden boyutlanmaz). */}
        <KeyboardAvoidingView style={s.perde} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onKapat} accessibilityLabel={t('genel.vazgec')} />
          <CekilenSayfa onKapat={onKapat} style={s.kutu}>
            <View style={s.tutamak} />
            <Text style={s.baslik}>{baslik}</Text>
            <SayfaKaydirici keyboardShouldPersistTaps="handled" contentContainerStyle={s.icerik}>
              <View style={s.aramaSatiri}>
                <View style={s.arama}>
                  <Text style={s.buyutec}>⌕</Text>
                  <TextInput
                    accessibilityLabel={t('otel.ara')}
                    placeholder={t('gunOteli.araYer')}
                    placeholderTextColor={renk.soluk}
                    value={sorgu}
                    onChangeText={setSorgu}
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
                <Pressable accessibilityRole="button" onPress={haritadan} style={s.haritadan}>
                  <Ikon ad="harita" boyut={16} renk={renk.metin} />
                  <Text style={s.haritadanMetin}>{t('gunOteli.haritadan')}</Text>
                </Pressable>
              </View>
              {listeAcik ? (
                <View style={s.oneriler}>
                  {oneriler.isError ? <Text style={s.hata}>{t('otel.araHata')}</Text> : null}
                  {oneriler.data?.length === 0 ? <Text style={s.bos}>{t('otel.sonucYok')}</Text> : null}
                  {oneriler.data?.map((o, i) => (
                    <Pressable key={o.place_id} accessibilityRole="button" disabled={mesgul} onPress={() => oneriSec(o)} style={({ pressed }) => [s.oneri, i > 0 && s.ayrac, pressed && { opacity: 0.7 }]}>
                      <Text style={s.ad} numberOfLines={1}>
                        {o.ana}
                      </Text>
                      <Text style={s.alt} numberOfLines={1}>
                        {o.ikincil}
                      </Text>
                    </Pressable>
                  ))}
                  {oneriler.data && oneriler.data.length > 0 ? <GoogleAtfi /> : null}
                </View>
              ) : null}
              {konaklamalar.length > 0 ? <Text style={s.bolum}>{t('gunOteli.kullanilan')}</Text> : null}
              {konaklamalar.map((k) => (
                <Pressable key={k.id} accessibilityRole="button" onPress={() => bitir({ stayId: k.id })} style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}>
                  <View style={s.otelIkon}>
                    <Ikon ad="ev" boyut={16} renk={renk.zemin} kalinlik={2.2} />
                  </View>
                  <Text style={[s.ad, { flex: 1 }]} numberOfLines={1}>
                    {k.label ?? t('otel.adsiz')}
                  </Text>
                  <Text style={s.ok}>›</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={() => bitir(null)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}>
                <Text style={[s.ad, { flex: 1, color: renk.ikincil }]}>{t('sihirbaz.oteller.otelYok')}</Text>
              </Pressable>
              {hata ? <Text style={s.hata}>{hata}</Text> : null}
            </SayfaKaydirici>
          </CekilenSayfa>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(15,15,15,0.35)', justifyContent: 'flex-end' },
  kutu: { maxHeight: '88%', backgroundColor: renk.zemin, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  tutamak: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: renk.ayrac },
  baslik: { fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  icerik: { paddingHorizontal: 20, paddingBottom: 32, gap: 8 },
  aramaSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arama: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey },
  buyutec: { fontSize: 16, color: renk.ikincil },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  linkDugme: { fontFamily: yazi.kalin, fontSize: 12, color: renk.vurgu, paddingVertical: 8 },
  haritadan: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: renk.ayrac },
  haritadanMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  oneriler: { borderRadius: 14, borderWidth: 1, borderColor: renk.ayrac, paddingHorizontal: 14, paddingVertical: 4 },
  oneri: { minHeight: minDokunma, justifyContent: 'center', paddingVertical: 8, gap: 2 },
  ayrac: { borderTopWidth: 1, borderTopColor: renk.ayrac },
  bolum: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, marginTop: 8 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minDokunma, paddingVertical: 6 },
  otelIkon: { width: 28, height: 28, borderRadius: 9, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  ad: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 22, color: '#c4c4c4' },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
});
