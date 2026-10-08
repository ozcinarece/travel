import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { bolgedenUzaklasti, bolgeHesapla } from '@/components/harita/geo';
import { BilgiHapi, EylemHapi, HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaBolgesi, HaritaOdagi, HaritaPini } from '@/components/harita/tipler';
import { Buton } from '@/components/ui/Buton';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { useGunler } from '@/features/gunler/sorgular';
import { haritaSeciminiTeslimEt } from '@/features/konaklama/haritaSecimi';
import type { Konaklama } from '@/features/konaklama/plan';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { useOtelKaydet, useSeyahat } from '@/features/seyahatler/sorgular';
import {
  hafifYerler,
  linkCoz,
  linkGibiMi,
  useOtelOnerileri,
  yakinYerler,
  yeniOturumJetonu,
  type HafifYer,
  type Oneri,
} from '@/features/yerler/api';
import { t } from '@/i18n';
import { puanMetni } from '@/lib/puan';
import type { Gun, OtelSecimi, Seyahat } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

// PRD 3.3 KK3: 20 dk yürüyüş ≈ 1,5 km.
const YURUME_YARICAPI_M = 1500;
// #17 KK3: görünür alan için en fazla 12 aday.
const ADAY_SAYISI = 12;

/** Seçili otel + ekranda gösterilen puan (veritabanına yazılmaz). */
type OtelGorunumu = OtelSecimi & { puan?: number | null };

/**
 * PRD 3.3 Otel — #17 ile tam ekran harita kabuğu (HaritaEkrani).
 * KK1 Autocomplete (lodging) + Google Maps linki; KK2 sürüklenebilir pin; KK3 20 dk dairesi; KK4 Atla;
 * KK5 mevcut otel yüklenir. #17: açık harita, yüzen üst/alt katmanlar, "Bu bölgedeki otelleri göster"
 * (Nearby Search lodging ≤12, yalnız bellekte), kaydırınca "Bu bölgede ara" (otomatik yenileme yok).
 */
