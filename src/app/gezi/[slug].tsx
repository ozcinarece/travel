import { Foto } from '@/components/ui/Foto';
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeziPlani } from '@/components/icerik/GeziPlani';
import { HazirGeziHaritasi, KalpDugmesi } from '@/components/icerik/HazirGeziHaritasi';
import { GeriAlBandi } from '@/components/listem/GeriAlBandi';
import { MdYazi } from '@/components/icerik/MdYazi';
import { GeziAl } from '@/components/icerik/GeziAl';
import { AmacKapagi } from '@/components/ortak/AmacKapagi';
import { MekanPaneli } from '@/components/mekan/MekanPaneli';
import { SecimMenusu } from '@/components/program/SecimMenusu';
import { BolumSiniri } from '@/components/ui/BolumSiniri';
import { Buton } from '@/components/ui/Buton';
import { EklemeDurumSatiri } from '@/components/ui/EklemeDurumSatiri';
import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import { Ikon } from '@/components/ui/Ikon';
import { Logo } from '@/components/ui/Logo';
import { kapakTonu, kartAltSatiri } from '@/features/anasayfa/v5';
import { cevrimdisiDurumu, eklemeHatasi, type EklemeDurumu } from '@/features/ekleme/eklemeDurumu';
import { icerikHafif, useIcerikCanli, type IcerikHafif } from '@/features/icerik/fotolar';
import { useIcerikMekanlari } from '@/features/icerik/mekanBilgileri';
import { rehberKartIdleri, rehberMekanIdleri } from '@/features/icerik/rehber';
import { cozumSebebi, olayYaz, useGezi, useGeziAlinma } from '@/features/icerik/sorgular';
import { hedefSeyahatler, useYereEkle, varsayilanHedef } from '@/features/icerik/yerEkle';
import { useGeriAlinabilirSil } from '@/features/mekanlar/geriAlinabilirSil';
import { useMekanGuncelle, useMekanlar } from '@/features/mekanlar/sorgular';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { yolTarifiHedefi } from '@/lib/konum';
import { kapakVeAtif } from '@/features/icerik/kapakAtfi';
import { t } from '@/i18n';
import { useCevrimdisi } from '@/lib/baglanti';
import { davetLinki } from '@/lib/davetLinki';
import { hataOzeti } from '@/lib/izler';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import { okumaSuresiDk } from '@/lib/markdown';
import { AYLAR, parcala, tarihAraligi } from '@/lib/takvim';
import type { GeziDuragi } from '@/lib/tipler';
import { anaV5, bosluk, renk, yazi } from '@/theme';

type Sekme = 'plan' | 'yazi';
/** Eklenecek / çıkarılacak mekan (durak satırı ya da yazıdaki mekan kartı). */
/** #205 Parça 1: `lat`/`lng` null = durağın konumu boşalmış (gece temizliği); listeye konumsuz eklenir. */
type Yer = { anahtar: string; place_id: string; ad: string; primary_type: string | null; lat: number | null; lng: number | null; dakika?: number };

/**
 * #97 B → #143 → #408 (UX önerileri kanvası `Sayfa_v6_HazirGezi_Harita` açılış · `Sayfa_v5_HazirGezi_Kayik` kaydırınca):
 * hazır gezi tek sayfa — üstte 330 px harita (geri / paylaş / ♥ daireleri, gün düğmeleri; KK1), altında 64 px kare kapak, ad ve
 * iki gri satır (KK2), alt çizgili Plan · Yazı sekmeleri (yazı yoksa sekme yok) ve bütün günlerin durakları (KK3). Kaydırınca
 * harita gider, üstte sabit satır (geri, 36 px kapak, ad ve "N gün · N durak", paylaş, ♥) ve altında sekmeler (KK4). Alt çubuk:
 * solda "Tek bir gününü de alabilirsin", sağda turuncu "Seyahatime al" (KK5). "+ / ✓" aynı şehirdeki en yakın tarihli seyahate
 * göre; seyahat yoksa + ilk dokunuşta "Hangi seyahate?" (#143 KK3; kesikli bağlam kutusu kalktı).
 */
