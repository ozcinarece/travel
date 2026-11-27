// #407 Arkadaşlar sekmesi (UX önerileri kanvası `Ana_v6_Arkadaslar`). Üstte 28 px başlık; yana kayan kişi satırı (56 px daire
// avatar, 13 px ad, sonda kesikli "Davet et"); altında birlikte gezdiğin kişilerin açık paylaşım linkleri, yeniden eskiye:
// 32 px avatar + "{Ad} {şehir} gezisini paylaştı" + zaman, 200 px kapak (16 köşe) ve sağ üstte 30 px ♥, 14 px gri özet.
// Karta dokununca alıcı ekranı paylaşımın kimliğiyle açılır (token istemciye gelmez, KK3). Paylaşım yoksa kişi satırı ve tek
// cümle (KK4). Google'a istek yok.
// #533 incelemesi: kartın tamamı dokunulabilir (♥ ayrı); sekmeye dönünce bayat akış tazelenir; "Davet et" etkin ya da yaklaşan
// seyahatin davetini paylaşır, yoksa "Yeni seyahat" açılır; veri varken yenileme hatası listeyi silmez; ♥ hatası genel uyarı.
// #540: misafire hesap cümlesi (KK1); kart etiketi zaman ve özeti de okur, ♥ etiketi beğenilmişken "Beğeniyi geri al" (KK2).
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Avatar } from '@/components/ui/Avatar';
import { ProfilOnayi } from '@/components/davet/ProfilOnayi';
import { Buton } from '@/components/ui/Buton';
import {
  useArkadaslarim,
  useArkadasPaylasimlari,
  useBegeni,
  useOdaktaTazele,
  type Arkadas,
  type ArkadasPaylasimi,
} from '@/features/arkadaslar/sorgular';
import { gecenZaman } from '@/features/arkadaslar/zaman';
import { davetiPaylas } from '@/features/davet/paylas';
import { profilOnayiniYaz, profilOnayiVerildiMi } from '@/features/davet/sorgular';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { siniflandir } from '@/features/seyahatler/siniflandir';
import { SEYAHAT_ALANLARI } from '@/features/seyahatler/alanlar';
import { ilkAd, paylasimOzeti } from '@/features/paylasim/baslik';
import { t } from '@/i18n';
import { useOturum } from '@/lib/oturum';
import { supabase } from '@/lib/supabase';
import type { Seyahat } from '@/lib/tipler';
import { anaV5, arkadasRenkleri, renk, yazi } from '@/theme';

/** Kanvastaki kesikli "Davet et" dairesinin kenarı. */
const DAVET_KENAR = '#B4BBD3';

const kisiRengi = (sira: number) => arkadasRenkleri[sira % arkadasRenkleri.length];

const hataUyarisi = () => Alert.alert(t('genel.hataBaslik'), t('genel.hataMetin'));

/**
 * #533 incelemesi 5: "Davet et" etkin (yoksa en yakın yaklaşan) seyahatin davet linkini paylaşır (ilk seferde profil onayı,
 * #137 KK5); böyle bir seyahat yoksa "Yeni seyahat" sihirbazı açılır.
 */
function useDavetEt() {
  const { session } = useOturum();
  const seyahatler = useSeyahatler();
  const [bekleyen, setBekleyen] = useState<Seyahat | null>(null);
  const davetEt = async () => {
    const s = seyahatler.data ? siniflandir(seyahatler.data) : null;
    const hedef = s?.aktif[0] ?? s?.yaklasan[0] ?? null;
    if (!hedef) {
      router.push('/(tabs)/yeni');
      return;
    }
    const { data, error } = await supabase.from('trips').select(SEYAHAT_ALANLARI).eq('id', hedef.id).single();
    if (error || !data) {
      hataUyarisi();
      return;
    }
    const seyahat = data as unknown as Seyahat;
    if (await profilOnayiVerildiMi(session?.user.id)) await davetiPaylas(seyahat);
    else setBekleyen(seyahat);
  };
  const onayla = async () => {
    const seyahat = bekleyen;
    setBekleyen(null);
    if (!seyahat) return;
    await profilOnayiniYaz(session?.user.id);
    await davetiPaylas(seyahat);
  };
  return { davetEt, onayAcik: !!bekleyen, onayKapat: () => setBekleyen(null), onayla };
}