export default function OtelEkrani() {
  // #56: secim=1 → program "günün oteli" alt sayfasının "Haritadan" seçimi (yazmaz, seçimi geri teslim eder).
  const { trip, secim } = useLocalSearchParams<{ trip: string; secim?: string }>();
  const seyahat = useSeyahat(trip);
  const gunler = useGunler(trip);
  const konaklamalar = useKonaklamalar(trip);
  const secimModu = secim === '1';

  if (seyahat.isPending || (!secimModu && (gunler.isPending || konaklamalar.isPending))) {
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
  const mevcut = secimModu ? null : ilkGununOteli(gunler.data ?? [], konaklamalar.data ?? []);
  return <OtelFormu key={trip} trip={trip} sehir={seyahat.data} mevcut={mevcut} secimModu={secimModu} />;
}

/** #56: KK5 mevcut otel = ilk günün başlangıç oteli (trips.hotel_* artık okunmaz). */
function ilkGununOteli(gunler: Gun[], konaklamalar: Konaklama[]): OtelGorunumu | null {
  const ilk = [...gunler].sort((a, b) => a.index - b.index)[0];
  const k = ilk?.start_stay_id ? konaklamalar.find((x) => x.id === ilk.start_stay_id) : undefined;
  return k ? { place_id: k.place_id, ad: k.label ?? t('otel.adsiz'), lat: k.lat, lng: k.lng } : null;
}

function OtelFormu({ trip, sehir, mevcut, secimModu }: { trip: string; sehir: Seyahat; mevcut: OtelGorunumu | null; secimModu: boolean }) {
  const kaydet = useOtelKaydet(trip);
  const [sorgu, setSorgu] = useState(mevcut?.ad ?? '');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [otel, setOtel] = useState<OtelGorunumu | null>(mevcut);
  const [odak, setOdak] = useState<HaritaOdagi | undefined>();
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // #17 KK3: adaylar yalnız bellekte; aramanın yapıldığı bölge "Bu bölgede ara" kararı için tutulur.
  const [adaylar, setAdaylar] = useState<HafifYer[]>([]);
  const [adayId, setAdayId] = useState<string | null>(null);
  const [bolge, setBolge] = useState<HaritaBolgesi | null>(null);
  const [aramaBolgesi, setAramaBolgesi] = useState<HaritaBolgesi | null>(null);
  const [adayMesgul, setAdayMesgul] = useState(false);
  const [adayNot, setAdayNot] = useState<string | null>(null);

  const merkez = { lat: sehir.lat, lng: sehir.lng, yaricapM: 30_000 };
  const linkMi = linkGibiMi(sorgu);
  const oneriler = useOtelOnerileri(otel ? '' : sorgu, jeton, merkez, !linkMi);

  const odakla = (lat: number, lng: number, zoom: number) => setOdak((o) => ({ konum: { lat, lng }, zoom, sayac: (o?.sayac ?? 0) + 1 }));

  const otelSec = (secim: OtelGorunumu) => {
    setOtel(secim);
    setSorgu(secim.ad);
    setAdaylar([]);
    setAdayId(null);
    setAramaBolgesi(null);
    setAdayNot(null);
    odakla(secim.lat, secim.lng, 15);
  };

  const sec = async (o: Oneri) => {
    setHata(null);
    setMesgul(true);
    try {
      const [yer] = await hafifYerler([o.place_id], { oturum: jeton });
      if (!yer) throw new Error('yer yok');
      otelSec({ place_id: yer.place_id, ad: o.ana || yer.ad, lat: yer.lat, lng: yer.lng, puan: yer.puan });
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
      otelSec({ place_id: yer.place_id || null, ad: yer.ad || t('otel.adsiz'), lat: yer.lat, lng: yer.lng, puan: yer.puan });
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

  // #17 KK3: görünür alanda lodging ara; kaydırmada otomatik yenilenmez, düğmeyle.
  const bolgedeAra = async () => {
    const hedef: HaritaBolgesi = bolge ?? bolgeHesapla({ lat: sehir.lat, lng: sehir.lng }, 0.05, 0.05);
    setAdayNot(null);
    setAdayMesgul(true);
    try {
      const yerler = await yakinYerler({ cip: 'otel', merkez: { ...hedef.merkez, yaricapM: hedef.yaricapM }, enFazla: ADAY_SAYISI });
      setAdaylar(yerler);
      setAdayId(null);
      setAramaBolgesi(hedef);
      if (yerler.length === 0) setAdayNot(t('otel.bolgeBos'));
    } catch {
      setAdayNot(t('otel.bolgeHata'));
    } finally {
      setAdayMesgul(false);
    }
  };

  const bitir = async (secim: OtelSecimi | null) => {
    setHata(null);
    if (secimModu) {
      if (secim) haritaSeciminiTeslimEt({ place_id: secim.place_id, ad: secim.ad, lat: secim.lat, lng: secim.lng });
      router.back();
      return;
    }
    try {
      await kaydet.mutateAsync(secim ? { place_id: secim.place_id, ad: secim.ad, lat: secim.lat, lng: secim.lng } : null);
      router.replace({ pathname: '/seyahat/[id]', params: { id: trip } });
    } catch {
      setHata(t('otel.kaydetHata'));
    }
  };

  const listeAcik = !otel && !linkMi && sorgu.trim().length >= 2;
  const aday = adaylar.find((a) => a.place_id === adayId) ?? null;
  const uzaklasti = !!aramaBolgesi && !!bolge && bolgedenUzaklasti(bolge, aramaBolgesi);

  const pinler: HaritaPini[] = otel
    ? [{ id: 'otel', tur: 'otel', konum: { lat: otel.lat, lng: otel.lng }, renk: renk.metin, surukle: true }]
    : adaylar.map((a) => ({
        id: a.place_id,
        tur: 'aday',
        konum: { lat: a.lat, lng: a.lng },
        renk: renk.metin,
        etiket: a.ad,
        puan: a.puan,
        secili: a.place_id === adayId,
      }));

  return (
    <HaritaEkrani
      baslik={secimModu ? t('gunOteli.haritaBaslik') : t('otel.baslik')}
      geri={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      sagUst={<BilgiHapi metin={secimModu ? t('gunOteli.haritaAlt') : t('otel.alt', { sehir: sehir.city_label })} />}
      arama={
        <>
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
        </>
      }
      ustEk={
        <>
          {listeAcik ? (
            <View style={[s.liste, s.golge]}>
              {oneriler.isError ? <Text style={s.hata}>{t('otel.araHata')}</Text> : null}
              {oneriler.data?.length === 0 ? <Text style={s.bos}>{t('otel.sonucYok')}</Text> : null}
              {oneriler.data?.map((o, i) => (
                <Pressable
                  key={o.place_id}
                  accessibilityRole="button"
                  disabled={mesgul}
                  onPress={() => sec(o)}
                  style={({ pressed }) => [s.satir, i > 0 && s.satirAyrac, pressed && { opacity: 0.7 }]}>
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
          {!otel && !listeAcik && aramaBolgesi && (uzaklasti || adayMesgul) ? (
            <EylemHapi metin={t('otel.bolgedeAra')} onPress={bolgedeAra} yukleniyor={adayMesgul} />
          ) : null}
        </>
      }
      altNot={!otel && adaylar.length > 0 ? t('otel.atif') : undefined}
      altPanel={
        <>
          {otel ? (
            <View style={s.kartSatir}>
              <View style={s.kartMetinler}>
                <Text style={s.kartAd} numberOfLines={2}>
                  {otel.ad}
                </Text>
                <Text style={s.kartAlt} numberOfLines={2}>
                  {[puanMetni(otel.puan) ? `★ ${puanMetni(otel.puan)}` : null, t('otel.daire'), t('otel.surukleNot')].filter(Boolean).join(' · ')}
                </Text>
                <GoogleAtfi />
              </View>
            </View>
          ) : aday ? (
            <View style={s.kartSatir}>
              <View style={s.kartMetinler}>
                <Text style={s.kartAd} numberOfLines={2}>
                  {aday.ad}
                </Text>
                <Text style={s.kartAlt}>{puanMetni(aday.puan) ? `★ ${puanMetni(aday.puan)}` : t('otel.puanYok')}</Text>
              </View>
              <Buton
                baslik={t('otel.bunuSec')}
                onPress={() => otelSec({ place_id: aday.place_id, ad: aday.ad, lat: aday.lat, lng: aday.lng, puan: aday.puan })}
                stil={s.kucukButon}
              />
            </View>
          ) : aramaBolgesi && adaylar.length > 0 ? (
            <Text style={s.adayNot}>{t('otel.adaySayisi', { n: adaylar.length })}</Text>
          ) : (
            <Buton
              baslik={t('otel.bolgeOtelleri')}
              tur="ikincil"
              onPress={bolgedeAra}
              yukleniyor={adayMesgul}
              pasif={listeAcik}
              stil={s.bolgeButon}
            />
          )}
          {adayNot && !otel ? <Text style={s.hata}>{adayNot}</Text> : null}

          {!otel && !secimModu ? (
            <View style={s.yokKart}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.yokBaslik}>{t('otel.yokBaslik')}</Text>
                <Text style={s.yokAlt}>{t('otel.yokAlt')}</Text>
              </View>
              <Buton baslik={t('otel.atla')} tur="ikincil" onPress={() => bitir(null)} stil={s.atla} pasif={kaydet.isPending} />
            </View>
          ) : null}

          {hata ? <Text style={s.hata}>{hata}</Text> : null}
          <Buton baslik={secimModu ? t('gunOteli.bunuKullan') : t('otel.devam')} onPress={() => bitir(otel)} pasif={!otel} yukleniyor={kaydet.isPending} stil={s.devam} />
        </>
      }
      harita={{
        merkez: otel ? { lat: otel.lat, lng: otel.lng } : { lat: sehir.lat, lng: sehir.lng },
        zoom: otel ? 14 : 12,
        pinler,
        daireler: otel ? [{ id: 'yurume', merkez: { lat: otel.lat, lng: otel.lng }, yaricapM: YURUME_YARICAPI_M, renk: renk.metin }] : [],
        odak,
        onPinBas: (id) => {
          if (!otel) setAdayId(id);
        },
        onPinSuruklendi: (_, konum) => setOtel((o) => (o ? { ...o, lat: konum.lat, lng: konum.lng } : o)),
        onBolgeDegisti: setBolge,
      }}
    />
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  golge: {
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
  },
  buyutec: { fontSize: 18, color: renk.ikincil },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  linkDugme: { fontFamily: yazi.kalin, fontSize: 12, color: renk.vurgu, paddingVertical: 8 },
  liste: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 14, backgroundColor: renk.zemin },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: minDokunma },
  satirAyrac: { borderTopWidth: 1, borderTopColor: renk.ayrac },
  metinler: { flex: 1, gap: 2 },
  ana: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  ikincil: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  ok: { fontFamily: yazi.kalin, fontSize: 22, color: '#c4c4c4' },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  kartSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kartMetinler: { flex: 1, gap: 2 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  kucukButon: { height: 40, paddingHorizontal: 18 },
  bolgeButon: { height: 44 },
  adayNot: { fontFamily: yazi.yari, fontSize: 12, color: renk.ikincil, textAlign: 'center', paddingVertical: 6 },
  yokKart: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c4c4c4' },
  yokBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  yokAlt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  atla: { height: 32, paddingHorizontal: 18 },
  devam: { height: 50 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
