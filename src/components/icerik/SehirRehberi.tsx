import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { KapakAtfi } from '@/components/icerik/KapakAtfi';
import { MdYazi } from '@/components/icerik/MdYazi';
import { GeriAlBandi } from '@/components/listem/GeriAlBandi';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { AnaGeziKarti } from '@/components/ortak/AnaGeziKarti';
import { InceEkle, Kamera } from '@/components/ortak/YerSatiri';
import { Sekme, SekmeSatiri } from '@/components/ortak/Sekme';
import { Buton } from '@/components/ui/Buton';
import { Foto } from '@/components/ui/Foto';
import { kapakTonu } from '@/features/anasayfa/v5';
import { icerikHafif } from '@/features/icerik/fotolar';
import { kapakVeAtif } from '@/features/icerik/kapakAtfi';
import { useIcerikMekanlari, type BilinenMekanlar } from '@/features/icerik/mekanBilgileri';
import { bolumYazisi, doluBolumler, rehberKartIdleri, rehberMekanIdleri } from '@/features/icerik/rehber';
import { useGeziler, useSehirRehberi, useSehirYerleri } from '@/features/icerik/sorgular';
import { useGeriAlinabilirSil } from '@/features/mekanlar/geriAlinabilirSil';
import { useMekanEkle, useMekanGuncelle, useMekanlar } from '@/features/mekanlar/sorgular';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { bilinenKategori, varsayilanDakika } from '@/lib/kategori';
import type { Sehir } from '@/lib/tipler';
import { anaV5, renk, yazi } from '@/theme';

/** Kapak yüksekliği (`Sayfa_v5_SehirRehberi`). */
const KAPAK = 260;

type Props = {
  sehir: Sehir | undefined;
  sehirlerYukleniyor: boolean;
  onGeri: () => void;
  /** Seyahat içinde: gri "Seyahat listesine ekle" satırı görünür; mekan satırları seyahatin listesine ekler / çıkarır. */
  seyahat?: { id: string; ad: string; tz: string };
  /** KK3 "Seyahat listesine ekle" → Keşfet'in "Rehberden" listesi. */
  onRehberMekanlari?: () => void;
  /** #172: BO önizlemesi — taslağın bildiği mekanlar (yayından önce DB'de yazı satırı yok). */
  bilinen?: BilinenMekanlar;
};

/**
 * #397 (UX önerileri kanvası, `Sayfa_v5_SehirRehberi`): şehir rehberi v5 — üstte 260 px Commons kapağı (yoksa düz zemin,
 * sağ altta atıf), şehir adı 28 px ve en çok 2 satır özet; seyahatten açıldıysa gri "N rehber mekânı · Seyahat listesine
 * ekle" satırı (ekranın tek turuncu eylemi); altı çizili bölüm sekmeleri (yalnız içi dolu bölümler); seçili bölümün yazısı,
 * içindeki mekanlar sade satır (56 px foto, ad, kategori, ince + / tik); en altta şehrin hazır gezileri ana sayfa kartıyla
 * alt alta. Önceki sürümün çipleri, yapışkan başlığı ve okuma çizgisi kalktı.
 */
