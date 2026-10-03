import { AdvancedMarker, APIProvider, Circle, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { t } from '@/i18n';
import { renk } from '@/theme';

import { bolgeHesapla, gizliEtiketler, pinCapasi, zoomDelta } from './geo';
import { PinIcerigi } from './PinIcerigi';
import type { HaritaBolgesi, HaritaCizgisi, HaritaOdagi, HaritaProps } from './tipler';

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

/** #33: Maps JS Polyline (kütüphanede hazır bileşen yok). */
function Cizgi({ cizgi }: { cizgi: HaritaCizgisi }) {
  const harita = useMap();
  const kutuphane = useMapsLibrary('maps');
  useEffect(() => {
    if (!harita || !kutuphane) return;
    const p = new kutuphane.Polyline({
      map: harita,
      path: cizgi.noktalar,
      strokeColor: cizgi.renk,
      strokeOpacity: cizgi.opaklik ?? 1,
      strokeWeight: 2.5,
      zIndex: 0,
    });
    return () => p.setMap(null);
  }, [harita, kutuphane, cizgi]);
  return null;
}

export function Harita({ merkez, zoom = 14, pinler = [], daireler = [], cizgiler = [], odak, onPinBas, onHaritaBas, onPinSuruklendi, onBolgeDegisti }: HaritaProps) {
  const ekran = useWindowDimensions();
  const [bolge, setBolge] = useState<HaritaBolgesi>(() => bolgeHesapla(merkez, zoomDelta(zoom), zoomDelta(zoom)));
  const gizli = useMemo(() => gizliEtiketler(pinler, bolge, { genislik: ekran.width, yukseklik: ekran.height }), [pinler, bolge, ekran.width, ekran.height]);

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
        onClick={() => onHaritaBas?.()}
        onIdle={(e) => {
          const b = e.map.getBounds();
          const c = e.map.getCenter();
          if (!b || !c) return;
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          const yeni = bolgeHesapla({ lat: c.lat(), lng: c.lng() }, ne.lat() - sw.lat(), ne.lng() - sw.lng());
          setBolge(yeni);
          onBolgeDegisti?.(yeni);
        }}>
        <OdakGit odak={odak} />
        {cizgiler.map((c) => (
          <Cizgi key={c.id} cizgi={c} />
        ))}
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
        {pinler.map((p) => {
          const capa = p.tur === 'aday' ? ['10%', '50%'] : p.tur === 'otel' ? ['50%', '50%'] : (({ x, y }) => [`${x * 100}%`, `${y * 100}%`])(pinCapasi(p));
          return p.tur ? (
            <AdvancedMarker
              key={p.id}
              position={p.konum}
              draggable={p.surukle}
              zIndex={p.secili ? 3 : p.tur === 'otel' ? 2 : 1}
              anchorPoint={capa as [string, string]}
              onClick={() => onPinBas?.(p.id)}
              onDragEnd={(e) => {
                const konum = e.latLng;
                if (konum) onPinSuruklendi?.(p.id, { lat: konum.lat(), lng: konum.lng() });
              }}>
              <PinIcerigi pin={p} etiketGizli={gizli.has(p.id)} />
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
          );
        })}
      </Map>
    </APIProvider>
  );
}
