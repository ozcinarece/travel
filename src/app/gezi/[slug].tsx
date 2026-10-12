import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeziPlani } from '@/components/icerik/GeziPlani';
import { Kalp } from '@/components/icerik/Kalp';
import { MdYazi } from '@/components/icerik/MdYazi';
import { SeyahatimeAl } from '@/components/icerik/SeyahatimeAl';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import type { AktarmaPlani } from '@/features/icerik/aktar';
import { useGeziAktar } from '@/features/icerik/aktarSorgu';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { cozumSebebi, olayYaz, useGezi } from '@/features/icerik/sorgular';
import { hedefSeyahatler, useYereEkle } from '@/features/icerik/yerEkle';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { davetLinki } from '@/lib/davetLinki';
import { okumaSuresiDk } from '@/lib/markdown';
import { AYLAR, parcala } from '@/lib/takvim';
import type { GeziDuragi } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

/**
 * #97 B (kanvas Home13 ekran 2–3): önerilen gezi — iki sayfa yatay kaydırma: 1. yazı (kapak, yazar · tarih · okuma süresi,
 * markdown), 2. plan (gün çipleri, mini harita, duraklar). Altta sabit çubuk: "Sayfa 1/2 · yazı" + Planı gör / Geziyi seyahatime al.
 */
