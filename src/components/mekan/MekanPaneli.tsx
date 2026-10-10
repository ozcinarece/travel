import { Image } from 'expo-image';
import { useEffect, useReducer, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AltSayfa, useSayfaKaydirma } from '@/components/harita/AltSayfa';
import { Avatar } from '@/components/ui/Avatar';
import { FotoGalerisi } from '@/components/yerler/FotoGalerisi';
import {
  acikDurumu,
  ctaAnahtari,
  geriTusu,
  gorunenFotoSayisi,
  govdeYuksekligi,
  KAPALI_PANEL,
  panelGecis,
  panelYukseklikleri,
  yorumlariSirala,
  type PanelOlayi,
  type PanelSekmesi,
  type YorumSirasi,
} from '@/features/mekan/panel';
import { usePlaceFoto, useTamYer, useYorumlar, type HafifYer, type TamYer, type Yorum } from '@/features/yerler/api';
import { t } from '@/i18n';
import { izBirak } from '@/lib/hataRaporu';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { yorumKisa } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import type { Gun } from '@/lib/tipler';
import { bosluk, gunRengi, renk, yazi } from '@/theme';

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

const FOTO_EN = 120;
const FOTO_BOY = 88;
const FOTO_ARA = 8;

/**
 * #80 (kanvas PlacePanel9): alttan açılan mekan paneli — %55 / tam; başlık (64 px kapak, ad, "Kategori · süre · Açık ·
 * saat", ★ puan · yorum, ★ Öne çıkan) + Genel · Yorumlar · Rehber sekmeleri + sabit alt çubuk (CTA + Yol tarifi).
 * Harita dolgusuna dokunmaz (kamera yerinde kalır, KK1). Pin değişince içerik değişir, hal/sekme korunur (KK13).
 * Yorumlar yalnız sekmeye dokununca istenir (KK8).
 * #83: yükseklikler panelin yaşadığı alana göre (ekranın alt menü HARİÇ yüksekliği, onLayout); gövde + sabit alt çubuk
 * görünür yüksekliğe sığar (alt çubuk hep alt menünün üstünde); Android geri tuşu yalnız paneli kapatır.
 * #85: tam ekran galeri RN `Modal` DEĞİL — panelin kendi katmanında (absoluteFill) overlay; Android'de Modal gri/boş
 * sahne bırakıyordu. Geri tuşu önce galeriyi kapatır (KK4). Panel/galeri olayları Sentry izine yazılır.
 */
