import { AdvancedMarker, APIProvider, Circle, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { t } from '@/i18n';
import { renk } from '@/theme';

import { bolgeHesapla } from './geo';
import { PinIcerigi } from './PinIcerigi';
import type { HaritaOdagi, HaritaProps } from './tipler';

const anahtar = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;

function OdakGit({ odak }: { odak?: HaritaOdagi }) {
  const harita = useMap();
  useEffect(() => {
    if (!odak || !harita) return;
    harita.panTo(odak.konum);
    harita.setZoom(odak.zoom);
  }, [harita, odak]);
  return null;
}

export function Harita({ merkez, zoom = 14, pinler = [], daireler = [], odak, onPinBas, onPinSuruklendi, onBolgeDegisti }: HaritaProps) {
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
        // #17 KK1: açık tema. Özel pinler (AdvancedMarker) mapId ister; mapId'li haritada stil JSON'u uygulanmaz,
        // açıklık colorScheme ile zorlanır.
        colorScheme="LIGHT"
        mapId="GEZI_ACIK"
        disableDefaultUI
        gestureHandling="greedy"
        onIdle={(e) => {
          const b = e.map.getBounds();
          const c = e.map.getCenter();
          if (!b || !c) return;
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          onBolgeDegisti?.(bolgeHesapla({ lat: c.lat(), lng: c.lng() }, ne.lat() - sw.lat(), ne.lng() - sw.lng()));
        }}>
        <OdakGit odak={odak} />
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
        {pinler.map((p) =>
          p.tur ? (
            <AdvancedMarker
              key={p.id}
              position={p.konum}
              draggable={p.surukle}
              zIndex={p.secili || p.tur === 'otel' ? 2 : 1}
              anchorPoint={p.tur === 'oneri' || p.tur === 'aday' ? ['10%', '50%'] : ['50%', '50%']}
              onClick={() => onPinBas?.(p.id)}
              onDragEnd={(e) => {
                const konum = e.latLng;
                if (konum) onPinSuruklendi?.(p.id, { lat: konum.lat(), lng: konum.lng() });
              }}>
              <PinIcerigi pin={p} />
            </AdvancedMarker>
          ) : (
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
          ),
        )}
      </Map>
    </APIProvider>
  );
}
