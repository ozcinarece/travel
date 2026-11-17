import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { HarcamaKapatKarti } from '@/components/anasayfa/HarcamaKapatKarti';
import { SERIT_YUKSEKLIK, SeyahatSeridi } from '@/components/anasayfa/SeyahatSeridi';
import { IlkSeyahatKarti } from '@/components/icerik/AnaSayfaKartlari';
import { GeziKarti } from '@/components/icerik/GeziKarti';
import { KesfetAkisi } from '@/components/icerik/KesfetAkisi';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { KisaBildirim, useGelenBildirim } from '@/components/ui/KisaBildirim';
import { LogoYazi } from '@/components/ui/Logo';
import { GEZI_PAYLAS_KARTI, kesfetDurumu, seritAdimMetni, useAcikBorc, useSeritAdimi, useSeritIpucu } from '@/features/anasayfa/serit';
import { bekleyenDavetiOku, bekleyenDavetiSil, useDavetKarsilama, useDavetKarsilandi } from '@/features/davet/sorgular';
import { kesfetAkisiAcik } from '@/features/icerik/kesfetAkisi';
import { useGeziler } from '@/features/icerik/sorgular';
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
import { bosluk, kose, olcek, renk, yazi } from '@/theme';

/**
 * #138 (kanvas 3 · Ana sayfa, 3b · İlk açılış): logo + profil, selam, arama, yaklaşan seyahat kartı, Önerilen Geziler.
 * "Gezilecek yerler" mozaiği kalktı (seyahat seçilmeden "+"nın hedefi belirsiz). Hiç seyahat yoksa: "Hoş geldin / İlk gezin
 * nereye?", büyük "İlk seyahatini kur · Başla" kartı ve "Ya da hazır bir geziyle başla" şeridi; başka kutu yok.
 * #137: giriş öncesi görülen davet → /r/{token}; web'de katılıp uygulamayı ilk açan → doğrudan seyahat.
 * #275 (kanvas 29a): alt menü yok. Üst çubukta sağda Ara · ♥ Kaydettiklerim · Profil (44 px, köşe 14); altta yüzen
 * [+ Yeni seyahat]. Seyahat silinip buraya dönülünce kısa bildirim.
 * #276 KK2: açılış kuralı — gezi günündeki kullanıcı oturumda bir kez doğrudan Gezi sayfasına iner (`src/lib/acilis.ts`).
 */