export default function GeziEkrani() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const gezi = useGezi(slug);
  const kenar = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const kaydirma = useRef<ScrollView>(null);
  const [sayfa, setSayfa] = useState(0);
  const [alAcik, setAlAcik] = useState(false);
  const [alHata, setAlHata] = useState<string | null>(null);
  const seyahatler = useSeyahatler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  const hedef = hedefler[0] ?? null;
  const hedefMekanlar = useMekanlar(hedef?.id);
  const hedefIdleri = useMemo(() => new Set((hedefMekanlar.data ?? []).map((m) => m.place_id)), [hedefMekanlar.data]);
  const duraklar = useMemo(() => gezi.data?.gezi_gunleri.flatMap((g) => g.gezi_duraklari) ?? [], [gezi.data]);
  const canli = useIcerikCanli(duraklar, () => gezi.data?.sehirler?.ad ?? '', !!gezi.data);
  const aktar = useGeziAktar();
  const ekle = useYereEkle();
  const [secimDuragi, setSecimDuragi] = useState<GeziDuragi | null>(null);
  const [mesgulId, setMesgulId] = useState<string | null>(null);

  useEffect(() => {
    if (gezi.data) olayYaz('gezi_goruntulendi', gezi.data.id, { slug });
  }, [gezi.data, slug]);

  if (gezi.isPending) {
    return (
      <View style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.metin} />
      </View>
    );
  }
  if (gezi.isError || !gezi.data) {
    return (
      <View style={[s.ekran, s.ortala, { paddingTop: kenar.top }]}>
        <Text style={s.hata}>{t('gezi.hata')}</Text>
        <Buton baslik={t('genel.geri')} tur="ikincil" onPress={() => router.back()} />
      </View>
    );
  }
  const g = gezi.data;
  // #119 KK2: programatik scrollTo Android'de onMomentumScrollEnd üretmiyor → alt çubuk "Planı gör"de kalıyordu; sayfa durumu
  // hem düğmede hem kaydırma sırasında (onScroll) güncellenir.
  const sayfayaGit = (i: number) => {
    setSayfa(i);
    kaydirma.current?.scrollTo({ x: i * width, animated: true });
  };
  const kaydirildi = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== sayfa) setSayfa(i);
  };
  // #119 KK1a: kapak yoksa şehrin kapağı, o da yoksa ilk durağın Google fotoğrafı (24 sa önbellek).
  const kapakUri = g.kapak_url ?? g.sehirler?.kapak_url ?? (duraklar.map((d) => canli.data?.get(d.id)?.foto_uri).find((u): u is string => !!u) ?? null);
  const tarih = parcala(g.created_at.slice(0, 10));
  const paylas = () => Share.share({ message: t('gezi.paylasMetin', { baslik: g.baslik, link: davetLinki(`gezi/${g.slug}`).replace('/r/gezi/', '/gezi/') }) }).catch(() => {});

  const durakEkle = async (d: GeziDuragi, seyahatId: string) => {
    const c = canli.data?.get(d.id);
    // #118: sebebi söyle — kimlik henüz çözülüyor / Google'da yok / sunucu hatası.
    if (!c?.place_id) return setAlHata(canli.isPending ? t('anasayfa.cozuluyor') : t('anasayfa.ekleHataSebep', { sebep: cozumSebebi(d.id) === 'bulunamadi' || !cozumSebebi(d.id) ? t('anasayfa.bulunamadi') : cozumSebebi(d.id)! }));
    setMesgulId(d.id);
    try {
      await ekle.mutateAsync({ seyahatId, yerId: null, place_id: c.place_id, primary_type: c.hafif?.primary_type ?? d.kategori, lat: d.lat, lng: d.lng });
      setAlHata(null);
    } catch (e) {
      setAlHata(t('anasayfa.ekleHataSebep', { sebep: e instanceof Error ? e.message : String(e) }));
    } finally {
      setMesgulId(null);
    }
  };
  const durakArti = (d: GeziDuragi) => {
    if (hedefler.length === 0) return router.navigate('/(tabs)/yeni');
    if (hedefler.length === 1) return durakEkle(d, hedefler[0].id);
    setSecimDuragi(d);
  };
  // KK5: aktarım sonrası Program, eklenen ilk gün seçili; rota hesabı Program açılınca tetiklenir.
  const al = async (seyahatId: string, plan: AktarmaPlani) => {
    setAlHata(null);
    try {
      const sonuc = await aktar.mutateAsync({ seyahatId, geziId: g.id, sehirAdi: g.sehirler?.ad ?? '', plan });
      // #118 KK4: sessiz başarısızlık yok — hiçbir şey eklenmediyse sayfa açık kalır ve sebep söylenir.
      if (sonuc.eklenenMekan === 0 && sonuc.eklenenDurak === 0) {
        const ilk = sonuc.cozumsuzler[0];
        const sebep = ilk ? (ilk.sebep === 'bulunamadi' ? t('gezi.sebepBulunamadi', { ad: ilk.ad }) : t('gezi.sebepSunucu', { ad: ilk.ad, sebep: ilk.sebep })) : t('gezi.hepsiZatenVar');
        setAlHata(t('gezi.hicEklenmedi', { sebep }));
        return;
      }
      setAlAcik(false);
      router.replace({
        pathname: '/seyahat/[id]/(sekmeler)/program',
        params: { id: seyahatId, eklenenDurak: String(sonuc.eklenenDurak), eklenenMekan: String(sonuc.eklenenMekan + sonuc.zatenVar), atlanan: String(sonuc.cozumsuz), ...(sonuc.ilkGunIndex !== null ? { gun: String(sonuc.ilkGunIndex) } : {}) },
      });
    } catch (e) {
      setAlHata(t('gezi.alHata', { sebep: e instanceof Error ? e.message : String(e) }));
    }
  };
  const yeniSeyahat = () => {
    setAlAcik(false);
    router.navigate({ pathname: '/(tabs)/yeni', params: { sehir: g.sehirler?.ad ?? '', gun: String(g.gun_sayisi) } });
  };

  return (
    <View style={s.ekran}>
      <ScrollView ref={kaydirma} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={kaydirildi} onScroll={kaydirildi} scrollEventThrottle={64} style={{ flex: 1 }}>
        {/* 1. sayfa · yazı */}
        <ScrollView style={{ width }} contentContainerStyle={s.sayfaIcerik}>
          <View style={s.kapak}>
            {kapakUri ? <Image source={{ uri: kapakUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
            <View style={s.kapakGolge} />
            <View style={[s.kapakUst, { top: kenar.top + 10 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={() => router.back()} style={s.yuvarlak}>
                <Ikon ad="geri" boyut={20} renk={renk.zemin} kalinlik={2.4} />
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Kalp tur="gezi" hedefId={g.id} koyu />
                <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.paylas')} onPress={paylas} style={s.yuvarlak}>
                  <Ikon ad="paylas" boyut={18} renk={renk.zemin} kalinlik={2.2} />
                </Pressable>
              </View>
            </View>
            <View style={s.kapakMetin}>
              <Text style={s.rozet}>{t('gezi.rozet', { n: g.gun_sayisi, sehir: (g.sehirler?.ad ?? '').toLocaleUpperCase('tr'), mekan: g.mekan_sayisi })}</Text>
              <Text style={s.baslik}>{g.baslik}</Text>
            </View>
          </View>
          <View style={s.yazar}>
            <Avatar ad={g.yazar_ad ?? '?'} boyut={28} />
            <Text style={s.yazarMetin}>{`${g.yazar_ad ?? ''} · ${AYLAR[tarih.ay - 1]} ${tarih.yil} · ${t('gezi.okuma', { n: okumaSuresiDk(g.yazi_md) })}`}</Text>
          </View>
          <MdYazi kaynak={g.yazi_md} />
          <Text style={s.ozetSon}>{t('gezi.gunMekan', { gun: g.gun_sayisi, mekan: g.mekan_sayisi })}</Text>
        </ScrollView>
        {/* 2. sayfa · plan */}
        <ScrollView style={{ width }} contentContainerStyle={[s.sayfaIcerik, { paddingTop: kenar.top + 8, paddingHorizontal: bosluk.kenar }]}>
          <View style={s.planUst}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={() => sayfayaGit(0)} style={[s.yuvarlak, s.yuvarlakAcik]}>
              <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.4} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.planBaslik} numberOfLines={1}>
                {`${g.sehirler?.ad ?? ''} · ${t('gezi.gunAdet', { n: g.gun_sayisi })}`}
              </Text>
              <Text style={s.planAlt} numberOfLines={1}>
                {t('gezi.sayfa2', { gun: g.gun_sayisi, mekan: g.mekan_sayisi })}
              </Text>
            </View>
          </View>
          <GeziPlani gezi={g} canli={canli.data} onDurakEkle={durakArti} listede={(d) => !!canli.data?.get(d.id)?.place_id && hedefIdleri.has(canli.data!.get(d.id)!.place_id!)} mesgulId={mesgulId} />
        </ScrollView>
      </ScrollView>
      <View style={[s.altCubuk, { paddingBottom: Math.max(kenar.bottom, 12) }]}>
        {alHata ? <Text style={s.hata}>{alHata}</Text> : null}
        {sayfa === 0 ? (
          <View style={s.altSatir}>
            <Text style={s.sayfaMetin}>{t('gezi.sayfa1')}</Text>
            <Buton baslik={`${t('gezi.planiGor')} →`} onPress={() => sayfayaGit(1)} stil={s.kucukButon} />
          </View>
        ) : (
          <Buton baslik={t('gezi.al')} onPress={() => setAlAcik(true)} />
        )}
      </View>
      {alAcik ? <SeyahatimeAl acik gezi={g} seyahatler={hedefler} onKapat={() => setAlAcik(false)} onYeniSeyahat={yeniSeyahat} onAl={al} hata={alHata} /> : null}
      <SecimMenusu acik={!!secimDuragi} baslik={t('anasayfa.hangiSeyahat')} secenekler={hedefler.map((sy) => ({ etiket: seyahatAdi(sy), onPress: () => secimDuragi && durakEkle(secimDuragi, sy.id) }))} onKapat={() => setSecimDuragi(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  sayfaIcerik: { paddingBottom: 110, gap: 16 },
  kapak: { height: 300, backgroundColor: '#2f6fed', justifyContent: 'flex-end' },
  kapakGolge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,15,15,0.3)' },
  kapakUst: { position: 'absolute', left: bosluk.kenar, right: bosluk.kenar, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yuvarlak: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(15,15,15,0.45)', alignItems: 'center', justifyContent: 'center' },
  yuvarlakAcik: { backgroundColor: renk.yuzey },
  kapakMetin: { padding: bosluk.kenar, gap: 6 },
  rozet: { fontFamily: yazi.ekstra, fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.9)' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: renk.zemin },
  yazar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: bosluk.kenar },
  yazarMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  ozetSon: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, paddingHorizontal: bosluk.kenar },
  planUst: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planBaslik: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.4, color: renk.metin },
  planAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  altCubuk: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: bosluk.kenar, paddingTop: 10, backgroundColor: renk.zemin, borderTopWidth: 1, borderTopColor: renk.ayrac, gap: 8 },
  altSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sayfaMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  kucukButon: { height: 44, paddingHorizontal: 18 },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center' },
});
