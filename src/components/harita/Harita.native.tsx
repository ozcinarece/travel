import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View, useWindowDimensions } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { bolgeHesapla, detayGoster, etiketBolgesi, haritaDolgusu, isaretciImzasi, izlemeGerekli, pinCapasi, pinCapi, pinSecimi, pinZ, zoomDelta } from './geo';
import { ACIK_HARITA_STILI } from './haritaStili';
import { PinIcerigi, pinPngAnahtari } from './PinIcerigi';
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
 * Taksi bacağı: yalnız renk katmanı noktalı (gölge ve beyaz kenar düz, RouteSpec5). Android'de yuvarlak uçlu parça Dot
 * olur (boyu çizgi kalınlığı kadar); boşluk ekran pikselidir → 7 dp piksele çevrilir (~1,3 nokta aralık).
 */
const NOKTALI = [1, Math.round(PixelRatio.get() * 7)];
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
      {oklar.map((o) => (
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
        return <OzelIsaretci key={p.id} pin={p} etiketGizli={gizli.etiket.has(p.id)} detay={detay} onPinBas={onPinBas} onPinSuruklendi={onPinSuruklendi} />;
      })}
    </MapView>
  );
}

/** #59 §C: üç katmanlı rota (gölge · beyaz kenar · renk); taksi noktalı; diğer günler tek ince çizgi. */
function RotaCizgisi({ cizgi: c }: { cizgi: HaritaCizgisi }) {
  const noktalar = useMemo(() => c.noktalar.map((n) => ({ latitude: n.lat, longitude: n.lng })), [c.noktalar]);
  const opaklik = c.opaklik ?? 1;
  const ortak = { coordinates: noktalar, lineCap: 'round' as const, lineJoin: 'round' as const };
  const desen = c.kesik ? NOKTALI : undefined;
  if (c.ince) return <Polyline {...ortak} lineDashPattern={desen} strokeColor={saydam(c.renk, opaklik)} strokeWidth={ROTA.ince} zIndex={0} />;
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
}: { pin: HaritaPini; etiketGizli: boolean; detay: boolean } & Pick<HaritaProps, 'onPinBas' | 'onPinSuruklendi'>) {
  const imza = isaretciImzasi(p, etiketGizli, detay);
  const beklenenPng = pinPngAnahtari(p);
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
    // onLoad çözümlemede gelir; bir kare sonra çizilmiş olur.
    setTimeout(() => setYuklenenPng(anahtar), 80);
  };
  const capa = p.tur === 'aday' ? { x: 0.1, y: 0.5 } : p.tur === 'otel' || p.tur === 'etiket' || p.tur === 'konum' || !p.tur ? { x: 0.5, y: 0.5 } : pinCapasi(p, detay);
  // Bacak etiketi ve kullanıcı konumu dokunulamaz.
  const bacak = p.tur === 'etiket' || p.tur === 'konum';
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
      draggable={p.surukle}
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
          <PinIcerigi pin={p} etiketGizli={etiketGizli} detay={detay} onYuklendi={ikonYuklendi} />
        </View>
      ) : null}
    </Marker>
  );
}
