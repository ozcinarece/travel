import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DavetLinkAlani } from '@/components/DavetLinkAlani';
import { EkranBasligi } from '@/components/EkranBasligi';
import { Cip } from '@/components/ui/Cip';
import { useProfilGuncelle } from '@/features/profil/sorgular';
import { t } from '@/i18n';
import type { SonrakiSeyahat } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

// Kanvastaki üç çip; 'daha_sonra' değeri v2 için saklı.
const PENCERELER: SonrakiSeyahat[] = ['bu_ay', 'uc_ay', 'bilmiyorum'];

// PRD 0.3 İlk seyahat yönlendirmesi. KK1 iki kapı ("haritayı doldur" v1'de gizli), KK2 cevap kaydı, KK3 atlanabilir.
export default function IlkSeyahatEkrani() {
  const guncelle = useProfilGuncelle();
  const [pencere, setPencere] = useState<SonrakiSeyahat | null>(null);
  const [davetAcik, setDavetAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // Hangi kapıdan çıkılırsa çıkılsın (atlama dahil) cevap ve damga yazılır; bir daha gösterilmez.
  const bitir = async (hedef: Href) => {
    setHata(null);
    try {
      await guncelle.mutateAsync({ next_trip_window: pencere, onboarding_done_at: new Date().toISOString() });
      router.replace(hedef);
    } catch {
      setHata(t('ilkSeyahat.hata'));
    }
  };

  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={t('ilkSeyahat.baslik')} alt={t('ilkSeyahat.alt')} />

      <View style={s.kapilar}>
        <Kapi
          koyu
          baslik={t('ilkSeyahat.yeni')}
          alt={t('ilkSeyahat.yeniAlt')}
          isaret="+"
          pasif={guncelle.isPending}
          onPress={() => bitir('/(tabs)/yeni')}
        />
        <Kapi
          baslik={t('ilkSeyahat.davet')}
          alt={t('ilkSeyahat.davetAlt')}
          isaret="⌁"
          pasif={guncelle.isPending}
          onPress={() => setDavetAcik((a) => !a)}
        />
        {davetAcik ? (
          <DavetLinkAlani onToken={(token) => bitir({ pathname: '/r/[token]', params: { token } })} />
        ) : null}
      </View>

      <View style={s.soru}>
        <Text style={s.soruBaslik}>{t('ilkSeyahat.soru')}</Text>
        <View style={s.cipler}>
          {PENCERELER.map((p) => (
            <Cip key={p} baslik={t(`ilkSeyahat.pencere.${p}`)} secili={pencere === p} onPress={() => setPencere(p)} />
          ))}
        </View>
        <Text style={s.not}>{t('ilkSeyahat.not')}</Text>
      </View>

      <View style={s.altKisim}>
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={guncelle.isPending}
          onPress={() => bitir('/(tabs)')}
          hitSlop={10}>
          <Text style={s.atla}>{t('ilkSeyahat.atla')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type KapiProps = { baslik: string; alt: string; isaret: string; koyu?: boolean; pasif?: boolean; onPress: () => void };

function Kapi({ baslik, alt, isaret, koyu, pasif, onPress }: KapiProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={pasif}
      onPress={onPress}
      style={({ pressed }) => [k.kap, koyu ? k.koyu : k.acik, pressed && { opacity: 0.85 }]}>
      <View style={[k.ikon, koyu ? k.ikonKoyu : k.ikonAcik]}>
        <Text style={[k.ikonIsaret, { color: koyu ? renk.zemin : renk.metin }]}>{isaret}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[k.baslik, { color: koyu ? renk.zemin : renk.metin }]}>{baslik}</Text>
        <Text style={[k.alt, { color: koyu ? '#a3a3a3' : renk.ikincil }]}>{alt}</Text>
      </View>
      <Text style={k.ok}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  kapilar: { paddingHorizontal: bosluk.kenar, paddingTop: 22, gap: 10 },
  soru: { paddingHorizontal: bosluk.kenar, paddingTop: 22, gap: 8 },
  soruBaslik: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  cipler: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  not: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  altKisim: { marginTop: 'auto', paddingHorizontal: bosluk.kenar, paddingBottom: 24, gap: 10, alignItems: 'center' },
  atla: { fontFamily: yazi.kalin, fontSize: 13, color: renk.ikincil, paddingVertical: 8 },
  hata: { fontFamily: yazi.yari, fontSize: 12, textAlign: 'center', color: renk.uyari },
});

const k = StyleSheet.create({
  kap: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18 },
  koyu: { backgroundColor: renk.metin },
  acik: { backgroundColor: renk.yuzey },
  ikon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ikonKoyu: { backgroundColor: '#2a2a2a' },
  ikonAcik: { backgroundColor: renk.zemin },
  ikonIsaret: { fontFamily: yazi.kalin, fontSize: 20, lineHeight: 24 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 15 },
  alt: { fontFamily: yazi.normal, fontSize: 12 },
  ok: { fontFamily: yazi.kalin, fontSize: 22, lineHeight: 24, color: '#c4c4c4' },
});
