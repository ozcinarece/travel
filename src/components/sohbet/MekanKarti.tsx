// #184 KK2 (kanvas 26): mekan kartı mesajı — fotoğraf, ad, "Yemek · ★ 4,5 · 1. güne 9 dk", "Listeye" (Mandalina) ya da "Listede".
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FotoKutusu } from '@/components/gezi/GeziParcalari';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Props = {
  ad: string;
  /** "Yemek · ★ 4,5 · 1. güne 9 dk" */
  alt: string;
  tip: string | null;
  foto: string | null;
  listede: boolean;
  ekleniyor?: boolean;
  onListeye: () => void;
};

export function MekanKarti({ ad, alt, tip, foto, listede, ekleniyor, onListeye }: Props) {
  return (
    <View style={s.kart}>
      <FotoKutusu uri={foto} tip={tip} boyut={44} kose={11} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.ad} numberOfLines={1}>
          {ad}
        </Text>
        <Text style={s.alt} numberOfLines={1}>
          {alt}
        </Text>
      </View>
      {listede ? (
        <View style={[s.dugme, { backgroundColor: renk.basariZemin }]}>
          <Ikon ad="tik" boyut={14} renk={renk.basariMetin} kalinlik={2.4} />
          <Text style={[s.dugmeMetin, { color: renk.basariMetin }]}>{t('sohbet.listede')}</Text>
        </View>
      ) : (
        <Pressable accessibilityRole="button" disabled={ekleniyor} onPress={onListeye} style={({ pressed }) => [s.dugme, { backgroundColor: renk.vurgu }, (pressed || ekleniyor) && { opacity: 0.8 }]}>
          <Ikon ad="arti" boyut={14} renk={renk.metin} kalinlik={2.6} />
          <Text style={s.dugmeMetin}>{t('sohbet.listeye')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kart: { width: 260, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14, backgroundColor: renk.zemin, borderWidth: 1.5, borderColor: renk.ayrac },
  ad: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  dugme: { height: 34, paddingHorizontal: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.metin },
});
