// #53 harita stili (tüm haritalar, cihaz temasından bağımsız): sade zemin, bina blokları kapalı, ince beyaz yollar,
// POI tamamen kapalı (mekanlar bizim pinlerimiz), şehir adı kapalı, mahalle adları açık gri.
// Hem react-native-maps `customMapStyle` hem Google Maps JS `styles` aynı biçimi alır.
// #51: YALNIZ 6 haneli renk — Android 8 haneli hex'i #AARRGGBB okur (#ffffff80 → sarımsı). Test: haritaStili.test.ts.
export const ACIK_HARITA_STILI = [
  { elementType: 'geometry', stylers: [{ color: '#f6f6f4' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#b0b0ad' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  // Yakın zoom'da koyu gri bina blokları olmasın.
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#f6f6f4' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  // Park alanı rengi kalır (etiketsiz).
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#e6efe3' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a3a3a3' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e3edf2' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9aaab0' }] },
];
