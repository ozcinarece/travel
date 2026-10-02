import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { bolgeHesapla, zoomDelta } from './geo';
import { ACIK_HARITA_STILI } from './haritaStili';
import { PinIcerigi } from './PinIcerigi';
import type { HaritaPini, HaritaProps } from './tipler';

export function Harita({ merkez, zoom = 14, pinler = [], daireler = [], odak, onPinBas, onPinSuruklendi, onBolgeDegisti }: HaritaProps) {
  const ref = useRef<MapView>(null);

  // Odak değişince kamera animasyonla gider; initialRegion yalnız ilk kurulumda okunur.
  useEffect(() => {
    if (!odak) return;
    const d = zoomDelta(odak.zoom);
    ref.current?.animateToRegion({ latitude: odak.konum.lat, longitude: odak.konum.lng, latitudeDelta: d, longitudeDelta: d }, 450);
  }, [odak]);

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
      onRegionChangeComplete={(b) =>
        onBolgeDegisti?.(bolgeHesapla({ lat: b.latitude, lng: b.longitude }, b.latitudeDelta, b.longitudeDelta))
      }>
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
          // Görünüm değişince (renk/etiket/seçim) işaretçi yeniden kurulur ve anlık görüntüsü yeniden alınır.
          key={`${p.id}:${p.tur ?? ''}:${p.renk}:${p.etiket ?? ''}:${p.secili ? 1 : 0}`}
          pin={p}
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
function OzelIsaretci({ pin: p, onPinBas, onPinSuruklendi }: { pin: HaritaPini } & Pick<HaritaProps, 'onPinBas' | 'onPinSuruklendi'>) {
  const [izle, setIzle] = useState(!!p.tur);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
  }, []);
  const yerlesti = () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => setIzle(false), 600);
  };
  return (
    <Marker
      coordinate={{ latitude: p.konum.lat, longitude: p.konum.lng }}
      pinColor={p.renk}
      title={p.tur ? undefined : p.etiket}
      anchor={p.tur === 'oneri' || p.tur === 'aday' ? { x: 0.1, y: 0.5 } : { x: 0.5, y: 0.5 }}
      tracksViewChanges={izle}
      zIndex={p.secili || p.tur === 'otel' ? 2 : 1}
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
          <PinIcerigi pin={p} />
        </View>
      ) : null}
    </Marker>
  );
}
