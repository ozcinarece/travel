// #277 (#237 v2, kanvas 29a · 29b): ana ekrandaki Keşfet akışı. Yaklaşan seyahat varsa o şehrin gezileri önde,
// "GİDECEĞİN ŞEHİR · {Şehir}'den geziler" başlığıyla (KK3); sonra diğer şehirler. Akışın sonunda "Kendi gezini kur" (KK5).
// Yüklenirken iskelet kartlar, hata/çevrimdışında "Bağlanamadık" + Tekrar dene (KK7, #239 dili).
// #287 KK1: yenileme hata verirse elde veri varken kartlar yerinde kalır; "Bağlanamadık" yalnız hiç veri yokken.
// #300 KK5 (kanvas 29a, 29h-A): başlığın altında tek seçimli amaç çipleri; "Sana göre" süzmez, diğerleri `amaclar` ile süzer.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GeziAlYukleyici } from '@/components/icerik/GeziAl';
import { Buton } from '@/components/ui/Buton';
import { Cip } from '@/components/ui/Cip';
import { Ikon } from '@/components/ui/Ikon';
import { ayrilmaEki } from '@/features/davet/katilim';
import { akisSirasi, amacaGore, doluAmaclar, geziyiPaylas, useKesfetAkisi, type AkisGezisi, type Amac } from '@/features/icerik/kesfetAkisi';
import { t } from '@/i18n';
import { baslikStili, bosluk, olcek, renk, yazi } from '@/theme';

import { IskeletKart, KendiGeziniKur, KesfetKarti } from './KesfetKarti';

type Props = {
  /** Yaklaşan seyahatin şehri (`city_label`); yoksa null. */
  sehir: string | null;
  onYeni: () => void;
};

