import { Image } from 'expo-image';
import { useEffect, useReducer, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AltSayfa, useSayfaKaydirma } from '@/components/harita/AltSayfa';
import { Kalp } from '@/components/icerik/Kalp';
import { MdYazi } from '@/components/icerik/MdYazi';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { FotoGalerisi } from '@/components/yerler/FotoGalerisi';
import { useYerRehberi } from '@/features/icerik/sorgular';
import {
  acikDurumu,
  ctaAnahtari,
  fotoSayfasi,
  fotoYuklensin,
  geriTusu,
  govdeYuksekligi,
  KAPALI_PANEL,
  panelGecis,
  panelSekmesi,
  panelYukseklikleri,
  yorumlariSirala,
  type PanelOlayi,
  type PanelSekmesi,
  type YorumSirasi,
} from '@/features/mekan/panel';
import { usePlaceFoto, useTamYer, useYorumlar, YorumSiniri, type HafifYer, type TamYer, type Yorum } from '@/features/yerler/api';
import { t } from '@/i18n';
import { izBirak } from '@/lib/hataRaporu';
import { kategoriEtiketi, sureMetni, varsayilanDakika } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import type { Gun } from '@/lib/tipler';
import { saatEkli } from '@/lib/zaman';
import { bosluk, gunRengi, gunUstuMetin, kose, renk, yazi } from '@/theme';

export type MekanPaneliProps = {
  placeId: string;
  /** Seyahatin saat dilimi ("Bugün" satırı ve kapanış saati için). */
  tz?: string;
  /** Tam veri gelene kadar başlık için eldeki hafif veri (ad, puan, kategori). */
  hafif?: HafifYer | null;
  oneCikan?: boolean;
  /** "{ad} ekledi" — listedeyse. */
  ekleyenAd?: string;
  /** Kalınacak süre (dakika) ve −/+ (15 dk). */
  dakika: number;
  onSure: (fark: number) => void;
  /** KK3: Keşfet = listeye ekle / listeden çıkar; Program = güne ekle / günden çıkar. */
  baglam: 'kesfet' | 'program';
  icinde: boolean;
  mesgul?: boolean;
  onCta: () => void;
  onYolTarifi: () => void;
  onKapat: () => void;
  /** KK12 (Program): "Gün" satırı — günler halka, atanmış gün dolu. */
  gunSecici?: { gunler: Gun[]; mevcutGunId: string | null; onGunSec: (g: Gun) => void };
};

/** #142 KK1: foto kaydırma yüksekliği (kanvas 14). */
const FOTO_YUKSEKLIK = 220;

/**
 * #80 → #142 (kanvas 14 · Mekan rehberi): alttan neredeyse tam ekran mekan paneli — 220 px foto kaydırma ("1 / N"), kategori
 * + "★ Öne çıkan", ad, "★ puan · yorum · Açık · kapanış", Burada kalış [–] süre [+], Listede ✓ / Yol tarifi / kalp / paylaş;
 * Rehber · Bilgiler · Google yorumları (açılışta Rehber, yoksa Bilgiler).
 * Harita dolgusuna dokunmaz (kamera yerinde kalır, KK1). Pin değişince içerik değişir, hal/sekme korunur (KK13).
 * Yorumlar yalnız sekmeye dokununca istenir (KK8).
 * #83: yükseklikler panelin yaşadığı alana göre (ekranın alt menü HARİÇ yüksekliği, onLayout); gövde + sabit alt çubuk
 * görünür yüksekliğe sığar (alt çubuk hep alt menünün üstünde); Android geri tuşu yalnız paneli kapatır.
 * #85: tam ekran galeri RN `Modal` DEĞİL — panelin kendi katmanında (absoluteFill) overlay; Android'de Modal gri/boş
 * sahne bırakıyordu. Geri tuşu önce galeriyi kapatır (KK4). Panel/galeri olayları Sentry izine yazılır.
 */
