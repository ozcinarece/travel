import { useLocalSearchParams } from 'expo-router';

import { ProfilV12 } from '@/components/profil/ProfilV12';

/**
 * #578 KK1 (kanvas `Profil_v12_Arkadas`): birlikte gezdiğin kişinin profili. Arkadaşlar sekmesindeki yüzlerden ve gezi ile
 * sohbetteki yüzlerin açtığı grup penceresinden açılır. Sunucu birlikte gezmediğin kişi için profil döndürmez.
 */
export default function KisiProfiliEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <ProfilV12 kisi={id} /> : null;
}
