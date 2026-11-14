import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IlkSeyahatKarti, YaklasanKart } from '@/components/icerik/AnaSayfaKartlari';
import { GeziKarti } from '@/components/icerik/GeziKarti';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { LogoYazi } from '@/components/ui/Logo';
import { bekleyenDavetiOku, bekleyenDavetiSil, useDavetKarsilama, useDavetKarsilandi } from '@/features/davet/sorgular';
import { useGeziler } from '@/features/icerik/sorgular';
import { hedefSeyahatler } from '@/features/icerik/yerEkle';
import { useProfil } from '@/features/profil/sorgular';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { gunFarki, seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
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
 */
export default function AnaSayfa() {
  const profil = useProfil();
  const seyahatler = useSeyahatler();
  const geziler = useGeziler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  const yaklasan = hedefler[0] ?? null;

  const { hesapli } = useOturum();
  // #137: giriş öncesi görülen davet → /r/{token}; web'de katılıp uygulamayı ilk açan → doğrudan seyahat (KK2). İkisi de
  // bilinene kadar yükleniyor gösterilir (ilk açılış ekranı bir an görünüp kaybolmasın); geçişler tek seferlik replace.
  const [bekleyenDavet, setBekleyenDavet] = useState<null | undefined>(undefined);
  useEffect(() => {
    bekleyenDavetiOku().then((token) => {
      if (token) router.replace({ pathname: '/r/[token]', params: { token } });
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
    bekleyenDavetiSil();
    karsilandi(karsilanan).then(() => {
      // #181 KK14: davetle gelen doğrudan Gezi sayfasına iner.
      router.replace({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: karsilanan, katildin: '1' } });
      setKarsilanan(null);
    });
  }, [karsilanan, karsilandi]);

  if (bekleyenDavet === undefined || karsilamaBekleniyor || karsilanan) {
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
  const yeni = () => router.navigate('/(tabs)/yeni');
  const geziAc = (slug: string) => router.push({ pathname: '/gezi/[slug]', params: { slug } });

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik} refreshControl={<RefreshControl refreshing={seyahatler.isRefetching} onRefresh={() => Promise.all([seyahatler.refetch(), geziler.refetch()])} />}>
        <View style={s.ust}>
          <LogoYazi boyut={36} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('anasayfa.profil')} onPress={() => router.navigate('/(tabs)/profil')} hitSlop={6}>
            <Avatar ad={profil.data?.name ?? '?'} url={profil.data?.photo_url} boyut={44} arkaPlan={renk.vurgu} />
          </Pressable>
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
            {gezilerListe.length > 0 ? (
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
              {yaklasan ? (
                <YaklasanKart
                  rozet={yaklasanRozeti(yaklasan)}
                  ad={seyahatAdi(yaklasan)}
                  alt={yaklasanAlti(yaklasan)}
                  uyeler={yaklasan.members}
                  onPress={() => router.push({ pathname: '/seyahat/[id]', params: { id: yaklasan.id } })}
                />
              ) : !seyahatler.isPending ? (
                <IlkSeyahatKarti baslik={t('anasayfa.yeniBaslik')} onPress={yeni} />
              ) : null}
            </View>

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
          </>
        )}
      </ScrollView>
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
  icerik: { paddingTop: 12, paddingBottom: 32, gap: 20 },
  ust: { paddingHorizontal: bosluk.kenar, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
