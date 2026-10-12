// #98 KK5 · 4. adım "Kimlerle?": davet linki kartı (paylaş / kopyala; PRD 3.10 token) + arkadaş listesi (v1 boş durum, #52).
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Ikon } from '@/components/ui/Ikon';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { davetLinki } from '@/lib/davetLinki';
import type { Seyahat } from '@/lib/tipler';
import { minDokunma, renk, yazi } from '@/theme';

export function AdimDavet({ seyahat }: { seyahat: Seyahat }) {
  const link = davetLinki(seyahat.invite_token);
  // #115/#117: "Kopyala" (expo-clipboard) bir sonraki EAS build'e kadar yok — tek düğme "Linki paylaş"; link metni seçilebilir.
  const paylas = () => Share.share({ message: t('sihirbaz.kimlerle.paylasMetin', { ad: seyahatAdi(seyahat), link }) }).catch(() => {});
  return (
    <View style={s.kap}>
      <View style={s.kart}>
        <Text style={s.kartBaslik}>{t('sihirbaz.kimlerle.linkBaslik')}</Text>
        <Text style={s.link} numberOfLines={1} selectable>
          {link.replace(/^https?:\/\//, '')}
        </Text>
        <View style={s.dugmeler}>
          <Pressable accessibilityRole="button" onPress={paylas} style={[s.dugme, s.dugmeKoyu]}>
            <Text style={[s.dugmeMetin, { color: renk.zemin }]}>{t('sihirbaz.kimlerle.paylas')}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={s.bolum}>{t('sihirbaz.kimlerle.arkadaslar')}</Text>
      <View style={s.bos}>
        <View style={s.bosIkon}>
          <Ikon ad="grup" boyut={20} renk={renk.ikincil} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.bosBaslik}>{t('sihirbaz.kimlerle.arkadasYok')}</Text>
          <Text style={s.bosAlt}>{t('sihirbaz.kimlerle.arkadasNot')}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  kart: { padding: 16, borderRadius: 18, backgroundColor: renk.yuzey, gap: 8 },
  kartBaslik: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  link: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  dugmeler: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  dugme: { flex: 1, height: minDokunma, borderRadius: 999, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  dugmeKoyu: { backgroundColor: renk.metin },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  bolum: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  bos: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c4c4c4' },
  bosIkon: { width: 40, height: 40, borderRadius: 20, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  bosBaslik: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  bosAlt: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 15, color: renk.ikincil },
});
