// #432 2/3b (KK5, KK6, KK8): paylaşılan gezi — linki açan arkadaşın ekranı (uygulama + web, girişsiz de açılır).
// Kanvas `Sos_v6_Alici` (açık link) ve `Sos_v6_Kapali` (kapalı link; bilinmeyen linkte başlık "Bu link açılmıyor").
// Salt okunur: başlık, "N gün · N durak · N kişi gezdi", "Haritada gör" (basınca 220 px harita; günlük sınır doluysa gri satır),
// gün çipleri, durak listesi (adı yoksa "Durak 3" + tür adı), altta "Seyahatime al". Girişsiz kişi girişe gider, sonra
// buraya döner. Places isteği yok; harita yalnız "Haritada gör"e basınca yüklenir (açılış başına en çok 1 yükleme).
// #515 inceleme: girişli açılışta bekleyen link silinir (girişten sonra ana sayfa bir daha buraya atmasın); logo dokunulabilir,
// girişliyi ana sayfaya, girişsizi girişe götürür (uygulama kapalıyken açılan linkte yığında başka ekran yok).
import { router, useLocalSearchParams } from 'expo-router';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HaritaCizgisi, HaritaPini, Konum } from '@/components/harita/tipler';
import { paylasimOzeti } from '@/features/paylasim/baslik';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { LogoYazi } from '@/components/ui/Logo';
import { olayYaz } from '@/features/icerik/sorgular';
import {
  aliciBasligi,
  bekleyenPaylasimiSil,
  bekleyenPaylasimiYaz,
  durakSatiri,
  haritaIzniAl,
  kimlikMi,
  usePaylasimdanAl,
  usePaylasimOzeti,
  type AcikPaylasimOzeti,
  type PaylasimDuragi,
} from '@/features/paylasim/alici';
import { t } from '@/i18n';
import { acilisKarariniKapat } from '@/lib/acilis';
import { useOturum } from '@/lib/oturum';
import { anaV5, gunRengi, paylasimGunRengi, renk, rotaRengi, yazi } from '@/theme';

// #550: harita yalnız "Haritada gör"e basınca gerekir; ayrı parça olarak o an iner (web davet girişinin ilk paketine girmez).
// Parça inene kadar 220 px'lik harita kutusu kendi zemin rengiyle görünür (görünüm aynı).
const Harita = lazy(() => import('@/components/harita/Harita').then((m) => ({ default: m.Harita })));

type HaritaDurumu = 'kapali' | 'soruluyor' | 'acik' | 'yok';

const konumlu = (d: PaylasimDuragi): d is PaylasimDuragi & Konum =>
  typeof d.lat === 'number' && typeof d.lng === 'number' && Math.abs(d.lat) <= 90 && Math.abs(d.lng) <= 180;

export default function PaylasimEkrani() {
  const { token: ham } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(ham) ? ham[0] : ham;
  const { hesapli, hazir } = useOturum();
  const ozet = usePaylasimOzeti(token, hesapli, hazir);
  const [kapandi, setKapandi] = useState(false);

  if (ozet.isPending) {
    return (
      <SafeAreaView style={s.ekran}>
        <ActivityIndicator color={renk.metin} style={{ marginTop: 120 }} />
      </SafeAreaView>
    );
  }
  if (ozet.isError) {
    return <BilgiEkrani ikon="wifiKapali" baslik={t('paylasim.agBaslik')} metin={t('paylasim.agMetin')} dugme={t('paylasim.tekrarDene')} onDugme={() => ozet.refetch()} mesgul={ozet.isFetching} />;
  }
  const o = ozet.data;
  if (!o || o.kapali || kapandi) {
    const kapali = kapandi || !!o?.kapali;
    // #533 incelemesi 4: akıştan (kimlikle) açılan kapalı paylaşımda metin linkten söz etmez.
    const akistan = kapali && !!token && kimlikMi(token);
    const ad = (o?.kapali ? o.paylasan : null) ?? t('seyahatV7.adsiz');
    const metin = akistan ? t('arkadaslar.kapattiMetin', { ad }) : t(kapali ? 'paylasim.kapaliMetin' : 'paylasim.gecersizMetin');
    return <KapaliEkran baslik={t(kapali ? 'paylasim.kapaliBaslik' : 'paylasim.gecersizBaslik')} metin={metin} />;
  }
  return <AcikEkran token={token!} o={o} onKapandi={() => setKapandi(true)} />;
}

