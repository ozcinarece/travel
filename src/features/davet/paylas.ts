// #137 KK5: "Davet linkini gönder" — ilk kez basıldığında profil onayı alt sayfası, sonra sistem paylaşım sayfası.
// Web'de navigator.share; yoksa link panoya kopyalanır. Olay: davet_paylasildi (#110 sayacı).
import { useState } from 'react';
import { Platform, Share } from 'react-native';

import { olayYaz } from '@/features/icerik/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { davetLinki } from '@/lib/davetLinki';

import { profilOnayiVerildiMi, profilOnayiniYaz } from './sorgular';

type SeyahatOzeti = { id: string; invite_token: string; name?: string | null; city_label: string };

export async function davetiPaylas(seyahat: SeyahatOzeti): Promise<'paylasildi' | 'kopyalandi' | 'vazgecildi'> {
  const link = davetLinki(seyahat.invite_token);
  const metin = t('sihirbaz.kimlerle.paylasMetin', { ad: seyahatAdi(seyahat), link });
  let sonuc: 'paylasildi' | 'kopyalandi' | 'vazgecildi' = 'vazgecildi';
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ text: metin });
        sonuc = 'paylasildi';
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(link);
        sonuc = 'kopyalandi';
      }
    } else {
      const r = await Share.share({ message: metin });
      sonuc = r.action === Share.dismissedAction ? 'vazgecildi' : 'paylasildi';
    }
  } catch {
    sonuc = 'vazgecildi';
  }
  if (sonuc !== 'vazgecildi') olayYaz('davet_paylasildi', seyahat.id, { kanal: Platform.OS === 'web' ? 'web' : 'app' });
  return sonuc;
}

export function useDavetPaylas(seyahat: SeyahatOzeti, onSonuc?: (s: 'paylasildi' | 'kopyalandi' | 'vazgecildi') => void) {
  const [onayAcik, setOnayAcik] = useState(false);
  const gonder = async () => onSonuc?.(await davetiPaylas(seyahat));
  const paylas = async () => {
    if (await profilOnayiVerildiMi()) return gonder();
    setOnayAcik(true);
  };
  const onayla = async () => {
    setOnayAcik(false);
    await profilOnayiniYaz();
    await gonder();
  };
  return { paylas, onayAcik, onayKapat: () => setOnayAcik(false), onayla };
}
