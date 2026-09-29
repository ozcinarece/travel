import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Buton } from '@/components/ui/Buton';
import { appleIleGiris, appleKullanilabilir, googleIleGiris, iptalMi } from '@/features/auth/giris';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Saglayici = 'google' | 'apple';

// PRD 0.1 Karşılama + hesap. KK1: Apple ve Google (Apple bayrakla kapalı, bkz. features/auth/giris.ts).
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
    <SafeAreaView style={s.ekran}>
      <View style={s.ust}>
        <View style={s.logo}>
          <Text style={s.logoIsaret}>▭</Text>
        </View>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('giris.baslik')}
        </Text>
        <Text style={s.alt}>{t('giris.alt')}</Text>
      </View>

      <OnizlemeKarti />

      <View style={s.altKisim}>
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        {appleVar ? (
          <Buton
            baslik={t('giris.apple')}
            onPress={() => calistir('apple', appleIleGiris)}
            yukleniyor={mesgul === 'apple'}
            pasif={mesgul !== null && mesgul !== 'apple'}
          />
        ) : null}
        <Buton
          baslik={t('giris.google')}
          tur={appleVar ? 'ikincil' : 'birincil'}
          onPress={() => calistir('google', googleIleGiris)}
          yukleniyor={mesgul === 'google'}
          pasif={mesgul !== null && mesgul !== 'google'}
        />
        <Text style={s.kosullar}>{t('giris.kosullar')}</Text>
      </View>
    </SafeAreaView>
  );
}

// Kanvastaki tanıtım kartı: sabit örnek program parçası.
function OnizlemeKarti() {
  return (
    <View style={k.kart}>
      <Text style={k.durum}>{t('giris.onizleme.durum')}</Text>
      <View style={{ gap: 10 }}>
        <View style={k.satir}>
          <Text style={k.saat}>10:42</Text>
          <View style={k.durakAcik}>
            <Text style={k.durakAcikMetin}>
              {t('giris.onizleme.durak1')} <Text style={k.durakEk}>{t('giris.onizleme.sure1')}</Text>
            </Text>
          </View>
        </View>
        <Text style={k.yuruyus}>{t('giris.onizleme.yuruyus')}</Text>
        <View style={k.satir}>
          <Text style={k.saat}>12:00</Text>
          <View style={k.durakKoyu}>
            <Text style={k.durakKoyuMetin}>
              {t('giris.onizleme.durak2')} <Text style={k.durakEkKoyu}>{t('giris.onizleme.ekleyen')}</Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ust: { paddingHorizontal: 24, paddingTop: 26, gap: 16 },
  logo: { width: 44, height: 44, borderRadius: 14, backgroundColor: renk.metin, alignItems: 'center', justifyContent: 'center' },
  logoIsaret: { color: renk.zemin, fontSize: 20 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 38, lineHeight: 39, letterSpacing: -1.5, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil },
  altKisim: { marginTop: 'auto', paddingHorizontal: 24, paddingBottom: 16, gap: 10 },
  kosullar: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 16, textAlign: 'center', color: renk.ikincil, paddingTop: 4 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});

const k = StyleSheet.create({
  kart: {
    marginHorizontal: 24,
    marginTop: 26,
    height: 210,
    borderRadius: 22,
    backgroundColor: renk.metin,
    padding: 18,
    justifyContent: 'space-between',
  },
  durum: { fontFamily: yazi.yari, fontSize: 12, color: renk.vurgu },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saat: { width: 44, fontFamily: yazi.ekstra, fontSize: 13, color: '#a3a3a3' },
  durakAcik: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: renk.zemin },
  durakAcikMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  durakEk: { fontFamily: yazi.orta, color: renk.ikincil },
  yuruyus: { paddingLeft: 54, fontFamily: yazi.normal, fontSize: 11, color: '#a3a3a3' },
  durakKoyu: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#2a2a2a' },
  durakKoyuMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.zemin },
  durakEkKoyu: { fontFamily: yazi.orta, color: '#a3a3a3' },
});