export function MekanPaneli(p: MekanPaneliProps) {
  // #119 KK4: bu Google mekanı içerik tablosunda (`yerler`) varsa kalp ve Rehber sekmesi oradan dolar.
  const icerikYeri = useYerRehberi(p.placeId);
  const ekran = useWindowDimensions();
  const kenar = useSafeAreaInsets();
  const [durum, gonder] = useReducer(panelGecis, KAPALI_PANEL);
  // Kuruluşta açılır (seçim = açık panel); seçim kalkınca üst bileşen paneli kaldırır.
  useEffect(() => {
    gonder({ tur: 'ac' });
  }, []);
  // Reducer'ın "kapalı"ya götürdüğü her olay üst bileşene bırakılır (seçim kalkar → panel kalkar); diğerleri yerel durum.
  const olay = (o: PanelOlayi) => {
    if (panelGecis(durum, o).hal === 'kapali') p.onKapat();
    else gonder(o);
  };
  // #85: tam ekran galeri (overlay) durumu panelde — geri tuşu önceliği ve alan ölçüsü burada.
  const [galeri, setGaleri] = useState(false);
  const galeriAc = (acik: boolean) => {
    izBirak('panel', acik ? 'galeri açıldı' : 'galeri kapandı');
    setGaleri(acik);
  };
  useEffect(() => {
    izBirak('panel', `mekan paneli açıldı: ${p.placeId}`);
  }, [p.placeId]);
  // #83 KK3 / #85 KK4: Android geri tuşu — galeri açıksa galeriyi, değilse yalnız paneli kapatır (ekrandan çıkmaz).
  const { onKapat } = p;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const abone = BackHandler.addEventListener('hardwareBackPress', () => {
      if (geriTusu(galeri) === 'galeri') setGaleri(false);
      else onKapat();
      return true;
    });
    return () => abone.remove();
  }, [onKapat, galeri]);
  // #83 KK1–2: alan = üst katmanın ölçülen yüksekliği (alt menü hariç); ölçülene kadar pencere yüksekliği.
  const [alanH, setAlanH] = useState(0);
  const [alanW, setAlanW] = useState(0);
  const [seritH, setSeritH] = useState(0);
  const yukseklik = panelYukseklikleri(alanH || ekran.height, kenar.top);
  const tam = useTamYer(p.placeId, p.tz);
  const yer = tam.data ?? null;
  const ad = yer?.ad ?? p.hafif?.ad ?? '';
  const puan = puanMetni(yer?.puan ?? p.hafif?.puan);
  const yorumSayisi = yer?.puan_sayisi ?? p.hafif?.puan_sayisi ?? null;
  const tip = yer?.primary_type ?? p.hafif?.primary_type ?? null;
  const kategori = kategoriEtiketi(tip);
  const { kategoriRenk } = kategoriPini(tip);
  const acik = acikDurumu(yer ?? (p.hafif ? { acik: p.hafif.acik } : null));
  const ctaAd = ctaAnahtari(p.baglam, p.icinde);
  const rehberMd = icerikYeri.data?.rehber_md?.trim() || null;
  const sekme = panelSekmesi(durum, !!rehberMd);
  const hal = durum.hal === 'kapali' ? 'katli' : durum.hal;
  const googleUrl = yer?.google_maps_uri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ad || 'yer')}&query_place_id=${encodeURIComponent(p.placeId)}`;
  const paylas = async () => {
    try {
      await Share.share({ message: `${ad} · ${googleUrl}` });
    } catch {
      // Paylaşım sayfası kapatıldı ya da desteklenmiyor.
    }
  };

  // Tutamak: sayfanın tepesinde; içerik (foto, başlık, sekmeler) gövdede kayar — liste en üstteyken aşağı çekiş sayfayı indirir.
  const ust = (
    <View style={s.ust}>
      <View style={s.tutamac} />
    </View>
  );

  const satirAcik = acik ? (
    <>
      {' · '}
      <Text style={acik.acik ? s.acik : s.kapali}>{acik.acik ? t('mekan.acik') : t('mekan.kapali')}</Text>
      {acik.acik && acik.kapanis ? ` · ${saatEkli(acik.kapanis, 'yonelme')} ${t('mekan.panel.kadar')}` : ''}
      {!acik.acik && acik.acilis && acik.acilis.gun !== 'sonra'
        ? ` · ${t(acik.acilis.gun === 'bugun' ? 'mekan.panel.acilisBugun' : 'mekan.panel.acilisYarin', { saat: acik.acilis.saat })}`
        : ''}
    </>
  ) : null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        setAlanH(e.nativeEvent.layout.height);
        setAlanW(e.nativeEvent.layout.width);
      }}>
      {alanH > 0 ? (
        // Aşağı çekip bırakma ('katli'): tamdan yarıya, yarıdan kapatır (üst bileşen seçimi kaldırır), #83 KK3.
        <AltSayfa hal={hal} onHal={(h) => olay({ tur: 'hal', hal: h })} yukseklik={yukseklik} ust={ust} onUstYukseklik={setSeritH} altDolgu={0}>
          <View style={{ height: govdeYuksekligi(yukseklik[hal], seritH) }}>
            <Govde>
              {/* KK1: foto kaydırma "1 / N", kapat; dokununca tam ekran galeri. */}
              <View style={s.fotoAlan}>
                {yer && yer.fotolar.length > 0 ? (
                  <FotoKaydirma yer={yer} genislik={alanW || ekran.width} onAc={() => galeriAc(true)} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: kategoriRenk + '22' }]}>
                    {p.hafif?.foto_uri ? <Image source={{ uri: p.hafif.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
                  </View>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.panel.kapat')} onPress={p.onKapat} hitSlop={8} style={s.kapat}>
                  <Ikon ad="yeni" boyut={20} renk={renk.ana} kalinlik={2.6} />
                </Pressable>
              </View>
              <View style={s.icerik}>
                <View style={{ gap: 4 }}>
                  <View style={s.cipler}>
                    <View style={[s.cip, { backgroundColor: kategoriRenk + '1f' }]}>
                      <Text style={[s.cipMetin, { color: kategoriRenk }]}>{kategori}</Text>
                    </View>
                    {p.oneCikan ? (
                      <View style={[s.cip, { backgroundColor: renk.yuzey }]}>
                        <Text style={[s.cipMetin, { color: renk.ana }]}>{t('mekan.panel.oneCikan')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text accessibilityRole="header" style={s.ad} numberOfLines={3}>
                    {ad || (tam.isPending ? '…' : t('mekan.hata'))}
                  </Text>
                  <Text style={s.bilgiSatiri}>
                    {puan ? `★ ${puan}` : ''}
                    {yorumSayisi !== null ? `${puan ? ' · ' : ''}${t('mekan.panel.yorumSayisi', { n: yorumSayisi.toLocaleString('tr-TR') })}` : ''}
                    {satirAcik}
                  </Text>
                  {p.ekleyenAd ? <Text style={s.ekleyen}>{t('mekan.ekledi', { ad: p.ekleyenAd })}</Text> : null}
                  {/* KK1: Burada kalış [–] süre [+] (15 dk adım; değişince saatler yeniden hesaplanır). */}
                  <View style={s.kalis}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.kalisBaslik}>{t('mekan.panel.kalis')}</Text>
                      <Text style={s.kalisAlt}>{t('mekan.panel.kalisAlt', { sure: sureMetni(varsayilanDakika(tip)) })}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.azalt')} onPress={() => p.onSure(-15)} hitSlop={4} style={s.kalisDugme}>
                      <Text style={s.kalisIsaret}>–</Text>
                    </Pressable>
                    <Text style={s.kalisDeger}>{sureMetni(p.dakika)}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.artir')} onPress={() => p.onSure(15)} hitSlop={4} style={s.kalisDugme}>
                      <Text style={s.kalisIsaret}>+</Text>
                    </Pressable>
                  </View>
                </View>
                {/* KK1: Listede ✓ / Yol tarifi / kalp / paylaş. */}
                <View style={s.eylemler}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={ctaAd === 'listede' ? t('mekan.panel.listedeA11y') : undefined}
                    accessibilityState={{ disabled: !!p.mesgul }}
                    disabled={p.mesgul}
                    onPress={p.onCta}
                    style={({ pressed }) => [s.eylem, s.eylemBirincil, (pressed || p.mesgul) && { opacity: 0.8 }]}>
                    <Text style={[s.eylemMetin, { color: renk.zemin }]}>{t(`mekan.panel.${ctaAd}`)}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={p.onYolTarifi} style={({ pressed }) => [s.eylem, s.eylemIkincil, pressed && { opacity: 0.8 }]}>
                    <Text style={s.eylemMetin}>{t('mekan.panel.yolTarifi')}</Text>
                  </Pressable>
                  {icerikYeri.data?.id ? <Kalp tur="yer" hedefId={icerikYeri.data.id} boyut={44} arkaPlan={renk.yuzey} /> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.panel.paylas')} onPress={paylas} style={({ pressed }) => [s.kare, pressed && { opacity: 0.8 }]}>
                    <Ikon ad="paylas" boyut={18} renk={renk.ana} kalinlik={2.3} />
                  </Pressable>
                </View>
                {/* KK2: Rehber · Bilgiler · Google yorumları (açılışta Rehber, yoksa Bilgiler). */}
                <View style={s.sekmeler} accessibilityRole="tablist">
                  {(['rehber', 'bilgiler', 'yorumlar'] as PanelSekmesi[]).map((sek) => {
                    const secili = sekme === sek;
                    return (
                      <Pressable key={sek} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => gonder({ tur: 'sekme', sekme: sek })} style={[s.sekme, secili && s.sekmeSecili]}>
                        <Text style={[s.sekmeMetin, secili && s.sekmeMetinSecili]}>{t(`mekan.panel.sekme${sek === 'rehber' ? 'Rehber' : sek === 'bilgiler' ? 'Bilgiler' : 'Google'}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {sekme === 'rehber' ? <RehberSekmesi md={rehberMd} /> : null}
                {sekme === 'bilgiler' ? <BilgilerSekmesi yer={yer} yukleniyor={tam.isPending} hata={tam.isError} gunSecici={p.gunSecici} mesgul={p.mesgul} /> : null}
                {sekme === 'yorumlar' ? <YorumlarSekmesi placeId={p.placeId} acik googleUrl={googleUrl} /> : null}
              </View>
            </Govde>
          </View>
        </AltSayfa>
      ) : null}
      {galeri && yer && yer.fotolar.length > 0 ? (
        // #85: tam ekran galeri — Modal yerine panel katmanında overlay (alt menü hariç alan); × ve geri tuşu kapatır.
        <View style={[StyleSheet.absoluteFill, s.galeri]}>
          <FotoGalerisi fotolar={yer.fotolar} ilkUri={yer.foto_uri} yukseklik={Math.round((alanH || ekran.height) * 0.62)} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.panel.fotoKapat')} onPress={() => galeriAc(false)} hitSlop={8} style={[s.galeriKapat, { top: kenar.top + 8 }]}>
            <Text style={s.galeriKapatMetin}>×</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Gövde: alt sayfanın kaydırma bağlamına bağlı liste (liste en üstteyken aşağı çekiş sayfayı indirir). */
function Govde({ children }: { children: ReactNode }) {
  const kaydirma = useSayfaKaydirma();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.govde} onScroll={kaydirma} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/**
 * #142 KK1 (kanvas 14): 220 px foto kaydırma — sayfa başına bir Google fotoğrafı, "1 / N" ve atıf; yalnız görünen sayfa ve
 * komşuları çözülür (foto başına istek). İlk fotoğraf places-full'dan hazır gelir. Dokununca tam ekran galeri.
 * #85 dersi: kaydırma konumu işleyicide eşzamanlı okunur, güncelleyiciye yalnız sayı girer (havuzlanan olay null olur).
 */
export function FotoKaydirma({ yer, genislik, onAc }: { yer: TamYer; genislik: number; onAc: () => void }) {
  const [sayfa, setSayfa] = useState(0);
  const sayi = yer.fotolar.length;
  const kaydirildi = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const yeni = fotoSayfasi(e.nativeEvent.contentOffset.x, genislik, sayi);
    setSayfa(yeni);
  };
  const yazar = yer.fotolar[sayfa]?.yazar;
  return (
    <View style={StyleSheet.absoluteFill}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={kaydirildi} onScroll={kaydirildi} scrollEventThrottle={64} testID="foto-kaydirma">
        {yer.fotolar.map((f, i) => (
          <Pressable key={f.ad} accessibilityRole="imagebutton" accessibilityLabel={t('mekan.panel.fotoAc')} onPress={onAc} style={{ width: genislik, height: FOTO_YUKSEKLIK }}>
            <BuyukFoto ad={f.ad} hazirUri={i === 0 ? yer.foto_uri : null} yukle={fotoYuklensin(i, sayfa)} testID={`foto-sayfa-${i}`} />
          </Pressable>
        ))}
      </ScrollView>
      {sayi > 1 ? (
        <View style={s.fotoSayac} pointerEvents="none">
          <Text style={s.fotoSayacMetin}>{t('mekan.panel.fotoSayac', { n: sayfa + 1, toplam: sayi })}</Text>
        </View>
      ) : null}
      <Text style={s.fotoAtif} pointerEvents="none" numberOfLines={1}>
        {yazar ? t('mekan.fotoAtif', { yazar }) : t('mekan.panel.fotoGoogle')}
      </Text>
    </View>
  );
}

function BuyukFoto({ ad, hazirUri, yukle, testID }: { ad: string; hazirUri: string | null; yukle: boolean; testID?: string }) {
  const sorgu = usePlaceFoto(yukle && !hazirUri ? ad : undefined, 800);
  const uri = hazirUri ?? sorgu.data ?? null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#d9d9d6' }]} testID={testID} accessibilityState={{ busy: yukle && !uri }}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Bilgiler

function BilgilerSekmesi({ yer, yukleniyor, hata, gunSecici, mesgul }: { yer: TamYer | null; yukleniyor: boolean; hata: boolean; gunSecici?: MekanPaneliProps['gunSecici']; mesgul?: boolean }) {
  const [ozetAcik, setOzetAcik] = useState(false);
  const ekran = useWindowDimensions();
  const acik = acikDurumu(yer);
  return (
    <View style={{ gap: 14 }}>
      {yukleniyor && !yer ? <ActivityIndicator color={renk.metin} style={{ marginVertical: 20 }} /> : null}
      {hata && !yer ? <Text style={s.hata}>{t('mekan.hata')}</Text> : null}
      {yer?.ozet ? (
        <View style={s.bilgi}>
          <Text style={s.bilgiBaslik}>{t('mekan.panel.bilmen')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setOzetAcik((a) => !a)}>
            <Text style={s.ozet} numberOfLines={ozetAcik ? undefined : 3}>
              {yer.ozet}
            </Text>
            <Text style={s.devami}>{ozetAcik ? t('mekan.panel.dahaAz') : t('mekan.panel.devami')}</Text>
          </Pressable>
        </View>
      ) : null}
      <View>
        {gunSecici ? (
          <Satir etiket={t('mekan.panel.gun')}>
            <View style={s.gunler}>
              {gunSecici.gunler.map((g) => {
                const secili = g.id === gunSecici.mevcutGunId;
                const rengi = gunRengi(g.index);
                return (
                  <Pressable
                    key={g.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('program.gunSec', { n: g.index })}
                    accessibilityState={{ selected: secili, disabled: !!mesgul }}
                    disabled={mesgul}
                    hitSlop={4}
                    onPress={() => gunSecici.onGunSec(g)}
                    style={[s.gunDaire, { borderColor: rengi }, secili && { backgroundColor: rengi }]}>
                    <Text style={[s.gunMetin, { color: secili ? gunUstuMetin(rengi) : rengi }]}>{g.index}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Satir>
        ) : null}
        <Satir etiket={t('mekan.panel.bugun')}>
          {acik && !acik.acik ? (
            <Text style={[s.deger, s.kapali]} numberOfLines={1}>
              {t('mekan.kapali')}
              {acik.acilis && acik.acilis.gun !== 'sonra' ? ` · ${t(acik.acilis.gun === 'bugun' ? 'mekan.panel.acilisBugun' : 'mekan.panel.acilisYarin', { saat: acik.acilis.saat })}` : ''}
            </Text>
          ) : (
            <Text style={s.deger} numberOfLines={1}>
              {yer?.bugun ?? (yer ? t('mekan.saatYok') : '…')}
            </Text>
          )}
        </Satir>
        <Satir etiket={t('mekan.panel.adres')}>
          <Text style={[s.deger, { maxWidth: ekran.width * 0.55 }]} numberOfLines={2}>
            {yer?.adres ?? (yer ? '—' : '…')}
          </Text>
        </Satir>
      </View>
    </View>
  );
}

function Satir({ etiket, children }: { etiket: string; children: ReactNode }) {
  return (
    <View style={s.satir}>
      <Text style={s.etiket}>{etiket}</Text>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- Yorumlar

/**
 * #142 KK3: Google yorumları yalnız bu sekmeye dokununca istenir, oturumda cihazda tutulur (ikinci açılışta istek yok), DB'ye
 * yazılmaz. Günlük sınır doluysa ya da yorumlar alınamazsa "Google'da aç".
 */
function YorumlarSekmesi({ placeId, acik, googleUrl }: { placeId: string; acik: boolean; googleUrl: string }) {
  const sorgu = useYorumlar(placeId, acik);
  const [sira, setSira] = useState<YorumSirasi>('yeni');
  const veri = sorgu.data;
  const puan = puanMetni(veri?.puan);
  return (
    <View style={{ gap: 14 }}>
      {sorgu.isPending ? <ActivityIndicator color={renk.metin} style={{ marginVertical: 20 }} /> : null}
      {sorgu.isError ? (
        <View style={s.googleKutu}>
          <Text style={s.ozet}>{sorgu.error instanceof YorumSiniri ? t('mekan.panel.yorumSiniri') : t('mekan.panel.yorumHata')}</Text>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(googleUrl)} style={({ pressed }) => [s.googleAc, pressed && { opacity: 0.8 }]}>
            <Text style={s.googleAcMetin}>{t('mekan.panel.googleAc')}</Text>
          </Pressable>
        </View>
      ) : null}
      {veri ? (
        <>
          <View style={s.ozetSatir}>
            <Text style={s.buyukPuan}>{puan ?? '–'}</Text>
            <View style={{ gap: 2 }}>
              <Yildizlar puan={veri.puan} boyut={14} />
              {veri.puan_sayisi !== null ? <Text style={s.alt}>{t('mekan.panel.yorumSayisi', { n: veri.puan_sayisi.toLocaleString('tr-TR') })}</Text> : null}
            </View>
          </View>
          {veri.yorumlar.length > 0 ? (
            <View style={s.siralar}>
              {(['yeni', 'yuksek', 'dusuk'] as YorumSirasi[]).map((x) => (
                <Pressable key={x} accessibilityRole="button" accessibilityState={{ selected: sira === x }} onPress={() => setSira(x)} style={[s.siraHap, sira === x && s.siraHapSecili]}>
                  <Text style={[s.siraMetin, sira === x && { color: renk.zemin }]}>{t(`mekan.panel.sirala${x === 'yeni' ? 'Yeni' : x === 'yuksek' ? 'Yuksek' : 'Dusuk'}`)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={s.alt}>{t('mekan.panel.yorumYok')}</Text>
          )}
          {yorumlariSirala(veri.yorumlar, sira).map((y, i) => (
            <YorumSatiri key={`${y.yazar}|${y.yayin ?? i}`} yorum={y} />
          ))}
          <Text style={s.atif}>{t('mekan.panel.yorumAtif')}</Text>
        </>
      ) : null}
    </View>
  );
}

function YorumSatiri({ yorum: y }: { yorum: Yorum }) {
  const [acik, setAcik] = useState(false);
  const uzun = y.metin.length > 220;
  return (
    <View style={s.yorum}>
      <View style={s.yorumUst}>
        <View style={s.yorumcu}>
          <Avatar ad={y.yazar || '?'} boyut={26} arkaPlan="#e0e0e0" />
          <Text style={s.yorumcuAd} numberOfLines={1}>
            {y.yazar}
          </Text>
          <Text style={s.yorumZaman}>{y.zaman}</Text>
        </View>
        <Yildizlar puan={y.puan} boyut={12} />
      </View>
      <Pressable accessibilityRole={uzun ? 'button' : undefined} disabled={!uzun} onPress={() => setAcik((a) => !a)}>
        <Text style={s.yorumMetin} numberOfLines={acik ? undefined : 5}>
          {y.metin}
        </Text>
        {uzun ? <Text style={s.devami}>{acik ? t('mekan.panel.yorumDahaAz') : t('mekan.panel.yorumDevami')}</Text> : null}
      </Pressable>
    </View>
  );
}

function Yildizlar({ puan, boyut }: { puan: number | null; boyut: number }) {
  const dolu = Math.round(puan ?? 0);
  return (
    <Text style={{ fontSize: boyut, letterSpacing: 1 }} accessibilityLabel={puan !== null ? `${puanMetni(puan)} / 5` : undefined}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ color: i <= dolu ? renk.vurgu : '#d9d9d6' }}>
          ★
        </Text>
      ))}
    </Text>
  );
}

// ---------------------------------------------------------------- Rehber

/** #142 KK2 (kanvas 14): "Sesli rehberi dinle · YAKINDA" şeridi, rehber yazısı (`yerler.rehber_md`), alıntı → İPUCU kutusu. */
function RehberSekmesi({ md }: { md: string | null }) {
  return (
    <View style={{ gap: 14 }}>
      <View style={s.sesli} accessibilityState={{ disabled: true }}>
        <View style={s.sesliIkon}>
          <Ikon ad="kitap" boyut={18} renk={renk.metin} kalinlik={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.sesliBaslik}>{t('mekan.panel.sesli')}</Text>
          <Text style={s.sesliAlt}>{t('mekan.panel.sesliAlt')}</Text>
        </View>
        <Text style={s.yakinda}>{t('mekan.panel.yakinda')}</Text>
      </View>
      {md ? (
        <MdYazi kaynak={md} ipucu kenar={0} />
      ) : (
        <View style={s.bilgi}>
          <Text style={s.bilgiBaslik}>{t('mekan.panel.rehberBaslik')}</Text>
          <Text style={s.ozet}>{t('mekan.panel.rehberMetin')}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ust: { paddingBottom: 6 },
  tutamac: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  govde: { paddingBottom: 24 },
  fotoAlan: { height: FOTO_YUKSEKLIK, backgroundColor: '#e6e0fa', overflow: 'hidden' },
  kapat: { position: 'absolute', right: 14, top: 12, width: 40, height: 40, borderRadius: kose.alan, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] },
  fotoSayac: { position: 'absolute', left: 14, bottom: 14, height: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: renk.zemin, justifyContent: 'center' },
  fotoSayacMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
  fotoAtif: { position: 'absolute', right: 14, bottom: 16, maxWidth: '60%', fontFamily: yazi.ekstra, fontSize: 11, color: renk.zemin, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  icerik: { paddingHorizontal: bosluk.kenar, paddingTop: 16, gap: 12 },
  cipler: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cip: { height: 24, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center' },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  ad: { fontFamily: yazi.baslik, fontSize: 26, lineHeight: 28, letterSpacing: -0.78, color: renk.metin },
  bilgiSatiri: { fontFamily: yazi.normal, fontSize: 14, color: renk.ikincil },
  ekleyen: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  acik: { fontFamily: yazi.ekstra, color: renk.basariMetin },
  kapali: { fontFamily: yazi.ekstra, color: renk.uyari },
  kalis: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, paddingVertical: 6, paddingLeft: 12, paddingRight: 6, borderRadius: 14, backgroundColor: renk.yuzey },
  kalisBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  kalisAlt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  kalisDugme: { width: 36, height: 36, borderRadius: 11, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  kalisIsaret: { fontFamily: yazi.ekstra, fontSize: 20, lineHeight: 22, color: renk.ana },
  kalisDeger: { minWidth: 58, textAlign: 'center', fontFamily: yazi.baslik, fontSize: 16, color: renk.metin },
  eylemler: { flexDirection: 'row', gap: 8 },
  eylem: { flex: 1, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  eylemBirincil: { backgroundColor: renk.ana },
  eylemIkincil: { backgroundColor: renk.yuzey },
  eylemMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  kare: { width: 44, height: 44, borderRadius: 13, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  sekmeler: { flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: renk.ayrac },
  sekme: { height: 40, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  sekmeSecili: { borderBottomColor: renk.vurgu },
  sekmeMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.soluk },
  sekmeMetinSecili: { color: renk.metin },
  sesli: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: renk.ana },
  sesliIkon: { width: 38, height: 38, borderRadius: 19, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  sesliBaslik: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.zemin },
  sesliAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.anaAcik },
  yakinda: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.anaAcik },
  googleKutu: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: renk.yuzey },
  googleAc: { alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: kose.alan, backgroundColor: renk.ana, justifyContent: 'center' },
  googleAcMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bilgi: { gap: 6 },
  bilgiBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  ozet: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 21, color: '#232b48' },
  devami: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana, marginTop: 2 },
  satir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: renk.ayrac, minHeight: 44 },
  etiket: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  deger: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin, textAlign: 'right', flexShrink: 1 },
  gunler: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
  gunDaire: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: renk.zemin },
  gunMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center', paddingVertical: 12 },
  ozetSatir: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  buyukPuan: { fontFamily: yazi.baslik, fontSize: 34, letterSpacing: -1, color: renk.metin },
  siralar: { flexDirection: 'row', gap: 8 },
  siraHap: { height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  siraHapSecili: { backgroundColor: renk.ana },
  siraMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ana },
  yorum: { gap: 4, paddingVertical: 12, borderTopWidth: 1, borderTopColor: renk.ayrac },
  yorumUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  yorumcu: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  yorumcuAd: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin, flexShrink: 1 },
  yorumZaman: { fontFamily: yazi.normal, fontSize: 11, color: renk.soluk },
  yorumMetin: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 19, color: '#4a4a4a' },
  atif: { fontFamily: yazi.normal, fontSize: 11, color: renk.soluk, textAlign: 'center', paddingTop: 4 },
  galeri: { backgroundColor: renk.metin, justifyContent: 'center' },
  galeriKapat: { position: 'absolute', right: bosluk.kenar, width: 36, height: 36, borderRadius: 18, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  galeriKapatMetin: { fontFamily: yazi.ekstra, fontSize: 20, lineHeight: 22, color: renk.metin },
});
