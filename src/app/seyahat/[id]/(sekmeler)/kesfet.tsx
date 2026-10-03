import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { bolgedenUzaklasti } from '@/components/harita/geo';
import { EylemHapi, HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaBolgesi, HaritaOdagi, HaritaPini } from '@/components/harita/tipler';
import { Avatar } from '@/components/ui/Avatar';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import { useMekanEkle, useMekanlar, useMekanSil, useUyeler } from '@/features/mekanlar/sorgular';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import {
  hafifYerler,
  linkCoz,
  linkGibiMi,
  ONERI_CIPLERI,
  useHafifYerler,
  useOneriler,
  useOnizleme,
  useYakinOneriler,
  yeniOturumJetonu,
  type HafifYer,
  type OneriCipi,
} from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import type { Mekan, Seyahat } from '@/lib/tipler';
import { bosluk, minDokunma, renk, yazi } from '@/theme';

// PRD 3.4 Keşfet: HaritaEkrani kabuğu (#17) — üstte şehir hapı + üyeler, arama, çipler; altta öneri kartları; en altta liste çubuğu.
export default function KesfetEkrani() {
  const id = useSeyahatId();
  const seyahat = useSeyahat(id);
  if (!seyahat.data || !id) return <SeyahatYukleme sorgular={[seyahat]} kimlikYok={!id} />;
  return <Kesfet key={id} seyahat={seyahat.data} />;
}

/** #29: önizleme kartındaki mekan — çip önerisinden, arama sonucundan ya da listedeki pinden. */
type Secim = { place_id: string; kaynak: 'oneri' | 'arama' | 'liste' };