export default function GeziEkrani() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const gezi = useGezi(slug);
  const alinma = useGeziAlinma(gezi.data?.id);
  const kenar = useSafeAreaInsets();
  const kaydirici = useRef<ScrollView>(null);
  // #388: çift basış / üst üste "Tekrar dene" ikinci ekleme isteğini göndermez (Seyahatime al'daki kilit).
  const eklemeKilidi = useRef(false);
  const [sekme, setSekme] = useState<Sekme>('plan');
  const [gunSira, setGunSira] = useState(0);
  const [sekmeY, setSekmeY] = useState(0);
  const [yapisik, setYapisik] = useState(false);
  const [alAcik, setAlAcik] = useState(false);
  const [alHata, setAlHata] = useState<EklemeDurumu | null>(null);
  const [altCubukH, setAltCubukH] = useState(88);
  // #388 KK5 (kanvas 23c): bağlantı yokken + düğmeleri pasif.
  const cevrimdisi = useCevrimdisi();

  // KK3: hedef seyahat — kullanıcı seçtiyse o, değilse aynı şehirdeki en yakın tarihli seyahat.
  const seyahatler = useSeyahatler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  const [secilenHedefId, setSecilenHedefId] = useState<string | null>(null);
  const hedef = hedefler.find((s) => s.id === secilenHedefId) ?? varsayilanHedef(hedefler, gezi.data?.sehirler?.ad);
  const [hedefMenusu, setHedefMenusu] = useState<{ bekleyen: Yer | null } | null>(null);
  const hedefMekanlar = useMekanlar(hedef?.id);
  // #387: ✓ ile çıkarılan mekan 5 sn "Geri al" bandında bekler; o sürede listede sayılmaz (düğme + olur).
  // #387 inceleme 2: silme hatası alt çubuk yerine bant yerinde (panel açıkken de görünür), 3,5 sn sonra kalkar.
  const [silHata, setSilHata] = useState<string | null>(null);
  const geriAlinabilir = useGeriAlinabilirSil(hedef?.id, () => setSilHata(t('listem.hata')));
  useEffect(() => {
    if (!silHata) return;
    const z = setTimeout(() => setSilHata(null), 3500);
    return () => clearTimeout(z);
  }, [silHata]);
  const cikan = geriAlinabilir.bekleyen;
  const listedeki = (placeId: string) => hedefMekanlar.data?.find((m) => m.place_id === placeId && m.id !== cikan?.mekanId);
  const ekle = useYereEkle();
  const guncelle = useMekanGuncelle(hedef?.id ?? '');
  const [mesgulId, setMesgulId] = useState<string | null>(null);

  const duraklar = useMemo(() => gezi.data?.gezi_gunleri.flatMap((g) => g.gezi_duraklari) ?? [], [gezi.data]);
  const canli = useIcerikCanli(duraklar, () => gezi.data?.sehirler?.ad ?? '', !!gezi.data);
  const kimlik = useCallback((d: GeziDuragi) => canli.data?.get(d.id)?.place_id ?? d.place_id ?? null, [canli.data]);
  // Gezi yazısındaki mekan kartları (`::mekan[place_id]`) ve satır içi bağlantılar. #172 KK7–KK9: ad, kategori, konum DB'den
  // (yazının açtığı yer satırı; yoksa aynı mekanın gezi durağı); fotoğraf önce bizim, yoksa Google (yalnız kartlar); puan yok.
  const yaziIdleri = useMemo(() => rehberMekanIdleri([gezi.data?.yazi_md ?? '']), [gezi.data?.yazi_md]);
  const yaziKartlari = useMemo(() => rehberKartIdleri([gezi.data?.yazi_md ?? '']), [gezi.data?.yazi_md]);
  const yaziMekan = useIcerikMekanlari(yaziIdleri, { kartlar: yaziKartlari });
  const [panel, setPanel] = useState<{ placeId: string; hafif: IcerikHafif; dakika: number } | null>(null);

  useEffect(() => {
    if (gezi.data) olayYaz('gezi_goruntulendi', gezi.data.id, { slug });
  }, [gezi.data, slug]);

  if (gezi.isPending) {
    return (
      <View style={[s.ekran, s.ortala]}>
        <ActivityIndicator color={renk.ana} />
      </View>
    );
  }
  if (gezi.isError || !gezi.data) {
    // #199: sebep görünür (ekran görüntüsüyle iletilir) ve yeniden denenebilir; sunucu düzelince sayfa kapatılmadan açılır.
    return (
      <View style={[s.ekran, s.ortala, { paddingTop: kenar.top }]}>
        <Text style={s.hata}>{t('gezi.hata')}</Text>
        {gezi.error ? (
          <Text style={s.hataKod} selectable>
            {geziHataKodu(gezi.error)}
          </Text>
        ) : null}
        <Buton baslik={t('genel.yenidenDene')} yukleniyor={gezi.isFetching} onPress={() => gezi.refetch()} />
        <Buton baslik={t('genel.geri')} tur="ikincil" onPress={() => router.back()} />
      </View>
    );
  }
  const g = gezi.data;
  const yaziVar = !!g.yazi_md?.trim();
  const aktifSekme: Sekme = yaziVar ? sekme : 'plan';
  // #408 KK2: kapak yalnız kendi kapağımız (gezi, yoksa şehir); yoksa amacın kapağı. Google fotoğrafı kapağa gerilmez (#390).
  const kapakUri = kapakVeAtif([g, g.sehirler ?? {}]).uri;
  const ton = kapakTonu(g.amaclar, null);
  const gunDuraklari = g.gezi_gunleri.map((x) => x.gezi_duraklari.length);
  const altSatir = kartAltSatiri({ ...g, gunDuraklari });
  const kisaOzet = t('gezi.v6.ozet', { gun: gunDuraklari.length || g.gun_sayisi, durak: gunDuraklari.length ? gunDuraklari.reduce((a, b) => a + b, 0) : g.mekan_sayisi });
  const tarih = parcala(g.created_at.slice(0, 10));
  const alinmaSayisi = alinma.data ?? 0;
  const paylas = () => Share.share({ message: t('gezi.paylasMetin', { baslik: g.baslik, link: davetLinki(`gezi/${g.slug}`).replace('/r/gezi/', '/gezi/') }) }).catch(() => {});
  // KK4: sekmeler sabit satırın (52 px) altına gelince harita gitmiştir; sabit satır ve sekmeler üstte kalır.
  const yapismaY = sekmeY - kenar.top - USTSATIR;

  const hedefeEkle = async (y: Yer, seyahatId: string) => {
    if (eklemeKilidi.current) return;
    eklemeKilidi.current = true;
    setMesgulId(y.anahtar);
    try {
      await ekle.mutateAsync({ seyahatId, yerId: null, place_id: y.place_id, primary_type: y.primary_type, lat: y.lat, lng: y.lng, dakika: y.dakika });
      setAlHata(null);
    } catch (e) {
      setAlHata(eklemeHatasi(e, 'gezi-mekan-ekle', () => void hedefeEkle(y, seyahatId)));
    } finally {
      eklemeKilidi.current = false;
      setMesgulId(null);
    }
  };
  // KK3: ✓ → listeden çıkar; + → hedef seyahate ekle; hedef yoksa önce "Hangi seyahate?".
  // #387 KK1: ✓ hemen silmez; bant kapanınca silinir. Bant açıkken aynı mekana + basılırsa çıkarma geri alınır.
  const degistir = async (y: Yer) => {
    const m = listedeki(y.place_id);
    if (m && hedef) return geriAlinabilir.cikar(m, y.ad);
    if (hedef && cikan?.placeId === y.place_id) return geriAlinabilir.geriAl();
    if (hedef) return hedefeEkle(y, hedef.id);
    setHedefMenusu({ bekleyen: y });
  };
  const durakYeri = (d: GeziDuragi): Yer | null => {
    const pid = kimlik(d);
    if (!pid) {
      // #118: sebebi söyle — kimlik henüz çözülüyor / Google'da yok / sunucu hatası.
      const sebep = cozumSebebi(d.id);
      // #388 KK2 · KK4: sunucunun ham sebebi gösterilmez; Google adı da geçmez.
      setAlHata({ metin: canli.isPending ? t('anasayfa.cozuluyor') : sebep === 'bulunamadi' || !sebep ? t('anasayfa.bulunamadi') : t('anasayfa.ekleHata'), tur: 'hata' });
      return null;
    }
    return { anahtar: d.id, place_id: pid, ad: d.ad, primary_type: d.kategori, lat: d.lat, lng: d.lng, dakika: d.sure_dk };
  };
  const durakArti = (d: GeziDuragi) => {
    const y = durakYeri(d);
    if (y) degistir(y);
  };
  const durakListede = (d: GeziDuragi) => {
    const pid = kimlik(d);
    return !!pid && !!listedeki(pid);
  };
  const paneliAc = (placeId: string, hafif: IcerikHafif | null | undefined, dakika?: number) => {
    if (hafif) setPanel({ placeId, hafif, dakika: dakika ?? varsayilanDakika(hafif.primary_type) });
  };

  const sekmeSec = (yeni: Sekme) => {
    setSekme(yeni);
    // Yapışıkken sekme değişirse yeni içerik sekmelerin hemen altından başlar.
    if (yapisik) kaydirici.current?.scrollTo({ y: yapismaY, animated: false });
  };
  const sekmeler = yaziVar ? <Sekmeler deger={aktifSekme} onDeger={sekmeSec} /> : null;
  const kucukKapak = (boyut: number, kose: number) => (
    <View style={[s.kapak, { width: boyut, height: boyut, borderRadius: kose }]}>
      {kapakUri ? <Foto source={{ uri: kapakUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} /> : <AmacKapagi ton={ton} yukseklik={boyut} kose={kose} daire={false} />}
    </View>
  );

  const yeniSeyahat = () => {
    setAlAcik(false);
    router.navigate('/(tabs)/yeni');
  };

  /** Yazıdaki mekanın DB verisi (yazının yer satırı, yoksa aynı mekanın gezi durağı) — panelin yedeği, kart, listeye ekleme. */
  const yaziYeri = (placeId: string): { hafif: IcerikHafif; durak: GeziDuragi | undefined } | null => {
    const durak = duraklar.find((d) => kimlik(d) === placeId);
    const m = yaziMekan.mekan(placeId) ?? (durak ? { ad: durak.ad, kategori: durak.kategori, lat: durak.lat, lng: durak.lng } : null);
    return m ? { hafif: icerikHafif(placeId, m), durak } : null;
  };
  const mekanKarti = (placeId: string) => {
    const bilgi = yaziYeri(placeId);
    if (!bilgi) return null;
    const { hafif, durak } = bilgi;
    const foto = yaziMekan.mekan(placeId)?.foto ?? (durak ? canli.data?.get(durak.id)?.foto_uri : null) ?? yaziMekan.foto(placeId);
    const y: Yer = { anahtar: placeId, place_id: placeId, ad: hafif.ad, primary_type: hafif.primary_type, lat: hafif.lat, lng: hafif.lng, dakika: durak?.sure_dk };
    return (
      <Pressable accessibilityRole="button" onPress={() => paneliAc(placeId, hafif, listedeki(placeId)?.default_minutes ?? durak?.sure_dk)} style={({ pressed }) => [s.kart, pressed && { opacity: 0.85 }]}>
        <View style={s.kartFoto}>{foto ? <Foto source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.kartAd} numberOfLines={1}>
            {hafif.ad}
          </Text>
          <Text style={s.kartAlt} numberOfLines={1}>
            {[kategoriEtiketi(y.primary_type), durak ? sureMetni(durak.sure_dk) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <EkleDugmesi listede={!!listedeki(placeId)} mesgul={mesgulId === placeId} pasif={cevrimdisi} ipucu={cevrimdisi ? t('ekleme.baglantiYokIpucu') : undefined} onPress={() => degistir(y)} />
      </Pressable>
    );
  };
  const panelMekani = panel ? listedeki(panel.placeId) : undefined;

  return (
    <View style={s.ekran}>
      <ScrollView
        ref={kaydirici}
        contentContainerStyle={{ paddingBottom: 112 + kenar.bottom }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const yeni = sekmeY > 0 && y >= yapismaY;
          if (yeni !== yapisik) setYapisik(yeni);
        }}>
        {/* KK1: üstte harita; hata verirse yalnız harita kutusu kart olur (#199 KK3), düğmeler çalışır. */}
        <HazirGeziHaritasi gezi={g} gunSira={gunSira} onGunSira={setGunSira} onGeri={() => router.back()} onPaylas={paylas} />
        {/* KK2: 64 px kare kapak, ad ve iki gri satır (özet; "N gün · N durak · Tripmate rehberi"). */}
        <View style={s.baslikSatiri}>
          {kucukKapak(64, 12)}
          <View style={s.baslikMetin}>
            <Text style={s.baslik} numberOfLines={2} ellipsizeMode="tail" accessibilityRole="header">
              {g.baslik}
            </Text>
            {g.ozet ? (
              <Text style={s.gri} numberOfLines={2}>
                {g.ozet}
              </Text>
            ) : null}
            <Text style={s.gri} numberOfLines={1}>
              {altSatir}
            </Text>
          </View>
        </View>
        {/* KK3 · KK4: sekmelerin yeri (yazı yoksa sekme yok; yapışma yine buradan ölçülür). */}
        <View onLayout={(e) => setSekmeY(e.nativeEvent.layout.y)}>{sekmeler}</View>
        {aktifSekme === 'plan' ? (
          <View style={s.plan}>
            {/* Sekmeler aynı yerde: anahtar, bir sekmenin hatası öbürüne taşınmasın diye. */}
            <BolumSiniri key="plan" ad="gezi-plan">
              <GeziPlani
                gezi={g}
                canli={canli.data}
                listede={durakListede}
                mesgulId={mesgulId}
                onDurakEkle={durakArti}
                eklePasif={cevrimdisi}
                onDurak={(d) => {
                  const pid = kimlik(d);
                  if (pid) paneliAc(pid, icerikHafif(pid, d), listedeki(pid)?.default_minutes ?? d.sure_dk);
                }}
              />
            </BolumSiniri>
          </View>
        ) : (
          <View style={s.yazi}>
            <BolumSiniri key="yazi" ad="gezi-yazi">
              <View style={s.yazar}>
                <View style={s.yazarKare}>
                  {/* #291 KK5 (Ekran 17): 18×11, kesik çizgi. */}
                  <Logo boyut={18} koyuZemin kesik />
                </View>
                <Text style={s.yazarMetin}>
                  {[g.yazar_ad, `${tarih.gun} ${AYLAR[tarih.ay - 1]}`, t('gezi.okuma', { n: okumaSuresiDk(g.yazi_md) }), alinmaSayisi > 0 ? t('gezi.alindi', { n: alinmaSayisi }) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <MdYazi kaynak={g.yazi_md} kenar={22} buyuk mekanKarti={mekanKarti} onMekan={(id) => paneliAc(id, yaziYeri(id)?.hafif, listedeki(id)?.default_minutes)} />
            </BolumSiniri>
          </View>
        )}
      </ScrollView>

      {/* KK4 (kanvas `Sayfa_v5_HazirGezi_Kayik`): kaydırınca üstte sabit satır ve altında sabit sekmeler. */}
      {yapisik ? (
        <View style={[s.yapisik, { paddingTop: kenar.top }]} testID="gezi-yapisik">
          <View style={s.kisaSatir}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={() => router.back()} style={s.kisaDugme} hitSlop={4}>
              <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.2} />
            </Pressable>
            {kucukKapak(36, 9)}
            <View style={s.kisaMetin}>
              <Text style={s.kisaAd} numberOfLines={1}>
                {g.baslik}
              </Text>
              <Text style={s.kisaAlt} numberOfLines={1}>
                {kisaOzet}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.paylas')} onPress={paylas} style={s.kisaDugme} hitSlop={4}>
              <Ikon ad="paylasV7" boyut={20} renk={renk.metin} kalinlik={2.2} />
            </Pressable>
            <KalpDugmesi geziId={g.id} boyut={20} stil={s.kisaDugme} />
          </View>
          {sekmeler}
        </View>
      ) : null}

      <View style={[s.altCubuk, { paddingBottom: Math.max(kenar.bottom, 12) + 8 }]} onLayout={(e) => setAltCubukH(e.nativeEvent.layout.height)}>
        {/* #388 inceleme: çevrimdışıyken + / ✓ pasif; nedeni aynı satırda. */}
        {alAcik ? null : alHata ? <EklemeDurumSatiri durum={alHata} metinStili={s.hata} /> : cevrimdisi ? <EklemeDurumSatiri durum={cevrimdisiDurumu()} metinStili={s.hata} /> : null}
        {/* KK5: solda "Tek bir gününü de alabilirsin" (tek günlük gezide yok), sağda turuncu "Seyahatime al". */}
        <View style={s.altSatir}>
          <Text style={s.altMetin} numberOfLines={2}>
            {g.gezi_gunleri.length > 1 ? t('gezi.altAlt') : ''}
          </Text>
          <Buton
            baslik={t('gezi.al')}
            tur="vurgu"
            stil={s.alDugmesi}
            onPress={() => {
              setAlHata(null);
              setAlAcik(true);
            }}
          />
        </View>
      </View>

      {alAcik ? (
        <BolumSiniri ad="gezi-al" yedek={() => <AlHatasi onKapat={() => setAlAcik(false)} />}>
          <GeziAl gezi={g} kimlik={kimlik} foto={(d) => canli.data?.get(d.id)?.foto_uri ?? null} ilkHedefId={hedef?.id ?? null} onKapat={() => setAlAcik(false)} />
        </BolumSiniri>
      ) : null}
      <SecimMenusu
        acik={!!hedefMenusu}
        baslik={t('anasayfa.hangiSeyahat')}
        secenekler={[
          ...hedefler.map((sy) => ({
            etiket: `${seyahatAdi(sy)}${sy.start_date && sy.end_date ? ` · ${tarihAraligi(sy.start_date, sy.end_date)}` : ''}`,
            onPress: () => {
              setSecilenHedefId(sy.id);
              // Seçilen seyahatte zaten varsa ekleme sessizce mevcut sayılır (23505).
              if (hedefMenusu?.bekleyen) hedefeEkle(hedefMenusu.bekleyen, sy.id);
            },
          })),
          { etiket: `+ ${t('gezi.yeniSeyahat')}`, onPress: yeniSeyahat },
        ]}
        onKapat={() => setHedefMenusu(null)}
      />

      {panel ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <BolumSiniri ad="gezi-mekan-paneli" yedek={() => <AlHatasi onKapat={() => setPanel(null)} />}>
            <MekanPaneli
              placeId={panel.placeId}
              hafif={panel.hafif}
              dakika={panelMekani?.default_minutes ?? panel.dakika}
              onSure={(fark) => {
                const yeni = Math.min(480, Math.max(15, (panelMekani?.default_minutes ?? panel.dakika) + fark));
                if (panelMekani) guncelle.mutate({ id: panelMekani.id, default_minutes: yeni });
                else setPanel({ ...panel, dakika: yeni });
              }}
              baglam="kesfet"
              icinde={!!panelMekani}
              mesgul={mesgulId === panel.placeId}
              pasif={cevrimdisi}
              ipucu={cevrimdisi ? t('ekleme.baglantiYokIpucu') : undefined}
              onCta={() => degistir({ anahtar: panel.placeId, place_id: panel.placeId, ad: panel.hafif.ad, primary_type: panel.hafif.primary_type, lat: panel.hafif.lat, lng: panel.hafif.lng, dakika: panel.dakika })}
              onYolTarifi={() =>
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${yolTarifiHedefi(panel.hafif, panel.hafif.ad)}&destination_place_id=${encodeURIComponent(panel.placeId)}&travelmode=walking`)
              }
              onKapat={() => setPanel(null)}
            />
          </BolumSiniri>
        </View>
      ) : null}
      {/* #387 inceleme 1: "Geri al" bandı alt çubuğun hemen üstünde ve mekan panelinden SONRA çizilir (paneldeki ✓'te de görünür). */}
      {cikan ? <GeriAlBandi metin={cikan.metin} olay={cikan} onGeriAl={geriAlinabilir.geriAl} alt={altCubukH + 8} /> : silHata ? <GeriAlBandi metin={silHata} alt={altCubukH + 8} /> : null}
    </View>
  );
}

/** PostgREST / ağ hatasının kısa özeti: "PGRST201 · Could not embed …". */
function geziHataKodu(e: unknown): string {
  const kod = typeof e === 'object' && e && 'code' in e && typeof (e as { code: unknown }).code === 'string' ? (e as { code: string }).code : null;
  const ozet = e instanceof Error ? hataOzeti(e) : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message).slice(0, 160) : hataOzeti(e);
  return kod ? `${kod} · ${ozet}` : ozet;
}

/** #199 KK3: üstte açılan pencere (Seyahatime al, mekan paneli) hata verirse sayfanın üstünde kapatılabilir küçük kart. */
function AlHatasi({ onKapat }: { onKapat: () => void }) {
  const kenar = useSafeAreaInsets();
  return (
    <View style={[s.pencereHata, { bottom: kenar.bottom + 16 }]}>
      <Text style={s.hataKod}>{t('genel.bolumHata')}</Text>
      <Buton baslik={t('genel.geri')} tur="ikincil" onPress={onKapat} />
    </View>
  );
}

/**
 * #199 KK3: rota düzeyinde hata sınırı (Expo Router) — sayfanın bölüm sınırlarının dışında kalan bir hata (kapak, alt çubuk)
 * bütün uygulamayı değil yalnız bu sayfayı "Yeniden dene · Geri" kartına çevirir.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={[s.ekran, s.ortala]}>
      <Text style={s.hata}>{t('gezi.hata')}</Text>
      <Text style={s.hataKod} selectable>
        {hataOzeti(error)}
      </Text>
      <Buton baslik={t('genel.yenidenDene')} onPress={() => retry()} />
      <Buton baslik={t('genel.geri')} tur="ikincil" onPress={() => router.back()} />
    </View>
  );
}

/** Sabit satırın yüksekliği (kanvas `Sayfa_v5_HazirGezi_Kayik`). */
const USTSATIR = 52;

/** KK3 (kanvas): alt çizgili sekmeler — 42 px, seçili 3 px Mandalina çizgi ve 15/700 Lacivert; diğeri 15/500 gri. */
function Sekmeler({ deger, onDeger }: { deger: Sekme; onDeger: (s: Sekme) => void }) {
  return (
    <View style={s.sekmeler} accessibilityRole="tablist">
      {(['plan', 'yazi'] as const).map((k) => {
        const secili = deger === k;
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => onDeger(k)} style={[s.sekme, secili && s.sekmeSecili]} hitSlop={{ left: 8, right: 8 }}>
            <Text style={[s.sekmeMetin, secili && s.sekmeMetinSecili]}>{k === 'plan' ? t('gezi.sekmePlan') : t('gezi.sekmeYazi')}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ortala: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  // KK2: 64 / 36 px kare kapak (kendi kapağımız ya da amacın kapağı).
  kapak: { overflow: 'hidden', backgroundColor: anaV5.fotoYok },
  baslikSatiri: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  baslikMetin: { flex: 1, minWidth: 0, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 20, lineHeight: 23, letterSpacing: -0.2, color: renk.metin },
  gri: { fontFamily: yazi.normal, fontSize: 15, color: anaV5.ikincil },
  sekmeler: { paddingHorizontal: 16, flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderBottomColor: anaV5.cizgi, backgroundColor: renk.zemin },
  sekme: { height: 42, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  sekmeSecili: { borderBottomColor: renk.vurgu },
  sekmeMetin: { fontFamily: yazi.orta, fontSize: 15, color: anaV5.ikincil },
  sekmeMetinSecili: { fontFamily: yazi.kalin, color: renk.metin },
  yapisik: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: renk.zemin },
  kisaSatir: { height: USTSATIR, paddingLeft: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kisaDugme: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  kisaMetin: { flex: 1, minWidth: 0 },
  kisaAd: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  kisaAlt: { fontFamily: yazi.normal, fontSize: 12, color: anaV5.ikincil },
  plan: { paddingHorizontal: 16 },
  yazi: { paddingTop: 18, gap: 14 },
  yazar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22 },
  yazarKare: { width: 28, height: 28, borderRadius: 9, backgroundColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  yazarMetin: { flex: 1, fontFamily: yazi.yari, fontSize: 13, color: renk.ikincil },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  kartFoto: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: renk.yuzey },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  altCubuk: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: renk.zemin, borderTopWidth: 1, borderTopColor: anaV5.cizgi, gap: 8 },
  altSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  altMetin: { flex: 1, minWidth: 0, fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  // Kanvas: 52 px, tam yuvarlak, 22 px iç boşluk.
  alDugmesi: { height: 52, borderRadius: 26, paddingHorizontal: 22 },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center' },
  hataKod: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 15, color: renk.ikincil, textAlign: 'center' },
  pencereHata: { position: 'absolute', left: bosluk.kenar, right: bosluk.kenar, padding: 16, gap: 10, borderRadius: 18, backgroundColor: renk.zemin, borderWidth: 1.5, borderColor: renk.ayrac },
});
