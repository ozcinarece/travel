// #407 Arkadaşlar sekmesi (UX önerileri kanvası `Ana_v6_Arkadaslar`). Üstte 28 px başlık; yana kayan kişi satırı (56 px daire
// avatar, 13 px ad, sonda kesikli "Davet et"); altında birlikte gezdiğin kişilerin açık paylaşım linkleri, yeniden eskiye:
// 32 px avatar + "{Ad} {şehir} gezisini paylaştı" + zaman, 200 px kapak (16 köşe) ve sağ üstte 30 px ♥, 14 px gri özet.
// Karta dokununca alıcı ekranı paylaşımın kimliğiyle açılır (token istemciye gelmez, KK3). Paylaşım yoksa kişi satırı ve tek
// cümle (KK4). Google'a istek yok.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { Avatar } from '@/components/ui/Avatar';
import { Buton } from '@/components/ui/Buton';
import { useArkadaslarim, useArkadasPaylasimlari, useBegeni, type Arkadas, type ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import { gecenZaman } from '@/features/arkadaslar/zaman';
import { ilkAd, paylasimOzeti } from '@/features/paylasim/baslik';
import { t } from '@/i18n';
import { anaV5, arkadasRenkleri, renk, yazi } from '@/theme';

/** Kanvastaki kesikli "Davet et" dairesinin kenarı. */
const DAVET_KENAR = '#B4BBD3';

const kisiRengi = (sira: number) => arkadasRenkleri[sira % arkadasRenkleri.length];

/** Uygulamanın web adresi (davet mesajı); alan adı yoksa yalnız metin. */
function uygulamaLinki(): string {
  const alan = (Constants.expoConfig?.extra as { appDomain?: string } | undefined)?.appDomain;
  return alan ? `https://${alan}` : '';
}

export default function ArkadaslarEkrani() {
  const kisiler = useArkadaslarim();
  const akis = useArkadasPaylasimlari();
  const begeni = useBegeni();
  const yenile = () => {
    void kisiler.refetch();
    void akis.refetch();
  };
  const davetEt = () => {
    Share.share({ message: t('arkadaslar.davetMetin', { link: uygulamaLinki() }).trim() }).catch(() => undefined);
  };
  const liste = kisiler.data ?? [];
  // Akıştaki kişinin avatar rengi kişi satırındakiyle aynı.
  const sira = new Map(liste.map((k, i) => [k.user_id, i]));
  const hata = kisiler.isError || akis.isError;

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
              <Pressable accessibilityRole="button" accessibilityLabel={t('arkadaslar.davetEt')} onPress={davetEt} style={s.kisi} testID="arkadaslar-davet">
                <View style={s.davetDaire}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={renk.ana} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 6v12M6 12h12" />
                  </Svg>
                </View>
                <Text style={s.davetYazi}>{t('arkadaslar.davetEt')}</Text>
              </Pressable>
            </ScrollView>
            {akis.data.length === 0 ? (
              <Text style={s.bos}>{t('arkadaslar.bos')}</Text>
            ) : (
              akis.data.map((p) => (
                <PaylasimKarti
                  key={p.id}
                  p={p}
                  ad={ilkAd(p.paylasan_ad) ?? ilkAd(liste.find((k) => k.user_id === p.paylasan)?.ad) ?? t('seyahatV7.adsiz')}
                  renk={kisiRengi(sira.get(p.paylasan) ?? 0)}
                  onBegen={() => begeni.mutate({ id: p.id, begen: !p.begendim })}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KisiOgesi({ kisi, renk: zemin }: { kisi: Arkadas; renk: string }) {
  const ad = ilkAd(kisi.ad) ?? t('seyahatV7.adsiz');
  return (
    <View style={s.kisi} accessible accessibilityLabel={ad}>
      <Avatar ad={ad} url={kisi.foto} boyut={56} arkaPlan={zemin} yuvarlak harfBoyutu={20} />
      <Text style={s.kisiAd} numberOfLines={1}>
        {ad}
      </Text>
    </View>
  );
}

function PaylasimKarti({ p, ad, renk: zemin, onBegen }: { p: ArkadasPaylasimi; ad: string; renk: string; onBegen: () => void }) {
  const ac = () => router.push({ pathname: '/r/g/[token]', params: { token: p.id } });
  return (
    <View style={s.kart} testID={`arkadas-paylasim-${p.id}`}>
      <View style={s.kartUst}>
        <Avatar ad={ad} boyut={32} arkaPlan={zemin} yuvarlak harfBoyutu={13} />
        <Text style={s.kartMetin} numberOfLines={2}>
          <Text style={s.kalin}>{ad}</Text> {t('arkadaslar.paylasti', { sehir: p.sehir })}
        </Text>
        <Text style={s.zaman}>{gecenZaman(p.olusturuldu)}</Text>
      </View>
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('arkadaslar.kartEtiket', { ad, sehir: p.sehir })} onPress={ac}>
          <SeyahatKapagi kimlik={p.id} yukseklik={200} kose={16} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('arkadaslar.begen')}
          accessibilityState={{ selected: p.begendim }}
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
      <Text style={s.ozet}>{paylasimOzeti(p.gun_sayisi, p.durak_sayisi, p.kisi_sayisi, p.kisi_kip)}</Text>
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