function Kesfet({ seyahat }: { seyahat: Seyahat }) {
  const mekanlar = useMekanlar(seyahat.id);
  const uyeler = useUyeler(seyahat.id);
  const ekle = useMekanEkle(seyahat.id);
  const sil = useMekanSil(seyahat.id);

  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  const [cip, setCip] = useState<OneriCipi>('populer');
  const [aramaSonucu, setAramaSonucu] = useState<HafifYer | null>(null);
  const [secim, setSecim] = useState<Secim | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [odak, setOdak] = useState<HaritaOdagi | undefined>();
  const odakla = (lat: number, lng: number, zoom: number) => setOdak((o) => ({ konum: { lat, lng }, zoom, sayac: (o?.sayac ?? 0) + 1 }));

  // #28: öneriler görünür bölge için. İlk açılış şehir (ya da otel) merkezi; kaydırınca "Bu bölgede ara" ile elle yenilenir.
  const ilkMerkez = useMemo(
    () => ({ lat: seyahat.hotel_lat ?? seyahat.lat, lng: seyahat.hotel_lng ?? seyahat.lng }),
    [seyahat.hotel_lat, seyahat.hotel_lng, seyahat.lat, seyahat.lng],
  );
  const [bolge, setBolge] = useState<HaritaBolgesi | null>(null);
  const [aramaBolgesi, setAramaBolgesi] = useState<HaritaBolgesi>({ merkez: ilkMerkez, yaricapM: 3000, latDelta: 0.05, lngDelta: 0.05 });
  const uzaklasti = !!bolge && bolgedenUzaklasti(bolge, aramaBolgesi);
  const buBolgedeAra = () => {
    if (bolge) setAramaBolgesi(bolge);
  };
  const cipSec = (c: OneriCipi) => {
    setCip(c);
    setAramaSonucu(null);
    setSecim(null);
    // Çip değişince görünür alan için yeniden arar.
    if (bolge) setAramaBolgesi(bolge);
  };

  // KK2: Autocomplete görünür alan merkezine 15 km yanlı (#28).
  const aramaMerkezi = { lat: (bolge ?? aramaBolgesi).merkez.lat, lng: (bolge ?? aramaBolgesi).merkez.lng, yaricapM: 15_000 };
  const linkMi = linkGibiMi(sorgu);
  const aramaAcik = !linkMi && sorgu.trim().length >= 2 && !aramaSonucu;
  const oneriler = useOneriler('mekan-oneri', sorgu, jeton, undefined, aramaMerkezi, aramaAcik);
  const yakin = useYakinOneriler(cip, { lat: aramaBolgesi.merkez.lat, lng: aramaBolgesi.merkez.lng, yaricapM: aramaBolgesi.yaricapM });

  const havuz = mekanlar.data ?? [];
  // #30: listedeki pinlerin altında ad etiketi (canlı ad, PRD §7).
  const havuzAdlari = useHafifYerler(havuz.map((m) => m.place_id));
  const uyeAdi = (uid: string | null) => uyeler.data?.find((u) => u.user_id === uid)?.display_name ?? '';
  const oneriListesi: HafifYer[] = yakin.data ?? [];

  // #29: seçili mekanın kart verisi — önizleme (ilk fotoğrafla), yoksa elimizdeki hafif veri.
  const onizleme = useOnizleme(secim?.place_id);
  const seciliHafif: HafifYer | null = secim
    ? onizleme.data ??
      (aramaSonucu && aramaSonucu.place_id === secim.place_id ? aramaSonucu : null) ??
      oneriListesi.find((y) => y.place_id === secim.place_id) ??
      havuzAdlari.data?.[secim.place_id] ??
      null
    : null;
  const seciliMekan = secim ? havuz.find((m) => m.place_id === secim.place_id) : undefined;

  const pinler: HaritaPini[] = [
    ...(seyahat.hotel_lat !== null && seyahat.hotel_lng !== null
      ? [{ id: 'otel', konum: { lat: seyahat.hotel_lat, lng: seyahat.hotel_lng }, renk: renk.metin, tur: 'otel' as const }]
      : []),
    // KK5: havuzdaki mekan güne atanana kadar "?" (Program > Harita'da numaralanır).
    ...havuz.map((m) => ({
      id: `m:${m.place_id}`,
      konum: { lat: m.lat, lng: m.lng },
      renk: renk.metin,
      etiket: '?',
      ad: havuzAdlari.data?.[m.place_id]?.ad,
      tur: 'durak' as const,
      secili: secim?.place_id === m.place_id,
    })),
    ...[...(aramaSonucu ? [aramaSonucu] : []), ...oneriListesi]
      .filter((y, i, dizi) => !havuz.some((m) => m.place_id === y.place_id) && dizi.findIndex((x) => x.place_id === y.place_id) === i)
      .map((y) => ({ id: `o:${y.place_id}`, konum: { lat: y.lat, lng: y.lng }, renk: renk.metin, ad: y.ad, tur: 'oneri' as const, secili: secim?.place_id === y.place_id })),
  ];

  const sec = async (placeId: string, ad: string) => {
    setHata(null);
    setMesgul(true);
    try {
      const [yer] = await hafifYerler([placeId], { oturum: jeton });
      if (!yer) throw new Error('yer yok');
      setAramaSonucu({ ...yer, ad: yer.ad || ad });
      setSecim({ place_id: yer.place_id, kaynak: 'arama' });
      odakla(yer.lat, yer.lng, 16);
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
      const { yer, kaynak } = await linkCoz(sorgu.trim(), aramaMerkezi);
      // places.place_id boş olamaz: yalnız koordinat çözüldüyse eklenemez (PR #13 notu).
      if (kaynak === 'koordinat' || !yer.place_id) {
        odakla(yer.lat, yer.lng, 16);
        setHata(t('kesfet.koordinatMekan'));
        return;
      }
      setAramaSonucu(yer);
      setSecim({ place_id: yer.place_id, kaynak: 'arama' });
      odakla(yer.lat, yer.lng, 16);
      setSorgu(yer.ad);
    } catch (e) {
      setHata((e as Error).message === 'desteklenmeyen_link' ? t('kesfet.linkDesteksiz') : t('kesfet.linkHata'));
    } finally {
      setMesgul(false);
    }
  };

  const yaz = (metin: string) => {
    setSorgu(metin);
    if (aramaSonucu) {
      setAramaSonucu(null);
      setSecim(null);
    }
  };

  // #29 KK: kart'tan ekle; eklenince pin dolu/numaralı olur, düğme "Listede ✓ · Çıkar"a döner.
  const listeyeEkle = async (y: HafifYer) => {
    setHata(null);
    try {
      await ekle.mutateAsync({ place_id: y.place_id, primary_type: y.primary_type, lat: y.lat, lng: y.lng });
    } catch {
      setHata(t('kesfet.ekleHata'));
    }
  };
  const listedenCikar = async (m: Mekan) => {
    setHata(null);
    try {
      await sil.mutateAsync(m.id);
    } catch {
      setHata(t('kesfet.ekleHata'));
    }
  };

  // #29: pine dokunmak seçimdir (ekleme karttan). #32: harita kaymaz.
  const pinBas = (pinId: string) => {
    if (pinId === 'otel') return;
    const placeId = pinId.slice(2);
    setSecim({ place_id: placeId, kaynak: pinId.startsWith('m:') ? 'liste' : 'oneri' });
  };
  const detayAc = (placeId: string) => router.push({ pathname: '/seyahat/[id]/mekan/[placeId]', params: { id: seyahat.id, placeId } });

  const sonEkleyen = havuz.length > 0 ? havuz[havuz.length - 1] : null;
  const sonEkleyenSayi = sonEkleyen ? havuz.filter((m) => m.added_by === sonEkleyen.added_by).length : 0;

  return (
    <HaritaEkrani
      baslik={seyahat.city_label}
      geri={() => router.replace('/(tabs)')}
      sagUst={
        <View style={s.avatarlar}>
          {(uyeler.data ?? []).slice(0, 3).map((u, i) => (
            <View key={u.user_id} style={[s.avatarCerceve, i > 0 && { marginLeft: -8 }]}>
              <Avatar ad={u.display_name} boyut={24} arkaPlan={['#0f0f0f', '#ff5a1f', '#4c6ef5'][i % 3]} />
            </View>
          ))}
        </View>
      }
      arama={
        <>
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
        </>
      }
      ustEk={
        aramaAcik ? (
          <View style={[s.sonuclar, s.golge]}>
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
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.ciplerKaydirma}
              contentContainerStyle={s.cipler}
              keyboardShouldPersistTaps="handled">
              {ONERI_CIPLERI.map((c) => {
                const aktif = cip === c;
                return (
                  <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: aktif }} onPress={() => cipSec(c)} style={[s.cip, s.golge, aktif && s.cipAktif]}>
                    <Text style={[s.cipMetin, aktif && s.cipMetinAktif]}>{t(`kesfet.cip.${c}`)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {uzaklasti || yakin.isFetching ? <EylemHapi metin={t('kesfet.bolgedeAra')} onPress={buBolgedeAra} yukleniyor={yakin.isFetching} /> : null}
          </>
        )
      }
      altSerbest={
        <View style={s.alt} pointerEvents="box-none">
          {hata ? (
            <View style={s.hataKutu}>
              <Text style={s.hataMetin}>{hata}</Text>
            </View>
          ) : null}
          {yakin.isError ? (
            <View style={s.hataKutu}>
              <Text style={s.hataMetin}>{t('kesfet.oneriHata')}</Text>
            </View>
          ) : null}
          {!yakin.isError && !yakin.isFetching && oneriListesi.length === 0 && !aramaSonucu ? <Text style={s.bosOneri}>{t('kesfet.bolgeBos')}</Text> : null}

          {secim ? (
            <OnizlemeKarti
              yer={seciliHafif}
              yukleniyor={onizleme.isPending && !seciliHafif}
              mekan={seciliMekan}
              ekleyenAd={seciliMekan ? uyeAdi(seciliMekan.added_by) : ''}
              mesgul={ekle.isPending || sil.isPending}
              onEkle={() => seciliHafif && listeyeEkle(seciliHafif)}
              onCikar={() => seciliMekan && listedenCikar(seciliMekan)}
              onDetay={() => detayAc(secim.place_id)}
              onKapat={() => setSecim(null)}
            />
          ) : null}

          <View style={[s.cubuk, s.golge]}>
            <View style={{ flex: 1 }}>
              <Text style={s.cubukBaslik}>{havuz.length > 0 ? t('kesfet.listede', { n: havuz.length }) : t('kesfet.listedeBos')}</Text>
              {sonEkleyen && uyeAdi(sonEkleyen.added_by) ? (
                <Text style={s.cubukAlt}>{t('kesfet.sonEkleyen', { ad: uyeAdi(sonEkleyen.added_by), n: sonEkleyenSayi })}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: seyahat.id, gorunum: 'harita' } })}
              style={s.cubukDugme}>
              <Text style={s.cubukDugmeMetin}>{t('kesfet.gunlereDagit')} →</Text>
            </Pressable>
          </View>
        </View>
      }
      harita={{
        merkez: ilkMerkez,
        zoom: 13,
        pinler,
        odak,
        onPinBas: pinBas,
        onHaritaBas: () => setSecim(null),
        onBolgeDegisti: setBolge,
      }}
    />
  );
}