export function SehirRehberi({ sehir, sehirlerYukleniyor, onGeri, seyahat, onRehberMekanlari, bilinen }: Props) {
  const kenar = useSafeAreaInsets();
  const rehber = useSehirRehberi(sehir?.id);
  const geziler = useGeziler(sehir?.id);
  const sehirYerleri = useSehirYerleri(sehir?.id);
  const bolumler = useMemo(() => rehber.data ?? [], [rehber.data]);
  const mekanIdleri = useMemo(() => rehberMekanIdleri(bolumler.map((b) => b.yazi_md)), [bolumler]);
  // #172 KK7–KK9: kart ve bağlantıların adı, kategorisi, konumu DB'den; fotoğraf önce bizim, yoksa Google (yalnız kartlar);
  // puan gösterilmez. Panel saat / puan için Google'a yalnız açılınca gider (places-full, KK10).
  const kartIdleri = useMemo(() => rehberKartIdleri(bolumler.map((b) => b.yazi_md)), [bolumler]);
  const icerik = useIcerikMekanlari(mekanIdleri, { kartlar: kartIdleri, bilinen });
  const hafifYeri = (placeId: string): HafifYer | undefined => {
    const m = icerik.mekan(placeId);
    return m ? icerikHafif(placeId, m) : undefined;
  };

  // Seyahat listesi: kartta EkleDugmesi (Listeye ekle / Listende ✓), mekan rehberinde aynı.
  const mekanlar = useMekanlar(seyahat?.id);
  const ekle = useMekanEkle(seyahat?.id ?? '');
  const guncelle = useMekanGuncelle(seyahat?.id ?? '');
  // #387: ✓ ile çıkarılan mekan 5 sn "Geri al" bandında bekler; o sürede listede sayılmaz.
  // #387 inceleme 2: silme hatası Listem'deki gibi bilgi bandında (3,5 sn).
  const [bildirim, setBildirim] = useState<string | null>(null);
  useEffect(() => {
    if (!bildirim) return;
    const z = setTimeout(() => setBildirim(null), 3500);
    return () => clearTimeout(z);
  }, [bildirim]);
  const geriAlinabilir = useGeriAlinabilirSil(seyahat?.id, () => setBildirim(t('listem.hata')));
  const cikanId = geriAlinabilir.bekleyen?.mekanId;
  const listedeki = (placeId: string) => mekanlar.data?.find((m) => m.place_id === placeId && m.id !== cikanId);
  const [mesgulId, setMesgulId] = useState<string | null>(null);
  const degistir = async (y: HafifYer) => {
    if (!seyahat) return;
    const m = listedeki(y.place_id);
    // #387 KK1: ✓ hemen silmez (bant kapanınca silinir); bant açıkken aynı mekana + basılırsa çıkarma geri alınır.
    if (m) return geriAlinabilir.cikar(m, y.ad);
    if (geriAlinabilir.bekleyen?.placeId === y.place_id) return geriAlinabilir.geriAl();
    setMesgulId(y.place_id);
    try {
      await ekle.mutateAsync({ place_id: y.place_id, primary_type: y.primary_type, lat: y.lat, lng: y.lng });
    } finally {
      setMesgulId(null);
    }
  };
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelSure, setPanelSure] = useState<Record<string, number>>({});

  // #397 KK4: altı çizili sekmeler; yalnız içi dolu bölüm sekme olur, seçili bölümün yazısı gösterilir.
  const doluBolum = useMemo(() => doluBolumler(bolumler), [bolumler]);
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const secili = doluBolum.find((b) => b.id === seciliId) ?? doluBolum[0];
  const secIndex = secili ? doluBolum.indexOf(secili) : 0;

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

  // #397 KK5: sade satır — 56 px foto ya da kamera, ad, kategori; sağda ince "+" ya da tik.
  const mekanKarti = (placeId: string) => {
    const y = hafifYeri(placeId);
    if (!y) return null;
    const foto = icerik.foto(placeId);
    const listede = !!listedeki(placeId);
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={[y.ad, bilinenKategori(y.primary_type)].filter(Boolean).join(', ')} onPress={() => setPanelId(placeId)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.85 }]}>
        <View style={s.satirFoto}>{foto ? <Foto source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Kamera />}</View>
        <View style={s.satirMetin}>
          <Text style={s.satirAd} numberOfLines={1}>
            {y.ad}
          </Text>
          <Text style={s.satirAlt} numberOfLines={1}>
            {bilinenKategori(y.primary_type)}
          </Text>
        </View>
        {seyahat ? <InceEkle listede={listede} mesgul={mesgulId === placeId} onPress={() => degistir(y)} /> : null}
      </Pressable>
    );
  };
  const panelYeri = panelId ? hafifYeri(panelId) : undefined;
  const panelMekani = panelId ? listedeki(panelId) : undefined;

  const mekanSayisi = sehirYerleri.data?.length ?? 0;
  // #345 KK4: kapak varsa atfı (sağ altta).
  const sehirAtif = kapakVeAtif([sehir]).atif;

  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(kenar.bottom, 16) + 24 }}>
        {/* KK1: Commons kapağı ~260 px; yoksa düz zemin. Süsler yok. */}
        <View style={s.kapak}>
          {sehir.kapak_url ? <Foto source={{ uri: sehir.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} /> : <Kamera />}
          {sehirAtif ? <KapakAtfi atif={sehirAtif} /> : null}
        </View>
        {/* KK2: şehir adı 28 px, altında en çok 2 satır özet. */}
        <View style={s.baslikBlok}>
          <Text accessibilityRole="header" style={s.baslik}>
            {sehir.ad}
          </Text>
          {sehir.ozet ? (
            <Text style={s.ozet} numberOfLines={2}>
              {sehir.ozet}
            </Text>
          ) : null}
        </View>
        {/* KK3: yalnız seyahatten açıldıysa; ekranın tek turuncu eylemi. */}
        {seyahat && mekanSayisi > 0 && onRehberMekanlari ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('rehber.mekanSayisi', { n: mekanSayisi })}, ${t('rehber.listeyeEkle')}`} onPress={onRehberMekanlari} style={({ pressed }) => [s.griSatir, pressed && { opacity: 0.85 }]}>
            <Text style={s.griSatirMetin}>{t('rehber.mekanSayisi', { n: mekanSayisi })}</Text>
            <Text style={s.griSatirEylem}>{t('rehber.listeyeEkle')}</Text>
          </Pressable>
        ) : null}
        {doluBolum.length > 0 ? (
          <SekmeSatiri aralik={24}>
            {doluBolum.map((b, i) => (
              <Sekme key={b.id} baslik={b.bolum ? t(`rehber.bolum.${b.bolum}`) : b.baslik} boyut={15} secili={i === secIndex} onPress={() => setSeciliId(b.id)} />
            ))}
          </SekmeSatiri>
        ) : null}
        {secili ? (
          <View style={s.bolum}>
            <MdYazi kaynak={bolumYazisi(secili.yazi_md)} kenar={0} ipucu mekanKarti={mekanKarti} onMekan={(id) => (icerik.mekan(id) ? setPanelId(id) : null)} />
          </View>
        ) : null}
        {/* KK6: bu şehrin hazır gezileri, ana sayfa kartıyla alt alta. */}
        {geziler.data && geziler.data.length > 0 ? (
          <View style={s.geziler}>
            <Text accessibilityRole="header" style={s.gezilerBaslik}>
              {t('rehber.geziler')}
            </Text>
            {geziler.data.map((g) => (
              <AnaGeziKarti key={g.id} gezi={g} ton={kapakTonu(g.amaclar, null)} onAc={() => router.push({ pathname: '/gezi/[slug]', params: { slug: g.slug } })} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel={seyahat ? t('rehber.geriSeyahat', { seyahat: seyahat.ad }) : t('genel.geri')} onPress={onGeri} hitSlop={4} style={[s.geri, { top: kenar.top + 8 }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={renk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 5l-7 7 7 7" />
        </Svg>
      </Pressable>

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
      {geriAlinabilir.bekleyen ? (
        <GeriAlBandi metin={geriAlinabilir.bekleyen.metin} olay={geriAlinabilir.bekleyen} onGeriAl={geriAlinabilir.geriAl} alt={kenar.bottom + 16} />
      ) : bildirim ? (
        <GeriAlBandi metin={bildirim} alt={kenar.bottom + 16} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  kapak: { height: KAPAK, backgroundColor: anaV5.fotoYok },
  geri: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center', shadowColor: renk.metin, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  baslikBlok: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.28, color: renk.metin },
  ozet: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: anaV5.ikincil },
  griSatir: { marginHorizontal: 16, marginBottom: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 44, borderRadius: 14, backgroundColor: anaV5.satirZemin, flexDirection: 'row', alignItems: 'center', gap: 10 },
  griSatirMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  griSatirEylem: { fontFamily: yazi.kalin, fontSize: 15, color: anaV5.adim },
  bolum: { paddingTop: 14, paddingHorizontal: 16 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  satirFoto: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: anaV5.fotoYok },
  satirMetin: { flex: 1, minWidth: 0, gap: 1 },
  satirAd: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  geziler: { paddingHorizontal: 16, paddingTop: 24, gap: 16 },
  gezilerBaslik: { fontFamily: yazi.ekstra, fontSize: 20, color: renk.metin },
  hata: { fontFamily: yazi.kalin, fontSize: 13, color: renk.uyari, textAlign: 'center' },
});
