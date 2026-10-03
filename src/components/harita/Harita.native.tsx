import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { bolgeHesapla, gizliEtiketler, pinCapasi, zoomDelta } from './geo';
import { ACIK_HARITA_STILI } from './haritaStili';
import { PinIcerigi } from './PinIcerigi';
import type { HaritaBolgesi, HaritaPini, HaritaProps } from './tipler';

/** "#rrggbb" + opaklık → "#rrggbbaa". */
function saydam(hex: string, opaklik: number) {
  const a = Math.round(Math.max(0, Math.min(1, opaklik)) * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? `${hex}${a}` : hex;
}

export function Harita({ merkez, zoom = 14, pinler = [], daireler = [], cizgiler = [], odak, onPinBas, onPinSuruklendi, onBolgeDegisti }: HaritaProps) {
  const ref = useRef<MapView>(null);
  const ekran = useWindowDimensions();
  const [bolge, setBolge] = useState<HaritaBolgesi>(() => bolgeHesapla(merkez, zoomDelta(zoom), zoomDelta(zoom)));

  // Odak değişince kamera animasyonla gider; initialRegion yalnız ilk kurulumda okunur.
  useEffect(() => {
    if (!odak) return;
    const d = zoomDelta(odak.zoom);
    ref.current?.animateToRegion({ latitude: odak.konum.lat, longitude: odak.konum.lng, latitudeDelta: d, longitudeDelta: d }, 450);
  }, [odak]);

  // #30: çakışan etiketler gizlenir (öncelik: seçili > listede > öneri); yakınlaşınca geri gelir.
  const gizli = useMemo(() => gizliEtiketler(pinler, bolge, { genislik: ekran.width, yukseklik: ekran.height }), [pinler, bolge, ekran.width, ekran.height]);

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
      showsPointsOfInterests={false}
      // #32: pine dokunmak haritayı kaydırmaz.
      moveOnMarkerPress={false}
      onRegionChangeComplete={(b) => {
        const yeni = bolgeHesapla({ lat: b.latitude, lng: b.longitude }, b.latitudeDelta, b.longitudeDelta);
        setBolge(yeni);
        onBolgeDegisti?.(yeni);
      }}>
      {cizgiler.map((c) => (
        <Polyline
          key={c.id}
          coordinates={c.noktalar.map((n) => ({ latitude: n.lat, longitude: n.lng }))}
          strokeColor={saydam(c.renk, c.opaklik ?? 1)}
          strokeWidth={2.5}
          zIndex={0}
        />
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
      {pinler.map((p) => (
        <OzelIsaretci
          // Görünüm değişince (renk/etiket/seçim/ad görünürlüğü) işaretçi yeniden kurulur ve anlık görüntüsü yeniden alınır.
          key={`${p.id}:${p.tur ?? ''}:${p.renk}:${p.etiket ?? ''}:${p.secili ? 1 : 0}:${p.ad && !gizli.has(p.id) ? 'a' : ''}`}
          pin={p}
          etiketGizli={gizli.has(p.id)}
          onPinBas={onPinBas}
          onPinSuruklendi={onPinSuruklendi}
        />
      ))}
    </MapView>
  );
}

/**
 * #24: Android, özel işaretçi görünümünü bitmap'e çevirir. `tracksViewChanges` baştan kapalıysa metin yerleşmeden
 * boş bir dikdörtgen yakalanır. Çözüm: içerik yerleşene kadar izleme açık, kısa bir gecikmeyle kapatılır
 * (sürekli açık kalması harita kaydırmada performansı düşürür).
 */
function OzelIsaretci({
  pin: p,
  etiketGizli,
  onPinBas,
  onPinSuruklendi,
}: { pin: HaritaPini; etiketGizli: boolean } & Pick<HaritaProps, 'onPinBas' | 'onPinSuruklendi'>) {
  const [izle, setIzle] = useState(!!p.tur);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    },
    [],
  );
  const yerlesti = () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => setIzle(false), 600);
  };
  const capa = p.tur === 'aday' ? { x: 0.1, y: 0.5 } : p.tur === 'otel' || !p.tur ? { x: 0.5, y: 0.5 } : pinCapasi(p);
  return (
    <Marker
      coordinate={{ latitude: p.konum.lat, longitude: p.konum.lng }}
      pinColor={p.renk}
      title={p.tur ? undefined : p.etiket}
      anchor={capa}
      tracksViewChanges={izle}
      zIndex={p.secili ? 3 : p.tur === 'otel' ? 2 : 1}
      draggable={p.surukle}
      onPress={() => onPinBas?.(p.id)}
      onDragEnd={(e) =>
        onPinSuruklendi?.(p.id, {
          lat: e.nativeEvent.coordinate.latitude,
          lng: e.nativeEvent.coordinate.longitude,
        })
      }>
      {p.tur ? (
        <View collapsable={false} onLayout={yerlesti}>
          <PinIcerigi pin={p} etiketGizli={etiketGizli} />
        </View>
      ) : null}
    </Marker>
  );
}