// #29: tek önizleme kartı — ad, kategori, ★ puan + yorum, açık/kapalı, varsayılan süre, 1 fotoğraf; "+ Listeye ekle" / "Listede ✓ · Çıkar" ve "Detay".
function OnizlemeKarti({
  yer,
  yukleniyor,
  mekan,
  ekleyenAd,
  mesgul,
  onEkle,
  onCikar,
  onDetay,
  onKapat,
}: {
  yer: HafifYer | null;
  yukleniyor: boolean;
  mekan: Mekan | undefined;
  ekleyenAd: string;
  mesgul: boolean;
  onEkle: () => void;
  onCikar: () => void;
  onDetay: () => void;
  onKapat: () => void;
}) {
  const dakika = mekan?.default_minutes ?? varsayilanDakika(yer?.primary_type);
  return (
    <View style={[s.kart, s.golge]}>
      <View style={s.kartUst}>
        {yer?.foto_uri ? <Image source={{ uri: yer.foto_uri }} style={s.kartFoto} contentFit="cover" /> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {yer ? (
            <>
              <Text style={s.kartAd} numberOfLines={2}>
                {yer.ad}
              </Text>
              <Text style={s.kartAlt} numberOfLines={1}>
                {kategoriEtiketi(yer.primary_type)} · {sureMetni(dakika)}
                {yer.puan !== null ? ` · ★ ${yer.puan.toLocaleString('tr-TR')}` : ''}
              </Text>
              <Text style={s.kartAlt} numberOfLines={1}>
                {yer.puan_sayisi !== null ? `${t('kesfet.yorum', { n: yer.puan_sayisi.toLocaleString('tr-TR') })} · ` : ''}
                {yer.acik === true ? `${t('kesfet.acik')} · ` : yer.acik === false ? `${t('kesfet.kapali')} · ` : ''}
                {t('yerler.atif')}
              </Text>
              {mekan && ekleyenAd ? (
                <View style={s.ekleyen}>
                  <Avatar ad={ekleyenAd} boyut={18} arkaPlan={renk.vurgu} />
                  <Text style={s.ekleyenMetin}>{t('kesfet.ekleyen', { ad: ekleyenAd })}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={s.kartAlt}>{yukleniyor ? '…' : t('kesfet.secimHata')}</Text>
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('genel.vazgec')} onPress={onKapat} hitSlop={8} style={s.kapat}>
          <Text style={s.kapatMetin}>×</Text>
        </Pressable>
      </View>
      <View style={s.kartDugmeler}>
        {mekan ? (
          <Pressable accessibilityRole="button" disabled={mesgul} onPress={onCikar} style={[s.kartDugme, s.kartDugmeGri]}>
            <Text style={s.kartDugmeMetin}>{t('kesfet.listedeCikar')}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" disabled={mesgul || !yer} onPress={onEkle} style={[s.kartDugme, s.kartDugmeSiyah, (mesgul || !yer) && { opacity: 0.5 }]}>
            <Text style={[s.kartDugmeMetin, { color: renk.zemin }]}>{t('kesfet.ekle')}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onDetay} style={[s.kartDugme, s.kartDugmeGri]}>
          <Text style={s.kartDugmeMetin}>{t('kesfet.detay')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.yuzey },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  avatarlar: { flexDirection: 'row' },
  avatarCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 14 },
  buyutec: { fontSize: 18, color: renk.ikincil },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 14, color: renk.metin, paddingVertical: 0 },
  linkDugme: { fontFamily: yazi.kalin, fontSize: 12, color: renk.vurgu, paddingVertical: 8 },
  sonuclar: { borderRadius: 14, backgroundColor: renk.zemin, paddingHorizontal: 14, paddingBottom: 6 },
  sonuc: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: renk.ayrac, gap: 2 },
  sonucAna: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  sonucAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 10 },
  ciplerKaydirma: { marginHorizontal: -bosluk.kenar },
  cipler: { gap: 8, paddingHorizontal: bosluk.kenar },
  cip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: renk.zemin },
  cipAktif: { backgroundColor: renk.metin },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cipMetinAktif: { color: renk.zemin },
  alt: { gap: 12, paddingBottom: 14 },
  bosOneri: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, textAlign: 'center', paddingHorizontal: bosluk.kenar },
  kart: { marginHorizontal: bosluk.kenar, padding: 14, borderRadius: 18, backgroundColor: renk.zemin, gap: 10 },
  kartUst: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kartFoto: { width: 72, height: 72, borderRadius: 12, backgroundColor: renk.yuzey },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 17, letterSpacing: -0.3, color: renk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  kapat: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  kapatMetin: { fontFamily: yazi.kalin, fontSize: 18, color: renk.ikincil },
  kartDugmeler: { flexDirection: 'row', gap: 8 },
  kartDugme: { height: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', minHeight: minDokunma },
  kartDugmeSiyah: { backgroundColor: renk.metin, flex: 1, alignItems: 'center' },
  kartDugmeGri: { backgroundColor: renk.yuzey, flex: 1, alignItems: 'center' },
  kartDugmeMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  ekleyen: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  ekleyenMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cubuk: { marginHorizontal: bosluk.kenar, height: 56, paddingLeft: 16, paddingRight: 6, borderRadius: 999, backgroundColor: renk.metin, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cubukBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  cubukAlt: { fontFamily: yazi.normal, fontSize: 11, color: '#a3a3a3' },
  cubukDugme: { height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  cubukDugmeMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  hataKutu: { marginHorizontal: bosluk.kenar, padding: 10, borderRadius: 12, backgroundColor: renk.uyariZemin },
  hataMetin: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center' },
});
