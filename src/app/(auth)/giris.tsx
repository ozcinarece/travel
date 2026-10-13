import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Buton } from '@/components/ui/Buton';
import { LogoYazi } from '@/components/ui/Logo';
import { appleIleGiris, appleKullanilabilir, googleIleGiris, iptalMi } from '@/features/auth/giris';
import { t } from '@/i18n';
import { haritaGolgesi, kose, renk, yazi } from '@/theme';

type Saglayici = 'google' | 'apple';

// PRD 0.1 Karşılama + hesap → #138 (kanvas 1 · Giriş): üstte Gece "harita" (süs yollar, kesik Mandalina rota, kare duraklar,
// "Şu an seyahatte" önizleme kartı), altta beyaz sayfa: başlık, metin, Apple (Gece) / Google (çerçeveli). Profil adımı yok.
export default function GirisEkrani() {
  const [appleVar, setAppleVar] = useState(false);
  const [mesgul, setMesgul] = useState<Saglayici | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    appleKullanilabilir().then(setAppleVar);
  }, []);

  const calistir = async (saglayici: Saglayici, giris: () => Promise<void>) => {
    setHata(null);
    setMesgul(saglayici);
    try {
      await giris();
    } catch (e) {
      if (!iptalMi(e)) setHata(t('giris.hata'));
    } finally {
      setMesgul(null);
    }
  };

  return (
    <View style={s.ekran}>
      <SafeAreaView edges={['top']} style={s.ust}>
        <Svg width="100%" height="100%" viewBox="0 0 390 470" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d="M-20 300 Q120 230 210 290 T420 250" stroke="#1e3680" strokeWidth={26} fill="none" />
          <Path d="M120 -10 Q150 160 110 300 T150 480" stroke="#1e3680" strokeWidth={18} fill="none" />
          <Path d="M-10 120 L400 170" stroke="#1e3680" strokeWidth={12} fill="none" />
          <Path d="M70 360 C130 300 170 330 214 250 S300 150 318 120" stroke={renk.vurgu} strokeWidth={6} fill="none" strokeDasharray="12 8" />
        </Svg>
        <View style={s.logo}>
          <LogoYazi boyut={40} koyuZemin />
        </View>
        <OnizlemeKarti />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={s.sayfa}>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('giris.baslik')}
        </Text>
        <Text style={s.alt}>{t('giris.alt')}</Text>
        <View style={s.dugmeler}>
          {hata ? <Text style={s.hata}>{hata}</Text> : null}
          {appleVar ? <Buton baslik={t('giris.apple')} boy="buyuk" onPress={() => calistir('apple', appleIleGiris)} yukleniyor={mesgul === 'apple'} pasif={mesgul !== null && mesgul !== 'apple'} /> : null}
          <Buton
            baslik={t('giris.google')}
            tur={appleVar ? 'cerceveli' : 'birincil'}
            boy="buyuk"
            onPress={() => calistir('google', googleIleGiris)}
            yukleniyor={mesgul === 'google'}
            pasif={mesgul !== null && mesgul !== 'google'}
          />
        </View>
        <Text style={s.kosullar}>{t('giris.kosullar')}</Text>
      </SafeAreaView>
    </View>
  );
}

// Kanvastaki tanıtım kartı: sabit örnek program parçası (beyaz kart, yeşil "Şu an seyahatte", Mandalina durak).
function OnizlemeKarti() {
  return (
    <View style={k.kart}>
      <Text style={k.durum}>{t('giris.onizleme.durum')}</Text>
      <View style={k.satir}>
        <Text style={k.saat}>10:42</Text>
        <Text style={k.durak} numberOfLines={1}>
          {t('giris.onizleme.durak1')} <Text style={k.ek}>{t('giris.onizleme.sure1')}</Text>
        </Text>
      </View>
      <Text style={k.yuruyus}>{t('giris.onizleme.yuruyus')}</Text>
      <View style={k.satir}>
        <Text style={k.saat}>12:00</Text>
        <View style={k.vurgu}>
          <Text style={k.durak} numberOfLines={1}>
            {t('giris.onizleme.durak2')} <Text style={k.ekKoyu}>{t('giris.onizleme.ekleyen')}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.ana },
  ust: { flex: 1, overflow: 'hidden' },
  logo: { paddingHorizontal: 24, paddingTop: 24 },
  sayfa: { backgroundColor: renk.zemin, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 12, gap: 14 },
  baslik: { fontFamily: yazi.baslik, fontSize: 29, lineHeight: 31, letterSpacing: -0.9, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  dugmeler: { gap: 10, marginTop: 6 },
  kosullar: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 17, textAlign: 'center', color: renk.ikincil, paddingBottom: 8 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});

const k = StyleSheet.create({
  kart: { position: 'absolute', right: 30, top: '42%', width: 220, padding: 14, borderRadius: 18, backgroundColor: renk.zemin, gap: 8, ...haritaGolgesi },
  durum: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.basari },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saat: { width: 36, fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil },
  durak: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  ek: { fontFamily: yazi.yari, color: renk.ikincil },
  ekKoyu: { fontFamily: yazi.yari, color: renk.metin },
  yuruyus: { paddingLeft: 44, fontFamily: yazi.kalin, fontSize: 11, color: renk.ikincil },
  vurgu: { flexShrink: 1, height: 26, paddingHorizontal: 9, borderRadius: kose.rozet, backgroundColor: renk.vurgu, justifyContent: 'center' },
});
