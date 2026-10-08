import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Image, PixelRatio, StyleSheet, View, useWindowDimensions } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { bolgeHesapla, detayGoster, etiketBolgesi, haritaDolgusu, isaretciImzasi, izlemeGerekli, pinCapasi, pinCapi, pinSecimi, pinZ, zoomDelta } from './geo';
import { ACIK_HARITA_STILI } from './haritaStili';
import { PinIcerigi, pinGorseli, pinPngAnahtari, TAKSI_SARI } from './PinIcerigi';
import { PIN_IKONLARI } from './pinIkonlari';
import { bacakEtiketPinleri, yonOklari } from './rota';
import type { HaritaBolgesi, HaritaCizgisi, HaritaPini, HaritaProps, Konum } from './tipler';

/** "#rrggbb" + opaklık → "#rrggbbaa". */
function saydam(hex: string, opaklik: number) {
  const a = Math.round(Math.max(0, Math.min(1, opaklik)) * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? `${hex}${a}` : hex;
}

/** #59 §C (RouteSpec5): seçili gün üç katman — gölge 11 dp %12 · beyaz kenar 9 dp · renk 5,5 dp; diğer günler 3 dp. */
const ROTA = { golge: 11, kenar: 9, cizgi: 5.5, ince: 3, golgeRenk: '#0f0f0f', golgeOpaklik: 0.12 } as const;
/**
 * #61 §7: taksi bacağı sarı-siyah şerit (mod rengi, gün renginden bağımsız): siyah 10 dp kenar · sarı 6 dp dolgu ·
 * siyah 6 dp kesikli şerit (10/14 dp; Android'de desen ekran pikseli olduğundan PixelRatio ile çevrilir). Ok yok.
 * Rotası henüz gelmemiş yürüyüş kuş uçuşu kesikli (10/8 dp), gün renginde.
 */
const TAKSI = { kenar: 10, dolgu: 6, serit: 6, siyah: '#0f0f0f', sari: TAKSI_SARI } as const;
const dp = (v: number) => Math.round(PixelRatio.get() * v);
const SERIT = [dp(10), dp(14)];
const KESIKLI = [dp(10), dp(8)];

/**
 * #61 §6: tüm pin PNG'leri (daireler, ok, hap ikonları) harita kurulmadan önce Fresco belleğine alınır; `image`
 * işaretçileri hazır olana kadar çizilmez (varsayılan kırmızı iğne görünmesin). Paket içi kaynaklar (şemasız ad)
 * zaten eşzamanlı yüklenir; prefetch reddederse geçilir. En fazla 1,5 sn beklenir.
 */
let pinGorselleriHazir = false;
let pinGorselleriSozu: Promise<void> | null = null;
export function pinGorselleriniYukle(): Promise<void> {
  if (!pinGorselleriSozu) {
    const uriler = Object.values(PIN_IKONLARI)
      .map((k) => Image.resolveAssetSource(k)?.uri)
      .filter((u): u is string => !!u && /^(https?|file|asset|data):/.test(u));
    const zamanAsimi = new Promise<void>((cozul) => setTimeout(cozul, 1500));
    pinGorselleriSozu = Promise.race([Promise.allSettled(uriler.map((u) => Image.prefetch(u))).then(() => undefined), zamanAsimi]).then(() => {
      pinGorselleriHazir = true;
    });
  }
  return pinGorselleriSozu;
}
function usePinGorselleri(): boolean {
  const [hazir, setHazir] = useState(pinGorselleriHazir);
  useEffect(() => {
    if (hazir) return;
    let aktif = true;
    pinGorselleriniYukle().then(() => {
      if (aktif) setHazir(true);
    });
    return () => {
      aktif = false;
    };
  }, [hazir]);
  return hazir;
}
const OK_PNG = PIN_IKONLARI['ok-ffffff'];

/** #59 §B KK3 geliştirme sayacı: işaretçi kurulumu / bitmap yakalaması (yalnız __DEV__'de yazdırılır). */
export const haritaSayaclari = { kurulum: 0, yakalama: 0 };

export function Harita({
  merkez,
  zoom = 14,
  pinler = [],
  daireler = [],
  cizgiler = [],
  odak,
  onPinBas,
  onHaritaBas,
  onPinSuruklendi,
  onBolgeDegisti,
  altBosluk = 0,
  ustBosluk = 0,
  sigdir,
  onPinUzunBas,
}: HaritaProps) {
  const ref = useRef<MapView>(null);
  const ekran = useWindowDimensions();
  const gorsellerHazir = usePinGorselleri();
  const [bolge, setBolge] = useState<HaritaBolgesi>(() => bolgeHesapla(merkez, zoomDelta(zoom), zoomDelta(zoom)));
  // #59 §B: etiket / ok hesabının bölgesi yalnız zoom adımı değişince yenilenir; saf kaydırma işaretçilere dokunmaz.
  const [etiketBolge, setEtiketBolge] = useState<HaritaBolgesi>(bolge);
  // #49: Android'de GoogleMap hazır olmadan değişen mapPadding native çöküşe yol açar (react-native-maps 1.27
  // applyBaseMapPadding → null map.setPadding). Dolgu yalnız onMapReady'den sonra gönderilir.
  const [hazir, setHazir] = useState(false);
  const dolgu = useMemo(() => haritaDolgusu(hazir, altBosluk), [hazir, altBosluk]);

  // Odak değişince kamera animasyonla gider; initialRegion yalnız ilk kurulumda okunur.
  useEffect(() => {
    if (!odak) return;
    const d = zoomDelta(odak.zoom);
    ref.current?.animateToRegion({ latitude: odak.konum.lat, longitude: odak.konum.lng, latitudeDelta: d, longitudeDelta: d }, 450);
  }, [odak]);

  const sigdirKamera = (noktalar: Konum[], kenar: { top: number; right: number; bottom: number; left: number }) => {
    if (noktalar.length === 1) {
      const d = zoomDelta(15);
      ref.current?.animateToRegion({ latitude: noktalar[0].lat, longitude: noktalar[0].lng, latitudeDelta: d, longitudeDelta: d }, 450);
      return;
    }
    ref.current?.fitToCoordinates(
      noktalar.map((n) => ({ latitude: n.lat, longitude: n.lng })),
      { edgePadding: kenar, animated: true },
    );
  };
  // #55 §A5: noktaları sığdır — harita hazır olunca (fitToCoordinates; dolgu panel yüksekliğini zaten içerir).
  useEffect(() => {
    if (!sigdir || !hazir || sigdir.noktalar.length === 0) return;
    sigdirKamera(sigdir.noktalar, { top: sigdir.ust, right: 48, bottom: sigdir.alt, left: 48 });
  }, [sigdir, hazir]);

  // #33: bacak etiketleri (#59: yalnız taksi "12 dk") pin gibi çizilir; çakışma kuralına en düşük öncelikle girer.
  const tumPinler = useMemo(() => [...pinler, ...bacakEtiketPinleri(cizgiler)], [pinler, cizgiler]);
  const olcu = useMemo(() => ({ genislik: ekran.width, yukseklik: ekran.height }), [ekran.width, ekran.height]);
  // #59 §A: kümeleme yok; yakın pinler üst üste biner (beyaz kenar ayırır, z-sırası pinZ). #61 §2: adı sığmayan öneri
  // pini çizilmez. Gizlenen hap da hiç çizilmez (opaklıkla saklamak bitmap yakalaması isterdi).
  const secim = useMemo(() => pinSecimi(tumPinler, etiketBolge, olcu, ustBosluk), [tumPinler, etiketBolge, olcu, ustBosluk]);
  const gizli = secim.gizli;
  const gorunen = useMemo(() => secim.pinler.filter((p) => !(p.tur === 'etiket' && gizli.etiket.has(p.id))), [secim, gizli]);
  // #59 §C: yön okları — zoom adımına göre; en fazla 40.
  const oklar = useMemo(() => yonOklari(cizgiler, pinler, etiketBolge, olcu), [cizgiler, pinler, etiketBolge, olcu]);
  // #55 §C10: Marker'da uzun basma yok — haritaya uzun basılan noktaya ~28 px içindeki en yakın pin.
  const uzunBas = (k: { latitude: number; longitude: number }) => {
    if (!onPinUzunBas || bolge.latDelta <= 0) return;
    const pxLat = olcu.yukseklik / bolge.latDelta;
    const pxLng = olcu.genislik / bolge.lngDelta;
    let enYakin: { id: string; d: number } | null = null;
    for (const p of gorunen) {
      if (p.tur === 'etiket' || p.tur === 'konum' || p.tur === 'otel') continue;
      // Pin dairesi çapanın üstünde değil, merkezinde (pinCapasi daire merkezi).
      const d = Math.hypot((p.konum.lng - k.longitude) * pxLng, (p.konum.lat - k.latitude) * pxLat);
      if (d <= Math.max(28, pinCapi(p) / 2 + 6) && (!enYakin || d < enYakin.d)) enYakin = { id: p.id, d };
    }
    if (enYakin) onPinUzunBas(enYakin.id);
  };

  return (
    <MapView
      ref={ref}
      // iOS'ta da Google: Places verisi Google haritası dışında gösterilemez.
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: merkez.lat,
        longitude: merkez.lng,
        latitudeDelta: zoomDelta(zoom),
        longitudeDelta: zoomDelta(zoom),
      }}
      // #17 KK1: cihaz temasından bağımsız açık harita (Android'de MapColorScheme.LIGHT, iOS'ta light).
      userInterfaceStyle="light"
      customMapStyle={ACIK_HARITA_STILI}
      toolbarEnabled={false}
      // #51: pusula üst haplarla çakışıyordu.
      showsCompass={false}
      // #47 A1: harita görünür alanı panelin üstünde biter; Google logosu panelin üstünde kalır.
      mapPadding={dolgu}
      onMapReady={() => setHazir(true)}
      showsPointsOfInterests={false}
      // #32: pine dokunmak haritayı kaydırmaz.
      moveOnMarkerPress={false}
      onPress={(e) => {
        if (e.nativeEvent.action !== 'marker-press') onHaritaBas?.();
      }}
      onLongPress={(e) => uzunBas(e.nativeEvent.coordinate)}
      onRegionChangeComplete={(b) => {
        const yeni = bolgeHesapla({ lat: b.latitude, lng: b.longitude }, b.latitudeDelta, b.longitudeDelta);
        setBolge(yeni);
        setEtiketBolge((onceki) => etiketBolgesi(onceki, yeni));
        onBolgeDegisti?.(yeni);
        if (__DEV__) console.log(`[harita] kurulum ${haritaSayaclari.kurulum} · yakalama ${haritaSayaclari.yakalama} · zoom ${yeni.zoom.toFixed(2)}`);
      }}>
      {cizgiler.map((c) => (
        <RotaCizgisi key={c.id} cizgi={c} />
      ))}
      {daireler.map((d) => (
        <Circle
          key={d.id}
          center={{ latitude: d.merkez.lat, longitude: d.merkez.lng }}
          radius={d.yaricapM}
          strokeColor={d.renk}
          strokeWidth={1.5}
          lineDashPattern={[6, 6]}
        />
      ))}
      {gorsellerHazir &&
        oklar.map((o) => (
        // #59 §C: ok görseli doğuya bakar; rotation saat yönünde, kuzeyden.
        <Marker
          key={o.id}
          coordinate={{ latitude: o.konum.lat, longitude: o.konum.lng }}
          image={OK_PNG}
          flat
          rotation={(o.aci - 90 + 360) % 360}
          anchor={{ x: 0.5, y: 0.5 }}
          tappable={false}
          tracksViewChanges={false}
            zIndex={0}
          />
        ))}
      {gorunen.map((p) => {
        // #40: çakışmada önce puan satırı düşer (gizli.detay), sonra ad (gizli.etiket).
        const detay = detayGoster(p, etiketBolge.zoom) && !gizli.detay.has(p.id);
        const etiketGizli = gizli.etiket.has(p.id);
        const gorsel = pinGorseli(p);
        if (!gorsel) return <OzelIsaretci key={p.id} pin={p} etiketGizli={etiketGizli} detay={detay} onPinBas={onPinBas} onPinSuruklendi={onPinSuruklendi} />;
        // #61 §6: daire hazır PNG (görünüm yakalaması yok); ad ayrı, yalnız metinli, dokunulamaz işaretçi. Görseller
        // belleğe alınmadan hiç çizilmez.
        if (!gorsellerHazir) return null;
        return (
          <Fragment key={p.id}>
            <Marker
              coordinate={{ latitude: p.konum.lat, longitude: p.konum.lng }}
              image={gorsel}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              opacity={p.opaklik ?? 1}
              zIndex={pinZ(p)}
              draggable={p.surukle}
              onPress={() => onPinBas?.(p.id)}
              onDragEnd={(e) => onPinSuruklendi?.(p.id, { lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
            />
            {p.ad && !etiketGizli ? <OzelIsaretci pin={p} etiketGizli={false} detay={detay} yalnizEtiket /> : null}
          </Fragment>
        );
      })}
    </MapView>
  );
}

/** #59 §C: üç katmanlı rota (gölge · beyaz kenar · renk); taksi noktalı; diğer günler tek ince çizgi. */
function RotaCizgisi({ cizgi: c }: { cizgi: HaritaCizgisi }) {
  const noktalar = useMemo(() => c.noktalar.map((n) => ({ latitude: n.lat, longitude: n.lng })), [c.noktalar]);
  const opaklik = c.opaklik ?? 1;
  const ortak = { coordinates: noktalar, lineCap: 'round' as const, lineJoin: 'round' as const };
  // #61 §7: taksi (hap taşıyan kesik bacak) sarı-siyah şerit; rotası gelmemiş yürüyüş kuş uçuşu kesikli.
  const taksi = c.kesik && c.etiketIkon === 'taksi';
  const desen = c.kesik && !taksi ? KESIKLI : undefined;
  if (c.ince) return <Polyline {...ortak} lineDashPattern={desen} strokeColor={saydam(c.renk, opaklik)} strokeWidth={ROTA.ince} zIndex={0} />;
  if (taksi)
    return (
      <>
        <Polyline {...ortak} strokeColor={saydam(TAKSI.siyah, opaklik)} strokeWidth={TAKSI.kenar} zIndex={1} />
        <Polyline {...ortak} strokeColor={saydam(TAKSI.sari, opaklik)} strokeWidth={TAKSI.dolgu} zIndex={2} />
        <Polyline {...ortak} lineDashPattern={SERIT} strokeColor={saydam(TAKSI.siyah, opaklik)} strokeWidth={TAKSI.serit} zIndex={3} />
      </>
    );
  return (
    <>
      <Polyline {...ortak} strokeColor={saydam(ROTA.golgeRenk, ROTA.golgeOpaklik * opaklik)} strokeWidth={ROTA.golge} zIndex={1} />
      <Polyline {...ortak} strokeColor={saydam('#ffffff', opaklik)} strokeWidth={ROTA.kenar} zIndex={2} />
      <Polyline {...ortak} lineDashPattern={desen} strokeColor={saydam(c.renk, opaklik)} strokeWidth={ROTA.cizgi} zIndex={3} />
    </>
  );
}

/** Görünüm değişince bitmap bu kadar ms sonra alınır (yerleşim + çizim payı). */
const YAKALAMA_GECIKMESI_MS = 350;

/**
 * #24: Android, özel işaretçi görünümünü bitmap'e çevirir; `tracksViewChanges` kapanırken o anki görünüm yakalanır.
 * #59 §B: anahtar yalnız pin kimliği (kaydırma / yakınlaştırma işaretçiyi yeniden kurmaz). İzleme, görünüm imzası
 * (geo.isaretciImzasi) değişince açılır ve 350 ms sonra kapanır → bitmap alınır; pinin PNG ikonu (pinPngAnahtari) ilk
 * yüklenene kadar da açık kalır. Yüklenme PNG anahtarına bağlıdır: imza değişip PNG aynı kalınca yeniden beklenmez.
 */
function OzelIsaretci({
  pin: p,
  etiketGizli,
  detay,
  onPinBas,
  onPinSuruklendi,
  yalnizEtiket = false,
}: { pin: HaritaPini; etiketGizli: boolean; detay: boolean; yalnizEtiket?: boolean } & Pick<HaritaProps, 'onPinBas' | 'onPinSuruklendi'>) {
  const imza = isaretciImzasi(p, etiketGizli, detay);
  // Yalnız etiket işaretçisi metinden ibaret: PNG beklenmez.
  const beklenenPng = yalnizEtiket ? null : pinPngAnahtari(p);
  // Bitmap'i alınmış (yakalanmış) görünümün imzası; yüklenmiş PNG ikonun anahtarı.
  const [yakalanan, setYakalanan] = useState<string | null>(null);
  const [yuklenenPng, setYuklenenPng] = useState<string | null>(null);
  const izle = !!p.tur && izlemeGerekli(imza, yakalanan, beklenenPng, yuklenenPng);
  useEffect(() => {
    haritaSayaclari.kurulum += 1;
  }, []);
  useEffect(() => {
    if (!p.tur) return;
    const z = setTimeout(() => {
      setYakalanan(imza);
      haritaSayaclari.yakalama += 1;
    }, YAKALAMA_GECIKMESI_MS);
    return () => clearTimeout(z);
  }, [imza, p.tur]);
  const ikonYuklendi = (anahtar: string) => {
    // onLoad çözümlemede gelir; bir kare sonra çizilmiş olur. Boyut değişmeden Android bitmap'i yenilemez (§6 teşhisi):
    // yüklenen PNG anahtarı görünüme 1 px dürtme olarak yansır → yerleşim değişir → yeniden yakalanır.
    setTimeout(() => setYuklenenPng(anahtar), 80);
  };
  const durt = yuklenenPng !== null && yuklenenPng === beklenenPng;
  const capa = p.tur === 'aday' ? { x: 0.1, y: 0.5 } : p.tur === 'otel' || p.tur === 'etiket' || p.tur === 'konum' || !p.tur ? { x: 0.5, y: 0.5 } : pinCapasi(p, detay);
  // Bacak etiketi, kullanıcı konumu ve yalnız-etiket işaretçisi dokunulamaz (dokunuş daire işaretçisine gider).
  const bacak = p.tur === 'etiket' || p.tur === 'konum' || yalnizEtiket;
  return (
    <Marker
      coordinate={{ latitude: p.konum.lat, longitude: p.konum.lng }}
      pinColor={p.renk}
      title={p.tur ? undefined : p.etiket}
      anchor={capa}
      tracksViewChanges={izle}
      tappable={!bacak}
      // #42 KK5: seçili güne ait olmayan pinler soluk.
      opacity={p.opaklik ?? 1}
      zIndex={pinZ(p)}
      draggable={!yalnizEtiket && p.surukle}
      onPress={() => {
        if (!bacak) onPinBas?.(p.id);
      }}
      onDragEnd={(e) =>
        onPinSuruklendi?.(p.id, {
          lat: e.nativeEvent.coordinate.latitude,
          lng: e.nativeEvent.coordinate.longitude,
        })
      }>
      {p.tur ? (
        <View collapsable={false}>
          <PinIcerigi pin={p} etiketGizli={etiketGizli} detay={detay} onYuklendi={ikonYuklendi} yalnizEtiket={yalnizEtiket} durt={durt} />
        </View>
      ) : null}
    </Marker>
  );
}
