// #97 A KK5–7 (kanvas Home13): gezilecek yer karosu — foto mozaiği (150/190 px dönüşümlü), ad + şehir + ★ puan · yorum,
// sağ üstte EkleDugmesi (38 px; listede ise ✓, dokununca çıkarır). Foto yoksa kategori renginde düz zemin.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import { kategoriPini, yorumKisa } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { renk, yazi } from '@/theme';

type Props = {
  ad: string;
  sehir: string | null;
  kategori: string | null;
  fotoUri: string | null;
  puan: number | null;
  yorum: number | null;
  yukseklik: 150 | 190;
  listede: boolean;
  mesgul?: boolean;
  onEkle: () => void;
  /** ✓'ye dokununca listeden çıkar (#136 Temel: tek EkleDugmesi davranışı). */
  onCikar?: () => void;
  onAc: () => void;
};

export function YerKarosu({ ad, sehir, kategori, fotoUri, puan, yorum, yukseklik, listede, mesgul, onEkle, onCikar, onAc }: Props) {
  const p = puanMetni(puan);
  const y = yorumKisa(yorum);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={ad} onPress={onAc} style={({ pressed }) => [s.karo, { height: yukseklik, backgroundColor: kategoriPini(kategori).kategoriRenk }, pressed && { opacity: 0.9 }]}>
      {fotoUri ? <Image source={{ uri: fotoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <View style={s.golgelik} />
      <View style={s.arti}>
        <EkleDugmesi listede={listede} mesgul={mesgul} pasif={listede && !onCikar} onPress={listede ? (onCikar ?? onEkle) : onEkle} />
      </View>
      <View style={s.metinler}>
        <Text style={s.ad} numberOfLines={2}>
          {ad}
        </Text>
        <Text style={s.alt} numberOfLines={1}>
          {[sehir, p ? `★ ${p}${y ? ` · ${y}` : ''}` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  karo: { borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  golgelik: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,15,15,0.22)' },
  arti: { position: 'absolute', right: 10, top: 10 },
  metinler: { padding: 12, gap: 2 },
  ad: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 18, color: renk.zemin },
  alt: { fontFamily: yazi.normal, fontSize: 11, color: 'rgba(255,255,255,0.85)' },
});
