import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View, useWindowDimensions } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { bolgeHesapla, enYakinPin, etiketBolgesi, gizliEtiketler, haritaDolgusu, isaretciImzasi, izlemeGerekli, pinCapasi, pinZ, zoomaGorePinler, zoomDelta } from './geo';
import { ACIK_HARITA_STILI } from './haritaStili';
import { dokunusuIletir, isaretciPlani, planFarki } from './isaretciler';
import { PinIcerigi, pinPngAnahtari } from './PinIcerigi';
import { IGNE_CAPA, IGNE_CAPA_34, PIN_IKONLARI } from './pinIkonlari';
import { usePinGorselleri } from './pinOnYukleme';
import { bacakEtiketPinleri, yonOklari } from './rota';
import { dokunmaKaydet, isaretciSayilariniKaydet, secimSuresiKaydet, taniSayaclari } from './tani';
import type { HaritaBolgesi, HaritaCizgisi, HaritaPini, HaritaProps, Konum } from './tipler';

/** "#rrggbb" + opaklık → "#rrggbbaa". */
function saydam(hex: string, opaklik: number) {
  const a = Math.round(Math.max(0, Math.min(1, opaklik)) * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? `${hex}${a}` : hex;
}

/** #59 §C (RouteSpec5): seçili gün üç katman — gölge 11 dp %12 · beyaz kenar 9 dp · renk 5,5 dp; diğer günler 3 dp. */
const ROTA = { golge: 11, kenar: 9, cizgi: 5.5, ince: 3, golgeRenk: '#0f0f0f', golgeOpaklik: 0.12 } as const;
/** Rotası henüz gelmemiş kuş uçuşu: ince kesikli (10/8 dp; Android'de desen ekran pikseli → PixelRatio). #65: araba bacağı düz. */
const dp = (v: number) => Math.round(PixelRatio.get() * v);
const KESIKLI = [dp(10), dp(8)];
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
  seciliId = null,
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

  // #33: bacak etiketleri (#65: yalnız araba "12 dk") pin gibi çizilir; çakışma kuralına en düşük öncelikle girer.
  // #66 KK2: zoom < 13'te öneri pinleri küçük ve adsız (zoom adımına bağlı).
  const tumPinler = useMemo(() => [...zoomaGorePinler(pinler, etiketBolge.zoom), ...bacakEtiketPinleri(cizgiler)], [pinler, cizgiler, etiketBolge.zoom]);
  const olcu = useMemo(() => ({ genislik: ekran.width, yukseklik: ekran.height }), [ekran.width, ekran.height]);
  // #59 §A: kümeleme yok; yakın pinler üst üste biner (beyaz kenar ayırır, z-sırası pinZ). #66 KK1: pin hiç düşmez,
  // yalnız adı / puanı gizlenir. Gizlenen hap hiç çizilmez (opaklıkla saklamak bitmap yakalaması isterdi).
  const gizli = useMemo(() => gizliEtiketler(tumPinler, etiketBolge, olcu, ustBosluk), [tumPinler, etiketBolge, olcu, ustBosluk]);
  const gorunen = useMemo(() => tumPinler.filter((p) => !(p.tur === 'etiket' && gizli.etiket.has(p.id))), [tumPinler, gizli]);
  // #71: işaretçi planı — anahtar görünüm durumunu içerir (PNG adı, seçili); her pin en fazla bir pin + bir ad işaretçisi.
  // #75: seçim (`seciliId`) yalnız burada işlenir — `tumPinler` / `gizli` seçimle değişmez, diğer işaretçiler aynı anahtarla kalır.
  const plan = useMemo(() => isaretciPlani(gorunen, gizli, etiketBolge.zoom, gorsellerHazir, seciliId), [gorunen, gizli, etiketBolge.zoom, gorsellerHazir, seciliId]);
  // Tanı sayaçları render dışında (effect) yazılır: işaretçi sayıları, plan farkı (#75 KK2) ve dokunuş → iğne süresi.
  const oncekiPlan = useRef<typeof plan>([]);
  useEffect(() => {
    taniSayaclari.sonDegisim = planFarki(oncekiPlan.current, plan);
    oncekiPlan.current = plan;
    isaretciSayilariniKaydet(gorunen.length, plan);
    if (seciliId && taniSayaclari.sonDokunma === seciliId && taniSayaclari.dokunmaAni && plan.some((i) => i.tur !== 'ad' && i.pin.id === seciliId && i.pin.secili)) {
      secimSuresiKaydet('igne');
    }
  }, [gorunen.length, plan, seciliId]);
  const pinBas = (id: string) => {
    dokunmaKaydet(id);
    onPinBas?.(id);
  };
  // #59 §C / #65: yön okları ~24 px aralık, en fazla 80 — zoom adımına göre.
  const oklar = useMemo(() => yonOklari(cizgiler, pinler, etiketBolge, olcu), [cizgiler, pinler, etiketBolge, olcu]);
  // #73 B: dokunma — işaretçi ya da harita dokunuşunun koordinatından en yakın pin (merkeze ≤ 22 px; eşitlikte pinZ).
  // Android'de işaretçi dokunuşunun koordinatı işaretçinin konumudur: o pin 0 px'te bulunur; ad işaretçisi de pinin
  // konumunda olduğundan aynı pine düşer (ad işaretçisinin dokunuşu yutması böylece bitti). Pin yoksa harita dokunuşu.
  const dokun = (k: { latitude: number; longitude: number }, isaretci: boolean) => {
    const id = enYakinPin(gorunen, bolge, olcu, { lat: k.latitude, lng: k.longitude }, undefined, (p) => !dokunusuIletir(p));
    if (id) pinBas(id);
    else if (!isaretci) onHaritaBas?.();
  };
  // #55 §C10: Marker'da uzun basma yok — haritaya uzun basılan noktaya ~28 px içindeki en yakın pin (otel hariç).
  const uzunBas = (k: { latitude: number; longitude: number }) => {
    if (!onPinUzunBas) return;
    const id = enYakinPin(gorunen, bolge, olcu, { lat: k.latitude, lng: k.longitude }, 28, (p) => p.tur === 'etiket' || p.tur === 'konum' || p.tur === 'otel');
    if (id) onPinUzunBas(id);
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
      // #75 (ürün kararı): çift dokunmayla yakınlaştırma kapalı — Google Maps tek dokunuşu çift dokunma süresi kadar
      // bekletiyordu; yakınlaştırma iki parmakla zaten var. İşaretçi dokunuşu (onMarkerPress) bu beklemeye girmez.
      zoomTapEnabled={false}
      // Android'de işaretçi dokunuşu haritanın onPress'ine değil onMarkerPress'e gelir (MapView.java onMarkerClick); iOS'ta
      // onPress 'marker-press' ile de gelebilir → o durumda yalnız onMarkerPress işler (çift seçim olmasın).
      onPress={(e) => {
        if (e.nativeEvent.action !== 'marker-press') dokun(e.nativeEvent.coordinate, false);
      }}
      onMarkerPress={(e) => dokun(e.nativeEvent.coordinate, true)}
      onLongPress={(e) => uzunBas(e.nativeEvent.coordinate)}
      onRegionChangeComplete={(b) => {
        const yeni = bolgeHesapla({ lat: b.latitude, lng: b.longitude }, b.latitudeDelta, b.longitudeDelta);
        taniSayaclari.bolgeOlayi += 1;
        setBolge(yeni);
        setEtiketBolge((onceki) => etiketBolgesi(onceki, yeni));
        onBolgeDegisti?.(yeni);
        if (__DEV__) console.log(`[harita] bölge olayı ${taniSayaclari.bolgeOlayi} · kurulum ${haritaSayaclari.kurulum} · yakalama ${haritaSayaclari.yakalama} · zoom ${yeni.zoom.toFixed(2)} · işaretçi ${gorunen.length}`);
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
      {plan.map((i) => {
        // #40: çakışmada önce puan satırı düşer (gizli.detay), sonra ad (gizli.etiket).
        const p = i.pin;
        if (i.tur === 'gorunum') return <OzelIsaretci key={i.anahtar} pin={p} etiketGizli={i.etiketGizli} detay={i.detay} onPinSuruklendi={onPinSuruklendi} />;
        // #71 / #73: ad işaretçisinin dokunuşu da haritanın onPress'ine (marker-press, işaretçi konumu) düşer → en yakın pin.
        if (i.tur === 'ad') return <OzelIsaretci key={i.anahtar} pin={p} etiketGizli={false} detay={i.detay} yalnizEtiket />;
        // #61 §6: daire hazır PNG (görünüm yakalaması yok); ad ayrı işaretçi. Anahtar görünüm durumunu taşır (#71).
        return (
          <Marker
            key={i.anahtar}
            coordinate={{ latitude: p.konum.lat, longitude: p.konum.lng }}
            image={i.gorsel}
            // #65: seçili iğnenin çapası ucu; dairelerde merkez.
            anchor={p.secili ? (p.boy === 34 ? IGNE_CAPA_34 : IGNE_CAPA) : { x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            opacity={p.opaklik ?? 1}
            zIndex={pinZ(p)}
            draggable={p.surukle}
            onDragEnd={(e) => onPinSuruklendi?.(p.id, { lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          />
        );
      })}
    </MapView>
  );
}

/**
 * #59 §C / #65: üç katmanlı rota (gölge · beyaz kenar · renk) — yürüme ve araba aynı (araba düz, oksuz); diğer günler ve kuş
 * uçuşu ince. #77: ince de aynı ÜÇ Polyline'dır (gölge ve kenar saydam) — ince ↔ kalın, kuş uçuşu ↔ gerçek yol geçişleri
 * çizgiyi kaldırıp yeniden kurmak yerine aynı Polyline'ın özelliklerini günceller (Android'de kaldırılan çizgi hayalet kalabiliyordu).
 */
function RotaCizgisi({ cizgi: c }: { cizgi: HaritaCizgisi }) {
  const noktalar = useMemo(() => c.noktalar.map((n) => ({ latitude: n.lat, longitude: n.lng })), [c.noktalar]);
  const opaklik = c.opaklik ?? 1;
  const ortak = { coordinates: noktalar, lineCap: 'round' as const, lineJoin: 'round' as const };
  const desen = c.kesik ? KESIKLI : undefined;
  const ince = !!c.ince;
  return (
    <>
      <Polyline {...ortak} strokeColor={ince ? SAYDAM : saydam(ROTA.golgeRenk, ROTA.golgeOpaklik * opaklik)} strokeWidth={ROTA.golge} zIndex={ince ? 0 : 1} />
      <Polyline {...ortak} strokeColor={ince ? SAYDAM : saydam('#ffffff', opaklik)} strokeWidth={ROTA.kenar} zIndex={ince ? 0 : 2} />
      <Polyline {...ortak} lineDashPattern={desen} strokeColor={saydam(c.renk, opaklik)} strokeWidth={ince ? ROTA.ince : ROTA.cizgi} zIndex={ince ? 0 : 3} />
    </>
  );
}
const SAYDAM = '#00000000';

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
  onPinSuruklendi,
  yalnizEtiket = false,
}: { pin: HaritaPini; etiketGizli: boolean; detay: boolean; yalnizEtiket?: boolean } & Pick<HaritaProps, 'onPinSuruklendi'>) {
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
  const capa =
    p.tur === 'aday' ? { x: 0.1, y: 0.5 } : p.tur === 'otel' || p.tur === 'etiket' || p.tur === 'konum' || !p.tur ? { x: 0.5, y: 0.5 } : yalnizEtiket && p.secili ? { x: 0.5, y: 0 } : pinCapasi(p, detay);
  // #73: dokunuş işaretçide değil haritanın onPress'inde çözülür (en yakın pin); `tappable` yalnız iOS'ta anlamlı.
  const bacak = !dokunusuIletir(p);
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
