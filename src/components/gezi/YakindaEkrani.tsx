// #181 KK3: Harcama ve Sohbet sekmeleri, C (#183) ve D (#184) gelene kadar "Yakında" boş durumu gösterir. Üstte (kanvas 25 · 26
// gibi) "‹ {seyahat adı}" → Gezi sayfası.
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeriHapi } from '@/components/harita/HaritaEkrani';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { geziyeGit } from '@/features/gezi/gezinti';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

export function YakindaEkrani({ baslik, ikon, metin }: { baslik: string; ikon: IkonAdi; metin: string }) {
  const id = useSeyahatId();
  const seyahat = useSeyahat(id);
  const kenar = useSafeAreaInsets();
  if (!id || !seyahat.data) return <SeyahatYukleme sorgular={[seyahat]} kimlikYok={!id} />;
  return (
    <View style={[s.ekran, { paddingTop: kenar.top + 12 }]}>
      <View style={{ alignSelf: 'flex-start' }}>
        <GeriHapi baslik={seyahatAdi(seyahat.data)} onPress={() => geziyeGit(id)} duz />
      </View>
      <Text accessibilityRole="header" style={s.baslik}>
        {baslik}
      </Text>
      <View style={s.bos}>
        <View style={s.ikon}>
          <Ikon ad={ikon} boyut={28} renk={renk.ana} kalinlik={2.2} />
        </View>
        <Text style={s.yakinda}>{t('seyahatMenusu.yakinda')}</Text>
        <Text style={s.metin}>{metin}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.haritaZemin, paddingHorizontal: 20, gap: 12 },
  baslik: { fontFamily: yazi.baslik, fontSize: 28, letterSpacing: -0.84, color: renk.metin },
  bos: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  ikon: { width: 64, height: 64, borderRadius: 20, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  yakinda: { fontFamily: yazi.baslik, fontSize: 20, color: renk.metin },
  metin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 22, color: renk.ikincil, textAlign: 'center', maxWidth: 300 },
});
