import { Redirect } from 'expo-router';

/** #275 KK4: ayrı Seyahatler ekranı kalktı; eski derin bağlantı (`/seyahatler`) Profil › Gezilerim'e yönlenir. */
export default function SeyahatlerYonlendir() {
  return <Redirect href={{ pathname: '/(tabs)/profil', params: { sekme: 'gezilerim' } }} />;
}
