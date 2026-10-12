import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GeziKarti } from '@/components/icerik/GeziKarti';
import { YerKarosu } from '@/components/icerik/YerKarosu';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { useGeziler, useTumYerler } from '@/features/icerik/sorgular';
import { hedefSeyahatler, useYereEkle } from '@/features/icerik/yerEkle';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { useProfil } from '@/features/profil/sorgular';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { gunFarki, seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { tarihAraligi } from '@/lib/takvim';
import type { Yer } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';
import { bosluk, renk, yazi } from '@/theme';

/**
 * #97 A (kanvas Home13): Ana sayfa — "Merhaba {ad}" + arama, yaklaşan seyahat kartı (ya da "İlk seyahatini kur"),
 * Önerilen geziler (ilk tam genişlik, gerisi şerit), Gezilecek yerler (2 sütun foto mozaiği, "+").
 */
export default function AnaSayfa() {
  const profil = useProfil();
  const seyahatler = useSeyahatler();
  const geziler = useGeziler();
  const yerler = useTumYerler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  const yaklasan = hedefler[0] ?? null;
  const hedefMekanlar = useMekanlar(yaklasan?.id);
  const hedefIdleri = useMemo(() => new Set((hedefMekanlar.data ?? []).map((m) => m.place_id)), [hedefMekanlar.data]);
  const yerListesi = useMemo(() => (yerler.data ?? []).slice(0, 8), [yerler.data]);
  const canli = useIcerikCanli(yerListesi, (y) => (y as (typeof yerListesi)[number]).sehirler?.ad ?? '');
  const ekle = useYereEkle();
  const [secimYeri, setSecimYeri] = useState<(typeof yerListesi)[number] | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [mesgulId, setMesgulId] = useState<string | null>(null);

  // #98: 0.3 yönlendirme ekranı kalktı — ilk açılış doğrudan sihirbaza (damgayı sihirbaz yazar).
  if (profil.data && !profil.data.onboarding_done_at) return <Redirect href="/(tabs)/yeni" />;

  const yereEkle = async (y: Yer, seyahatId: string) => {
    const c = canli.data?.get(y.id);
    if (!c?.place_id) {
      setBildirim(t('anasayfa.ekleHata'));
      return;
    }
    setMesgulId(y.id);
    try {
      await ekle.mutateAsync({ seyahatId, yerId: y.id, place_id: c.place_id, primary_type: c.hafif?.primary_type ?? y.kategori, lat: c.hafif?.lat ?? y.lat, lng: c.hafif?.lng ?? y.lng });
      const sy = hedefler.find((x) => x.id === seyahatId);
      setBildirim(t('anasayfa.eklendi', { seyahat: sy ? seyahatAdi(sy) : '' }));
      setTimeout(() => setBildirim(null), 2500);
    } catch {
      setBildirim(t('anasayfa.ekleHata'));
    } finally {
      setMesgulId(null);
    }
  };
  const artiBas = (y: (typeof yerListesi)[number]) => {
    if (hedefler.length === 0) return router.navigate('/(tabs)/yeni');
    if (hedefler.length === 1) return yereEkle(y, hedefler[0].id);
    setSecimYeri(y);
  };
  const yerAc = (y: (typeof yerListesi)[number]) => {
    const c = canli.data?.get(y.id);
    if (yaklasan && c?.place_id) router.push({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id: yaklasan.id, mekan: c.place_id } });
    else router.push('/yerler');
  };

  const bugun = yaklasan ? yerelTarih(new Date(), yaklasan.tz) : '';
  const kalanGun = yaklasan?.start_date ? gunFarki(bugun, yaklasan.start_date) : null;
  const ilkGezi = geziler.data?.[0];
  const digerGeziler = (geziler.data ?? []).slice(1);

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik} refreshControl={<RefreshControl refreshing={seyahatler.isRefetching} onRefresh={() => Promise.all([seyahatler.refetch(), geziler.refetch(), yerler.refetch()])} />}>
        <View style={s.ust}>
          <View style={{ flex: 1 }}>
            <Text style={s.merhaba}>{t('anasayfa.merhaba', { ad: profil.data?.name?.split(' ')[0] ?? '' })}</Text>
            <Text accessibilityRole="header" style={s.soru}>
              {t('anasayfa.soru')}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('sekme.profil')} onPress={() => router.navigate('/(tabs)/profil')} hitSlop={8}>
            <Avatar ad={profil.data?.name ?? '?'} url={profil.data?.photo_url} boyut={36} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="search" onPress={() => router.push('/ara')} style={s.arama}>
          <Ikon ad="ara" boyut={18} renk={renk.ikincil} kalinlik={2.2} />
          <Text style={s.aramaMetin}>{t('anasayfa.ara')}</Text>
        </Pressable>

        {yaklasan ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: yaklasan.id } })} style={s.kart}>
            <Text style={s.kartUst}>{kalanGun === null ? t('anasayfa.tarihsiz').toLocaleUpperCase('tr') : kalanGun <= 0 ? t('anasayfa.aktif') : kalanGun === 0 ? t('anasayfa.yaklasanBugun') : t('anasayfa.yaklasan', { n: kalanGun })}</Text>
            <Text style={s.kartAd} numberOfLines={1}>
              {seyahatAdi(yaklasan)}
            </Text>
            <Text style={s.kartAlt} numberOfLines={1}>
              {[yaklasan.start_date && yaklasan.end_date ? tarihAraligi(yaklasan.start_date, yaklasan.end_date) : t('anasayfa.tarihsiz'), t('anasayfa.durakKisi', { durak: yaklasan.places[0]?.count ?? 0, kisi: yaklasan.members.length })].join(' · ')}
            </Text>
            <View style={s.kartDugme}>
              <Text style={s.kartDugmeMetin}>{t('anasayfa.programaGit')} →</Text>
            </View>
          </Pressable>
        ) : !seyahatler.isPending ? (
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/(tabs)/yeni')} style={s.kart}>
            <Text style={s.kartAd}>{t('anasayfa.ilkBaslik')}</Text>
            <Text style={s.kartAlt}>{t('anasayfa.ilkAlt')}</Text>
            <View style={s.kartDugme}>
              <Text style={s.kartDugmeMetin}>{t('anasayfa.ilkDugme')} →</Text>
            </View>
          </Pressable>
        ) : null}

        <Bolum baslik={t('anasayfa.geziler')} onTumu={() => router.push('/geziler')}>
          {ilkGezi ? <GeziKarti gezi={ilkGezi} buyuk onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: ilkGezi.slug } })} /> : <Text style={s.bos}>{t('anasayfa.bos')}</Text>}
          {digerGeziler.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.seritKaydirma} contentContainerStyle={s.serit}>
              {digerGeziler.map((g, i) => (
                <GeziKarti key={g.id} gezi={g} sira={i + 1} onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })} />
              ))}
            </ScrollView>
          ) : null}
        </Bolum>

        <Bolum baslik={t('anasayfa.yerler')} onTumu={() => router.push('/yerler')}>
          {yerListesi.length === 0 ? <Text style={s.bos}>{t('anasayfa.bos')}</Text> : null}
          <View style={s.mozaik}>
            {[0, 1].map((sutun) => (
              <View key={sutun} style={s.sutun}>
                {yerListesi
                  .filter((_, i) => i % 2 === sutun)
                  .map((y, i) => {
                    const c = canli.data?.get(y.id);
                    return (
                      <YerKarosu
                        key={y.id}
                        ad={y.ad}
                        sehir={y.sehirler?.ad ?? null}
                        kategori={c?.hafif?.primary_type ?? y.kategori}
                        fotoUri={c?.foto_uri ?? null}
                        puan={c?.hafif?.puan ?? null}
                        yorum={c?.hafif?.puan_sayisi ?? null}
                        yukseklik={(i + sutun) % 2 === 0 ? 190 : 150}
                        listede={!!c?.place_id && hedefIdleri.has(c.place_id)}
                        mesgul={mesgulId === y.id}
                        onEkle={() => artiBas(y)}
                        onAc={() => yerAc(y)}
                      />
                    );
                  })}
              </View>
            ))}
          </View>
        </Bolum>
      </ScrollView>
      {bildirim ? (
        <View style={s.bildirim} pointerEvents="none">
          <Text style={s.bildirimMetin}>{bildirim}</Text>
        </View>
      ) : null}
      <SecimMenusu
        acik={!!secimYeri}
        baslik={t('anasayfa.hangiSeyahat')}
        secenekler={hedefler.map((sy) => ({ etiket: seyahatAdi(sy), onPress: () => secimYeri && yereEkle(secimYeri, sy.id) }))}
        onKapat={() => setSecimYeri(null)}
      />
    </SafeAreaView>
  );
}

