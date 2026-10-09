import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { bolgedenUzaklasti, bolgeHesapla, zoomDelta } from '@/components/harita/geo';
import { medyan, secimSuresiKaydet, taniSayaclari, useTani } from '@/components/harita/tani';
import { EylemHapi, HaritaEkrani } from '@/components/harita/HaritaEkrani';
import type { HaritaBolgesi, HaritaOdagi, HaritaPini } from '@/components/harita/tipler';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { GoogleAtfi } from '@/components/yerler/GoogleAtfi';
import type { Konaklama } from '@/features/konaklama/plan';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { useMekanEkle, useMekanGuncelle, useMekanlar, useMekanSil, useUyeler } from '@/features/mekanlar/sorgular';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { FiltreSayfasi } from '@/components/kesfet/FiltreSayfasi';
import { hafifYerler, linkCoz, linkGibiMi, useHafifYerler, useOneriler, yeniOturumJetonu, type HafifYer, type OneriCipi } from '@/features/yerler/api';
import { aktifFiltreSayisi, filtreAktif, filtredenGecer, filtreOzeti } from '@/features/yerler/filtre';
import { useOneCikanlar } from '@/features/yerler/oneCikan';
import { gorunurOneriler } from '@/features/yerler/karolar';
import { useKaroOnerileri } from '@/features/yerler/karoYukleme';
import { kesfetDurumunuAl, useKesfetDurumu } from '@/features/yerler/kesfetDurumu';
import { t } from '@/i18n';
import { kategoriPini } from '@/lib/pinIkonu';
import { varsayilanDakika } from '@/lib/kategori';
import type { Mekan, Seyahat } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

// PRD 3.4 Keşfet: HaritaEkrani kabuğu (#17) — üstte şehir hapı + üyeler, arama, çipler; altta öneri kartları; en altta liste çubuğu.
export default function KesfetEkrani() {
  const id = useSeyahatId();
  // #80 KK12: eski `mekan/[placeId]` derin linki buraya `mekan` parametresiyle yönlenir → panel açılır.
  const { mekan } = useLocalSearchParams<{ mekan?: string | string[] }>();
  const seyahat = useSeyahat(id);
  const konaklamalar = useKonaklamalar(id);
  if (!seyahat.data || !konaklamalar.data || !id) return <SeyahatYukleme sorgular={[seyahat, konaklamalar]} kimlikYok={!id} />;
  return <Kesfet key={id} seyahat={seyahat.data} konaklamalar={konaklamalar.data} ilkMekan={Array.isArray(mekan) ? mekan[0] : mekan} />;
}

const ILK_ZOOM = 13;
const ILK_BOLGE_BEKLEME_MS = 2000;