export function KesfetAkisi({ sehir, onYeni }: Props) {
  const akis = useKesfetAkisi();
  const [alinan, setAlinan] = useState<string | null>(null);
  const [secilenAmac, setSecilenAmac] = useState<Amac | null>(null);
  const tumu = akis.data ?? [];
  // Boş çip gösterilmez; seçili amacın gezisi yenilemede kalmadıysa "Sana göre"ye düşer.
  const amaclar = doluAmaclar(tumu);
  const amac = secilenAmac && amaclar.includes(secilenAmac) ? secilenAmac : null;
  const gorunen = amacaGore(tumu, amac);
  const { sehirGezileri, digerleri } = akisSirasi(gorunen, sehir);
  const sehirAdi = sehirGezileri[0]?.sehirler?.ad ?? null;
  const geziSayisi = amac ? <Text style={s.sayi}>{t('kesfetAkisi.geziSayisi', { n: gorunen.length })}</Text> : null;

  const kart = (g: AkisGezisi, i: number) => (
    <View key={g.id} style={s.kenar}>
      <KesfetKarti gezi={g} sira={i} onAc={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })} onPaylas={() => geziyiPaylas(g)} onAl={() => setAlinan(g.slug)} />
    </View>
  );

  if (akis.isPending) {
    return (
      <View style={s.akis}>
        <Text accessibilityRole="header" style={[s.baslik, s.kenar, s.ilkBaslik]}>
          {t('kesfetAkisi.geziler')}
        </Text>
        <View style={s.kenar}>
          <IskeletKart />
        </View>
        <View style={s.kenar}>
          <IskeletKart />
        </View>
      </View>
    );
  }
  if (akis.isError && !akis.data) {
    return (
      <View style={[s.akis, s.kenar]}>
        {/* #239 (kanvas 3d-A) dili: ikon kutusu, "Bağlanamadık", açıklama, Tekrar dene. */}
        <View style={s.hata}>
          <View style={s.ikonKutu} accessible={false} importantForAccessibility="no-hide-descendants">
            <Ikon ad="wifiKapali" boyut={26} renk={renk.ana} kalinlik={2.2} />
          </View>
          <Text accessibilityRole="header" style={s.hataBaslik}>
            {t('kesfetAkisi.agBaslik')}
          </Text>
          <Text style={s.hataMetin}>{t('kesfetAkisi.agMetin')}</Text>
          <Buton baslik={t('kesfetAkisi.tekrarDene')} onPress={() => akis.refetch()} yukleniyor={akis.isFetching} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.akis}>
      {sehirAdi ? (
        <View style={[s.kenar, s.sehirBaslik]}>
          <Text style={s.etiket}>{t('kesfetAkisi.gidecegin')}</Text>
          <View style={s.baslikSatiri}>
            <Text accessibilityRole="header" style={[s.baslik, s.baslikMetni]}>
              {t('kesfetAkisi.sehirGezileri', { sehir: ayrilmaEki(sehirAdi) })}
            </Text>
            {geziSayisi}
          </View>
        </View>
      ) : (
        <View style={[s.kenar, s.ilkBaslik, s.baslikSatiri]}>
          <Text accessibilityRole="header" style={[s.baslik, s.baslikMetni]}>
            {t('kesfetAkisi.geziler')}
          </Text>
          {geziSayisi}
        </View>
      )}
      {amaclar.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('kesfetAkisi.amacGrubu')}
          style={s.cipSatiri}
          contentContainerStyle={s.cipler}
        >
          <Cip radyo baslik={t('kesfetAkisi.sanaGore')} secili={!amac} onPress={() => setSecilenAmac(null)} />
          {amaclar.map((a) => (
            <Cip key={a} radyo baslik={t(`kesfetAkisi.amac.${a}`)} secili={amac === a} onPress={() => setSecilenAmac(amac === a ? null : a)} />
          ))}
        </ScrollView>
      ) : null}
      {sehirGezileri.map(kart)}
      {digerleri.map((g, i) => kart(g, sehirGezileri.length + i))}
      {amac ? (
        <View style={s.kenar}>
          <Text style={s.bilgi}>
            {t('kesfetAkisi.amacBilgi')}
            <Text style={s.bilgiKalin}>{t('kesfetAkisi.sanaGore')}</Text>
            {t('kesfetAkisi.amacBilgiSon')}
          </Text>
        </View>
      ) : null}
      <View style={s.kenar}>
        <KendiGeziniKur onPress={onYeni} />
      </View>
      {alinan ? <GeziAlYukleyici slug={alinan} onKapat={() => setAlinan(null)} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  akis: { gap: 20 },
  kenar: { paddingHorizontal: bosluk.kenar },
  ilkBaslik: { paddingTop: 6 },
  sehirBaslik: { gap: 2 },
  etiket: {
    fontFamily: yazi.ekstra,
    fontSize: olcek.etiket,
    letterSpacing: 0.48,
    color: renk.ikincil,
  },
  baslik: {
    ...baslikStili(olcek.bolum),
    color: renk.metin,
  },
  baslikSatiri: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  baslikMetni: { flexShrink: 1 },
  sayi: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  // Kanvas 29h-A: çip satırı başlığa 12 px (akış aralığı 20 − 8); soldan 20 px, çipler arası 6 px, yatay kayar. Dikey 4 px
  // iç boşluk 44 px dokunma alanı (hitSlop) kesilmesin diye; dış boşlukla dengelenir.
  cipSatiri: { marginTop: -12, marginBottom: -4, flexGrow: 0 },
  cipler: { paddingHorizontal: bosluk.kenar, gap: 6, paddingVertical: 4 },
  bilgi: {
    borderRadius: 16,
    backgroundColor: renk.yuzey,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: yazi.normal,
    fontSize: 14,
    lineHeight: 20,
    color: '#232b48',
    overflow: 'hidden',
  },
  bilgiKalin: { fontFamily: yazi.kalin },
  hata: { gap: 14, paddingTop: 6 },
  ikonKutu: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: renk.yuzey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hataBaslik: {
    ...baslikStili(olcek.bolum),
    color: renk.metin,
  },
  hataMetin: {
    fontFamily: yazi.normal,
    fontSize: 14,
    lineHeight: 20,
    color: renk.ikincil,
  },
});