function AcikEkran({ token, o, onKapandi }: { token: string; o: AcikPaylasimOzeti; onKapandi: () => void }) {
  const { hesapli } = useOturum();
  const kenar = useSafeAreaInsets();
  const al = usePaylasimdanAl();

  // Girişten sonra bu ekrana dönen kişi için bekleyen link artık gerekmez; kalırsa ana sayfa onu yeniden buraya atar.
  useEffect(() => {
    if (hesapli) void bekleyenPaylasimiSil();
  }, [hesapli]);
  const [gunSira, setGunSira] = useState(0);
  const [harita, setHarita] = useState<HaritaDurumu>('kapali');
  const [alHata, setAlHata] = useState(false);
  const [altH, setAltH] = useState(96);

  // KK8: girişli açılış olayı (bir kez); girişsiz açılış yalnız sunucudaki sayaçta.
  const yazildi = useRef(false);
  useEffect(() => {
    if (!hesapli || yazildi.current) return;
    yazildi.current = true;
    void olayYaz('paylasim_acildi', o.id);
  }, [hesapli, o.id]);

  const gun = o.gunler[gunSira] ?? o.gunler[0];
  const gunNo = gun?.gun ?? 1;
  const duraklar = useMemo(() => gun?.duraklar ?? [], [gun]);
  const pinler = useMemo<HaritaPini[]>(
    () => duraklar.flatMap((d, i): HaritaPini[] => (konumlu(d) ? [{ id: `pd:${gunNo}:${i}`, tur: 'durak', konum: { lat: d.lat, lng: d.lng }, renk: gunRengi(gunNo), etiket: String(i + 1) }] : [])),
    [duraklar, gunNo],
  );
  const cizgiler = useMemo<HaritaCizgisi[]>(
    () => (pinler.length > 1 ? [{ id: `pc:${gunNo}`, noktalar: pinler.map((p) => p.konum), renk: rotaRengi(gunNo), kesik: true, ince: true }] : []),
    [pinler, gunNo],
  );
  const haritaVar = o.gunler.some((g) => g.duraklar.some(konumlu));

  const haritadaGor = async () => {
    setHarita('soruluyor');
    setHarita((await haritaIzniAl(token)) ? 'acik' : 'yok');
  };

  const seyahatimeAl = async () => {
    setAlHata(false);
    if (!hesapli) {
      // "Giriş yapınca bu geziye geri dönersin": ana sayfa girişten sonra bu linke döner.
      await bekleyenPaylasimiYaz(token);
      router.push('/giris');
      return;
    }
    try {
      const id = await al.mutateAsync(token);
      acilisKarariniKapat();
      router.replace({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id } });
    } catch (e) {
      if ((e as { code?: string } | null)?.code === 'P0002') onKapandi();
      else setAlHata(true);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={s.ekran}>
      <UstLogo />
      <ScrollView contentContainerStyle={{ paddingBottom: altH + 16 }}>
        <View style={s.baslikSatiri}>
          <SeyahatKapagi kimlik={token} yukseklik={64} genislik={64} kose={12} />
          <View style={s.baslikMetinleri}>
            {o.paylasan ? <Text style={s.paylasti}>{t('paylasim.paylasti', { ad: o.paylasan })}</Text> : null}
            <Text accessibilityRole="header" style={s.baslik}>
              {aliciBasligi(o)}
            </Text>
            <Text style={s.ozet}>{paylasimOzeti(o.gun_sayisi, o.durak_sayisi, o.kisi_sayisi, o.kisi_kip ?? 'gezdi')}</Text>
          </View>
        </View>

        {haritaVar ? (
          harita === 'acik' ? (
            <View style={s.harita} testID="paylasim-harita">
              {pinler.length > 0 ? (
                <Suspense fallback={null}>
                  <Harita merkez={pinler[0].konum} zoom={13} pinler={pinler} cizgiler={cizgiler} sigdir={{ noktalar: pinler.map((p) => p.konum), ust: 24, alt: 24 }} />
                </Suspense>
              ) : null}
            </View>
          ) : harita === 'yok' ? (
            <Text style={s.haritaYok}>{t('paylasim.haritaYok')}</Text>
          ) : (
            <View style={s.haritaKap}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: harita === 'soruluyor', disabled: harita === 'soruluyor' }}
                disabled={harita === 'soruluyor'}
                onPress={haritadaGor}
                style={({ pressed }) => [s.haritaDugme, pressed && s.basili]}>
                {harita === 'soruluyor' ? (
                  <ActivityIndicator color={renk.metin} />
                ) : (
                  <>
                    <Ikon ad="harita" boyut={18} renk={renk.metin} kalinlik={2.2} />
                    <Text style={s.haritaDugmeMetin}>{t('paylasim.haritadaGor')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )
        ) : null}

        {o.gunler.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler}>
            {o.gunler.map((g, i) => {
              const secili = i === gunSira;
              return (
                <Pressable
                  key={g.gun}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: secili }}
                  onPress={() => setGunSira(i)}
                  hitSlop={{ top: 5, bottom: 5 }}
                  style={[s.cip, secili && s.cipSecili]}>
                  <View style={[s.cipNokta, { backgroundColor: paylasimGunRengi(g.gun) }]} />
                  <Text style={[s.cipMetin, secili && s.cipMetinSecili]}>{t('paylasim.gunCip', { n: g.gun })}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={s.liste}>
          {duraklar.length === 0 ? <Text style={s.gunBos}>{t('paylasim.gunBos')}</Text> : null}
          {duraklar.map((d, i) => {
            const satir = durakSatiri(d, i + 1);
            return (
              <View key={i} style={[s.durak, i < duraklar.length - 1 && s.durakCizgi]} accessible accessibilityLabel={d.ad ? `${i + 1}. ${satir.ust}, ${satir.alt}` : `${satir.ust}, ${satir.alt}`}>
                <View style={[s.no, { backgroundColor: paylasimGunRengi(gunNo) }]}>
                  <Text style={s.noMetin}>{i + 1}</Text>
                </View>
                <View style={s.durakMetinleri}>
                  <Text style={s.durakAd}>{satir.ust}</Text>
                  <Text style={s.durakAlt}>{satir.alt}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[s.alt, { paddingBottom: Math.max(kenar.bottom, 12) + 18 }]} onLayout={(e) => setAltH(e.nativeEvent.layout.height)}>
        {alHata ? (
          <View style={s.hataKutu}>
            <Text style={s.hataMetin} accessibilityLiveRegion="polite">
              {t('paylasim.alHata')}
            </Text>
          </View>
        ) : null}
        <View style={[s.altSatir, hesapli && s.altSatirGirisli]}>
          {!hesapli ? <Text style={s.altNot}>{t('paylasim.girisNot')}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: al.isPending, disabled: al.isPending }}
            disabled={al.isPending}
            onPress={seyahatimeAl}
            style={({ pressed }) => [s.alDugme, pressed && s.basili]}>
            {al.isPending ? <ActivityIndicator color={renk.metin} /> : <Text style={s.alDugmeMetin}>{t('paylasim.seyahatimeAl')}</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** `Sos_v6_Kapali`: kapalı ya da bilinmeyen link; "Hazır gezilere bak" girişliyi hazır gezilere, girişsizi girişe götürür. */
function KapaliEkran({ baslik, metin }: { baslik: string; metin: string }) {
  const { hesapli } = useOturum();
  const git = () => {
    acilisKarariniKapat();
    router.replace(hesapli ? '/geziler' : '/giris');
  };
  return <BilgiEkrani ikon="kirikBag" baslik={baslik} metin={metin} dugme={t('paylasim.hazirGeziler')} onDugme={git} />;
}

/**
 * Logo (görünüm aynı): yığında önceki ekran varsa (ör. Arkadaşlar akışından açıldı) ona döner (#533 incelemesi 3); yoksa
 * girişli kişiyi ana sayfaya, girişsizi girişe götürür.
 */
function UstLogo() {
  const { hesapli } = useOturum();
  const git = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    acilisKarariniKapat();
    router.replace(hesapli ? '/(tabs)' : '/giris');
  };
  return (
    <View style={s.ust}>
      <Pressable accessibilityRole="link" accessibilityLabel={t('paylasim.logoEtiket')} onPress={git} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} style={s.logo}>
        <LogoYazi boyut={36} />
      </Pressable>
    </View>
  );
}

function BilgiEkrani({ ikon, baslik, metin, dugme, onDugme, mesgul }: { ikon: IkonAdi; baslik: string; metin: string; dugme: string; onDugme: () => void; mesgul?: boolean }) {
  const kenar = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['top']} style={s.ekran}>
      <UstLogo />
      <View style={s.bilgi}>
        <View style={s.bilgiIkon} accessible={false} importantForAccessibility="no-hide-descendants">
          <Ikon ad={ikon} boyut={30} renk={anaV5.ikincil} kalinlik={2} />
        </View>
        <Text accessibilityRole="header" style={s.bilgiBaslik}>
          {baslik}
        </Text>
        <Text style={s.bilgiMetin}>{metin}</Text>
      </View>
      <View style={[s.bilgiAlt, { paddingBottom: Math.max(kenar.bottom, 12) + 18 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: !!mesgul, disabled: !!mesgul }}
          disabled={mesgul}
          onPress={onDugme}
          style={({ pressed }) => [s.genisDugme, pressed && s.basili]}>
          {mesgul ? <ActivityIndicator color={renk.metin} /> : <Text style={s.alDugmeMetin}>{dugme}</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ust: { height: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  logo: { minHeight: 44, justifyContent: 'center' },
  baslikSatiri: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  baslikMetinleri: { flex: 1, gap: 2 },
  paylasti: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.adim },
  baslik: { fontFamily: yazi.ekstra, fontSize: 20, lineHeight: 23, letterSpacing: -0.2, color: renk.metin },
  ozet: { fontFamily: yazi.normal, fontSize: 15, color: anaV5.ikincil },
  haritaKap: { paddingHorizontal: 16, paddingBottom: 14 },
  haritaDugme: {
    height: 44,
    borderWidth: 1.5,
    borderColor: anaV5.inceKenar,
    borderRadius: 22,
    backgroundColor: renk.zemin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  haritaDugmeMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  harita: { height: 220, marginBottom: 14, backgroundColor: renk.haritaZemin, overflow: 'hidden' },
  haritaYok: { paddingHorizontal: 16, paddingBottom: 14, fontFamily: yazi.normal, fontSize: 14, lineHeight: 19, color: anaV5.ikincil },
  cipler: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  cip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: anaV5.satirZemin, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cipSecili: { backgroundColor: renk.metin },
  cipNokta: { width: 8, height: 8, borderRadius: 4 },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  cipMetinSecili: { color: renk.zemin },
  liste: { paddingTop: 4, paddingHorizontal: 16 },
  gunBos: { paddingVertical: 16, fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  durak: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  durakCizgi: { borderBottomWidth: 1, borderBottomColor: anaV5.cizgi },
  no: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  noMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  durakMetinleri: { flex: 1, gap: 1, paddingVertical: 8 },
  durakAd: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  durakAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  alt: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, backgroundColor: renk.zemin, borderTopWidth: 1, borderTopColor: anaV5.cizgi, gap: 8 },
  altSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  altSatirGirisli: { justifyContent: 'flex-end' },
  altNot: { flex: 1, fontFamily: yazi.normal, fontSize: 14, lineHeight: 18, color: anaV5.ikincil },
  alDugme: { height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  alDugmeMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  // Çekmecedeki hata kutusuyla aynı (`PaylasimCekmecesi`).
  hataKutu: { padding: 10, borderRadius: 12, backgroundColor: renk.uyariZemin },
  hataMetin: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center' },
  basili: { opacity: 0.8 },
  bilgi: { flex: 1, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bilgiIkon: { width: 72, height: 72, borderRadius: 36, backgroundColor: anaV5.satirZemin, alignItems: 'center', justifyContent: 'center' },
  bilgiBaslik: { marginTop: 4, fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.2, textAlign: 'center', color: renk.metin },
  bilgiMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, textAlign: 'center', color: anaV5.ikincil },
  bilgiAlt: { paddingTop: 12, paddingHorizontal: 16 },
  genisDugme: { height: 52, borderRadius: 26, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
});