function Kesfet({ seyahat, konaklamalar, ilkMekan }: { seyahat: Seyahat; konaklamalar: Konaklama[]; ilkMekan?: string }) {
  const mekanlar = useMekanlar(seyahat.id);
  const uyeler = useUyeler(seyahat.id);
  const ekle = useMekanEkle(seyahat.id);
  const sil = useMekanSil(seyahat.id);
  const guncelle = useMekanGuncelle(seyahat.id);

  const [sorgu, setSorgu] = useState('');
  const [jeton, setJeton] = useState(yeniOturumJetonu);
  // #69: filtre durumu — hızlı filtreler ve filtre sayfası aynı durumu paylaşır (KK9). #79 KK2: filtre, seçim ve son bölge
  // seyahat belleğinde (kesfetDurumu): ekran yeniden kurulsa da aynı filtreyle süzülür, aynı bölgeden açılır.
  const [filtre, setFiltre] = useKesfetDurumu(seyahat.id, 'filtre');
  const [filtreAcik, setFiltreAcik] = useState(false);
  // #71: tanı şeridi — filtre düğmesine uzun basınca açılır/kapanır (cihazda logcat olmadan sayaçlar).
  const [taniAcik, setTaniAcik] = useState(__DEV__);
  const tani = useTani(taniAcik);
  // #79 KK5: ekranın kuruluş sayısı tanı şeridinde (1'den fazlaysa ekran yeniden mount olmuş demektir).
  useEffect(() => {
    taniSayaclari.kesfetKurulum += 1;
  }, []);
  const [aramaSonucu, setAramaSonucu] = useState<HafifYer | null>(null);
  const [secim, setSecim] = useKesfetDurumu(seyahat.id, 'secim');
  // #80 KK12: derin linkle gelen mekan panelde açılır (bir kez).
  useEffect(() => {
    if (ilkMekan) setSecim({ place_id: ilkMekan, kaynak: 'oneri' });
  }, [ilkMekan, setSecim]);
  // #80 KK7: listede olmayan mekan için "Kalınacak süre" ayarı oturumda tutulur; listeye eklenince yazılır.
  const [sureAyari, setSureAyari] = useState<Record<string, number>>({});
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [odak, setOdak] = useState<HaritaOdagi | undefined>();
  const odakla = (lat: number, lng: number, zoom: number) => setOdak((o) => ({ konum: { lat, lng }, zoom, sayac: (o?.sayac ?? 0) + 1 }));

  // #66: öneriler görünür alanın karolarından otomatik yüklenir (kaydırma bitince 400 ms) ve çip başına birikir;
  // "Bu bölgede ara" yok. İlk açılış şehir (ya da otel) merkezi, zoom 13. #56: otel gün bazında (stays); ilk eklenen otel merkez.
  const ilkOtel = konaklamalar[0];
  const ilkMerkez = useMemo(
    () => ({
      lat: ilkOtel?.lat ?? seyahat.lat,
      lng: ilkOtel?.lng ?? seyahat.lng,
    }),
    [ilkOtel?.lat, ilkOtel?.lng, seyahat.lat, seyahat.lng],
  );
  const ilkBolge = useMemo(() => bolgeHesapla(ilkMerkez, zoomDelta(ILK_ZOOM), zoomDelta(ILK_ZOOM)), [ilkMerkez]);
  const [bolge, setBolge] = useKesfetDurumu(seyahat.id, 'bolge');
  // #79 KK1: ekran yeniden kurulduysa harita son görünür bölgeden açılır (kamera aynı kalır); ilk açılışta şehir / otel merkezi.
  const [baslangicBolge] = useState<HaritaBolgesi | null>(() => kesfetDurumunuAl(seyahat.id).bolge);
  // İlk tur gerçek görünür bölgeyi bekler (kare `ilkBolge` ile çift yükleme olmasın, #68 incelemesi); harita 2 sn içinde
  // bölge bildirmezse yedek olarak ilkBolge kullanılır.
  const [ilkBolgeYedek, setIlkBolgeYedek] = useState(false);
  useEffect(() => {
    const z = setTimeout(() => setIlkBolgeYedek(true), ILK_BOLGE_BEKLEME_MS);
    return () => clearTimeout(z);
  }, []);

  // KK2: Autocomplete görünür alan merkezine 15 km yanlı (#28).
  const aramaMerkezi = {
    lat: (bolge ?? ilkBolge).merkez.lat,
    lng: (bolge ?? ilkBolge).merkez.lng,
    yaricapM: 15_000,
  };
  const linkMi = linkGibiMi(sorgu);
  const aramaAcik = !linkMi && sorgu.trim().length >= 2 && !aramaSonucu;
  const oneriler = useOneriler('mekan-oneri', sorgu, jeton, undefined, aramaMerkezi, aramaAcik);
  // #71 ürün kararı: açılışta tek tur; sonra yalnız "Bu bölgeyi tara" ile (filtre değişimi istek atmaz). #69 KK10: tarama o anki
  // filtreye göre `hepsi` + seçili kategori kümeleri (4+ kategori seçiliyse yalnız `hepsi`).
  const kumeler = useMemo<OneriCipi[]>(() => ['hepsi', ...(filtre.kategoriler.length < 4 ? filtre.kategoriler : [])], [filtre.kategoriler]);
  const yakin = useKaroOnerileri(seyahat.id, bolge ?? (ilkBolgeYedek ? ilkBolge : null));
  // Görünür bölge son taranandan belirgin uzaklaştıysa (bolgedenUzaklasti) düğme çıkar.
  const uzaklasti = !!bolge && !!yakin.sonTaranan && bolgedenUzaklasti(bolge, yakin.sonTaranan);
  const bolgeyiTara = () => {
    if (bolge) yakin.tara(bolge, kumeler);
  };

  const havuz = useMemo(() => mekanlar.data ?? [], [mekanlar.data]);
  // #30: listedeki pinlerin altında ad etiketi (canlı ad, PRD §7).
  const havuzAdlari = useHafifYerler(havuz.map((m) => m.place_id));
  const uyeAdi = (uid: string | null) => uyeler.data?.find((u) => u.user_id === uid)?.display_name ?? '';
  const oneriListesi: HafifYer[] = yakin.yerler;
  const havuzIdleri = useMemo(() => new Set(havuz.map((m) => m.place_id)), [havuz]);
  // #69 §A: öne çıkanlar — şehrin yüklenmiş mekanları arasında en üst %10; liste büyüdükçe en fazla 10 sn'de bir yeniden hesap.
  const oneCikan = useOneCikanlar(oneriListesi);
  // #69 KK5: filtre açıkken eşleşmeyen öneri pinleri gizlenir; listedekiler ve seçili pin her zaman görünür.
  const filtreli = filtreAktif(filtre);
  const gecenler = useMemo(() => (filtreli ? oneriListesi.filter((y) => filtredenGecer(y, filtre, oneCikan)) : oneriListesi), [oneriListesi, filtreli, filtre, oneCikan]);

  // #80: panel başlığı için eldeki hafif veri (ad, puan, kategori); tam veriyi panel kendisi çeker (places-full).
  const seciliHafif: HafifYer | null = secim
    ? ((aramaSonucu && aramaSonucu.place_id === secim.place_id ? aramaSonucu : null) ??
      oneriListesi.find((y) => y.place_id === secim.place_id) ??
      havuzAdlari.data?.[secim.place_id] ??
      null)
    : null;
  const seciliMekan = secim ? havuz.find((m) => m.place_id === secim.place_id) : undefined;
  const seciliDakika = secim ? (seciliMekan?.default_minutes ?? sureAyari[secim.place_id] ?? varsayilanDakika(seciliHafif?.primary_type)) : 0;
  const sureDegistir = (fark: number) => {
    if (!secim) return;
    const yeni = Math.min(480, Math.max(15, seciliDakika + fark));
    if (yeni === seciliDakika) return;
    if (seciliMekan) guncelle.mutateAsync({ id: seciliMekan.id, default_minutes: yeni }).catch(() => setHata(t('kesfet.ekleHata')));
    else setSureAyari((a) => ({ ...a, [secim.place_id]: yeni }));
  };

  // #53: öneri = beyaz daire, kategori renginde kenar + ikon (primaryType). #66 KK6: en fazla 250 öneri pini çizilir
  // (aşılırsa görünür alan dışındakiler; listede kalırlar). #68 🔴2: liste oturum boyu büyür — tek geçişte Set ile ayıklanır,
  // yalnız girdileri değişince yeniden kurulur.
  // #69 KK5: filtre açıkken yalnız geçenler + seçili pin; gizli sayısı listedekileri ve seçili pini saymaz.
  const seciliOneri = secim && filtreli ? oneriListesi.find((y) => y.place_id === secim.place_id) : undefined;
  const oneriPinleri = useMemo((): HaritaPini[] => {
    const gorulen = new Set(havuzIdleri);
    const adaylar: HafifYer[] = [];
    for (const y of [...(aramaSonucu ? [aramaSonucu] : []), ...gecenler, ...(seciliOneri ? [seciliOneri] : [])]) {
      if (gorulen.has(y.place_id)) continue;
      gorulen.add(y.place_id);
      adaylar.push(y);
    }
    return gorunurOneriler(adaylar, bolge).map((y) => ({
      id: `o:${y.place_id}`,
      konum: { lat: y.lat, lng: y.lng },
      renk: renk.metin,
      ad: y.ad,
      ...kategoriPini(y.primary_type),
      puan: y.puan,
      yorumSayisi: y.puan_sayisi,
      tur: 'oneri' as const,
      oneCikan: oneCikan.has(y.place_id),
    }));
  }, [gecenler, seciliOneri, havuzIdleri, aramaSonucu, bolge, oneCikan]);
  // #75: seçim pin listesinden ayrı (Harita `seciliId`): seçim değişince liste ve çakışma hesabı yeniden kurulmaz.
  const seciliId = secim ? (havuzIdleri.has(secim.place_id) ? `m:${secim.place_id}` : `o:${secim.place_id}`) : null;
  // #75: dokunuş → kart (#80: panel) süresi — panel `secim` ile aynı render'da; commit sonrası ölçülür.
  useEffect(() => {
    if (secim) secimSuresiKaydet('kart');
  }, [secim]);
  const gizliSayi = useMemo(() => {
    if (!filtreli) return 0;
    const gecen = new Set(gecenler.map((y) => y.place_id));
    return oneriListesi.filter((y) => !havuzIdleri.has(y.place_id) && !gecen.has(y.place_id) && y.place_id !== secim?.place_id).length;
  }, [filtreli, oneriListesi, gecenler, havuzIdleri, secim?.place_id]);

  const pinler: HaritaPini[] = [
    ...konaklamalar.map((k) => ({
      id: `otel:${k.id}`,
      konum: { lat: k.lat, lng: k.lng },
      renk: renk.metin,
      tur: 'otel' as const,
    })),
    // #61 §4: listeye eklenen = kategori renginde dolu daire + beyaz kategori ikonu; altında ad (öncelikli), yakınken ★ puan · yorum.
    ...havuz.map((m) => ({
      id: `m:${m.place_id}`,
      konum: { lat: m.lat, lng: m.lng },
      renk: renk.metin,
      ...kategoriPini(m.primary_type),
      ad: havuzAdlari.data?.[m.place_id]?.ad,
      puan: havuzAdlari.data?.[m.place_id]?.puan ?? null,
      yorumSayisi: havuzAdlari.data?.[m.place_id]?.puan_sayisi ?? null,
      tur: 'listede' as const,
      oneCikan: oneCikan.has(m.place_id),
    })),
    ...oneriPinleri,
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

  // #29 KK / #80 KK3: panelden ekle; eklenince pin dolu olur, düğme "Listeden çıkar"a döner. Oturumda ayarlanan süre yazılır.
  const listeyeEkle = async (y: HafifYer) => {
    setHata(null);
    try {
      await ekle.mutateAsync({
        place_id: y.place_id,
        primary_type: y.primary_type,
        lat: y.lat,
        lng: y.lng,
        default_minutes: sureAyari[y.place_id],
      });
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
    if (pinId.startsWith('otel:')) return;
    const placeId = pinId.slice(2);
    setSecim({
      place_id: placeId,
      kaynak: pinId.startsWith('m:') ? 'liste' : 'oneri',
    });
  };
  // #80 KK3: Yol tarifi — Google Maps derin linki (yürüyüş).
  const yolTarifi = () => {
    const y = seciliHafif ?? seciliMekan;
    if (!y || !secim) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${y.lat},${y.lng}&destination_place_id=${encodeURIComponent(secim.place_id)}&travelmode=walking`);
  };

  const sonEkleyen = havuz.length > 0 ? havuz[havuz.length - 1] : null;
  const sonEkleyenSayi = sonEkleyen ? havuz.filter((m) => m.added_by === sonEkleyen.added_by).length : 0;

  return (
    <HaritaEkrani
      baslik={seyahat.city_label}
      geri={() => router.replace('/(tabs)')}
      sagUst={
        // #45: Grup'a erişim avatarlardan (seyahat içi alt menü kalktı).
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('seyahat.grup.baslik')}
          hitSlop={8}
          onPress={() =>
            router.navigate({
              pathname: '/seyahat/[id]/(sekmeler)/grup',
              params: { id: seyahat.id },
            })
          }
          style={s.avatarlar}
        >
          {(uyeler.data ?? []).slice(0, 3).map((u, i) => (
            <View key={u.user_id} style={[s.avatarCerceve, i > 0 && { marginLeft: -8 }]}>
              <Avatar ad={u.display_name} boyut={24} arkaPlan={['#0f0f0f', '#ff5a1f', '#4c6ef5'][i % 3]} />
            </View>
          ))}
        </Pressable>
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
      aramaSag={
        // #69 §C: 46 px filtre düğmesi; aktif filtre varsa siyah + sağ üstte turuncu sayı rozeti.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('kesfet.filtre.ac')}
          onPress={() => setFiltreAcik(true)}
          onLongPress={() => setTaniAcik((a) => !a)}
          style={({ pressed }) => [s.filtreDugme, s.golge, filtreli && s.filtreDugmeAktif, pressed && { opacity: 0.85 }]}>
          <Ikon ad="filtre" boyut={18} renk={filtreli ? renk.zemin : renk.metin} kalinlik={2.2} />
          {filtreli ? (
            <View style={s.filtreRozet}>
              <Text style={s.filtreRozetMetin}>{aktifFiltreSayisi(filtre)}</Text>
            </View>
          ) : null}
        </Pressable>
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
            {/* #69 §B: hızlı filtreler — ★ Öne çıkanlar · 4,5+ ★ · 5K+ yorum; açılır/kapanır (siyah + ×), birlikte VE. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.ciplerKaydirma} contentContainerStyle={s.cipler} keyboardShouldPersistTaps="handled">
              <HizliFiltre aktif={filtre.oneCikan} onPress={() => setFiltre({ ...filtre, oneCikan: !filtre.oneCikan })} yildiz>
                {t('kesfet.filtre.oneCikanlar')}
              </HizliFiltre>
              <HizliFiltre aktif={filtre.puan === 4.5} onPress={() => setFiltre({ ...filtre, puan: filtre.puan === 4.5 ? 0 : 4.5 })}>
                {t('kesfet.filtre.hizliPuan')}
              </HizliFiltre>
              <HizliFiltre aktif={filtre.yorum === 5000} onPress={() => setFiltre({ ...filtre, yorum: filtre.yorum === 5000 ? 0 : 5000 })}>
                {t('kesfet.filtre.hizliYorum')}
              </HizliFiltre>
            </ScrollView>
            {filtreli ? (
              // #69 KK5: filtre açıkken "Şehrin öne çıkanları · 9 mekan gizli" hapı (dokunulmaz).
              <View style={s.yukleniyorSatir} pointerEvents="none">
                <View style={[s.filtreOzet, s.golge]}>
                  <Text style={s.filtreOzetMetin}>{filtreOzeti(filtre, gizliSayi)}</Text>
                </View>
              </View>
            ) : null}
            {/* #71: "Bu bölgeyi tara" — son taranandan uzaklaşınca; basılınca düğmenin yerinde yükleme, tur bitince kaybolur.
                #79 KK4: filtre hapı varsa düğme onun ALTINA iner (çakışmaz). */}
            {uzaklasti || yakin.yukleniyor ? <EylemHapi metin={t('kesfet.bolgeyiTara')} onPress={bolgeyiTara} yukleniyor={yakin.yukleniyor} /> : null}
          </>
        )
      }
      altSerbest={
        <View style={s.alt} pointerEvents="box-none">
          {tani ? (
            <View style={s.tani} pointerEvents="none">
              <Text style={s.taniMetin}>
                {`tur ${tani.tur} · istek ${tani.istek} · hata ${tani.hata} · bölge ${tani.bolgeOlayi} · yükleniyor ${yakin.yukleniyor ? 'E' : 'H'}\nişaretçi ${tani.gorunen} (png ${tani.png} · ad ${tani.ad} · görünüm ${tani.gorunum}) · render ${tani.render}\ndokunma ${tani.dokunma}${tani.sonDokunma ? ` · son ${tani.sonDokunma.slice(0, 28)}` : ''} · liste ${oneriListesi.length} · gizli ${gizliSayi}\nseçim: iğne ${tani.igneMs.at(-1) ?? '–'} ms · kart ${tani.kartMs.at(-1) ?? '–'} ms · medyan(10) iğne ${medyan(tani.igneMs)} / kart ${medyan(tani.kartMs)} · değişen işaretçi ${tani.sonDegisim}\nkuruluş: keşfet ${tani.kesfetKurulum} · harita hazır ${tani.haritaHazir} · yeniden ${tani.haritaYenidenKurulum}`}
              </Text>
            </View>
          ) : null}
          <FiltreSayfasi acik={filtreAcik} filtre={filtre} onFiltre={setFiltre} sayi={gecenler.length} onKapat={() => setFiltreAcik(false)} />
          {hata ? (
            <View style={s.hataKutu}>
              <Text style={s.hataMetin}>{hata}</Text>
            </View>
          ) : null}
          {yakin.hata ? (
            <View style={s.hataKutu}>
              <Text style={s.hataMetin}>{t('kesfet.oneriHata')}</Text>
            </View>
          ) : null}
          {!yakin.hata && !yakin.yukleniyor && oneriListesi.length === 0 && !aramaSonucu ? <Text style={s.bosOneri}>{t('kesfet.bolgeBos')}</Text> : null}

          <View style={[s.cubuk, s.golge]}>
            <View style={{ flex: 1 }}>
              <Text style={s.cubukBaslik}>{havuz.length > 0 ? t('kesfet.listede', { n: havuz.length }) : t('kesfet.listedeBos')}</Text>
              {sonEkleyen && uyeAdi(sonEkleyen.added_by) ? (
                <Text style={s.cubukAlt}>
                  {t('kesfet.sonEkleyen', {
                    ad: uyeAdi(sonEkleyen.added_by),
                    n: sonEkleyenSayi,
                  })}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.navigate({
                  pathname: '/seyahat/[id]/(sekmeler)/program',
                  params: { id: seyahat.id },
                })
              }
              style={s.cubukDugme}
            >
              <Text style={s.cubukDugmeMetin}>{t('kesfet.gunlereDagit')} →</Text>
            </Pressable>
          </View>
        </View>
      }
      // #80: mekan paneli en üst katmanda; harita dolgusu değişmez (kamera yerinde). Pin değişince içerik değişir, panel kalır.
      ustKatman={
        secim ? (
          <MekanPaneli
            placeId={secim.place_id}
            tz={seyahat.tz}
            hafif={seciliHafif}
            oneCikan={oneCikan.has(secim.place_id)}
            ekleyenAd={seciliMekan ? uyeAdi(seciliMekan.added_by) : undefined}
            dakika={seciliDakika}
            onSure={sureDegistir}
            baglam="kesfet"
            icinde={!!seciliMekan}
            mesgul={ekle.isPending || sil.isPending}
            onCta={() => (seciliMekan ? listedenCikar(seciliMekan) : seciliHafif && listeyeEkle(seciliHafif))}
            onYolTarifi={yolTarifi}
            onKapat={() => setSecim(null)}
          />
        ) : null
      }
      harita={{
        merkez: ilkMerkez,
        zoom: ILK_ZOOM,
        pinler,
        odak,
        onPinBas: pinBas,
        onHaritaBas: () => setSecim(null),
        onBolgeDegisti: setBolge,
        seciliId,
        ilkBolge: baslangicBolge,
      }}
    />
  );
}

/** #69 §B: hızlı filtre çipi — 32 px beyaz hap, gölgeli; açıkken siyah + "×". */
function HizliFiltre({ aktif, onPress, yildiz, children }: { aktif: boolean; onPress: () => void; yildiz?: boolean; children: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: aktif }} onPress={onPress} style={[s.cip, s.golge, aktif && s.cipAktif]}>
      {yildiz ? <Ikon ad="yildiz" boyut={11} renk={aktif ? renk.zemin : renk.vurgu} /> : null}
      <Text style={[s.cipMetin, aktif && s.cipMetinAktif]}>{children}</Text>
      {aktif ? <Text style={[s.cipMetin, s.cipKapat]}>×</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.yuzey },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  golge: {
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarlar: { flexDirection: 'row' },
  avatarCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 14 },
  buyutec: { fontSize: 18, color: renk.ikincil },
  girdi: {
    flex: 1,
    fontFamily: yazi.yari,
    fontSize: 14,
    color: renk.metin,
    paddingVertical: 0,
  },
  linkDugme: {
    fontFamily: yazi.kalin,
    fontSize: 12,
    color: renk.vurgu,
    paddingVertical: 8,
  },
  sonuclar: {
    borderRadius: 14,
    backgroundColor: renk.zemin,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  sonuc: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: renk.ayrac,
    gap: 2,
  },
  sonucAna: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  sonucAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bos: {
    fontFamily: yazi.normal,
    fontSize: 13,
    color: renk.ikincil,
    paddingVertical: 10,
  },
  yukleniyorSatir: { alignItems: 'center', gap: 6 },
  ciplerKaydirma: { marginHorizontal: -bosluk.kenar },
  cipler: { gap: 8, paddingHorizontal: bosluk.kenar },
  cip: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cipAktif: { backgroundColor: renk.metin },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  cipKapat: { color: renk.zemin, opacity: 0.7, marginLeft: 4 },
  filtreDugme: { width: 46, height: 46, borderRadius: 14, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  filtreDugmeAktif: { backgroundColor: renk.metin },
  filtreRozet: { position: 'absolute', right: -2, top: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: renk.vurgu, borderWidth: 1.5, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  filtreRozetMetin: { fontFamily: yazi.ekstra, fontSize: 10, lineHeight: 12, color: renk.zemin },
  filtreOzet: { height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  filtreOzetMetin: { fontFamily: yazi.kalin, fontSize: 11, color: '#4a4a4a' },
  cipMetinAktif: { color: renk.zemin },
  alt: { gap: 12, paddingBottom: 14 },
  bosOneri: {
    fontFamily: yazi.normal,
    fontSize: 12,
    color: renk.ikincil,
    textAlign: 'center',
    paddingHorizontal: bosluk.kenar,
  },
  cubuk: {
    marginHorizontal: bosluk.kenar,
    height: 56,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: renk.metin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cubukBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  cubukAlt: { fontFamily: yazi.normal, fontSize: 11, color: '#a3a3a3' },
  cubukDugme: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: renk.zemin,
    justifyContent: 'center',
  },
  cubukDugmeMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  tani: { marginHorizontal: bosluk.kenar, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(15,15,15,0.8)' },
  taniMetin: { fontFamily: yazi.kalin, fontSize: 10, lineHeight: 14, color: renk.zemin },
  hataKutu: {
    marginHorizontal: bosluk.kenar,
    padding: 10,
    borderRadius: 12,
    backgroundColor: renk.uyariZemin,
  },
  hataMetin: {
    fontFamily: yazi.yari,
    fontSize: 12,
    color: renk.uyari,
    textAlign: 'center',
  },
});
