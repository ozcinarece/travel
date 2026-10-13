import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeriHapi } from '@/components/harita/HaritaEkrani';
import { SehirRehberi } from '@/components/icerik/SehirRehberi';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { Buton } from '@/components/ui/Buton';
import { sehirEslestir, useSehirler } from '@/features/icerik/sorgular';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { bosluk, olcek, renk, yazi } from '@/theme';

/**
 * #141 KK1: seyahat içi Rehber sekmesi — seyahatin şehri yayınlı rehberle eşleşiyorsa şehir rehberi (#100); yoksa boş hal.
 * Geri → ana sayfa. Bölüm çipleri ve okuma ilerlemesi #142'de.
 */
export default function RehberSekmesi() {
  const id = useSeyahatId();
  const seyahat = useSeyahat(id);
  const sehirler = useSehirler();
  const kenar = useSafeAreaInsets();
  if (!id || !seyahat.data) return <SeyahatYukleme sorgular={[seyahat]} kimlikYok={!id} />;
  const sehir = sehirEslestir(sehirler.data, { ad: seyahat.data.city_label, lat: seyahat.data.lat, lng: seyahat.data.lng });
  const anaSayfa = () => router.navigate('/(tabs)');
  if (!sehirler.isPending && !sehir) {
    return (
      <View style={[s.ekran, { paddingTop: kenar.top + 12 }]}>
        <GeriHapi baslik={seyahatAdi(seyahat.data)} onPress={anaSayfa} />
        <View style={s.bos}>
          <Text style={s.baslik}>{t('seyahatMenusu.rehberYok', { sehir: seyahat.data.city_label })}</Text>
          <Text style={s.metin}>{t('seyahatMenusu.rehberYokAlt')}</Text>
          <Buton baslik={t('seyahatMenusu.kesfeteGit')} tur="ikincil" onPress={() => router.navigate({ pathname: '/seyahat/[id]/(sekmeler)/kesfet', params: { id } })} />
        </View>
      </View>
    );
  }
  return <SehirRehberi sehir={sehir} sehirlerYukleniyor={sehirler.isPending} onGeri={anaSayfa} />;
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin, paddingHorizontal: bosluk.kenar },
  bos: { flex: 1, justifyContent: 'center', gap: 10, paddingBottom: 60 },
  baslik: { fontFamily: yazi.baslik, fontSize: olcek.bolum + 2, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil, marginBottom: 6 },
});
