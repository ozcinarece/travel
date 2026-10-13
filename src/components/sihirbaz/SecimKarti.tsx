// #139 KK4 (kanvas 7): kompakt mekan kartı — foto 56, ad, "Kategori · süre · ★ puan", EkleDugmesi. Odaktaki kart Mandalina kenar
// + açık turuncu zemin (haritada Mandalina pin). Karta dokunma: odak + mekan paneli (#121).
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import type { OnerilenMekan } from '@/features/sihirbaz/onerilenler';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { renk, yazi } from '@/theme';

type Props = { mekan: OnerilenMekan; listede: boolean; mesgul?: boolean; odak?: boolean; onEkle: () => void; onCikar: () => void; onAc: () => void };

export function SecimKarti({ mekan, listede, mesgul, odak, onEkle, onCikar, onAc }: Props) {
  const puan = puanMetni(mekan.puan);
  const meta = [kategoriEtiketi(mekan.primary_type), sureMetni(mekan.dakika), puan ? `★ ${puan}` : null].filter(Boolean).join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={mekan.ad} onPress={onAc} style={({ pressed }) => [s.kart, odak && s.odak, pressed && { opacity: 0.9 }]}>
      <View style={[s.foto, { backgroundColor: kategoriPini(mekan.primary_type).kategoriRenk }]}>{mekan.foto_uri ? <Image source={{ uri: mekan.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={s.ad} numberOfLines={1}>
          {mekan.ad}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <EkleDugmesi listede={listede} mesgul={mesgul} onPress={listede ? onCikar : onEkle} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  kart: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  odak: { borderWidth: 2, borderColor: renk.vurgu, backgroundColor: '#fff4ec' },
  foto: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden' },
  ad: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
});
