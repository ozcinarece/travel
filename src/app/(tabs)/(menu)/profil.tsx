import { ProfilV12 } from '@/components/profil/ProfilV12';
import { useOturum } from '@/lib/oturum';

/**
 * #578 KK1 (kanvas `Profil_v12_Kendi`): kendi profilin. Bugün Profil sekmesinden açılır; ana sayfa v9 (#569, PR #592)
 * birleşince sağ üstteki yuvarlak aynı rotayı (`/(tabs)/profil`) açar. Ayarlar "Düzenle"de (`/ayarlar`).
 */
export default function ProfilEkrani() {
  const { session } = useOturum();
  const uid = session?.user.id;
  return uid ? <ProfilV12 kisi={uid} /> : null;
}