function Bolum({ baslik, onTumu, children }: { baslik: string; onTumu: () => void; children: React.ReactNode }) {
  return (
    <View style={s.bolum}>
      <View style={s.bolumSatir}>
        <Text style={s.bolumBaslik}>{baslik}</Text>
        <Pressable accessibilityRole="button" onPress={onTumu} hitSlop={8}>
          <Text style={s.tumu}>{t('anasayfa.tumu')}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingBottom: 28 },
  ust: { paddingHorizontal: bosluk.kenar, paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  merhaba: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  soru: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.9, color: renk.metin },
  arama: { marginHorizontal: bosluk.kenar, marginTop: 14, height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 10 },
  aramaMetin: { fontFamily: yazi.yari, fontSize: 14, color: renk.soluk },
  kart: { marginHorizontal: bosluk.kenar, marginTop: 16, padding: 18, borderRadius: 22, backgroundColor: renk.metin, gap: 4 },
  kartUst: { fontFamily: yazi.ekstra, fontSize: 10, letterSpacing: 0.8, color: '#a3a3a3' },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.5, color: renk.zemin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: '#c4c4c4' },
  kartDugme: { alignSelf: 'flex-start', marginTop: 10, height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: renk.zemin, justifyContent: 'center' },
  kartDugmeMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  bolum: { paddingTop: 24, paddingHorizontal: bosluk.kenar, gap: 12 },
  bolumSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bolumBaslik: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.4, color: renk.metin },
  tumu: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil },
  seritKaydirma: { marginHorizontal: -bosluk.kenar },
  serit: { gap: 10, paddingHorizontal: bosluk.kenar },
  mozaik: { flexDirection: 'row', gap: 10 },
  sutun: { flex: 1, gap: 10 },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingVertical: 12 },
  bildirim: { position: 'absolute', left: bosluk.kenar, right: bosluk.kenar, bottom: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin, textAlign: 'center' },
});
