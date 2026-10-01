import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Harita } from '@/components/harita/Harita';
import type { HaritaPini } from '@/components/harita/tipler';
import { Avatar } from '@/components/ui/Avatar';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { useMekanEkle, useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import {
  hafifYerler,
  linkCoz,
  linkGibiMi,
  ONERI_CIPLERI,
  useOneriler,
  useYakinOneriler,
  yeniOturumJetonu,
  type HafifYer,
  type OneriCipi,
} from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import type { Mekan, Seyahat } from '@/lib/tipler';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

// PRD 3.4 Keşfet: tam ekran harita; üstte arama + çipler; altta öneri kartları; en altta liste çubuğu.
export default function KesfetEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seyahat = useSeyahat(id);
  if (!seyahat.data || !id) {
    return (
      <View style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.metin} />
      </View>
    );
  }
  return <Kesfet key={id} seyahat={seyahat.data} />;
}

type Kart = HafifYer & { eklendi?: Mekan };

function Kesfet({ seyahat }: { seyahat: Seyahat }) {
  const ust = useSafeAreaInsets().top;
  const mekanlar = useMekanlar(seyahat.id);
  const uyeler = useUyeler(seyahat.id);
  const ekle = useMekanEkle(seyahat.id);

  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [cip, setCip] = useState<OneriCipi | null>('populer');
  const [secili, setSecili] = useState<HafifYer | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [odak, setOdak] = useState<{ lat: number; lng: number; zoom: number; anahtar: string }>({
    lat: seyahat.hotel_lat ?? seyahat.lat,
    lng: seyahat.hotel_lng ?? seyahat.lng,
    zoom: 13,
    anahtar: 'ilk',
  });

  // KK2: Autocomplete şehir merkezine 15 km yanlı. KK4: çip önerileri otel ya da şehir merkezi çevresinde.
  const merkez = { lat: seyahat.lat, lng: seyahat.lng, yaricapM: 15_000 };
  const linkMi = linkGibiMi(sorgu);
  const aramaAcik = !linkMi && sorgu.trim().length >= 2;
  const oneriler = useOneriler('mekan-oneri', sorgu, jeton, undefined, merkez, aramaAcik);
  const yakin = useYakinOneriler(aramaAcik || secili ? null : cip, {
    lat: seyahat.hotel_lat ?? seyahat.lat,
    lng: seyahat.hotel_lng ?? seyahat.lng,
    yaricapM: 3000,
  });

  const havuz = mekanlar.data ?? [];
  const uyeAdi = (uid: string | null) => uyeler.data?.find((u) => u.user_id === uid)?.display_name ?? '';

  // Kartlar: seçili arama sonucu > çip önerileri. Listede olanlar işaretlenir (KK5).
  const kartlar: Kart[] = (secili ? [secili] : (yakin.data ?? [])).map((y) => ({
    ...y,
    eklendi: havuz.find((m) => m.place_id === y.place_id),
  }));

  const pinler: HaritaPini[] = [
    ...(seyahat.hotel_lat !== null && seyahat.hotel_lng !== null
      ? [{ id: 'otel', konum: { lat: seyahat.hotel_lat, lng: seyahat.hotel_lng }, renk: renk.metin, tur: 'otel' as const }]
      : []),
    // KK5: havuzdaki mekan güne atanana kadar "?" (3.5'te numaralanır).
    ...havuz.map((m) => ({ id: `m:${m.id}`, konum: { lat: m.lat, lng: m.lng }, renk: renk.metin, etiket: '?', tur: 'durak' as const })),
    ...kartlar
      .filter((k) => !k.eklendi)
      .map((k) => ({ id: `o:${k.place_id}`, konum: { lat: k.lat, lng: k.lng }, renk: renk.zemin, etiket: k.ad, tur: 'oneri' as const })),
  ];

  const sec = async (placeId: string, ad: string) => {
    setHata(null);
    setMesgul(true);
    try {
      const [yer] = await hafifYerler([placeId], { oturum: jeton });
      if (!yer) throw new Error('yer yok');
      setSecili({ ...yer, ad: yer.ad || ad });
      setOdak({ lat: yer.lat, lng: yer.lng, zoom: 16, anahtar: yer.place_id });
      setSorgu(yer.ad || ad);
      setJeton(yeniOturumJetonu());
    } catch {
      setHata(t('kesfet.secimHata'));
    } finally {
      setMesgul(false);
    }
  };

  const linkiCoz = async () => {
    setHata(null);
    setMesgul(true);
    try {
      const { yer, kaynak } = await linkCoz(sorgu.trim(), merkez);
      // places.place_id boş olamaz: yalnız koordinat çözüldüyse eklenemez (PR #13 notu).
      if (kaynak === 'koordinat' || !yer.place_id) {
        setOdak({ lat: yer.lat, lng: yer.lng, zoom: 16, anahtar: `k:${yer.lat},${yer.lng}` });
        setHata(t('kesfet.koordinatMekan'));
        return;
      }
      setSecili(yer);
      setOdak({ lat: yer.lat, lng: yer.lng, zoom: 16, anahtar: yer.place_id });
      setSorgu(yer.ad);
    } catch (e) {
      setHata((e as Error).message === 'desteklenmeyen_link' ? t('kesfet.linkDesteksiz') : t('kesfet.linkHata'));
    } finally {
      setMesgul(false);
    }
  };

  const yaz = (metin: string) => {
    setSorgu(metin);
    if (secili) setSecili(null);
  };

  const listeyeEkle = async (k: Kart) => {
    setHata(null);
    try {
      await ekle.mutateAsync({ place_id: k.place_id, primary_type: k.primary_type, lat: k.lat, lng: k.lng });
    } catch {
      setHata(t('kesfet.ekleHata'));
    }
  };

  const pinBas = (pinId: string) => {
    if (pinId.startsWith('m:')) {
      const m = havuz.find((x) => `m:${x.id}` === pinId);
      if (m) router.push({ pathname: '/seyahat/[id]/mekan/[placeId]', params: { id: seyahat.id, placeId: m.place_id } });
    } else if (pinId.startsWith('o:')) {
      const k = kartlar.find((x) => `o:${x.place_id}` === pinId);
      if (k) listeyeEkle(k);
    }
  };

  const sonEkleyen = havuz.length > 0 ? havuz[havuz.length - 1] : null;
  const sonEkleyenSayi = sonEkleyen ? havuz.filter((m) => m.added_by === sonEkleyen.added_by).length : 0;

  return (
    <View style={s.ekran}>
      <Harita
        key={odak.anahtar}
        merkez={{ lat: odak.lat, lng: odak.lng }}
        zoom={odak.zoom}
        pinler={pinler}
        onPinBas={pinBas}
      />

      {/* Üst katman: geri, üyeler, arama, çipler */}
      <View style={[s.ust, { paddingTop: ust + 8 }]} pointerEvents="box-none">
        <View style={s.ustSatir} pointerEvents="box-none">
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={s.geri}>
            <Text style={s.geriMetin}>‹ {seyahat.city_label}</Text>
          </Pressable>
          <View style={s.avatarlar}>
            {(uyeler.data ?? []).slice(0, 3).map((u, i) => (
              <View key={u.user_id} style={[s.avatarCerceve, i > 0 && { marginLeft: -8 }]}>
                <Avatar ad={u.display_name} boyut={24} arkaPlan={['#0f0f0f', '#ff5a1f', '#4c6ef5'][i % 3]} />
              </View>
            ))}
          </View>
        </View>

        <View style={s.arama}>
          <Text style={s.buyutec}>⌕</Text>
          <TextInput
            accessibilityLabel={t('kesfet.ara')}
            placeholder={t('kesfet.araYer')}
            placeholderTextColor={renk.soluk}
            value={sorgu}
            onChangeText={yaz}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType={linkMi ? 'go' : 'search'}
            onSubmitEditing={linkMi ? linkiCoz : undefined}
            style={s.girdi}
          />
          {mesgul || (aramaAcik && oneriler.isFetching) ? <ActivityIndicator color={renk.ikincil} /> : null}
          {linkMi && !mesgul ? (
            <Pressable accessibilityRole="button" onPress={linkiCoz} hitSlop={10}>
              <Text style={s.linkDugme}>{t('kesfet.linkCoz')}</Text>
            </Pressable>
          ) : null}
        </View>

        {aramaAcik && !secili ? (
          <View style={s.sonuclar}>
            {oneriler.isError ? <Text style={s.hataMetin}>{t('kesfet.araHata')}</Text> : null}
            {oneriler.data?.length === 0 ? <Text style={s.bos}>{t('kesfet.sonucYok')}</Text> : null}
            {oneriler.data?.map((o) => (
              <Pressable key={o.place_id} accessibilityRole="button" onPress={() => sec(o.place_id, o.ana)} style={s.sonuc}>
                <Text style={s.sonucAna} numberOfLines={1}>
                  {o.ana}
                </Text>
                <Text style={s.sonucAlt} numberOfLines={1}>
                  {o.ikincil}
                </Text>
              </Pressable>
            ))}
            {oneriler.data && oneriler.data.length > 0 ? <GoogleAtfi /> : null}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler} keyboardShouldPersistTaps="handled">
            {ONERI_CIPLERI.map((c) => {
              const aktif = cip === c && !secili;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityState={{ selected: aktif }}
                  onPress={() => {
                    setSecili(null);
                    setCip(c);
                  }}
                  style={[s.cip, aktif && s.cipAktif]}>
                  <Text style={[s.cipMetin, aktif && s.cipMetinAktif]}>{t(`kesfet.cip.${c}`)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Alt katman: kartlar + liste çubuğu */}
      <View style={s.alt} pointerEvents="box-none">
        {hata ? (
          <View style={s.hataKutu}>
            <Text style={s.hataMetin}>{hata}</Text>
          </View>
        ) : null}
        {yakin.isError && !secili ? (
          <View style={s.hataKutu}>
            <Text style={s.hataMetin}>{t('kesfet.oneriHata')}</Text>
          </View>
        ) : null}
        {kartlar.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kartlar} keyboardShouldPersistTaps="handled">
            {kartlar.map((k) => (
              <MekanKarti
                key={k.place_id}
                kart={k}
                ekleyenAd={k.eklendi ? uyeAdi(k.eklendi.added_by) : ''}
                mesgul={ekle.isPending}
                onEkle={() => listeyeEkle(k)}
                onAc={() =>
                  router.push({ pathname: '/seyahat/[id]/mekan/[placeId]', params: { id: seyahat.id, placeId: k.place_id } })
                }
              />
            ))}
          </ScrollView>
        ) : yakin.isFetching && !secili ? (
          <ActivityIndicator color={renk.metin} style={{ marginBottom: 12 }} />
        ) : null}

        <View style={s.cubuk}>
          <View style={{ flex: 1 }}>
            <Text style={s.cubukBaslik}>{havuz.length > 0 ? t('kesfet.listede', { n: havuz.length }) : t('kesfet.listedeBos')}</Text>
            {sonEkleyen && uyeAdi(sonEkleyen.added_by) ? (
              <Text style={s.cubukAlt}>{t('kesfet.sonEkleyen', { ad: uyeAdi(sonEkleyen.added_by), n: sonEkleyenSayi })}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/seyahat/[id]/(sekmeler)/gunler', params: { id: seyahat.id } })}
            style={s.cubukDugme}>
            <Text style={s.cubukDugmeMetin}>{t('kesfet.gunlereDagit')} →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// PRD 3.4 KK6: ad, kategori, varsayılan süre, puan, yorum sayısı, açık/kapalı, Google atfı; KK7 ekleyenin baş harfi.
function MekanKarti({
  kart,
  ekleyenAd,
  mesgul,
  onEkle,
  onAc,
}: {
  kart: Kart;
  ekleyenAd: string;
  mesgul: boolean;
  onEkle: () => void;
  onAc: () => void;
}) {
  const dakika = kart.eklendi?.default_minutes ?? varsayilanDakika(kart.primary_type);
  return (
    <Pressable accessibilityRole="button" onPress={onAc} style={s.kart}>
      <View style={s.kartUst}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.kartAd} numberOfLines={1}>
            {kart.ad}
          </Text>
          <Text style={s.kartAlt} numberOfLines={1}>
            {kategoriEtiketi(kart.primary_type)} · {sureMetni(dakika)}
            {kart.puan !== null ? ` · ★ ${kart.puan.toLocaleString('tr-TR')}` : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={kart.eklendi ? t('kesfet.eklendi') : t('kesfet.ekle')}
          disabled={!!kart.eklendi || mesgul}
          onPress={onEkle}
          style={[s.arti, kart.eklendi && s.artiEklendi]}>
          <Text style={[s.artiMetin, kart.eklendi && { color: renk.zemin }]}>{kart.eklendi ? '✓' : '+'}</Text>
        </Pressable>
      </View>
      <View style={s.kartAltSatir}>
        {kart.eklendi && ekleyenAd ? (
          <View style={s.ekleyen}>
            <Avatar ad={ekleyenAd} boyut={20} arkaPlan={renk.vurgu} />
            <Text style={s.ekleyenMetin}>{t('kesfet.ekleyen', { ad: ekleyenAd })}</Text>
          </View>
        ) : (
          <Text style={s.kartAlt} numberOfLines={1}>
            {kart.puan_sayisi !== null ? `${t('kesfet.yorum', { n: kart.puan_sayisi.toLocaleString('tr-TR') })} · ` : ''}
            {kart.acik === true ? t('kesfet.acik') : kart.acik === false ? t('kesfet.kapali') : ''}
            {kart.acik !== null ? ' · ' : ''}
            {t('yerler.atif')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.yuzey },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  ust: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: bosluk.kenar, gap: 10 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  geri: { height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center', minWidth: minDokunma },
  geriMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  avatarlar: { flexDirection: 'row' },
  avatarCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 14 },
  arama: { height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 10 },
  buyutec: { fontSize: 18, color: renk.ikincil },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  linkDugme: { fontFamily: yazi.kalin, fontSize: 12, color: renk.vurgu, paddingVertical: 8 },
  sonuclar: { borderRadius: 14, backgroundColor: renk.zemin, paddingHorizontal: 14, paddingBottom: 6 },
  sonuc: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: renk.ayrac, gap: 2 },
  sonucAna: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  sonucAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 10 },
  cipler: { gap: 8, paddingRight: bosluk.kenar },
  cip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: renk.zemin },
  cipAktif: { backgroundColor: renk.metin },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cipMetinAktif: { color: renk.zemin },
  alt: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 12, paddingBottom: 14 },
  kartlar: { paddingHorizontal: bosluk.kenar, gap: 12 },
  kart: { width: 246, padding: 14, borderRadius: 18, backgroundColor: renk.zemin, gap: 8 },
  kartUst: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 17, letterSpacing: -0.3, color: renk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  kartAltSatir: { minHeight: 20, justifyContent: 'center' },
  arti: { width: 40, height: 40, borderRadius: 20, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  artiEklendi: { backgroundColor: renk.metin },
  artiMetin: { fontFamily: yazi.ekstra, fontSize: 20, lineHeight: 22, color: renk.metin },
  ekleyen: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ekleyenMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cubuk: { marginHorizontal: bosluk.kenar, height: 56, paddingLeft: 16, paddingRight: 6, borderRadius: 999, backgroundColor: renk.metin, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cubukBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  cubukAlt: { fontFamily: yazi.normal, fontSize: 11, color: '#a3a3a3' },
  cubukDugme: { height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  cubukDugmeMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  hataKutu: { marginHorizontal: bosluk.kenar, padding: 10, borderRadius: 12, backgroundColor: renk.uyariZemin },
  hataMetin: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center' },
});