export function MekanPaneli(p: MekanPaneliProps) {
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
  const [seritH, setSeritH] = useState(0);
  const yukseklik = panelYukseklikleri(alanH || ekran.height, kenar.top);
  const tam = useTamYer(p.placeId, p.tz);
  const yer = tam.data ?? null;
  const ad = yer?.ad ?? p.hafif?.ad ?? '';
  const puan = puanMetni(yer?.puan ?? p.hafif?.puan);
  const yorum = yorumKisa(yer?.puan_sayisi ?? p.hafif?.puan_sayisi);
  const kategori = kategoriEtiketi(yer?.primary_type ?? p.hafif?.primary_type);
  const acik = acikDurumu(yer ?? (p.hafif ? { acik: p.hafif.acik } : null));
  const fotoUri = yer?.foto_uri ?? p.hafif?.foto_uri ?? null;
  const cta = t(`mekan.panel.${ctaAnahtari(p.baglam, p.icinde)}`);
  const hal = durum.hal === 'kapali' ? 'katli' : durum.hal;

  const ust = (
    <View style={s.ust}>
      <View style={s.tutamac} />
      <View style={s.baslik}>
        {fotoUri ? <Image source={{ uri: fotoUri }} style={s.kapak} contentFit="cover" transition={150} /> : <View style={s.kapak} />}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={s.ad} numberOfLines={1}>
            {ad || (tam.isPending ? '…' : t('mekan.hata'))}
          </Text>
          <Text style={s.alt} numberOfLines={1}>
            {kategori} · {sureMetni(p.dakika)}
            {acik ? (
              <>
                {' · '}
                <Text style={acik.acik ? s.acik : s.kapali}>{acik.acik ? t('mekan.acik') : t('mekan.kapali')}</Text>
                {acik.acik && acik.kapanis ? ` · ${t('mekan.kadar', { saat: acik.kapanis })}` : ''}
                {!acik.acik && acik.acilis && acik.acilis.gun !== 'sonra'
                  ? ` · ${t(acik.acilis.gun === 'bugun' ? 'mekan.panel.acilisBugun' : 'mekan.panel.acilisYarin', { saat: acik.acilis.saat })}`
                  : ''}
              </>
            ) : null}
          </Text>
          <View style={s.puanSatir}>
            {puan ? (
              <Text style={s.puanMetin}>
                <Text style={{ color: renk.vurgu }}>★</Text> <Text style={s.puanKalin}>{puan}</Text>
                {yorum ? ` · ${t('mekan.panel.yorumSayisi', { n: yorum })}` : ''}
              </Text>
            ) : null}
            {p.oneCikan ? (
              <View style={s.rozet}>
                <Text style={s.rozetMetin}>{t('mekan.panel.oneCikan')}</Text>
              </View>
            ) : null}
            {p.ekleyenAd ? <Text style={s.alt}>{t('mekan.ekledi', { ad: p.ekleyenAd })}</Text> : null}
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.panel.kapat')} onPress={p.onKapat} hitSlop={8} style={s.kapat}>
          <Text style={s.kapatMetin}>×</Text>
        </Pressable>
      </View>
      <View style={s.sekmeler}>
        {(['genel', 'yorumlar', 'rehber'] as PanelSekmesi[]).map((sek) => {
          const secili = durum.sekme === sek;
          return (
            <Pressable key={sek} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => gonder({ tur: 'sekme', sekme: sek })} style={[s.sekme, secili && s.sekmeSecili]}>
              <Text style={[s.sekmeMetin, secili && s.sekmeMetinSecili]}>{t(`mekan.panel.sekme${sek === 'genel' ? 'Genel' : sek === 'yorumlar' ? 'Yorumlar' : 'Rehber'}`)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={(e) => setAlanH(e.nativeEvent.layout.height)}>
      {alanH > 0 ? (
        // Aşağı çekip bırakma ('katli'): yarıdan kapatır (üst bileşen seçimi kaldırır), tamdan yarıya iner (#83 KK3).
        <AltSayfa hal={hal} onHal={(h) => olay({ tur: 'hal', hal: h })} yukseklik={yukseklik} ust={ust} onUstYukseklik={setSeritH} altDolgu={0}>
          {/* Gövde görünür yüksekliğe sabitlenir: sayfa tam boy olup aşağı kaydığı için flex:1 alt çubuğu ekran dışına taşırıyordu (#83). */}
          <View style={{ height: govdeYuksekligi(yukseklik[hal], seritH) }}>
            {durum.sekme === 'genel' ? (
              <GenelSekmesi yer={yer} yukleniyor={tam.isPending} hata={tam.isError} dakika={p.dakika} onSure={p.onSure} gunSecici={p.gunSecici} mesgul={p.mesgul} onGaleri={() => galeriAc(true)} />
            ) : null}
            {durum.sekme === 'yorumlar' ? <YorumlarSekmesi placeId={p.placeId} acik={durum.sekme === 'yorumlar'} /> : null}
            {durum.sekme === 'rehber' ? <RehberSekmesi /> : null}
            <View style={s.altCubuk}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !!p.mesgul }}
                disabled={p.mesgul}
                onPress={p.onCta}
                style={({ pressed }) => [s.cta, (pressed || p.mesgul) && { opacity: 0.8 }]}
              >
                <Text style={s.ctaMetin}>{cta}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={p.onYolTarifi} style={({ pressed }) => [s.ikincil, pressed && { opacity: 0.8 }]}>
                <Text style={s.ikincilMetin}>{t('mekan.panel.yolTarifi')}</Text>
              </Pressable>
            </View>
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

/** Sekme gövdesi: alt sayfanın kaydırma bağlamına bağlı liste (liste en üstteyken aşağı çekiş sayfayı indirir). */
function Govde({ children }: { children: ReactNode }) {
  const kaydirma = useSayfaKaydirma();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.govde} onScroll={kaydirma} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Genel

function GenelSekmesi({
  yer,
  yukleniyor,
  hata,
  dakika,
  onSure,
  gunSecici,
  mesgul,
  onGaleri,
}: {
  yer: TamYer | null;
  yukleniyor: boolean;
  hata: boolean;
  dakika: number;
  onSure: (fark: number) => void;
  gunSecici?: MekanPaneliProps['gunSecici'];
  mesgul?: boolean;
  /** Fotoğraf şeridine dokunuldu → tam ekran galeri (panel katmanında). */
  onGaleri: () => void;
}) {
  const [ozetAcik, setOzetAcik] = useState(false);
  const ekran = useWindowDimensions();
  const acik = acikDurumu(yer);
  return (
    <Govde>
      {yer && yer.fotolar.length > 0 ? <FotoSeridi yer={yer} onAc={onGaleri} /> : null}
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
      <View style={s.satirlar}>
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
                    style={[s.gunDaire, { borderColor: rengi }, secili && { backgroundColor: rengi }]}
                  >
                    <Text style={[s.gunMetin, { color: secili ? renk.zemin : rengi }]}>{g.index}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Satir>
        ) : null}
        <Satir etiket={t('mekan.panel.sure')}>
          <View style={s.sureKontrol}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.azalt')} onPress={() => onSure(-15)} hitSlop={6} style={s.sureDugme}>
              <Text style={s.sureIsaret}>−</Text>
            </Pressable>
            <Text style={s.deger}>{sureMetni(dakika)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('mekan.artir')} onPress={() => onSure(15)} hitSlop={6} style={s.sureDugme}>
              <Text style={s.sureIsaret}>+</Text>
            </Pressable>
          </View>
        </Satir>
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
          <Text style={[s.deger, { maxWidth: ekran.width * 0.55 }]} numberOfLines={1}>
            {yer?.adres ?? (yer ? '—' : '…')}
          </Text>
        </Satir>
      </View>
    </Govde>
  );
}

/**
 * KK5: 10 küçük resim (120×88), yatay; yalnız görünür olanlar + 1 komşu çözülür; dokununca tam ekran galeri.
 * #85 kök neden: kaydırma işleyicisi `e.nativeEvent`'i setState GÜNCELLEYİCİSİNİN içinde (render sırasında) okuyordu.
 * React Native sentetik olayları havuzlar: işleyici dönünce `nativeEvent` null'lanır; art arda kaydırma olaylarında
 * güncelleyici render'a ertelenince `null.contentOffset` → render istisnası (hata kartı). Konum artık işleyicide eşzamanlı
 * okunur; güncelleyiciye yalnız sayı girer. Her küçük resim kendi hook'unu taşıyan ayrı bileşendir (hook sayısı sabit).
 */
export function FotoSeridi({ yer, onAc }: { yer: TamYer; onAc: () => void }) {
  const ekran = useWindowDimensions();
  const [yuklenecek, setYuklenecek] = useState(() => gorunenFotoSayisi(0, ekran.width, FOTO_EN, FOTO_ARA));
  const kaydirildi = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const sayi = gorunenFotoSayisi(e.nativeEvent.contentOffset.x, ekran.width, FOTO_EN, FOTO_ARA);
    setYuklenecek((n) => Math.max(n, sayi));
  };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.serit}
      contentContainerStyle={s.seritIcerik}
      onScroll={kaydirildi}
      scrollEventThrottle={48}
      testID="foto-seridi"
    >
      {yer.fotolar.map((f, i) => (
        <Pressable key={f.ad} accessibilityRole="imagebutton" accessibilityLabel={t('mekan.panel.fotoAc')} onPress={onAc}>
          <KucukFoto ad={f.ad} hazirUri={i === 0 ? yer.foto_uri : null} yukle={i < yuklenecek} testID={`foto-kare-${i}`} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function KucukFoto({ ad, hazirUri, yukle, testID }: { ad: string; hazirUri: string | null; yukle: boolean; testID?: string }) {
  const sorgu = usePlaceFoto(yukle && !hazirUri ? ad : undefined, 400);
  const uri = hazirUri ?? sorgu.data ?? null;
  return (
    <View style={s.kucukFoto} testID={testID} accessibilityState={{ busy: yukle && !uri }}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
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

function YorumlarSekmesi({ placeId, acik }: { placeId: string; acik: boolean }) {
  const sorgu = useYorumlar(placeId, acik);
  const [sira, setSira] = useState<YorumSirasi>('yeni');
  const veri = sorgu.data;
  const puan = puanMetni(veri?.puan);
  return (
    <Govde>
      {sorgu.isPending ? <ActivityIndicator color={renk.metin} style={{ marginVertical: 20 }} /> : null}
      {sorgu.isError ? <Text style={s.hata}>{t('mekan.panel.yorumHata')}</Text> : null}
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
    </Govde>
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

// ---------------------------------------------------------------- Rehber (KK11: yer tutucu)

function RehberSekmesi() {
  return (
    <Govde>
      <View style={s.bilgi}>
        <Text style={s.bilgiBaslik}>{t('mekan.panel.rehberBaslik')}</Text>
        <Text style={s.ozet}>{t('mekan.panel.rehberMetin')}</Text>
      </View>
    </Govde>
  );
}

const s = StyleSheet.create({
  ust: { paddingHorizontal: bosluk.kenar, gap: 12 },
  tutamac: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', marginTop: -2 },
  baslik: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kapak: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#d9d9d6' },
  ad: { fontFamily: yazi.ekstra, fontSize: 18, letterSpacing: -0.36, lineHeight: 21, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  acik: { fontFamily: yazi.kalin, color: renk.basari },
  kapali: { fontFamily: yazi.kalin, color: renk.uyari },
  puanSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  puanMetin: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  puanKalin: { fontFamily: yazi.kalin, color: renk.metin },
  rozet: { height: 20, paddingHorizontal: 8, borderRadius: 999, backgroundColor: renk.vurgu, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 10.5, color: renk.zemin },
  kapat: { width: 32, height: 32, borderRadius: 16, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  kapatMetin: { fontFamily: yazi.ekstra, fontSize: 18, lineHeight: 20, color: renk.metin },
  sekmeler: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 12, backgroundColor: renk.yuzey },
  sekme: { flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sekmeSecili: { backgroundColor: renk.zemin, shadowColor: renk.metin, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  sekmeMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
  sekmeMetinSecili: { color: renk.metin },
  govde: { paddingHorizontal: bosluk.kenar, paddingTop: 14, paddingBottom: 16, gap: 14 },
  serit: { marginHorizontal: -bosluk.kenar, flexGrow: 0 },
  seritIcerik: { paddingHorizontal: bosluk.kenar, gap: FOTO_ARA },
  kucukFoto: { width: FOTO_EN, height: FOTO_BOY, borderRadius: 12, overflow: 'hidden', backgroundColor: '#d9d9d6' },
  bilgi: { gap: 6 },
  bilgiBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  ozet: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 19.5, color: '#4a4a4a' },
  devami: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin, marginTop: 2 },
  satirlar: {},
  satir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: renk.ayrac, minHeight: 44 },
  etiket: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  deger: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin, textAlign: 'right', flexShrink: 1 },
  sureKontrol: { flexDirection: 'row', alignItems: 'center', height: 32, borderRadius: 999, backgroundColor: renk.yuzey, paddingHorizontal: 2 },
  sureDugme: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sureIsaret: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  gunler: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
  gunDaire: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: renk.zemin },
  gunMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  // Alt güvenli alanı uygulama alt menüsü karşılar (panel alanı menünün üstünde biter, #83 KK1).
  altCubuk: { flexDirection: 'row', gap: 10, paddingHorizontal: bosluk.kenar, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: renk.ayrac, backgroundColor: renk.zemin },
  cta: { flex: 1, height: 52, borderRadius: 999, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  ctaMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.zemin },
  ikincil: { height: 52, paddingHorizontal: 18, borderRadius: 999, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  ikincilMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center', paddingVertical: 12 },
  ozetSatir: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  buyukPuan: { fontFamily: yazi.ekstra, fontSize: 34, letterSpacing: -1, color: renk.metin },
  siralar: { flexDirection: 'row', gap: 8 },
  siraHap: { height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  siraHapSecili: { backgroundColor: renk.metin },
  siraMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
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
