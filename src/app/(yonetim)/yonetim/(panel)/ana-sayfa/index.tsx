import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Hap } from '@/components/yonetim/Hap';
import { YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { AnaSayfaOnizleme, ANA_SAYFA_TELEFON } from '@/components/yonetim/anaSayfa/AnaSayfaOnizleme';
import { BolumSatiri } from '@/components/yonetim/anaSayfa/BolumSatiri';
import { yRenk } from '@/components/yonetim/tema';
import { RAF_EN_AZ, rafGezileri } from '@/features/anasayfa/raflar';
import { bannerUyarisi, paneldeSirala, planliSatirlar, yayindanFarkli, yeniBolum } from '@/features/yonetim/anaSayfa';
import { useBolumIslemleri, useSonYayin, useTaslakBolumler, useYayindakiAkis } from '@/features/yonetim/anaSayfaSorgulari';
import { saatMetni, tasi } from '@/features/yonetim/gezi';
import { useYonetimGezileri, useYonetimSehirleri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import { useYonetimYerleri } from '@/features/yonetim/yerSorgulari';
import { gorunenBolumler } from '@/lib/anaSayfa';
import { yazi } from '@/theme';

const OLCEK = 0.56;

/**
 * #109 ana sayfa düzeni (kanvas ekran 3; #406 2/2: raf ve banner düzenleyicisi, v6 önizleme): bölüm listesi (sürükle = sıra, anahtar = açık/kapalı, Düzenle = içerik),
 * "+ Raf" · "+ Banner" (banner başta sabit; #438 inceleme), planlı yayın kutusu; sağda uygulama ana sayfası önizlemesi. Düzenlemeler taslağa anında yazılır;
 * "Yayınla" taslağı canlıya çıkarır.
 */
export default function AnaSayfaDuzeniSayfasi() {
  const taslak = useTaslakBolumler();
  const yayin = useSonYayin();
  const geziler = useYonetimGezileri();
  const yerler = useYonetimYerleri();
  const sehirler = useYonetimSehirleri();
  const is = useBolumIslemleri();
  const [acikId, setAcikId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  // #438 inceleme 2: görseli yazılıp kaydedilmemiş banner'lar; Yayınla bunlar varken durur.
  const [kirliler, setKirliler] = useState<ReadonlySet<string>>(new Set());
  const bolumler = taslak.data ?? [];
  const liste = useMemo(() => paneldeSirala(bolumler), [bolumler]);
  const bannerSayisi = liste.filter((b) => b.tur === 'banner').length;
  const akis = useYayindakiAkis();
  const gorunen = useMemo(() => gorunenBolumler(bolumler), [bolumler]);
  const rafSayilari = useMemo(
    () => new Map(gorunen.filter((b) => b.tur === 'raf').map((b) => [b.id, rafGezileri(b.icerik, akis.data ?? []).length] as const)),
    [gorunen, akis.data],
  );
  const uyari = (b: (typeof bolumler)[number]) => (akis.data ? bannerUyarisi(b, gorunen, akis.data, rafSayilari, RAF_EN_AZ) : null);
  const kirliDegis = (id: string, kirli: boolean) =>
    setKirliler((eski) => {
      if (eski.has(id) === kirli) return eski;
      const yeni = new Set(eski);
      if (kirli) yeni.add(id);
      else yeni.delete(id);
      return yeni;
    });
  const kaydedilmemis = liste.some((b) => kirliler.has(b.id));
  const dene = (p: Promise<unknown>) => p.catch(() => setHata(ty('gezi.islemHata')));
  const secenekler = {
    geziler: geziler.data ?? [],
    yerler: (yerler.data ?? []).map((y) => ({ id: y.id, ad: y.ad })),
    sehirler: (sehirler.data ?? []).map((sh) => ({ id: sh.id, ad: sh.ad })),
    raflar: bolumler.filter((b) => b.tur === 'raf').map((b) => ({ id: b.id, ad: b.baslik })),
    gezilerYukleniyor: geziler.isPending,
  };
  const farkli = yayindanFarkli(bolumler, yayin.data?.bolumler ?? null);
  const planli = planliSatirlar(bolumler, ty);

  const yayinla = async () => {
    if (kaydedilmemis) return setHata(ty('anaSayfa.yayinGorselBekliyor'));
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
  const ekle = async (tur: 'raf' | 'banner') => {
    try {
      const { id } = await is.ekle(yeniBolum(bolumler, ty('anaSayfa.yeniBaslik'), tur));
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
          <Hap tur="vurgu" baslik={ty('gezi.yayinla')} onPress={yayinla} yukleniyor={mesgul} />
        </>
      }>
      <ScrollView style={s.orta} contentContainerStyle={s.ortaIc}>
        <Text style={s.aciklama}>{ty('anaSayfa.aciklama')}</Text>
        {hata ? (
          <Pressable accessibilityRole="button" onPress={() => setHata(null)}>
            <Text style={s.hata}>{hata}</Text>
          </Pressable>
        ) : null}
        {liste.map((b, i) => (
          <BolumSatiri
            key={b.id}
            bolum={b}
            indeks={i}
            secenekler={secenekler}
            acik={acikId === b.id}
            uyari={uyari(b)}
            onKirli={(k) => kirliDegis(b.id, k)}
            onAcKapa={() => setAcikId(acikId === b.id ? null : b.id)}
            onGuncelle={(alanlar) => dene(is.guncelle(b.id, alanlar))}
            onSil={() => {
              kirliDegis(b.id, false);
              return dene(is.sil(b.id));
            }}
            // Banner'lar başta sabit: raf onların üstüne bırakılamaz.
            onBirak={(k, h) => dene(is.sirala(tasi(liste, k, Math.max(h, bannerSayisi))))}
          />
        ))}
        <View style={s.ekleSatiri}>
          <Pressable accessibilityRole="button" onPress={() => ekle('raf')} style={s.ekle}>
            <Text style={s.ekleMetin}>{ty('anaSayfa.ekleRaf')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => ekle('banner')} style={s.ekle}>
            <Text style={s.ekleMetin}>{ty('anaSayfa.ekleBanner')}</Text>
          </Pressable>
        </View>
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
            <AnaSayfaOnizleme bolumler={bolumler} />
          </View>
        </View>
      </View>
    </YonetimSayfasi>
  );
}

function GozIkonu() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.ana} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.hata },
  ekleSatiri: { flexDirection: 'row', gap: 10 },
  ekle: { flex: 1, height: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: yRenk.cerceve, justifyContent: 'center' },
  ekleMetin: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.ikincil },
  planli: { marginTop: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: yRenk.yuzey },
  planliMetin: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 18, color: yRenk.ikincil },
  planliBaslik: { fontFamily: yazi.ekstra, color: yRenk.metin },
  onizleme: { width: 300, flexShrink: 0, paddingVertical: 14, paddingHorizontal: 16, gap: 8, backgroundColor: yRenk.zemin, borderLeftWidth: 1, borderLeftColor: yRenk.ayrac },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  cerceve: { borderRadius: 16, overflow: 'hidden' },
  olcek: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
});
