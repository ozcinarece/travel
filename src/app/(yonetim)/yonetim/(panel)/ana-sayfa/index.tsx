import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Hap } from '@/components/yonetim/Hap';
import { YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { AnaSayfaOnizleme, ANA_SAYFA_TELEFON } from '@/components/yonetim/anaSayfa/AnaSayfaOnizleme';
import { BolumSatiri } from '@/components/yonetim/anaSayfa/BolumSatiri';
import { yRenk } from '@/components/yonetim/tema';
import { planliSatirlar, yayindanFarkli, yeniBolum } from '@/features/yonetim/anaSayfa';
import { useBolumIslemleri, useEnCokAlinan, useSonYayin, useTaslakBolumler } from '@/features/yonetim/anaSayfaSorgulari';
import { saatMetni, tasi } from '@/features/yonetim/gezi';
import { useYonetimGezileri, useYonetimSehirleri } from '@/features/yonetim/geziSorgulari';
import { kullaniciEtiketi } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';
import { useYonetimYerleri } from '@/features/yonetim/yerSorgulari';
import { useOturum } from '@/lib/oturum';
import { yazi } from '@/theme';

const OLCEK = 0.56;

/**
 * #109 ana sayfa düzeni (kanvas ekran 3): bölüm listesi (sürükle = sıra, anahtar = açık/kapalı, Düzenle = içerik),
 * "+ Bölüm ekle", planlı yayın kutusu; sağda uygulama ana sayfası önizlemesi. Düzenlemeler taslağa anında yazılır;
 * "Yayınla" taslağı canlıya çıkarır.
 */
export default function AnaSayfaDuzeniSayfasi() {
  const { session } = useOturum();
  const taslak = useTaslakBolumler();
  const yayin = useSonYayin();
  const geziler = useYonetimGezileri();
  const yerler = useYonetimYerleri();
  const sehirler = useYonetimSehirleri();
  const enCokAlinan = useEnCokAlinan();
  const is = useBolumIslemleri();
  const [acikId, setAcikId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const bolumler = taslak.data ?? [];
  const dene = (p: Promise<unknown>) => p.catch(() => setHata(ty('gezi.islemHata')));
  const secenekler = {
    geziler: geziler.data ?? [],
    yerler: (yerler.data ?? []).map((y) => ({ id: y.id, ad: y.ad })),
    sehirler: (sehirler.data ?? []).map((sh) => ({ id: sh.id, ad: sh.ad })),
  };
  const farkli = yayindanFarkli(bolumler, yayin.data?.bolumler ?? null);
  const planli = planliSatirlar(bolumler, ty);

  const yayinla = async () => {
    setMesgul(true);
    setHata(null);
    try {
      await is.yayinla();
    } catch {
      setHata(ty('anaSayfa.yayinHata'));
    } finally {
      setMesgul(false);
    }
  };
  const ekle = async () => {
    try {
      const { id } = await is.ekle(yeniBolum(bolumler, ty('anaSayfa.yeniBaslik')));
      setAcikId(id);
    } catch {
      setHata(ty('gezi.islemHata'));
    }
  };
  const durumMetni = farkli ? ty('anaSayfa.bekleyen') : yayin.data ? ty('anaSayfa.yayinlandi', { saat: saatMetni(new Date(yayin.data.yayinlandi_at)) }) : null;

  return (
    <YonetimSayfasi
      sutunlu
      baslik={ty('menu.anaSayfa')}
      eylemler={
        <>
          {durumMetni ? <Text style={s.durum}>{durumMetni}</Text> : null}
          <Hap baslik={ty('gezi.onizle')} onPress={() => window.open('/yonetim/ana-sayfa/onizle', '_blank')} ikon={<GozIkonu />} />
          <Hap tur="birincil" baslik={ty('gezi.yayinla')} onPress={yayinla} yukleniyor={mesgul} />
        </>
      }>
      <ScrollView style={s.orta} contentContainerStyle={s.ortaIc}>
        <Text style={s.aciklama}>{ty('anaSayfa.aciklama')}</Text>
        {hata ? (
          <Pressable accessibilityRole="button" onPress={() => setHata(null)}>
            <Text style={s.hata}>{hata}</Text>
          </Pressable>
        ) : null}
        {bolumler.map((b, i) => (
          <BolumSatiri
            key={b.id}
            bolum={b}
            indeks={i}
            secenekler={secenekler}
            acik={acikId === b.id}
            onAcKapa={() => setAcikId(acikId === b.id ? null : b.id)}
            onGuncelle={(alanlar) => dene(is.guncelle(b.id, alanlar))}
            onSil={() => dene(is.sil(b.id))}
            onBirak={(k, h) => dene(is.sirala(tasi(bolumler, k, h)))}
          />
        ))}
        <Pressable accessibilityRole="button" onPress={ekle} style={s.ekle}>
          <Text style={s.ekleMetin}>{ty('anaSayfa.ekle')}</Text>
        </Pressable>
        <View style={s.planli}>
          <Text style={s.planliMetin}>
            <Text style={s.planliBaslik}>{`${ty('anaSayfa.planliBaslik')} `}</Text>
            {planli.length ? `${planli.join('; ')}.` : ty('anaSayfa.planliYok')}
            {` ${ty('anaSayfa.yayinNotu')}`}
          </Text>
        </View>
      </ScrollView>
      <View style={s.onizleme}>
        <Text style={s.etiket}>{ty('anaSayfa.onizleme')}</Text>
        <View style={[s.cerceve, { width: ANA_SAYFA_TELEFON.genislik * OLCEK, height: ANA_SAYFA_TELEFON.yukseklik * OLCEK }]}>
          <View style={[s.olcek, { transform: [{ scale: OLCEK }] }]}>
            <AnaSayfaOnizleme
              bolumler={bolumler}
              geziler={geziler.data ?? []}
              yerler={yerler.data ?? []}
              sehirler={sehirler.data ?? []}
              enCokAlinan={enCokAlinan.data ?? null}
              ad={kullaniciEtiketi(session?.user.user_metadata?.full_name as string | undefined, session?.user.email).ad.split(' ')[0]}
            />
          </View>
        </View>
      </View>
    </YonetimSayfasi>
  );
}

function GozIkonu() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

const s = StyleSheet.create({
  durum: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  orta: { flex: 1, minWidth: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac },
  ortaIc: { paddingVertical: 20, paddingHorizontal: 24, gap: 10 },
  aciklama: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil, paddingBottom: 4 },
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: '#ff5a1f' },
  ekle: { height: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: yRenk.cerceve, justifyContent: 'center' },
  ekleMetin: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.ikincil },
  planli: { marginTop: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: yRenk.yuzey },
  planliMetin: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 18, color: yRenk.ikincil },
  planliBaslik: { fontFamily: yazi.ekstra, color: yRenk.metin },
  onizleme: { width: 300, flexShrink: 0, paddingVertical: 14, paddingHorizontal: 16, gap: 8, backgroundColor: yRenk.yuzey },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  cerceve: { borderRadius: 16, overflow: 'hidden' },
  olcek: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
});
