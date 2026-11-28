import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnaGeziKarti } from '@/components/ortak/AnaGeziKarti';
import { KurSatiri } from '@/components/ortak/KurSatiri';
import { KartKaydirici } from '@/components/anasayfa/KartKaydirici';
import { ArkadasRotalari, RafV9 } from '@/components/anasayfa/RafV9';
import { ArtiIkonu, GeziOncesiKarti, GeziSirasiKarti, GeziYokKarti, KartYerTutucu } from '@/components/anasayfa/SeyahatKarti';
import { DavetKarti } from '@/components/davet/DavetKarti';
import { GeriAlBandi } from '@/components/listem/GeriAlBandi';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { KisaBildirim, useGelenBildirim, useKisaBildirim } from '@/components/ui/KisaBildirim';
import { LogoYazi } from '@/components/ui/Logo';
import { kesfetRaflari, type Raf as RafVerisi } from '@/features/anasayfa/raflar';
import { karsilamaKapaklari, useKarsilamaKapagi } from '@/features/anasayfa/karsilama';
import { anaArama, kapakTonu } from '@/features/anasayfa/v5';
import { bugunSatiri, geziOncesiAlt, kartGenisligi, kartSeyahatleri, kartYuzleri, seyahatKapagi, yedekKapak } from '@/features/anasayfa/v9';
import { useArkadasPaylasimlari } from '@/features/arkadaslar/sorgular';
import { bekleyenPaylasimiOku, bekleyenPaylasimiSil } from '@/features/paylasim/alici';
import { bekleyenDavetiOku, bekleyenDavetiSil, useDavetKarsilama, useDavetKarsilandi } from '@/features/davet/sorgular';
import { useDavetEylemleri } from '@/features/davet/uygulamaIci';
import { useKesfetAkisi, type AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { olayYaz, useSehirler } from '@/features/icerik/sorgular';
import { useProfil } from '@/features/profil/sorgular';
import { acilisDurumu, siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
import { t } from '@/i18n';
import { useAnaSayfaBolumleri } from '@/lib/anaSayfa';
import { ACILIS_BEKLEME_MS, acilisKarariAcik, acilisKarariAl, acilisKarariniKapat, acilisKarariniYenile } from '@/lib/acilis';
import { useOturum } from '@/lib/oturum';
import type { Sehir, SeyahatOzet } from '@/lib/tipler';
import { aktifMi } from '@/lib/zaman';
import { anaV5, minDokunma, renk, yazi } from '@/theme';

/**
 * #361 ana sayfa v5 (UX önerileri kanvası, "#358 Ana sayfa v5 · harman": `Ana_v5_Yok` · `Ana_v5_Var` · `Ana_v5_Bitti`): tek
 * ana sayfa. Üstte logo, ♥ Kaydettiklerim, "+ Seyahat", profil (KK2); bitmemiş en yakın seyahat için "Planlamaya devam"
 * satırı (KK3) ya da gezi bitince "Harcamaları kapat" (KK4); düz arama (KK5, yerel süzgeç, Google yok); amaç sekmeleri (KK6);
 * tek sütun hazır gezi kartları (KK7). Bayrak (`KESFET_AKISI`) ve eski iki ana sayfa kalktı (KK1).
 * #406 (kanvas `Ana_v6_Kesfet`): sıra üst satır · arama · Planlamaya devam · banner · raflar; amaç sekmeleri ve tek sütun
 * liste kalktı. Banner ve raflar BO'nun yayınladığı bölümlerden (`ana_sayfa_gorunen`); yayında raf yoksa amaç rafları.
 * #137: giriş öncesi görülen davet → /r/{token}; web'de katılıp uygulamayı ilk açan → doğrudan seyahat.
 * #275 (kanvas 29a): alt menü yok. Üst çubukta sağda Ara · ♥ Kaydettiklerim · Profil (44 px, köşe 14); altta yüzen
 * [+ Yeni seyahat]. Seyahat silinip buraya dönülünce kısa bildirim.
 * #276 KK2: açılış kuralı — gezi günündeki kullanıcı oturumda bir kez doğrudan Gezi sayfasına iner (`src/lib/acilis.ts`).
 * #569 v9 (kanvas "Ana sayfa v9 · ONAYLI": `Ana_v9_GeziOncesi` · `_GeziSirasi` · `_GeziYok`; `Ana_v6_Kesfet` ve `Ana_v5_*`
 * yerine): üstte logo ve profil yuvarlağı (KK1); kayan seyahat kartları ya da "Sıradaki rota neresi?" kartı (KK2–KK5);
 * gezi öncesinde kartın altında "+ Yeni gezi oluştur" (KK6); "Nereye gitmek istersin?" araması (KK7); "Arkadaşlarının
 * rotaları" ve BO rafları (KK8). Banner, Planlamaya devam ve Harcamaları kapat kanvasta yok, kalktı. ♥ Kaydettiklerim kanvasta yok ama tek giriş olduğu
 * için kaldı (tasarım bekliyor).
 * #573 KK2 (kanvas `Davet_v1_AnaSayfa`): bekleyen uygulama içi davet varsa şeridin ilk kartları davet kartlarıdır; seyahat
 * kartları (ya da gezisi olmayan kart) yanında kalır. Hayır → kart kalkar, altta 5 sn "Daveti geri çevirdin · Geri al".
 */
export default function AnaSayfa() {
  const profil = useProfil();
  const seyahatler = useSeyahatler();
  const akis = useKesfetAkisi();
  const sehirler = useSehirler();
  const bolumler = useAnaSayfaBolumleri();
  const paylasimlar = useArkadasPaylasimlari();
  const ekran = useWindowDimensions().width;

  const { session, hesapli } = useOturum();
  const altBosluk = useSafeAreaInsets().bottom;
  const gelenBildirim = useGelenBildirim();
  // #291 KK6: aşağı çekip yenileme gezileri de çeker; veri varken yenileme hata verirse kartlar kalır ve bir kez
  // "Güncellenemedi".
  const bildirim = useKisaBildirim();
  const davet = useDavetEylemleri(bildirim.goster);
  const yenile = () =>
    Promise.all([
      seyahatler.refetch(),
      davet.yenile(),
      bolumler.refetch(),
      paylasimlar.refetch(),
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
        return;
      }
      // #432 2/3b: girişsiz "Seyahatime al"a basan, girişten sonra paylaşılan geziye döner (tek seferlik).
      return bekleyenPaylasimiOku().then((paylasim) => {
        if (paylasim) {
          acilisKarariniKapat();
          void bekleyenPaylasimiSil();
          router.replace({ pathname: '/r/g/[token]', params: { token: paylasim } });
        } else setBekleyenDavet(null);
      });
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

  // #569 KK2: kayan kartlar — süren seyahatler önce, sonra yaklaşanlar. KK6: gezi sırasında "+ Yeni gezi oluştur" yok.
  const siniflar = seyahatler.data ? siniflandir(seyahatler.data) : null;
  const kartlar = siniflar ? kartSeyahatleri(siniflar) : [];
  const geziSirasinda = !!siniflar && siniflar.aktif.length > 0;
  // #573 KK2: davet kartları şeridin başında; seyahat yoksa yanında gezisi olmayan kart.
  const davetler = davet.davetler;
  const kartGenislik = kartGenisligi(ekran, davetler.length + (kartlar.length > 0 ? kartlar.length : seyahatler.data ? 1 : 0));

  // KK5: arama.
  const [sorgu, setSorgu] = useState('');
  const [aramaOdakta, setAramaOdakta] = useState(false);
  const tumGeziler = useMemo(() => akis.data ?? [], [akis.data]);
  // #406 KK3 → #569 KK8: BO rafları. Bölümler okunamazsa (ya da yayında raf yoksa) amaç rafları kurulur.
  const raflar = useMemo(() => kesfetRaflari(bolumler.data, tumGeziler), [bolumler.data, tumGeziler]);
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

  // #574 KK1: her girişte "Nasıl bir gezi?" temiz açılır (yeni `n`).
  const yeni = () => router.push({ pathname: '/(tabs)/yeni', params: { n: yeniGirisNo() } });
  const geziyiAc = (g: AkisGezisi) => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } });
  const aramaGezisi = (g: AkisGezisi) => {
    aramaSonucYazildi.current = true;
    olayYaz('ana_ara', null, { sonuc: 'gezi' });
    olayYaz('ana_kart_acildi', g.id, { kaynak: 'arama', amac: null });
    geziyiAc(g);
  };
  // #406 KK6: raf kartı ölçümü.
  const rafKarti = (r: RafVerisi<AkisGezisi>, g: AkisGezisi) => {
    olayYaz('raf_kart_acildi', g.id, { raf: r.id, raf_turu: r.tur });
    geziyiAc(g);
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
  const seyahatiAc = (sy: SeyahatOzet) => router.push({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: sy.id } });
  const sekmeyiAc = (sy: SeyahatOzet, sekme: 'sohbet' | 'harcama') => router.push({ pathname: `/seyahat/[id]/(sekmeler)/${sekme}`, params: { id: sy.id } });
  const profilAd = profil.data?.name?.trim() || t('anasayfa.v9.profilEtiket');
  const arkadasPaylasimlari = paylasimlar.data ?? [];

  const kart = (sy: SeyahatOzet) => {
    const ortak = { id: sy.id, ad: seyahatAdi(sy), yuzler: kartYuzleri(sy.members, session?.user.id), kapak: seyahatKapagi(sy, sehirler.data), genislik: kartGenislik };
    return aktifMi(sy) ? (
      <GeziSirasiKarti key={sy.id} {...ortak} ust={bugunSatiri(sy) ?? ''} onAc={() => seyahatiAc(sy)} onSohbet={() => sekmeyiAc(sy, 'sohbet')} onHarcama={() => sekmeyiAc(sy, 'harcama')} />
    ) : (
      <GeziOncesiKarti key={sy.id} {...ortak} alt={geziOncesiAlt(sy)} onAc={() => seyahatiAc(sy)} />
    );
  };

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Math.max(24, altBosluk + 16) }}
        refreshControl={<RefreshControl refreshing={seyahatler.isRefetching} onRefresh={yenile} />}
      >
        {/* #569 KK1: logo solda, profil yuvarlağı sağda (36 pt Mandalina, 14/800 baş harf; dokunma 44). */}
        <View style={s.ust}>
          <LogoYazi boyut={36} />
          <View style={s.ustDugmeler}>
            {/* Kanvasta yok (tasarım bekliyor): Kaydettiklerim'in tek girişi; eski ♥ düğmesi olduğu gibi. */}
            <KaydettiklerimDugmesi />
            <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v9.profilEtiket')} onPress={() => router.navigate('/(tabs)/profil')} hitSlop={4} style={({ pressed }) => pressed && s.basili} testID="ana-profil">
              <Avatar ad={profilAd} url={profil.data?.photo_url} boyut={36} arkaPlan={renk.vurgu} yuvarlak harfBoyutu={14} />
            </Pressable>
          </View>
        </View>

        {/* KK2–KK5: seyahat kartları ya da gezisi olmayan kart. Liste gelmeden yer tutucu (#594 KK3). */}
        {davetler.length > 0 || (seyahatler.data && kartlar.length > 0) ? (
          <KartKaydirici genislik={kartGenislik}>
            {[
              ...davetler.map((d) => (
                <DavetKarti
                  key={`davet-${d.id}`}
                  davet={d}
                  kapak={seyahatKapagi({ city_label: d.sehir }, sehirler.data)}
                  genislik={kartGenislik}
                  katiliyor={davet.katilan === d.id}
                  onHayir={() => davet.reddet(d)}
                  onKatil={() => davet.katil(d)}
                />
              )),
              ...kartlar.map(kart),
              ...(kartlar.length === 0 && seyahatler.data
                ? [<Karsilama key="karsilama" bolumler={bolumler.data} bekleniyor={bolumler.isPending} sehirler={sehirler.data} genislik={kartGenislik} onYeni={yeni} />]
                : []),
            ]}
          </KartKaydirici>
        ) : seyahatler.data ? (
          <View style={s.kenar}>
            <Karsilama bolumler={bolumler.data} bekleniyor={bolumler.isPending} sehirler={sehirler.data} genislik={kartGenislik} onYeni={yeni} />
          </View>
        ) : !seyahatler.isError ? (
          // #594 KK3: liste gelene kadar kartın yerinde aynı boyda düz yer tutucu; arama ve raflar kaymaz.
          <View style={s.kenar}>
            <KartYerTutucu genislik={kartGenislik} />
          </View>
        ) : null}
        {!seyahatler.data && seyahatler.isError ? (
          // Liste okunamadıysa "gezin yok" denmez; Gezilerim'deki hata kalıbı (#388, ham hata gösterilmez).
          <View style={[s.kenar, s.seyahatHata]} testID="ana-seyahat-hata">
            <Text style={s.seyahatHataMetin}>{t('seyahatlerim.hata')}</Text>
            <Buton baslik={t('seyahatlerim.tekrarDene')} tur="ikincil" onPress={() => seyahatler.refetch()} yukleniyor={seyahatler.isFetching} />
          </View>
        ) : null}

        {/* KK6: gezi öncesinde kartın hemen altında; gezi sırasında yok. */}
        {kartlar.length > 0 && !geziSirasinda ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.v9.yeniGezi')} onPress={yeni} hitSlop={{ top: 13, bottom: 13 }} style={({ pressed }) => [s.yeniBag, pressed && s.basili]} testID="ana-yeni-gezi">
            <ArtiIkonu renk={renk.ana} />
            <Text style={s.yeniBagMetin}>{t('anasayfa.v9.yeniGezi')}</Text>
          </Pressable>
        ) : null}

        {/* KK7: "Nereye gitmek istersin?" — mevcut yerel arama (`Ana_v5_Arama`: odakta 2 px Gece kenar, yazı varken ×). */}
        <View style={[s.arama, aramaOdakta && s.aramaOdak, sorgu ? s.aramaDolu : null]} testID="ana-arama-kutu">
          <Ikon ad="ara" boyut={18} renk={renk.metin} kalinlik={2.4} />
          <TextInput
            value={sorgu}
            onChangeText={setSorgu}
            onFocus={() => setAramaOdakta(true)}
            onBlur={() => setAramaOdakta(false)}
            placeholder={t('anasayfa.v9.ara')}
            placeholderTextColor={anaV5.ikincil}
            accessibilityLabel={t('anasayfa.v9.ara')}
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
          // `Ana_v5_Arama` · `Ana_v5_Ayrinti` §3: "… için gezi kur" satırı klavyenin üstünde kalsın diye gezilerden önce;
          // sonra "Hazır geziler · N" ve kartlar. Geziler yüklenemediyse yalnız satır.
          <View style={s.liste} testID="ana-arama-sonuc">
            {arama.sehir ? (
              <KurSatiri ikon="sehir" onPress={() => sehirleKur(arama.sehir!)}>
                {t('anasayfa.v9.sehirleKurOnce')}
                <Text style={s.kurKalin}>{arama.sehir.ad}</Text>
                {t('anasayfa.v9.sehirleKurSon')}
              </KurSatiri>
            ) : arama.metin ? (
              <KurSatiri ikon="metin" onPress={() => metinleKur(arama.metin!)}>
                {t('anasayfa.v9.metinleKur', { metin: arama.metin })}
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
            {/* KK8: ilk raf arkadaşların açık paylaşımları (#533); yoksa raf yok. */}
            {arkadasPaylasimlari.length > 0 ? (
              <View style={s.ilkRaf}>
                <ArkadasRotalari paylasimlar={arkadasPaylasimlari} onTumu={() => router.navigate('/(tabs)/arkadaslar')} />
              </View>
            ) : null}
            {akis.isPending || bolumler.isPending ? (
              <ActivityIndicator color={renk.ana} style={s.yukleniyor} accessibilityLabel={t('anasayfa.v5.yukleniyor')} />
            ) : akis.isError && !akis.data ? (
              <View style={[s.kenar, s.hata]}>
                <Text accessibilityRole="header" style={s.hataBaslik}>
                  {t('kesfetAkisi.agBaslik')}
                </Text>
                <Text style={s.hataMetin}>{t('kesfetAkisi.agMetin')}</Text>
                <Buton baslik={t('kesfetAkisi.tekrarDene')} onPress={() => akis.refetch()} yukleniyor={akis.isFetching} />
              </View>
            ) : (
              raflar.map((r, i) => (
                <View key={r.id} style={i === 0 && arkadasPaylasimlari.length === 0 ? s.ilkRaf : s.sonrakiRaf}>
                  <RafV9 raf={r} onKart={(g) => rafKarti(r, g)} />
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
      {davet.bekleyen ? (
        <GeriAlBandi metin={t('davet.kutu.geriCevirdin')} olay={davet.bekleyen} onGeriAl={davet.geriAl} alt={Math.max(24, altBosluk + 8)} />
      ) : (
        <KisaBildirim metin={gelenBildirim ?? bildirim.metin} alt={Math.max(24, altBosluk + 8)} />
      )}
    </SafeAreaView>
  );
}

/** #361 KK2: ♥ → Kaydettiklerim (22 px, Gece, 2,4 çizgi; 36 px daire, 44 px dokunma). v9 kanvasında yok; tasarım bekliyor. */
function KaydettiklerimDugmesi() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.kaydettiklerim')} onPress={() => router.push('/(tabs)/kaydettiklerim')} hitSlop={4} style={({ pressed }) => [s.daire, pressed && s.basili]}>
      <Ikon ad="kalp" boyut={22} renk={renk.ana} kalinlik={2.4} />
    </Pressable>
  );
}

/**
 * KK5: gezisi olmayan kart. Görsel BO'nun `karsilama` bölümünden (#586), her açılışta sıradaki; bölüm yoksa ya da boşsa
 * Eskişehir'in BO kapağı. Bölümler gelene kadar yer tutucu (önce Eskişehir görünüp sonra değişmesin). Sıra yalnız bu kart
 * gösterildiğinde ilerler.
 */
function Karsilama({
  bolumler,
  bekleniyor,
  sehirler,
  genislik,
  onYeni,
}: {
  bolumler: readonly { tur: string; icerik: unknown }[] | undefined;
  bekleniyor: boolean;
  sehirler: Sehir[] | undefined;
  genislik: number;
  onYeni: () => void;
}) {
  const kapaklar = useMemo(() => karsilamaKapaklari(bolumler), [bolumler]);
  const secilen = useKarsilamaKapagi(kapaklar);
  const kapak = bekleniyor ? null : kapaklar.length > 0 ? secilen : yedekKapak(sehirler);
  return <GeziYokKarti kapak={kapak} genislik={genislik} onYeni={onYeni} />;
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  kenar: { paddingHorizontal: 16 },
  // Kanvas: üst çubuk durum çubuğunun altında, alttan 12; 36 pt öğeler.
  ust: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  basili: { opacity: 0.85 },
  ustDugmeler: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  daire: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  seyahatHata: { gap: 12, alignItems: 'flex-start' },
  seyahatHataMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: renk.metin },
  // KK6: kartın altında (üstten 12): 18 px artı (Gece, 2,6) + 15/700 Gece, aralık 8.
  yeniBag: { alignSelf: 'flex-start', marginTop: 12, marginLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 18 },
  yeniBagMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ana },
  // KK7: 52 pt, köşe 26, #F6F7FA zemin, iç boşluk 18, aralık 10; yazı 16, ikincil.
  arama: {
    marginHorizontal: 16,
    marginTop: 14,
    height: 52,
    borderRadius: 26,
    backgroundColor: anaV5.satirZemin,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Odakta 2 px kenar: iç boşluk 2 px azalır, içerik yerinde kalır. × varken sağ boşluk 4 (44 pt düğme).
  aramaOdak: { borderWidth: 2, borderColor: renk.ana, paddingLeft: 16, paddingRight: 16 },
  aramaDolu: { paddingRight: 4 },
  aramaGirdi: { flex: 1, fontFamily: yazi.normal, fontSize: 16, color: renk.metin, paddingVertical: 0 },
  temizle: { width: minDokunma, height: minDokunma, alignItems: 'center', justifyContent: 'center' },
  temizleDaire: { width: 24, height: 24, borderRadius: 12, backgroundColor: anaV5.ikincil, alignItems: 'center', justifyContent: 'center' },
  bolumBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.ikincil },
  liste: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  // KK8: ilk raf aramanın altından 18, sonrakiler 14.
  ilkRaf: { paddingTop: 18 },
  sonrakiRaf: { paddingTop: 14 },
  yukleniyor: { marginTop: 24 },
  hata: { gap: 14, paddingTop: 20 },
  hataBaslik: { fontFamily: yazi.ekstra, fontSize: 20, color: renk.metin },
  hataMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: anaV5.ikincil },
  kurKalin: { fontFamily: yazi.kalin },
});