export default function AnaSayfa() {
  const profil = useProfil();
  const seyahatler = useSeyahatler();
  const geziler = useGeziler();

  const { hesapli } = useOturum();
  const altBosluk = useSafeAreaInsets().bottom;
  const gelenBildirim = useGelenBildirim();
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

  // #276 2b · KK3 · KK4 · KK-ek4: altta seyahat şeridi (29b) ya da üstte "gezi bitti" kartı (29c).
  const siniflar = seyahatler.data ? siniflandir(seyahatler.data) : null;
  const bitenAday = siniflar && !siniflar.aktif[0] && !siniflar.yaklasan[0] ? (siniflar.yeniBiten[0] ?? null) : null;
  const borc = useAcikBorc(bitenAday);
  const bitenKartiVar = GEZI_PAYLAS_KARTI || (!!borc && borc.transfer > 0);
  const durum = siniflar ? kesfetDurumu(siniflar, bitenKartiVar) : null;
  const seritSeyahati = durum?.tur === 'serit' ? durum.seyahat : null;
  const seritAdimi = useSeritAdimi(seritSeyahati);
  const ipucu = useSeritIpucu(!!seritSeyahati);

  if (bekleyenDavet === undefined || karsilamaBekleniyor || karsilanan || acilisGostergesi) {
    return (
      <SafeAreaView style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.ana} />
      </SafeAreaView>
    );
  }

  const ad = profil.data?.name?.split(' ')[0] ?? '';
  // KK5: ilk açılış = hiç seyahat yok (geçmiş dahil).
  const ilkAcilis = !seyahatler.isPending && !seyahatler.isError && (seyahatler.data?.length ?? 0) === 0;
  const gezilerListe = geziler.data ?? [];
  const yeni = () => router.push('/(tabs)/yeni');
  // Yüzen düğme ekranın altından 28 px (kanvas 29a); ana çubuk (home indicator) varsa onun 8 px üstü.
  const yuzenAlt = Math.max(28, altBosluk + 8);
  // Şerit ekranın altından 24 px (kanvas 29b); ana çubuk varsa onun 8 px üstü.
  const seritAlt = Math.max(24, altBosluk + 8);
  const seyahatiAc = (id: string) => router.push({ pathname: '/seyahat/[id]', params: { id } });
  const geziAc = (slug: string) => router.push({ pathname: '/gezi/[slug]', params: { slug } });
  // #277 KK3 · KK6: akış bayrağı ve yaklaşan seyahatin (≤ 14 gün) şehri; o şehrin gezileri önde.
  const akisAcik = kesfetAkisiAcik();
  const akisSehri = seyahatler.data ? (siniflandir(seyahatler.data).yaklasan[0]?.city_label ?? null) : null;

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik} refreshControl={<RefreshControl refreshing={seyahatler.isRefetching} onRefresh={() => Promise.all([seyahatler.refetch(), geziler.refetch()])} />}>
        <View style={s.ust}>
          <LogoYazi boyut={36} />
          <View style={s.ustDugmeler}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.araEtiket')} onPress={() => router.push('/ara')} style={({ pressed }) => [s.kare, pressed && s.basili]}>
              <Ikon ad="ara" boyut={20} renk={renk.ana} kalinlik={2.4} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.kaydettiklerim')} onPress={() => router.push('/(tabs)/kaydettiklerim')} style={({ pressed }) => [s.kare, pressed && s.basili]}>
              <Ikon ad="kalp" boyut={20} renk={renk.ana} kalinlik={2.4} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.profil')} onPress={() => router.push('/(tabs)/profil')} style={({ pressed }) => pressed && s.basili}>
              <Avatar ad={profil.data?.name ?? '?'} url={profil.data?.photo_url} boyut={44} arkaPlan={renk.vurgu} />
            </Pressable>
          </View>
        </View>

        <View style={s.selam}>
          <Text style={s.merhaba}>{ilkAcilis ? t('anasayfa.hosGeldin', { ad }) : t('anasayfa.merhaba', { ad })}</Text>
          <Text accessibilityRole="header" style={s.soru}>
            {ilkAcilis ? t('anasayfa.ilkSoru') : t('anasayfa.soru')}
          </Text>
        </View>

        {ilkAcilis ? (
          <>
            <View style={s.kenar}>
              <IlkSeyahatKarti baslik={t('anasayfa.ilkBaslik')} onPress={yeni} />
            </View>
            {akisAcik ? (
              <KesfetAkisi sehir={null} onYeni={yeni} />
            ) : gezilerListe.length > 0 ? (
              <View style={s.bolum}>
                <View style={{ gap: 2, paddingHorizontal: bosluk.kenar }}>
                  <Text style={s.bolumBaslik}>{t('anasayfa.haziraBaslik')}</Text>
                  <Text style={s.bolumAlt}>{t('anasayfa.haziraAlt')}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.serit}>
                  {gezilerListe.map((g, i) => (
                    <GeziKarti key={g.id} gezi={g} sira={i} genislik={250} onPress={() => geziAc(g.slug)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Pressable accessibilityRole="search" onPress={() => router.push('/ara')} style={s.arama}>
              <Ikon ad="ara" boyut={20} renk={renk.ana} kalinlik={2.4} />
              <Text style={s.aramaMetin}>{t('anasayfa.ara')}</Text>
            </Pressable>

            <View style={s.kenar}>
              {/* Yaklaşan / planlanan / aktif seyahat altta şeritte (29b); burada kart yok. */}
              {!durum && !seyahatler.isPending ? <IlkSeyahatKarti baslik={t('anasayfa.yeniBaslik')} onPress={yeni} /> : null}
            </View>
            {durum?.tur === 'geziBitti' && borc && borc.transfer > 0 ? (
              <HarcamaKapatKarti
                sehir={durum.seyahat.city_label}
                borc={borc}
                onBakiyeler={() => router.push({ pathname: '/seyahat/[id]/bakiyeler', params: { id: durum.seyahat.id } })}
              />
            ) : null}

            {akisAcik ? (
              // #277 KK6: bayrak açıkken bugünkü hazır geziler bölümü yerine Keşfet akışı.
              <KesfetAkisi sehir={akisSehri} onYeni={yeni} />
            ) : (
              <View style={s.bolum}>
                <View style={s.bolumSatir}>
                  <Text style={s.bolumBaslik}>{t('anasayfa.geziler')}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/geziler')} hitSlop={8}>
                    <Text style={s.tumu}>{t('anasayfa.tumu')}</Text>
                  </Pressable>
                </View>
                {gezilerListe[0] ? (
                  <View style={s.kenar}>
                    <GeziKarti gezi={gezilerListe[0]} buyuk kalp onPress={() => geziAc(gezilerListe[0].slug)} />
                  </View>
                ) : (
                  <Text style={[s.bolumAlt, s.kenar]}>{t('anasayfa.bos')}</Text>
                )}
                {gezilerListe.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.serit}>
                    {gezilerListe.slice(1).map((g, i) => (
                      <GeziKarti key={g.id} gezi={g} sira={i + 1} onPress={() => geziAc(g.slug)} />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
      {seritSeyahati ? (
        <SeyahatSeridi
          rozet={durum?.tur === 'serit' && durum.sinif !== 'planlanan' ? yaklasanRozeti(seritSeyahati) : null}
          ad={seyahatAdi(seritSeyahati)}
          alt={seritAdimi ? seritAdimMetni(seritAdimi) : seritAdimi === null ? yaklasanAlti(seritSeyahati) : null}
          ipucu={ipucu.acik}
          onAc={() => seyahatiAc(seritSeyahati.id)}
          onYeni={yeni}
          onIpucuKapat={ipucu.kapat}
          alttan={seritAlt}
        />
      ) : (
        <View style={[s.yuzenKap, { bottom: yuzenAlt }]} pointerEvents="box-none">
          <Pressable accessibilityRole="button" onPress={yeni} style={({ pressed }) => [s.yuzen, pressed && s.basili]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={renk.metin} strokeWidth={3} strokeLinecap="round" />
            </Svg>
            <Text style={s.yuzenMetin}>{t('anasayfa.yeniSeyahat')}</Text>
          </Pressable>
        </View>
      )}
      <KisaBildirim metin={gelenBildirim} alt={seritSeyahati ? seritAlt + SERIT_YUKSEKLIK + 12 : yuzenAlt + 68} />
    </SafeAreaView>
  );
}

/** "4 GÜN SONRA" · "BUGÜN" · "ŞU AN SEYAHATTE" · tarihsizse "TASLAK". */
function yaklasanRozeti(sy: SeyahatOzet): string {
  if (!sy.start_date) return t('anasayfa.tarihsizRozet');
  const kalan = gunFarki(yerelTarih(new Date(), sy.tz), sy.start_date);
  if (kalan < 0) return t('anasayfa.aktif');
  if (kalan === 0) return t('anasayfa.yaklasanBugun');
  return t('anasayfa.yaklasan', { n: kalan });
}

/** "16 – 19 Ekim · 4 gün · 12 mekan" (tarihsizse "Tarih belli değil · N mekan"). */
function yaklasanAlti(sy: SeyahatOzet): string {
  const mekan = sy.places[0]?.count ?? 0;
  if (!sy.start_date || !sy.end_date) return t('anasayfa.kartAltTarihsiz', { mekan });
  return t('anasayfa.kartAlt', { tarih: tarihAraligi(sy.start_date, sy.end_date), gun: gunFarki(sy.start_date, sy.end_date) + 1, mekan });
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  icerik: { paddingTop: 12, paddingBottom: 120, gap: 20 },
  ust: { paddingHorizontal: bosluk.kenar, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ustDugmeler: { flexDirection: 'row', gap: 8 },
  kare: { width: 44, height: 44, borderRadius: 14, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  basili: { opacity: 0.85 },
  yuzenKap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  yuzen: {
    height: 56,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 18,
    backgroundColor: renk.vurgu,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: renk.metin,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  yuzenMetin: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  selam: { paddingHorizontal: bosluk.kenar, gap: 4 },
  merhaba: { fontFamily: yazi.yari, fontSize: 15, color: renk.ikincil },
  soru: { fontFamily: yazi.baslik, fontSize: olcek.ekran, lineHeight: 34, letterSpacing: -1, color: renk.metin },
  arama: { marginHorizontal: bosluk.kenar, height: 52, paddingHorizontal: 16, borderRadius: kose.dugme, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 10 },
  aramaMetin: { fontFamily: yazi.yari, fontSize: 15, color: renk.soluk },
  kenar: { paddingHorizontal: bosluk.kenar },
  bolum: { gap: 12, paddingTop: 6 },
  bolumSatir: { paddingHorizontal: bosluk.kenar, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bolumBaslik: { fontFamily: yazi.baslik, fontSize: olcek.bolum, letterSpacing: -0.4, color: renk.metin },
  bolumAlt: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  tumu: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  serit: { gap: 12, paddingHorizontal: bosluk.kenar },
});
