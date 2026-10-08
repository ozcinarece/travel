import { AdvancedMarker, APIProvider, Circle, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { t } from '@/i18n';
import { renk } from '@/theme';

import { bolgeHesapla, detayGoster, etiketBolgesi, pinCapasi, pinSecimi, zoomDelta } from './geo';
import { pinZ } from './Harita.native';
import { PinIcerigi } from './PinIcerigi';
import { bacakEtiketPinleri } from './rota';
import type { HaritaBolgesi, HaritaCizgisi, HaritaOdagi, HaritaProps, HaritaSigdirma } from './tipler';

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

/** #55 §A5: noktaları sığdır (fitBounds, kenar boşluklarıyla). */
function SigdirGit({ sigdir }: { sigdir?: HaritaSigdirma }) {
  const harita = useMap();
  useEffect(() => {
    if (!sigdir || !harita || sigdir.noktalar.length === 0) return;
    if (sigdir.noktalar.length === 1) {
      harita.panTo(sigdir.noktalar[0]);
      harita.setZoom(15);
      return;
    }
    const lat = sigdir.noktalar.map((n) => n.lat);
    const lng = sigdir.noktalar.map((n) => n.lng);
    harita.fitBounds(
      { south: Math.min(...lat), north: Math.max(...lat), west: Math.min(...lng), east: Math.max(...lng) },
      { top: sigdir.ust, bottom: sigdir.alt, left: 48, right: 48 },
    );
  }, [harita, sigdir]);
  return null;
}

/**
 * #33: Maps JS Polyline (kütüphanede hazır bileşen yok). #59 §C: seçili gün üç katman (gölge 11 · beyaz 9 · renk 5,5),
 * yürüyüş bacağında beyaz yön okları (FORWARD_OPEN_ARROW, ~45 px), taksi bacağı noktalı; diğer günler 3 px ince.
 */
function Cizgi({ cizgi }: { cizgi: HaritaCizgisi }) {
  const harita = useMap();
  const kutuphane = useMapsLibrary('maps');
  useEffect(() => {
    if (!harita || !kutuphane) return;
    const opaklik = cizgi.opaklik ?? 1;
    const nokta = (renk: string, scale: number) => ({ icon: { path: kutuphane.SymbolPath.CIRCLE, strokeOpacity: 0, fillOpacity: opaklik, fillColor: renk, scale }, offset: '0', repeat: '11px' });
    // Yalnız renk katmanı noktalı (gölge ve beyaz kenar düz); oklar yürüyüş bacağında.
    const katman = (renk: string, kalinlik: number, zIndex: number, secenek: { noktali?: boolean; oklar?: boolean; opaklik?: number }) =>
      new kutuphane.Polyline({
        map: harita,
        path: cizgi.noktalar,
        strokeColor: renk,
        strokeOpacity: secenek.noktali ? 0 : (secenek.opaklik ?? opaklik),
        strokeWeight: kalinlik,
        zIndex,
        icons: secenek.noktali
          ? [nokta(renk, kalinlik / 2)]
          : secenek.oklar
            ? [{ icon: { path: kutuphane.SymbolPath.FORWARD_OPEN_ARROW, strokeColor: '#ffffff', strokeWeight: 2, scale: 2.2 }, offset: '22px', repeat: '45px' }]
            : undefined,
      });
    const katmanlar = cizgi.ince
      ? [katman(cizgi.renk, 3, 0, { noktali: cizgi.kesik })]
      : [
          katman('#0f0f0f', 11, 1, { opaklik: 0.12 * opaklik }),
          katman('#ffffff', 9, 2, {}),
          katman(cizgi.renk, 5.5, 3, { noktali: cizgi.kesik, oklar: !cizgi.kesik && opaklik >= 0.5 }),
        ];
    return () => katmanlar.forEach((k) => k.setMap(null));
  }, [harita, kutuphane, cizgi]);
  return null;
}

// Web'de `altBosluk` yok sayılır (Maps JS logosu konumlanmaz; panel web'de ikincil); uzun basma yok.
export function Harita({ merkez, zoom = 14, pinler = [], daireler = [], cizgiler = [], odak, onPinBas, onHaritaBas, onPinSuruklendi, onBolgeDegisti, ustBosluk = 0, sigdir }: HaritaProps) {
  const ekran = useWindowDimensions();
  const [bolge, setBolge] = useState<HaritaBolgesi>(() => bolgeHesapla(merkez, zoomDelta(zoom), zoomDelta(zoom)));
  const tumPinler = useMemo(() => [...pinler, ...bacakEtiketPinleri(cizgiler)], [pinler, cizgiler]);
  const olcu = useMemo(() => ({ genislik: ekran.width, yukseklik: ekran.height }), [ekran.width, ekran.height]);
  // #59 §A: kümeleme yok. #59 §B: etiket hesabı yalnız zoom adımında yenilenir.
  const [etiketBolge, setEtiketBolge] = useState<HaritaBolgesi>(bolge);
  const secim = useMemo(() => pinSecimi(tumPinler, etiketBolge, olcu, ustBosluk), [tumPinler, etiketBolge, olcu, ustBosluk]);
  const gizli = secim.gizli;
  const gorunen = useMemo(() => secim.pinler.filter((p) => !(p.tur === 'etiket' && gizli.etiket.has(p.id))), [secim, gizli]);

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
          const yeni = bolgeHesapla({ lat: c.lat(), lng: c.lng() }, ne.lat() - sw.lat(), ne.lng() - sw.lng(), e.map.getZoom() ?? undefined);
          setBolge(yeni);
          setEtiketBolge((onceki) => etiketBolgesi(onceki, yeni));
          onBolgeDegisti?.(yeni);
        }}>
        <OdakGit odak={odak} />
        <SigdirGit sigdir={sigdir} />
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
        {gorunen.map((p) => {
          const detay = detayGoster(p, etiketBolge.zoom) && !gizli.detay.has(p.id);
          const bacak = p.tur === 'etiket' || p.tur === 'konum';
          const capa =
            p.tur === 'aday' ? ['10%', '50%'] : p.tur === 'otel' || bacak ? ['50%', '50%'] : (({ x, y }) => [`${x * 100}%`, `${y * 100}%`])(pinCapasi(p, detay));
          return p.tur ? (
            <AdvancedMarker
              key={p.id}
              position={p.konum}
              draggable={p.surukle}
              zIndex={pinZ(p)}
              anchorPoint={capa as [string, string]}
              clickable={!bacak}
              onClick={() => {
                if (!bacak) onPinBas?.(p.id);
              }}
              onDragEnd={(e) => {
                const konum = e.latLng;
                if (konum) onPinSuruklendi?.(p.id, { lat: konum.lat(), lng: konum.lng() });
              }}>
              <View style={{ opacity: p.opaklik ?? 1 }}>
                <PinIcerigi pin={p} etiketGizli={gizli.etiket.has(p.id)} detay={detay} />
              </View>
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
