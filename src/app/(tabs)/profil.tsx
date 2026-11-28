import { ProfilV12 } from '@/components/profil/ProfilV12';
import { useOturum } from '@/lib/oturum';

/**
 * #578 KK1 (kanvas `Profil_v12_Kendi`): kendi profilin; ana sayfanın sağ üstündeki yuvarlak ve seyahatteki grup penceresi
 * `/(tabs)/profil`'i açar. Ayarlar "Düzenle"de (`/ayarlar`). #624 KK1: sekme değil, `(tabs)` yığınında; alt menü yok.
 */
export default function ProfilEkrani() {
  const { session } = useOturum();
  const uid = session?.user.id;
  return uid ? <ProfilV12 kisi={uid} /> : null;
}
