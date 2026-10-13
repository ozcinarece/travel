import { Redirect, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { GirisKarti, GoogleDugmesi } from '@/components/yonetim/GirisKarti';
import { useYonetimDurumu, yonetimGiris } from '@/features/yonetim/admin';
import { GIRIS, yonetimYonu } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

// #106 KK2 (kanvas BekleyenTasarim21 ekran 1): Google ile giriş. Dönüşte oturum URL'deki koddan kurulur; admin köke,
// admin olmayan "Yetkin yok"a gider. Hata satırı kanvasta yok: dipnotun altında turuncu.
export default function YonetimGirisSayfasi() {
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState(false);
  const yon = yonetimYonu(useYonetimDurumu(), GIRIS);
  if (yon) return <Redirect href={yon as Href} />;

  const gir = async () => {
    setHata(false);
    setMesgul(true);
    try {
      await yonetimGiris();
    } catch {
      setHata(true);
      setMesgul(false);
    }
  };

  return (
    <GirisKarti baslik={ty('giris.baslik')} aciklama={ty('giris.aciklama')}>
      <GoogleDugmesi onPress={gir} yukleniyor={mesgul} />
      <Text style={s.not}>{ty('giris.not')}</Text>
      {hata ? <Text style={s.hata}>{ty('giris.hata')}</Text> : null}
    </GirisKarti>
  );
}

const s = StyleSheet.create({
  not: { fontFamily: yazi.normal, fontSize: 11.5, color: '#6e6e6e', marginTop: -6 },
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: '#ff5a1f' },
});
