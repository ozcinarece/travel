// #17 KK1: harita her zaman açık tema. Hafif gri özel stil: POI etiketleri sade, yollar açık gri.
// Hem react-native-maps `customMapStyle` hem Google Maps JS `styles` aynı biçimi alır.
export const ACIK_HARITA_STILI = [
  { elementType: 'geometry', stylers: [{ color: '#f4f4f2' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6e6e6e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  // #47 D13: Google POI etiketleri tamamen kapalı (attraction dahil — mekanlar bizim pinlerimiz); şehir adı kapalı,
  // mahalle adları %50 saydam (bizim etiketlerle çakışmasın).
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#6e6e6e80' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff80' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e3e9e2' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e6e6e3' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#eeeeeb' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dfe7ea' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8a9aa0' }] },
];
