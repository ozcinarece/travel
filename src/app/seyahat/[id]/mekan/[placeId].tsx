import { Redirect, useLocalSearchParams } from 'expo-router';

// #80 KK12: mekan detay SAYFASI kalktı — eski derin link Keşfet'e yönlenir, mekan panelde açılır (`mekan` parametresi).
export default function MekanYonlendirme() {
  const { id, placeId } = useLocalSearchParams<{ id: string; placeId: string }>();
  return <Redirect href={{ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id, mekan: placeId } }} />;
}