export default function ArkadaslarEkrani() {
  const kisiler = useArkadaslarim();
  const akis = useArkadasPaylasimlari();
  const begeni = useBegeni();
  const davet = useDavetEt();
  const { hesapli } = useOturum();
  useOdaktaTazele();
  const yenile = () => {
    void kisiler.refetch();
    void akis.refetch();
  };
  const begen = (p: ArkadasPaylasimi) => begeni.mutate({ id: p.id, begen: !p.begendim }, { onError: hataUyarisi });
  const liste = kisiler.data ?? [];
  // Akıştaki kişinin avatar rengi kişi satırındakiyle aynı.
  const sira = new Map(liste.map((k, i) => [k.user_id, i]));
  // #533 incelemesi 9: veri varken yenileme hatası listeyi silmez; tam ekran hata yalnız hiç veri yokken.
  const hata = (kisiler.isError && !kisiler.data) || (akis.isError && !akis.data);

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView contentContainerStyle={s.icerik} refreshControl={<RefreshControl refreshing={kisiler.isRefetching || akis.isRefetching} onRefresh={yenile} />}>
        <View style={s.ust}>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('arkadaslar.baslik')}
          </Text>
        </View>
        {hata ? (
          <View style={s.hata}>
            <Text style={s.hataMetin}>{t('arkadaslar.hata')}</Text>
            <Buton baslik={t('arkadaslar.tekrarDene')} tur="ikincil" onPress={yenile} yukleniyor={kisiler.isFetching || akis.isFetching} />
          </View>
        ) : !kisiler.data || !akis.data ? (
          <ActivityIndicator color={renk.ana} style={s.yukleniyor} accessibilityLabel={t('arkadaslar.yukleniyor')} />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kisiler}>
              {liste.map((k, i) => (
                <KisiOgesi key={k.user_id} kisi={k} renk={kisiRengi(i)} />
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel={t('arkadaslar.davetEt')} onPress={() => void davet.davetEt()} style={s.kisi} testID="arkadaslar-davet">
                <View style={s.davetDaire}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={renk.ana} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 6v12M6 12h12" />
                  </Svg>
                </View>
                <Text style={s.davetYazi}>{t('arkadaslar.davetEt')}</Text>
              </Pressable>
            </ScrollView>
            {/* #540 KK1: sunucu misafire akışı hiç döndürmez; boş cümle yerine hesap cümlesi. */}
            {!hesapli ? (
              <Text style={s.bos}>{t('arkadaslar.misafir')}</Text>
            ) : liste.length === 0 ? (
              <Text style={s.bos}>{t('arkadaslar.bosKisi')}</Text>
            ) : akis.data.length === 0 ? (
              <Text style={s.bos}>{t('arkadaslar.bos')}</Text>
            ) : (
              akis.data.map((p) => (
                <PaylasimKarti
                  key={p.id}
                  p={p}
                  ad={ilkAd(p.paylasan_ad) ?? ilkAd(liste.find((k) => k.user_id === p.paylasan)?.ad) ?? t('seyahatV7.adsiz')}
                  foto={p.foto ?? liste.find((k) => k.user_id === p.paylasan)?.foto ?? null}
                  renk={kisiRengi(sira.get(p.paylasan) ?? 0)}
                  onBegen={() => begen(p)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
      <ProfilOnayi acik={davet.onayAcik} onKapat={davet.onayKapat} onGonder={davet.onayla} />
    </SafeAreaView>
  );
}

/** #578 KK1: yüze dokununca arkadaşın profili (Profil v12) açılır. */
function KisiOgesi({ kisi, renk: zemin }: { kisi: Arkadas; renk: string }) {
  const ad = ilkAd(kisi.ad) ?? t('seyahatV7.adsiz');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ad}
      onPress={() => router.push({ pathname: '/kisi/[id]', params: { id: kisi.user_id } })}
      style={({ pressed }) => [s.kisi, pressed && { opacity: 0.8 }]}
      testID={`arkadas-kisi-${kisi.user_id}`}>
      <Avatar ad={ad} url={kisi.foto} boyut={56} arkaPlan={zemin} yuvarlak harfBoyutu={20} />
      <Text style={s.kisiAd} numberOfLines={1}>
        {ad}
      </Text>
    </Pressable>
  );
}

function PaylasimKarti({ p, ad, foto, renk: zemin, onBegen }: { p: ArkadasPaylasimi; ad: string; foto: string | null; renk: string; onBegen: () => void }) {
  const ac = () => router.push({ pathname: '/r/g/[token]', params: { token: p.id } });
  const zaman = gecenZaman(p.olusturuldu);
  const ozet = paylasimOzeti(p.gun_sayisi, p.durak_sayisi, p.kisi_sayisi, p.kisi_kip);
  // #533 incelemesi 7: başlık satırı, kapak ve özet aynı ekranı açar; ♥ kapağın üstünde ayrı Pressable. Ekran okuyucu için kart
  // tek düğme (başlık satırı), kapak ve özet ikinci kez okunmaz.
  return (
    <View style={s.kart} testID={`arkadas-paylasim-${p.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('arkadaslar.kartEtiket', { ad, sehir: p.sehir, zaman, ozet })}
        accessibilityHint={t('arkadaslar.kartIpucu')}
        onPress={ac}
        style={s.kartUst}>
        <Avatar ad={ad} url={foto} boyut={32} arkaPlan={zemin} yuvarlak harfBoyutu={13} />
        <Text style={s.kartMetin} numberOfLines={2}>
          <Text style={s.kalin}>{ad}</Text> {t('arkadaslar.paylasti', { sehir: p.sehir })}
        </Text>
        <Text style={s.zaman}>{zaman}</Text>
      </Pressable>
      <View>
        <Pressable onPress={ac} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`arkadas-kapak-${p.id}`}>
          <SeyahatKapagi kimlik={p.id} yukseklik={200} kose={16} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(p.begendim ? 'arkadaslar.begeniGeriAl' : 'arkadaslar.begen')}
          onPress={onBegen}
          hitSlop={7}
          style={s.kalp}
          testID={`arkadas-begen-${p.id}`}>
          {/* Beğenilmiş hal kart ♥ kuralıyla (`Ana_v5_Ayrinti` §2): Mandalina dolgu, koyu turuncu kenar. */}
          <Svg width={16} height={16} viewBox="0 0 24 24" fill={p.begendim ? renk.vurgu : 'none'} stroke={p.begendim ? anaV5.kalpKenar : renk.metin} strokeWidth={p.begendim ? 1.6 : 2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </Svg>
        </Pressable>
      </View>
      <Pressable onPress={ac} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`arkadas-ozet-${p.id}`}>
        <Text style={s.ozet}>{ozet}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  ust: { height: 48, flexDirection: 'row', alignItems: 'center' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.28, color: renk.metin },
  kisiler: { gap: 10, paddingTop: 10, paddingBottom: 16 },
  kisi: { width: 64, alignItems: 'center', gap: 6 },
  kisiAd: { fontFamily: yazi.normal, fontSize: 13, color: renk.metin, maxWidth: 64 },
  davetDaire: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: DAVET_KENAR, alignItems: 'center', justifyContent: 'center' },
  davetYazi: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ana },
  kart: { gap: 8, paddingBottom: 18 },
  kartUst: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kartMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 14, color: renk.metin },
  kalin: { fontFamily: yazi.kalin },
  zaman: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  kalp: { position: 'absolute', right: 12, top: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: anaV5.kalpDaire, alignItems: 'center', justifyContent: 'center' },
  ozet: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: anaV5.ikincil },
  yukleniyor: { marginTop: 24 },
  hata: { paddingTop: 24, gap: 12, alignItems: 'flex-start' },
  hataMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: renk.metin },
});
