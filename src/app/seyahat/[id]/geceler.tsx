import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { AdimOteller } from '@/components/sihirbaz/AdimOteller';
import { useGunler } from '@/features/gunler/sorgular';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import { bosluk, renk, yazi } from '@/theme';

/** #139 KK7: "Geceleri ayrı seç" — gece gece otel (sihirbazdaki eski otel adımı burada; seçimler anında yazılır). */
export default function GecelerEkrani() {
  const id = useSeyahatId();
  const seyahat = useSeyahat(id);
  const gunler = useGunler(id);
  const konaklamalar = useKonaklamalar(id);
  const [hata, setHata] = useState<string | null>(null);
  return (
    <SafeAreaView style={s.ekran}>
      <EkranBasligi baslik={t('program.otelSayfa.baslik')} alt={t('program.otelSayfa.alt')} geri={() => router.back()} />
      <ScrollView contentContainerStyle={s.icerik}>
        {seyahat.data && gunler.data && konaklamalar.data ? <AdimOteller seyahat={seyahat.data} gunler={gunler.data} konaklamalar={konaklamalar.data} onHata={setHata} /> : <ActivityIndicator color={renk.ana} />}
        {hata ? <Text style={s.hata}>{hata}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { padding: bosluk.kenar, gap: 12 },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari },
});
