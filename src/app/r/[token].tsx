// #137 Davetle katılma — /r/{token} (uygulama + web). Giriş gerektirmeden plan özeti (salt-okunur); oturum yoksa
// Apple/Google ile katıl (token cihazda bekler, giriş/profil sonrası ana sayfa buraya döner); hesap + profil varsa
// açılır açılmaz üyelik yazılır ve seyahatin Program'ı "Katıldın ✓" alt sayfasıyla açılır. Zaten üyeyse doğrudan seyahat.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { appleIleGiris, appleKullanilabilir, googleIleGiris, iptalMi } from '@/features/auth/giris';
import { davetAdimi, davetSeyahatAdi, yonelmeEki } from '@/features/davet/katilim';
import { DAVET_KANALI, bekleyenDavetiSil, bekleyenDavetiYaz, useDavetKarsilandi, useDavetOzeti, useDavetleKatil } from '@/features/davet/sorgular';
import { olayYaz } from '@/features/icerik/sorgular';
import { useProfil } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import { useOturum } from '@/lib/oturum';
import { tarihAraligi } from '@/lib/takvim';
import { bosluk, renk, yazi } from '@/theme';

type Saglayici = 'google' | 'apple';

export default function DavetEkrani() {
  const { token: ham } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(ham) ? ham[0] : ham;
  const { hazir, hesapli } = useOturum();
  const profil = useProfil();
  const ozet = useDavetOzeti(token);
  const katil = useDavetleKatil();
  const [appleVar, setAppleVar] = useState(false);
  const [mesgul, setMesgul] = useState<Saglayici | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  // Katılım sırasında token yenilendiyse (P0002) ya da ağ hatası: sonsuz bekleme yok — geçersiz ekranı ya da "Tekrar dene".
  const [katilimHatasi, setKatilimHatasi] = useState<'gecersiz' | 'ag' | null>(null);
  const [deneme, setDeneme] = useState(0);
  const karsilandi = useDavetKarsilandi();

  useEffect(() => {
    appleKullanilabilir().then(setAppleVar);
  }, []);

  const hamAdim = davetAdimi({ ozet: ozet.data, ozetBekliyor: ozet.isPending, hazir, hesapli, profilVar: hesapli ? (profil.isPending ? undefined : !!profil.data) : undefined });
  const adim = katilimHatasi === 'gecersiz' ? 'gecersiz' : hamAdim;

  // Olay: davet açıldı (hesaplıysa bir kez; anon yazamaz, giriş sonrası aynı sayfaya dönünce yazılır).
  const acildiYazildi = useRef(false);
  useEffect(() => {
    if (!hesapli || !ozet.data || acildiYazildi.current) return;
    acildiYazildi.current = true;
    olayYaz('davet_acildi', ozet.data.trip_id, { kanal: DAVET_KANALI });
  }, [hesapli, ozet.data]);

  // Hesap + profil hazırsa katılım kendiliğinden; zaten üyeyse doğrudan seyahat.
  const katilimBasladi = useRef(false);
  useEffect(() => {
    if (!token || katilimBasladi.current) return;
    if (adim === 'uye') {
      katilimBasladi.current = true;
      bekleyenDavetiSil();
      const tripId = ozet.data!.trip_id;
      // Web'de katılıp linki uygulamada açan: karşılama damgası şimdi (sonradan bir kez daha karşılanmasın).
      if (DAVET_KANALI === 'app') karsilandi(tripId);
      router.replace({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: tripId } });
      return;
    }
    if (adim !== 'katil' || katilimHatasi) return;
    katilimBasladi.current = true;
    katil
      .mutateAsync(token)
      .then((sonuc) => {
        bekleyenDavetiSil();
        router.replace({ pathname: '/seyahat/[id]/(sekmeler)/program', params: sonuc.zaten_uye ? { id: sonuc.trip_id } : { id: sonuc.trip_id, katildin: '1' } });
      })
      .catch((e: unknown) => {
        katilimBasladi.current = false;
        if ((e as { code?: string } | null)?.code === 'P0002') {
          bekleyenDavetiSil();
          setKatilimHatasi('gecersiz');
        } else {
          setKatilimHatasi('ag');
          setHata(t('davet.hata'));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adim, token, deneme]);
  const tekrarDene = () => {
    setHata(null);
    setKatilimHatasi(null);
    ozet.refetch();
    setDeneme((n) => n + 1);
  };

  useEffect(() => {
    if (adim === 'gecersiz') bekleyenDavetiSil();
  }, [adim]);

  const girisYap = async (saglayici: Saglayici, giris: () => Promise<void>) => {
    if (!token) return;
    setHata(null);
    setMesgul(saglayici);
    await bekleyenDavetiYaz(token);
    try {
      await giris();
    } catch (e) {
      if (!iptalMi(e)) setHata(t('giris.hata'));
    } finally {
      setMesgul(null);
    }
  };
  const anaSayfa = () => router.replace('/(tabs)');

  if (adim === 'yukleniyor') {
    return (
      <SafeAreaView style={s.ekran}>
        <ActivityIndicator color={renk.metin} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }
  if (adim === 'gecersiz' || !ozet.data) {
    return (
      <SafeAreaView style={s.ekran}>
        <View style={s.icerik}>
          <Text style={s.baslik}>{t('davet.gecersizBaslik')}</Text>
          <Text style={s.alt}>{t('davet.gecersizMetin')}</Text>
          {hesapli ? <Buton baslik={t('davet.anaSayfa')} onPress={anaSayfa} stil={{ marginTop: 16 }} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  const o = ozet.data;
  const seyahatAd = davetSeyahatAdi(o);
  const tarih = o.start_date && o.end_date ? tarihAraligi(o.start_date, o.end_date) : t('davet.tarihsiz');
  const katiliyor = (adim === 'katil' || adim === 'uye') && !katilimHatasi;
  return (
    <SafeAreaView style={s.ekran}>
      <ScrollView contentContainerStyle={s.icerik}>
        <View style={s.davetci}>
          <Avatar ad={o.inviter_name ?? '?'} url={o.inviter_photo} boyut={44} arkaPlan={renk.vurgu} />
          <Text style={s.davetciMetin}>{t('davet.davetEden', { ad: o.inviter_name ?? t('davet.biri') })}</Text>
        </View>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('davet.baslik', { ad: o.inviter_name ?? t('davet.biri'), seyahatEk: yonelmeEki(seyahatAd) })}
        </Text>
        <Text style={s.alt}>{t('davet.ozet', { tarih, gun: o.day_count, mekan: o.place_count, kisi: o.member_count })}</Text>

        <View style={s.plan}>
          <Text style={s.planBaslik}>{t('davet.planBaslik')}</Text>
          {o.gunler.map((g) => (
            <View key={g.index} style={s.gunSatiri}>
              <Text style={s.gunAd}>{g.date ? tarihAraligi(g.date, g.date) : t('davet.gunSatiri', { gun: g.index })}</Text>
              <Text style={s.gunDurak}>{g.durak > 0 ? t('davet.gunDurak', { n: g.durak }) : t('davet.gunBos')}</Text>
            </View>
          ))}
          {o.gunler.length === 0 ? <Text style={s.gunDurak}>{t('davet.gunYok')}</Text> : null}
          <Text style={s.planNot}>{t('davet.planNot')}</Text>
        </View>

        <View style={s.altKisim}>
          {hata ? <Text style={s.hata}>{hata}</Text> : null}
          {katilimHatasi === 'ag' ? (
            <Buton baslik={t('davet.tekrarDene')} onPress={tekrarDene} />
          ) : katiliyor || adim === 'profil' ? (
            // #138: profil sunucuda kendiliğinden oluşur (kök düzen); bu arada "katılıyorsun".
            <View style={s.katiliyor}>
              <ActivityIndicator color={renk.ana} />
              <Text style={s.katiliyorMetin}>{adim === 'uye' ? t('davet.zatenUye') : t('davet.katiliyor')}</Text>
            </View>
          ) : (
            <>
              {appleVar ? <Buton baslik={t('davet.katilApple')} boy="buyuk" onPress={() => girisYap('apple', appleIleGiris)} yukleniyor={mesgul === 'apple'} pasif={mesgul !== null && mesgul !== 'apple'} /> : null}
              <Buton baslik={t('davet.katilGoogle')} tur={appleVar ? 'cerceveli' : 'birincil'} boy="buyuk" onPress={() => girisYap('google', googleIleGiris)} yukleniyor={mesgul === 'google'} pasif={mesgul !== null && mesgul !== 'google'} />
              {Platform.OS === 'web' ? <Text style={s.not}>{t('davet.webNot')}</Text> : null}
              <Text style={s.not}>{t('giris.kosullar')}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { flexGrow: 1, padding: bosluk.kenar, paddingTop: 28, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  davetci: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  davetciMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  baslik: { fontFamily: yazi.baslik, fontSize: 28, lineHeight: 32, letterSpacing: -0.8, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  plan: { marginTop: 8, padding: 16, borderRadius: 22, backgroundColor: renk.yuzey, gap: 8 },
  planBaslik: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.5, color: renk.ikincil },
  gunSatiri: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  gunAd: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  gunDurak: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  planNot: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 15, color: renk.soluk, paddingTop: 4 },
  altKisim: { marginTop: 'auto', paddingTop: 16, gap: 10 },
  katiliyor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52 },
  katiliyorMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  not: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 16, textAlign: 'center', color: renk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});
