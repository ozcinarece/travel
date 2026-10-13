import { Redirect, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { GirisKarti } from '@/components/yonetim/GirisKarti';
import { Hap } from '@/components/yonetim/Hap';
import { yRenk } from '@/components/yonetim/tema';
import { useYonetimDurumu, yonetimCikis, yonetimGiris } from '@/features/yonetim/admin';
import { YETKIN_YOK, yonetimYonu } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';
import { useOturum } from '@/lib/oturum';
import { yazi } from '@/theme';

// #106 KK2 (kanvas BekleyenTasarim21 ekran 2): e-posta `admin_kullanicilar`da değil — turuncu kilit kutusu, e-posta kalın,
// "Başka hesapla gir" (çıkış + Google hesap seçimi) ve "Çıkış".
export default function YetkinYokSayfasi() {
  const { session } = useOturum();
  const yon = yonetimYonu(useYonetimDurumu(), YETKIN_YOK);
  if (yon) return <Redirect href={yon as Href} />;
  const eposta = session?.user.email ?? '';
  const baskaHesap = async () => {
    await yonetimCikis();
    await yonetimGiris({ hesapSec: true });
  };
  return (
    <GirisKarti
      ust={
        <View style={s.kilit}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={yRenk.vurgu} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Rect x="5" y="11" width="14" height="9" rx="2" />
            <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </Svg>
        </View>
      }
      baslik={ty('yetkinYok.baslik')}
      aciklama={
        <>
          <Text style={s.eposta}>{eposta}</Text>
          {` ${ty('yetkinYok.aciklama')}`}
        </>
      }>
      <View style={s.eylemler}>
        <Hap tur="birincil" baslik={ty('yetkinYok.baskaHesap')} onPress={() => void baskaHesap()} />
        <Hap baslik={ty('yetkinYok.cikis')} onPress={() => void yonetimCikis()} />
      </View>
    </GirisKarti>
  );
}

const s = StyleSheet.create({
  kilit: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff1e8', alignItems: 'center', justifyContent: 'center' },
  eposta: { fontFamily: yazi.kalin, color: yRenk.metin },
  eylemler: { flexDirection: 'row', gap: 8 },
});
