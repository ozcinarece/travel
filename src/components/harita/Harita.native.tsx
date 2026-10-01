import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet } from 'react-native';

import { PinIcerigi } from './PinIcerigi';
import type { HaritaProps } from './tipler';

// Google zoom → enlem aralığı (yaklaşık): 360 / 2^zoom.
function delta(zoom: number) {
  return 360 / 2 ** zoom;
}

export function Harita({ merkez, zoom = 14, pinler = [], daireler = [], onPinBas, onPinSuruklendi }: HaritaProps) {
  return (
    <MapView
      // iOS'ta da Google: Places verisi Google haritası dışında gösterilemez.
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: merkez.lat,
        longitude: merkez.lng,
        latitudeDelta: delta(zoom),
        longitudeDelta: delta(zoom),
      }}
      toolbarEnabled={false}>
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
        <Marker
          key={p.id}
          coordinate={{ latitude: p.konum.lat, longitude: p.konum.lng }}
          pinColor={p.renk}
          title={p.tur ? undefined : p.etiket}
          anchor={p.tur === 'oneri' ? { x: 0.1, y: 0.5 } : { x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          draggable={p.surukle}
          onPress={() => onPinBas?.(p.id)}
          onDragEnd={(e) =>
            onPinSuruklendi?.(p.id, {
              lat: e.nativeEvent.coordinate.latitude,
              lng: e.nativeEvent.coordinate.longitude,
            })
          }>
          {p.tur ? <PinIcerigi pin={p} /> : null}
        </Marker>
      ))}
    </MapView>
  );
}
