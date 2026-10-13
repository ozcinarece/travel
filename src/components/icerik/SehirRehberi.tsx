import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeriHapi } from '@/components/harita/HaritaEkrani';
import { GeziKarti } from '@/components/icerik/GeziKarti';
import { MdYazi } from '@/components/icerik/MdYazi';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { Buton } from '@/components/ui/Buton';
import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import { Ikon } from '@/components/ui/Ikon';
import { aktifBolum, bolumYazisi, okumaOrani, rehberMekanIdleri } from '@/features/icerik/rehber';
import { useGeziler, useSehirRehberi, useSehirYerleri } from '@/features/icerik/sorgular';
import { useMekanEkle, useMekanGuncelle, useMekanlar, useMekanSil } from '@/features/mekanlar/sorgular';
import { useHafifYerler, useYerFotolari, type HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, varsayilanDakika } from '@/lib/kategori';
import { puanMetni } from '@/lib/puan';
import type { Sehir } from '@/lib/tipler';
import { bosluk, kose, renk, yazi } from '@/theme';

/** Kapak yüksekliği (kanvas 15). */
const KAPAK = 300;

type Props = {
  sehir: Sehir | undefined;
  sehirlerYukleniyor: boolean;
  onGeri: () => void;
  /** Seyahat içinde (Rehber sekmesi): geri hapında seyahat adı; mekan kartları seyahatin listesine ekler / çıkarır. */
  seyahat?: { id: string; ad: string; tz: string };
  /** "Rehberdeki N mekan ›" (seyahatte Keşfet'in "Rehberden" listesi; dışarıda yerler sayfası). */
  onRehberMekanlari?: () => void;
};

/**
 * #100 B KK2 → #142 KK4–5 (kanvas 15 · 15b): şehir rehberi — Gece kapak "ŞEHİR REHBERİ · {şehir}", özet, içindekiler çipleri
 * (kaydırır, süzmez), turuncu "Rehberdeki N mekan ›", bölümler blog gibi (numara, başlık, yazı; paragraf altında mekan kartı
 * EkleDugmesi, satır içi bağlantı turuncu alt çizgi → mekan rehberi), en altta "Bu şehirde hazır geziler". Kapak geçince üstte
 * "‹ {şehir} rehberi" + çipler sabit; okunan bölümün çipi Gece; turuncu okuma ilerleme çizgisi.
 */
