import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AnaGeziKarti } from '@/components/anasayfa/AnaGeziKarti';
import { HarcamaKapatKarti } from '@/components/anasayfa/HarcamaKapatKarti';
import { PlanlamayaDevam } from '@/components/anasayfa/PlanlamayaDevam';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { KisaBildirim, useGelenBildirim, useKisaBildirim } from '@/components/ui/KisaBildirim';
import { LogoYazi } from '@/components/ui/Logo';
import { banaAcikBorc, GEZI_PAYLAS_KARTI, seritAdimMetni, useAcikBorc, useSeritAdimi } from '@/features/anasayfa/serit';
import { anaArama, kapakTonu, sekmeAmaclari, ustSatir } from '@/features/anasayfa/v5';
import { bekleyenDavetiOku, bekleyenDavetiSil, useDavetKarsilama, useDavetKarsilandi } from '@/features/davet/sorgular';
import { amacaGore, useKesfetAkisi, type AkisGezisi, type Amac } from '@/features/icerik/kesfetAkisi';
import { olayYaz, useSehirler } from '@/features/icerik/sorgular';
import { useProfil } from '@/features/profil/sorgular';
import { acilisDurumu, siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { gunFarki, seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { ACILIS_BEKLEME_MS, acilisKarariAcik, acilisKarariAl, acilisKarariniKapat, acilisKarariniYenile } from '@/lib/acilis';
import { useOturum } from '@/lib/oturum';
import { tarihAraligi } from '@/lib/takvim';
import type { SeyahatOzet } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';
import { anaV5, minDokunma, renk, yazi } from '@/theme';

/**
 * #361 ana sayfa v5 (UX önerileri kanvası, "#358 Ana sayfa v5 · harman": `Ana_v5_Yok` · `Ana_v5_Var` · `Ana_v5_Bitti`): tek
 * ana sayfa. Üstte logo, ♥ Kaydettiklerim, "+ Seyahat", profil (KK2); bitmemiş en yakın seyahat için "Planlamaya devam"
 * satırı (KK3) ya da gezi bitince "Harcamaları kapat" (KK4); düz arama (KK5, yerel süzgeç, Google yok); amaç sekmeleri (KK6);
 * tek sütun hazır gezi kartları (KK7). Bayrak (`KESFET_AKISI`) ve eski iki ana sayfa kalktı (KK1).
 * #137: giriş öncesi görülen davet → /r/{token}; web'de katılıp uygulamayı ilk açan → doğrudan seyahat.
 * #275 (kanvas 29a): alt menü yok. Üst çubukta sağda Ara · ♥ Kaydettiklerim · Profil (44 px, köşe 14); altta yüzen
 * [+ Yeni seyahat]. Seyahat silinip buraya dönülünce kısa bildirim.
 * #276 KK2: açılış kuralı — gezi günündeki kullanıcı oturumda bir kez doğrudan Gezi sayfasına iner (`src/lib/acilis.ts`).
 */
export default function AnaSayfa() {
  const profil = useProfil();
  const seyahatler = useSeyahatler();
  const akis = useKesfetAkisi();
  const sehirler = useSehirler();

  const { hesapli } = useOturum();
  const altBosluk = useSafeAreaInsets().bottom;
  const gelenBildirim = useGelenBildirim();
  // #291 KK6: aşağı çekip yenileme gezileri de çeker; veri varken yenileme hata verirse kartlar kalır ve bir kez
  // "Güncellenemedi".
  const bildirim = useKisaBildirim();
  const yenile = () =>
    Promise.all([
      seyahatler.refetch(),
      akis.refetch().then((r) => {
        if (r.isError && r.data) bildirim.goster(t('kesfetAkisi.guncellenemedi'));
      }),
    ]);
  // #137: giriş öncesi görülen davet → /r/{token}; web'de katılıp uygulamayı ilk açan → doğrudan seyahat (KK2). İkisi de
  // bilinene kadar yükleniyor gösterilir (ilk açılış ekranı bir an görünüp kaybolmasın); geçişler tek seferlik replace.
  const [bekleyenDavet, setBekleyenDavet] = useState<null | undefined>(undefined);
  useEffect(() => {
    bekleyenDavetiOku().then((token) => {
      if (token) {
        // #283 inceleme 2 · 1: davetle gelen bu oturumda açılış kuralına girmez; katılıp "‹ Keşfet"e basınca ana ekran sıfırdan
        // kurulsa da Gezi'ye geri atılmaz.
        acilisKarariniKapat();
        router.replace({ pathname: '/r/[token]', params: { token } });
      }
      else setBekleyenDavet(null);
    });
  }, []);
  const karsilamaEtkin = bekleyenDavet === null && !!profil.data;
  const karsilama = useDavetKarsilama(karsilamaEtkin);
  const karsilamaBekleniyor = karsilamaEtkin && hesapli && Platform.OS !== 'web' && karsilama.data === undefined && !karsilama.isError;
  const karsilandi = useDavetKarsilandi();
  // "Önceki render" deseni: karşılanacak seyahat gelince bir kez tutulur; damga, önbellek ve tek seferlik geçiş etkide.
  const [karsilanan, setKarsilanan] = useState<string | null>(null);
  if (karsilama.data && karsilanan !== karsilama.data.trip_id) setKarsilanan(karsilama.data.trip_id);
  useEffect(() => {
    if (!karsilanan) return;
    acilisKarariniKapat();
    bekleyenDavetiSil();
    karsilandi(karsilanan).then(() => {
      // #181 KK14: davetle gelen doğrudan Gezi sayfasına iner.
      router.replace({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: karsilanan, katildin: '1' } });
      setKarsilanan(null);
    });
  }, [karsilanan, karsilandi]);

  // #276 KK2 · KK5: davet akışı bittikten (ya da hiç yokken) ve seyahatler gelince karar verilir. Gezi günündeki kullanıcı
  // doğrudan o seyahatin Gezi sayfasına iner (altında Keşfet kalır, "‹ Keşfet" buraya döner); birden çok aktifte en geç
  // başlayan. Bayrak yalnız gerçek yönlendirmede ya da kullanıcı Keşfet'ten kendisi ayrılınca / Keşfet'e kendisi dönünce
  // kapanır (#283 inceleme 2 · 3, 5): aktif seyahat yokken ya da liste hatasında tüketilmez; bağlantı gelip liste yüklenince
  // kural işler. `davetBitti` profil yüklenmeden (ya da hata vermeden) true olmaz: önce Gezi'ye push, sonra karşılama
  // `replace`'i olmasın (inceleme 2 · 2).
  const davetBitti = bekleyenDavet === null && (!!profil.data || profil.isError) && !karsilamaBekleniyor && !karsilanan && !karsilama.data;
  const acilisSeyahati = davetBitti && seyahatler.data ? acilisDurumu(seyahatler.data) : null;
  const aktif = acilisSeyahati?.tur === 'aktif' ? acilisSeyahati.seyahat : null;
  const aktifSeyahatId = aktif?.id ?? null;
  const aktifTz = aktif?.tz ?? null;
  // KK-ek3: uygulama ön plana gelince (`AppState` → `active`) ekran yeniden çizilir; sınıflar o anki saatle yeniden hesaplanır.
  const [onPlan, setOnPlan] = useState(0);
  // KK-ek7: yenileme kararı yalnız AppState → `active` olayında verilir. Etki aktif seyahat (ya da dilimi) değişince de çalışır;
  // o zaman (ör. gece yarısından sonra aşağı çekip yenileme) bayrak yeniden açılmaz, Keşfet'i okuyan kullanıcı Gezi'ye atılmaz.
  const islenenOnPlan = useRef(0);
  useEffect(() => {
    const onPlanaGeldi = onPlan !== islenenOnPlan.current;
    islenenOnPlan.current = onPlan;
    if (!aktifSeyahatId) return;
    // Ön plana gelişte, aktif seyahatin diliminde gün değiştiyse (ve kullanıcı o gün Keşfet'e kendisi dönmediyse) kural yeniden işler.
    if (onPlanaGeldi && aktifTz) acilisKarariniYenile(aktifTz);
    if (!acilisKarariAl()) return;
    // `acilis: '1'`: kök yığında bu geçiş animasyonsuz (`src/app/_layout.tsx`).
    router.push({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: aktifSeyahatId, acilis: '1' } });
  }, [aktifSeyahatId, aktifTz, onPlan]);
  // Kullanıcı Keşfet'ten kendisi ayrıldıysa (Ara, Profil, Yeni seyahat…) sonradan yüklenen liste onu Gezi'ye itmez. KK-ek3
  // yalnız Keşfet odaktayken işler (kullanıcı başka bir ekrandaysa ön plana gelince yerinden oynatılmaz).
  const odakta = useRef(false);
  useFocusEffect(
    useCallback(() => {
      odakta.current = true;
      return () => {
        odakta.current = false;
        acilisKarariniKapat();
      };
    }, []),
  );
  useEffect(() => {
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active' && odakta.current) setOnPlan((n) => n + 1);
    });
    return () => abonelik.remove();
  }, []);
  // #283 inceleme 2 · 2: karar verilmemişken liste beklenirken Keşfet bir an görünüp kaymasın; en çok 1,5 sn yükleniyor, sonra
  // Keşfet. Gezi'ye geçerken de gösterge kalır (Keşfet arkada bir kare boyanmasın).
  const [acilisBekleniyor, setAcilisBekleniyor] = useState(acilisKarariAcik);
  const kararBekleniyor = !davetBitti || seyahatler.isPending;
  const kararBekleniyorRef = useRef(kararBekleniyor);
  useEffect(() => {
    kararBekleniyorRef.current = kararBekleniyor;
  }, [kararBekleniyor]);
  useEffect(() => {
    if (!acilisBekleniyor) return;
    const z = setTimeout(() => {
      // KK-ek5: süre dolduğunda liste (ya da davet/profil) hâlâ bekleniyorsa bayrak kapanır; Keşfet'i okumaya başlayan
      // kullanıcı geç gelen kararla habersiz Gezi'ye taşınmaz (aktif seyahat şeritte görünür).
      if (kararBekleniyorRef.current) acilisKarariniKapat();
      setAcilisBekleniyor(false);
    }, ACILIS_BEKLEME_MS);
    return () => clearTimeout(z);
  }, [acilisBekleniyor]);
  const acilisGostergesi = acilisBekleniyor && (kararBekleniyor || !!aktifSeyahatId);

  // #361 KK3 · KK4: üstteki tek satır — "Planlamaya devam" ya da gezi bitince "Harcamaları kapat" (gezi günü yok).
  const siniflar = seyahatler.data ? siniflandir(seyahatler.data) : null;
  const bitenAday = siniflar && !siniflar.aktif[0] && !siniflar.yaklasan[0] ? (siniflar.yeniBiten[0] ?? null) : null;
  const borc = useAcikBorc(bitenAday);
  // #289 inceleme 1: yeni biten seyahatin harcama verisi gelene kadar satır çizilmez (sonradan zıplamasın).
  const borcBekleniyor = !!bitenAday && borc === undefined;
  // #289 inceleme 3: kart yalnız beni ilgilendiren açık borçta.
  const bitenKartiVar = GEZI_PAYLAS_KARTI || banaAcikBorc(borc);
  const durum = siniflar && !borcBekleniyor ? ustSatir(siniflar, bitenKartiVar) : null;
  const devamSeyahati = durum?.tur === 'serit' ? durum.seyahat : null;
  const seritAdimi = useSeritAdimi(devamSeyahati);

  // KK5 · KK6: arama ve amaç sekmesi.
  const [sorgu, setSorgu] = useState('');
  const [aramaOdakta, setAramaOdakta] = useState(false);
  const [secilenSekme, setSecilenSekme] = useState<Amac | null>(null);
  const tumGeziler = useMemo(() => akis.data ?? [], [akis.data]);
  const sekmeler = useMemo(() => sekmeAmaclari(tumGeziler), [tumGeziler]);
  const sekme = secilenSekme && sekmeler.includes(secilenSekme) ? secilenSekme : null;
  const arama = useMemo(() => anaArama(sorgu, tumGeziler, sehirler.data ?? []), [sorgu, tumGeziler, sehirler.data]);
  // KK8 (Büyüme notu): `ana_ara` yalnız sonucu yazar (yazılan metin kaydedilmez). Aramadan bir şeye dokunmadan çıkılırsa `yok`.
  const aramaSonucYazildi = useRef(false);
  const aramaVardi = useRef(false);
  useEffect(() => {
    if (arama) {
      aramaVardi.current = true;
      return;
    }
    if (aramaVardi.current && !aramaSonucYazildi.current) olayYaz('ana_ara', null, { sonuc: 'yok' });
    aramaVardi.current = false;
    aramaSonucYazildi.current = false;
  }, [arama]);

  if (bekleyenDavet === undefined || karsilamaBekleniyor || karsilanan || acilisGostergesi) {
    return (
      <SafeAreaView style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.ana} />
      </SafeAreaView>
    );
  }

  const yeni = () => router.push('/(tabs)/yeni');
  const geziAc = (g: AkisGezisi, kaynak: 'liste' | 'arama') => {
    olayYaz('ana_kart_acildi', g.id, { kaynak, amac: sekme });
    router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } });
  };
  const aramaGezisi = (g: AkisGezisi) => {
    aramaSonucYazildi.current = true;
    olayYaz('ana_ara', null, { sonuc: 'gezi' });
    geziAc(g, 'arama');
  };
  const sehirleKur = (sehir: { id: string }) => {
    aramaSonucYazildi.current = true;
    const slug = sehirler.data?.find((x) => x.id === sehir.id)?.slug ?? null;
    olayYaz('ana_ara', null, { sonuc: 'sehir', sehir_slug: slug });
    router.push({ pathname: '/(tabs)/yeni', params: { sehir: sehir.id, n: String(Date.now()) } });
  };
  const metinleKur = (metin: string) => {
    aramaSonucYazildi.current = true;
    olayYaz('ana_ara', null, { sonuc: 'metin' });
    router.push({ pathname: '/(tabs)/yeni', params: { metin, n: String(Date.now()) } });
  };
  const devamAc = (sy: SeyahatOzet) => {
    olayYaz('planlamaya_devam', sy.id);
    router.push({ pathname: '/seyahat/[id]', params: { id: sy.id } });
  };

  const ustKart =
    durum?.tur === 'geziBitti' && borc && banaAcikBorc(borc) ? (
      <View style={s.kenar}>
        <HarcamaKapatKarti
          sehir={durum.seyahat.city_label}
          borc={borc}
          onBakiyeler={() => router.push({ pathname: '/seyahat/[id]/bakiyeler', params: { id: durum.seyahat.id } })}
        />
      </View>
    ) : devamSeyahati ? (
      <PlanlamayaDevam
        ad={seyahatAdi(devamSeyahati)}
        // KK3: adım yüklenirken, hata verince ya da adım yokken tarih satırı.
        adim={seritAdimi ? { metin: seritAdimMetni(seritAdimi), turuncu: true } : { metin: tarihSatiri(devamSeyahati), turuncu: false }}
        alt={kalanVeKisiler(devamSeyahati)}
        onAc={() => devamAc(devamSeyahati)}
      />
    ) : null;

  const liste = amacaGore(tumGeziler, sekme);

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.icerik, { paddingBottom: Math.max(24, altBosluk + 16) }]}
        refreshControl={<RefreshControl refreshing={seyahatler.isRefetching} onRefresh={yenile} />}
      >
        {/* KK2 → #405 KK3: logo · ♥ · "+ Seyahat"; profil dairesi kalktı (alt menüde Profil sekmesi var). */}
        <View style={s.ust}>
          <LogoYazi boyut={36} />
          <View style={s.ustDugmeler}>
            <KaydettiklerimDugmesi />
            <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v5.yeniSeyahatEtiket')} onPress={yeni} hitSlop={4} style={({ pressed }) => [s.seyahatDugme, pressed && s.basili]}>
              <Text style={s.seyahatArti}>+</Text>
              <Text style={s.seyahatMetin}>{t('anasayfa.v5.seyahat')}</Text>
            </Pressable>
          </View>
        </View>

        {ustKart}

        {/* KK5: düz arama kutusu; "Ne zaman" yok. */}
        {/* `Ana_v5_Arama`: odaktayken 2 px Gece kenar; yazı varken sağda × temizle (44 pt, 24 px ikincil daire). */}
        <View style={[s.arama, aramaOdakta && s.aramaOdak, sorgu ? s.aramaDolu : null]} testID="ana-arama-kutu">
          <Ikon ad="ara" boyut={18} renk={renk.metin} kalinlik={2.4} />
          <TextInput
            value={sorgu}
            onChangeText={setSorgu}
            onFocus={() => setAramaOdakta(true)}
            onBlur={() => setAramaOdakta(false)}
            placeholder={t('anasayfa.v5.ara')}
            placeholderTextColor={anaV5.ikincil}
            accessibilityLabel={t('anasayfa.v5.ara')}
            returnKeyType="search"
            autoCorrect={false}
            style={s.aramaGirdi}
          />
          {sorgu ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v5.temizle')} onPress={() => setSorgu('')} style={s.temizle}>
              <View style={s.temizleDaire}>
                <Ikon ad="kapat" boyut={12} renk={renk.zemin} kalinlik={3.4} />
              </View>
            </Pressable>
          ) : null}
        </View>

        {arama ? (
          // `Ana_v5_Arama` · `Ana_v5_Ayrinti` §3: "… için seyahat kur" satırı klavyenin üstünde kalsın diye gezilerden önce;
          // sonra "Hazır geziler · N" ve kartlar. Geziler yüklenemediyse yalnız satır.
          <View style={[s.liste, s.aramaListe]} testID="ana-arama-sonuc">
            {arama.sehir ? (
              <KurSatiri ikon="sehir" onPress={() => sehirleKur(arama.sehir!)}>
                {t('anasayfa.v5.sehirleKurOnce')}
                <Text style={s.kurKalin}>{arama.sehir.ad}</Text>
                {t('anasayfa.v5.sehirleKurSon')}
              </KurSatiri>
            ) : arama.metin ? (
              <KurSatiri ikon="metin" onPress={() => metinleKur(arama.metin!)}>
                {t('anasayfa.v5.metinleKur', { metin: arama.metin })}
              </KurSatiri>
            ) : null}
            {arama.geziler.length > 0 ? (
              <Text accessibilityRole="header" accessibilityLabel={t('anasayfa.v5.hazirGezilerEtiket', { n: arama.geziler.length })} style={s.bolumBaslik}>
                {t('anasayfa.v5.hazirGeziler', { n: arama.geziler.length })}
              </Text>
            ) : null}
            {arama.geziler.map((g) => (
              <AnaGeziKarti key={g.id} gezi={g} ton={kapakTonu(g.amaclar, null)} onAc={() => aramaGezisi(g)} />
            ))}
          </View>
        ) : (
          <>
            {/* KK6: yalnız en az 2 gezisi olan amaçlar (en çok 4) + "Hepsi"; yatay kaymaz; 2'den az doluysa satır yok. */}
            {sekmeler.length > 0 ? (
              <View style={s.sekmeler} accessibilityRole="tablist">
                <Sekme baslik={t('anasayfa.v5.hepsi')} secili={!sekme} onPress={() => setSecilenSekme(null)} />
                {sekmeler.map((a) => (
                  <Sekme key={a} baslik={t(`anasayfa.v5.sekme.${a}`)} etiket={t(`kesfetAkisi.amac.${a}`)} secili={sekme === a} onPress={() => setSecilenSekme(a)} />
                ))}
              </View>
            ) : null}
            {akis.isPending ? (
              <ActivityIndicator color={renk.ana} style={s.yukleniyor} accessibilityLabel={t('anasayfa.v5.yukleniyor')} />
            ) : akis.isError && !akis.data ? (
              <View style={[s.kenar, s.hata]}>
                <Text accessibilityRole="header" style={s.hataBaslik}>
                  {t('kesfetAkisi.agBaslik')}
                </Text>
                <Text style={s.hataMetin}>{t('kesfetAkisi.agMetin')}</Text>
                <Buton baslik={t('kesfetAkisi.tekrarDene')} onPress={() => akis.refetch()} yukleniyor={akis.isFetching} />
              </View>
            ) : tumGeziler.length === 0 ? (
              // `Ana_v5_Ayrinti` §4: yayında hiç gezi yok.
              <View style={s.kenar}>
                <View style={s.bos} testID="ana-bos">
                  <Text accessibilityRole="header" style={s.bosBaslik}>
                    {t('anasayfa.v5.bosBaslik')}
                  </Text>
                  <Text style={s.bosMetin}>{t('anasayfa.v5.bosMetin')}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v5.yeniSeyahatEtiket')} onPress={yeni} style={({ pressed }) => [s.bosDugme, pressed && s.basili]}>
                    <Text style={s.seyahatMetin}>{t('anasayfa.v5.artiSeyahat')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={s.liste}>
                {liste.map((g) => (
                  <AnaGeziKarti key={g.id} gezi={g} ton={kapakTonu(g.amaclar, sekme)} onAc={() => geziAc(g, 'liste')} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <KisaBildirim metin={gelenBildirim ?? bildirim.metin} alt={Math.max(24, altBosluk + 8)} />
    </SafeAreaView>
  );
}

/** KK2: ♥ → Kaydettiklerim (22 px, Gece, 2,4 çizgi; 36 px daire, 44 px dokunma). */
function KaydettiklerimDugmesi() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.kaydettiklerim')} onPress={() => router.push('/(tabs)/kaydettiklerim')} hitSlop={4} style={({ pressed }) => [s.daire, pressed && s.basili]}>
      <Ikon ad="kalp" boyut={22} renk={renk.ana} kalinlik={2.4} />
    </Pressable>
  );
}


/** KK6: sekme — seçili 700 Lacivert ve 2 px alt çizgi; değilse 500 ikincil. */
function Sekme({ baslik, etiket, secili, onPress }: { baslik: string; /** Ekran okuyucu için uzun ad (#386 onay notu 1). */ etiket?: string; secili: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={etiket ?? baslik} accessibilityState={{ selected: secili }} onPress={onPress} style={[s.sekme, secili && s.sekmeSecili]}>
      <Text style={[s.sekmeMetin, secili && s.sekmeMetinSecili]} numberOfLines={1}>
        {baslik}
      </Text>
    </Pressable>
  );
}

/**
 * KK5 (`Ana_v5_Ayrinti` §3): "{Şehir} için seyahat kur ›" iğne ikonuyla, eşleşmeyen metinde "“{metin}” için seyahat kur ›"
 * + ikonuyla. Zemin #F6F7FA, köşe 16, en az 52 px.
 */
function KurSatiri({ children, ikon, onPress }: { children: ReactNode; ikon: 'sehir' | 'metin'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.kurSatiri, pressed && s.basili]}>
      {ikon === 'sehir' ? (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={renk.ana} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
          <Circle cx={12} cy={11} r={2.2} />
        </Svg>
      ) : (
        <Ikon ad="arti" boyut={20} renk={renk.ana} kalinlik={2.4} />
      )}
      <Text style={s.kurMetin} numberOfLines={2}>
        {children}
      </Text>
      <Ikon ad="ileri" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
    </Pressable>
  );
}

/** KK3: "4 gün kaldı · Ece, Mert, Ayşe" (bugün başlıyorsa "Bugün"; tarihsizse yalnız kişiler). */
function kalanVeKisiler(sy: SeyahatOzet): string {
  const kisiler = sy.members.map((m) => m.display_name.trim().split(' ')[0]).filter(Boolean).join(', ');
  if (!sy.start_date) return kisiler;
  const kalan = gunFarki(yerelTarih(new Date(), sy.tz), sy.start_date);
  const ilk = kalan <= 0 ? t('anasayfa.v5.kalanBugun') : t('anasayfa.v5.kalan', { n: kalan });
  return kisiler ? `${ilk} · ${kisiler}` : ilk;
}

/** KK3: adım yokken tarih satırı — "16 – 19 Ekim · 4 gün · 12 mekan" (tarihsizse "Tarih belli değil · N mekan"). */
function tarihSatiri(sy: SeyahatOzet): string {
  const mekan = sy.places[0]?.count ?? 0;
  if (!sy.start_date || !sy.end_date) return t('anasayfa.kartAltTarihsiz', { mekan });
  return t('anasayfa.kartAlt', { tarih: tarihAraligi(sy.start_date, sy.end_date), gun: gunFarki(sy.start_date, sy.end_date) + 1, mekan });
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  icerik: { gap: 14 },
  kenar: { paddingHorizontal: 16 },
  ust: { paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ustDugmeler: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  daire: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  basili: { opacity: 0.85 },
  seyahatDugme: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', gap: 4 },
  seyahatArti: { fontFamily: yazi.kalin, fontSize: 18, lineHeight: 20, color: renk.metin },
  seyahatMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  arama: {
    marginHorizontal: 16,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: anaV5.cizgi,
    backgroundColor: renk.zemin,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: renk.metin,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Odakta 2 px kenar: iç boşluk 1 px azalır, içerik yerinde kalır. × varken sağ boşluk 4 (44 pt düğme).
  aramaOdak: { borderWidth: 2, borderColor: renk.ana, paddingLeft: 17, paddingRight: 17 },
  aramaDolu: { paddingRight: 4 },
  aramaGirdi: { flex: 1, fontFamily: yazi.normal, fontSize: 15, color: renk.metin, paddingVertical: 0 },
  temizle: { width: minDokunma, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  temizleDaire: { width: 24, height: 24, borderRadius: 12, backgroundColor: anaV5.ikincil, alignItems: 'center', justifyContent: 'center' },
  bolumBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.ikincil },
  bos: { paddingVertical: 20, paddingHorizontal: 16, borderRadius: 16, backgroundColor: anaV5.satirZemin, gap: 6 },
  bosBaslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  bosMetin: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  bosDugme: { alignSelf: 'flex-start', marginTop: 6, height: minDokunma, paddingHorizontal: 18, borderRadius: 22, backgroundColor: renk.vurgu, justifyContent: 'center' },
  sekmeler: { paddingHorizontal: 16, flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderBottomColor: anaV5.cizgi },
  sekme: { height: minDokunma, minWidth: 44, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', flexShrink: 1 },
  sekmeSecili: { borderBottomColor: renk.metin },
  sekmeMetin: { fontFamily: yazi.orta, fontSize: 14, color: anaV5.ikincil },
  sekmeMetinSecili: { fontFamily: yazi.kalin, color: renk.metin },
  liste: { paddingHorizontal: 16, paddingTop: 4, gap: 20 },
  aramaListe: { gap: 16 },
  yukleniyor: { marginTop: 24 },
  hata: { gap: 14, paddingTop: 6 },
  hataBaslik: { fontFamily: yazi.ekstra, fontSize: 20, color: renk.metin },
  hataMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: anaV5.ikincil },
  kurSatiri: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: anaV5.satirZemin },
  kurMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 15, color: renk.metin },
  kurKalin: { fontFamily: yazi.kalin },
});
