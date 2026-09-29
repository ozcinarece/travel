import { APIProvider, Circle, Map, Marker } from '@vis.gl/react-google-maps';
import { Text, View } from 'react-native';

import { t } from '@/i18n';
import { renk } from '@/theme';

import type { HaritaProps } from './tipler';

const anahtar = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;

export function Harita({ merkez, zoom = 14, pinler = [], daireler = [], onPinBas, onPinSuruklendi }: HaritaProps) {
  if (!anahtar) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: renk.yuzey }}>
        <Text style={{ color: renk.ikincil }}>{t('harita.anahtarYok')}</Text>
      </View>
    );
  }

  return (
    <APIProvider apiKey={anahtar} language="tr">
      <Map
        style={{ width: '100%', height: '100%' }}
        defaultCenter={merkez}
        defaultZoom={zoom}
        disableDefaultUI
        gestureHandling="greedy">
        {daireler.map((d) => (
          <Circle
            key={d.id}
            center={d.merkez}
            radius={d.yaricapM}
            strokeColor={d.renk}
            strokeWeight={1.5}
            fillOpacity={0}
          />
        ))}
        {pinler.map((p) => (
          <Marker
            key={p.id}
            position={p.konum}
            label={p.etiket}
            draggable={p.surukle}
            onClick={() => onPinBas?.(p.id)}
            onDragEnd={(e) => {
              const konum = e.latLng;
              if (konum) onPinSuruklendi?.(p.id, { lat: konum.lat(), lng: konum.lng() });
            }}
          />
        ))}
      </Map>
    </APIProvider>
  );
}