export function SehirRehberi({ sehir, sehirlerYukleniyor, onGeri, seyahat, onRehberMekanlari }: Props) {
  const kenar = useSafeAreaInsets();
  const rehber = useSehirRehberi(sehir?.id);
  const geziler = useGeziler(sehir?.id);
  const sehirYerleri = useSehirYerleri(sehir?.id);
  const bolumler = useMemo(() => rehber.data ?? [], [rehber.data]);
  const mekanIdleri = useMemo(() => rehberMekanIdleri(bolumler.map((b) => b.yazi_md)), [bolumler]);
  const hafif = useHafifYerler(mekanIdleri);
  const fotolar = useYerFotolari(mekanIdleri);

  // Seyahat listesi: kartta EkleDugmesi (Listeye ekle / Listende ✓), mekan rehberinde aynı.
  const mekanlar = useMekanlar(seyahat?.id);
  const ekle = useMekanEkle(seyahat?.id ?? '');
  const sil = useMekanSil(seyahat?.id ?? '');
  const guncelle = useMekanGuncelle(seyahat?.id ?? '');
  const listedeki = (placeId: string) => mekanlar.data?.find((m) => m.place_id === placeId);
  const [mesgulId, setMesgulId] = useState<string | null>(null);
  const degistir = async (y: HafifYer) => {
    if (!seyahat) return;
    setMesgulId(y.place_id);
    try {
      const m = listedeki(y.place_id);
      if (m) await sil.mutateAsync(m.id);
      else await ekle.mutateAsync({ place_id: y.place_id, primary_type: y.primary_type, lat: y.lat, lng: y.lng });
    } finally {
      setMesgulId(null);
    }
  };
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelSure, setPanelSure] = useState<Record<string, number>>({});

  // KK5: yapışkan başlık, okunan bölüm, ilerleme.
  const kaydirici = useRef<ScrollView>(null);
  const [kaydirma, setKaydirma] = useState(0);
  const [icerikH, setIcerikH] = useState(0);
  const [gorunenH, setGorunenH] = useState(0);
  const [konumlar, setKonumlar] = useState<Record<string, number>>({});
  const [ustH, setUstH] = useState(150);
  const yapiskan = kaydirma > KAPAK - kenar.top - 60;
  const aktif = aktifBolum(kaydirma, bolumler.map((b) => konumlar[b.id]), ustH);
  const oran = okumaOrani(kaydirma, icerikH, gorunenH);
  const bolumeGit = (id: string) => {
    const y = konumlar[id];
    if (y !== undefined) kaydirici.current?.scrollTo({ y: Math.max(0, y - ustH + 4), animated: true });
  };

  if (sehirlerYukleniyor || (sehir && rehber.isPending)) {
    return (
      <View style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.ana} />
      </View>
    );
  }
  if (!sehir || rehber.isError) {
    return (
      <View style={[s.ekran, s.ortala, { paddingTop: kenar.top }]}>
        <Text style={s.hata}>{t('rehber.hata')}</Text>
        <Buton baslik={t('genel.geri')} tur="ikincil" onPress={onGeri} />
      </View>
    );
  }

  const mekanKarti = (placeId: string) => {
    const y = hafif.data?.[placeId];
    if (!y) return null;
    const foto = fotolar.data?.get(placeId) ?? null;
    const puan = puanMetni(y.puan);
    const listede = !!listedeki(placeId);
    return (
      <Pressable accessibilityRole="button" onPress={() => setPanelId(placeId)} style={({ pressed }) => [s.kart, pressed && { opacity: 0.85 }]}>
        <View style={s.kartFoto}>{foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}</View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.kartAd} numberOfLines={1}>
            {y.ad}
          </Text>
          <Text style={s.kartAlt} numberOfLines={1}>
            {[kategoriEtiketi(y.primary_type), puan ? `★ ${puan}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {seyahat ? <EkleDugmesi listede={listede} mesgul={mesgulId === placeId} onPress={() => degistir(y)} /> : null}
      </Pressable>
    );
  };
  const panelYeri = panelId ? hafif.data?.[panelId] : undefined;
  const panelMekani = panelId ? listedeki(panelId) : undefined;

  const cipler = (yatay: boolean) =>
    bolumler.map((b, i) => (
      <Pressable key={b.id} accessibilityRole="button" accessibilityState={{ selected: i === aktif }} onPress={() => bolumeGit(b.id)} style={[s.cip, yatay && s.cipYatay, i === aktif && s.cipAktif]}>
        <Text style={[s.cipMetin, i === aktif && s.cipMetinAktif]}>{b.baslik}</Text>
      </Pressable>
    ));
  const mekanSayisi = sehirYerleri.data?.length ?? 0;

  return (
    <View style={s.ekran} onLayout={(e) => setGorunenH(e.nativeEvent.layout.height)}>
      <ScrollView
        ref={kaydirici}
        scrollEventThrottle={32}
        onScroll={(e) => setKaydirma(e.nativeEvent.contentOffset.y)}
        onContentSizeChange={(_w, h) => setIcerikH(h)}
        contentContainerStyle={{ paddingBottom: Math.max(kenar.bottom, 16) + 24 }}>
        <View style={s.kapak}>
          {sehir.kapak_url ? <Image source={{ uri: sehir.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
          <View style={s.kapakGolge} />
          <View style={[s.kapakUst, { top: kenar.top + 12 }]}>
            {seyahat ? (
              <GeriHapi baslik={seyahat.ad} onPress={onGeri} />
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={onGeri} style={s.geriKare}>
                <Ikon ad="geri" boyut={20} renk={renk.ana} kalinlik={2.6} />
              </Pressable>
            )}
          </View>
          <View style={s.kapakMetin}>
            <Text style={s.ustBaslik}>{t('rehber.ustBaslik')}</Text>
            <Text accessibilityRole="header" style={s.baslik}>
              {sehir.ad}
            </Text>
          </View>
        </View>
        <View style={s.icerik}>
          {sehir.ozet ? <Text style={s.ozet}>{sehir.ozet}</Text> : null}
          {bolumler.length > 0 ? <View style={s.cipler}>{cipler(false)}</View> : null}
          {mekanSayisi > 0 && onRehberMekanlari ? (
            <Pressable accessibilityRole="button" onPress={onRehberMekanlari} style={({ pressed }) => [s.mekanlarKutu, pressed && { opacity: 0.9 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.mekanlarBaslik}>{t('rehber.mekanlar', { n: mekanSayisi })}</Text>
                <Text style={s.mekanlarAlt}>{t('rehber.mekanlarAlt')}</Text>
              </View>
              <View style={s.ileri}>
                <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.8} />
              </View>
            </Pressable>
          ) : null}
          {bolumler.map((b, i) => (
            <View
              key={b.id}
              style={s.bolum}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                setKonumlar((k) => (k[b.id] === y ? k : { ...k, [b.id]: y }));
              }}>
              <Text style={s.bolumNo}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={s.bolumBaslik}>{b.baslik}</Text>
              <MdYazi kaynak={bolumYazisi(b.yazi_md)} kenar={0} buyuk ipucu mekanKarti={mekanKarti} onMekan={(id) => (hafif.data?.[id] ? setPanelId(id) : null)} />
            </View>
          ))}
          {geziler.data && geziler.data.length > 0 ? (
            <View style={{ gap: 10, paddingTop: 8 }}>
              <Text style={s.seritBaslik}>{t('rehber.geziler')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.serit} style={{ marginHorizontal: -bosluk.kenar }}>
                {geziler.data.map((g, i) => (
                  <View key={g.id} style={{ width: 230 }}>
                    <GeziKarti gezi={g} sira={i} onPress={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {yapiskan ? (
        <View style={[s.yapiskan, { paddingTop: kenar.top + 8 }]} onLayout={(e) => setUstH(e.nativeEvent.layout.height)}>
          <View style={s.yapiskanSatir}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={onGeri} style={s.geriKare}>
              <Ikon ad="geri" boyut={20} renk={renk.ana} kalinlik={2.6} />
            </Pressable>
            <Text style={s.yapiskanBaslik} numberOfLines={1}>
              {t('rehber.yapiskan', { sehir: sehir.ad })}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {cipler(true)}
          </ScrollView>
          <View style={s.ilerleme} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(oran * 100) }}>
            <View style={[s.ilerlemeDolu, { width: `${Math.round(oran * 100)}%` }]} />
          </View>
        </View>
      ) : null}

      {panelId && panelYeri ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <MekanPaneli
            placeId={panelId}
            tz={seyahat?.tz}
            hafif={panelYeri}
            dakika={panelMekani?.default_minutes ?? panelSure[panelId] ?? varsayilanDakika(panelYeri.primary_type)}
            onSure={(fark) => {
              const simdi = panelMekani?.default_minutes ?? panelSure[panelId] ?? varsayilanDakika(panelYeri.primary_type);
              const yeni = Math.min(480, Math.max(15, simdi + fark));
              if (panelMekani) guncelle.mutate({ id: panelMekani.id, default_minutes: yeni });
              else setPanelSure((x) => ({ ...x, [panelId]: yeni }));
            }}
            baglam="kesfet"
            icinde={!!panelMekani}
            mesgul={mesgulId === panelId}
            onCta={() => (seyahat ? degistir(panelYeri) : undefined)}
            onYolTarifi={() =>
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${panelYeri.lat},${panelYeri.lng}&destination_place_id=${encodeURIComponent(panelId)}&travelmode=walking`)
            }
            onKapat={() => setPanelId(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  kapak: { height: KAPAK, backgroundColor: renk.ana, justifyContent: 'flex-end' },
  kapakGolge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(21,42,107,0.55)' },
  kapakUst: { position: 'absolute', left: 16, right: 16, flexDirection: 'row' },
  geriKare: { width: 40, height: 40, borderRadius: kose.alan, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  kapakMetin: { paddingHorizontal: bosluk.kenar, paddingBottom: 26, gap: 6 },
  ustBaslik: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.96, color: '#ffb27a' },
  baslik: { fontFamily: yazi.baslik, fontSize: 36, lineHeight: 38, letterSpacing: -1.08, color: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 20, gap: 16 },
  ozet: { fontFamily: yazi.normal, fontSize: 16, lineHeight: 25.6, color: '#232b48' },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cip: { height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  cipYatay: { height: 36 },
  cipAktif: { backgroundColor: renk.ana },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  cipMetinAktif: { color: renk.zemin },
  mekanlarKutu: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: renk.vurgu },
  mekanlarBaslik: { fontFamily: yazi.baslik, fontSize: 17, color: renk.metin },
  mekanlarAlt: { fontFamily: yazi.yari, fontSize: 13, color: renk.metin },
  ileri: { transform: [{ rotate: '180deg' }] },
  bolum: { gap: 12, paddingTop: 6 },
  bolumNo: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.96, color: renk.ikincil },
  bolumBaslik: { fontFamily: yazi.baslik, fontSize: 24, letterSpacing: -0.6, color: renk.metin, marginTop: -8 },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  kartFoto: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: renk.yuzey },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  seritBaslik: { fontFamily: yazi.baslik, fontSize: 20, letterSpacing: -0.4, color: renk.metin },
  serit: { paddingHorizontal: bosluk.kenar, gap: 12 },
  yapiskan: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, paddingBottom: 10, gap: 10, backgroundColor: renk.zemin, shadowColor: renk.metin, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  yapiskanSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yapiskanBaslik: { flex: 1, fontFamily: yazi.baslik, fontSize: 17, color: renk.metin },
  ilerleme: { height: 3, borderRadius: 2, backgroundColor: renk.ayrac, overflow: 'hidden' },
  ilerlemeDolu: { height: '100%', borderRadius: 2, backgroundColor: renk.vurgu },
  hata: { fontFamily: yazi.kalin, fontSize: 13, color: renk.uyari, textAlign: 'center' },
});
